import copy
import json
import os
import time
import uuid
from typing import Any, Callable, Dict, Optional

from replay.core.loader import TraceLoader
from replay.core.tool_registry import get_registry


class ReplayEngine:
    """
    Forks a stored trace at a specific span and replays from that point.

    Two fundamentally different fork types:

    Tool fork  — re-run the tool with new arguments, inject the new result
                 into downstream LLM message histories, re-run those LLMs.

    LLM fork   — apply message changes then run the full agent loop:
                 LLM → tool calls → tool results → LLM → ... until a
                 final text response.  Original downstream spans are
                 discarded; the loop creates its own.
    """

    def __init__(self, traces_dir: str = "traces"):
        self.loader = TraceLoader(traces_dir)
        self.traces_dir = traces_dir
        self.registry = get_registry()

    # ------------------------------------------------------------------ #
    # Public API                                                           #
    # ------------------------------------------------------------------ #

    def replay(
        self,
        trace_id: str,
        fork_span_id: str,
        changes: Dict[str, Any],
        temperature: float = 0.0,
        on_tool_pause: Optional[Callable] = None,
    ) -> Dict[str, Any]:
        """
        Fork a trace and replay from the fork point.

        Args:
            trace_id:      ID of the trace to fork.
            fork_span_id:  ID of the span to fork at.
            changes:       Attribute overrides, e.g.
                           {"gen_ai.tool.call.arguments": "..."}
                           {"replay.messages_json": "..."}
            temperature:   Temperature for re-run LLM calls.
            on_tool_pause: Optional callback — called when a tool needs a
                           decision in a non-interactive context.
                           Signature: (tool_name, args, original_output) -> str
                           Returns "run", "skip", or "stop".
        """
        trace = self.loader.load(trace_id)
        spans_by_id = {s["span_id"]: s for s in trace["spans"]}

        if fork_span_id not in spans_by_id:
            raise ValueError(f"Span {fork_span_id!r} not found in trace {trace_id!r}")

        fork_span = spans_by_id[fork_span_id]
        replay_trace_id = str(uuid.uuid4()).replace("-", "")

        ancestors = self.loader.get_ancestors(trace_id, fork_span_id)
        cached_spans = [self._make_cached_span(s, replay_trace_id) for s in ancestors]

        if self._is_tool_span(fork_span):
            new_spans = self._fork_tool(
                fork_span, changes, trace["spans"],
                replay_trace_id, temperature, on_tool_pause,
            )
        elif self._is_llm_span(fork_span):
            new_spans = self._fork_llm(
                fork_span, changes, replay_trace_id, temperature, on_tool_pause,
            )
        else:
            raise ValueError(
                f"Span '{fork_span['name']}' is not forkable. "
                "Only LLM spans and tool spans can be forked."
            )

        result = {
            "replay_trace_id": replay_trace_id,
            "original_trace_id": trace_id,
            "fork_span_id": fork_span_id,
            "changes": changes,
            "replayed_at": time.time(),
            "spans": cached_spans + new_spans,
            "summary": self._generate_summary(fork_span, changes, len(new_spans) - 1),
        }
        self._save_replay(result)
        return result

    # ------------------------------------------------------------------ #
    # Tool fork path                                                       #
    # ------------------------------------------------------------------ #

    def _fork_tool(
        self,
        fork_span: Dict[str, Any],
        changes: Dict[str, Any],
        all_spans: list,
        replay_trace_id: str,
        temperature: float,
        on_tool_pause: Optional[Callable],
    ) -> list:
        """
        Re-runs the tool with updated arguments, injects the new result
        into downstream LLM message histories, and re-runs those LLMs.
        """
        forked_span = self._apply_fork(fork_span, changes, replay_trace_id)

        result_span = self._run_tool(forked_span, replay_trace_id, on_tool_pause)
        if result_span == "STOP":
            return [forked_span]

        new_result = result_span["attributes"].get("replay.tool_result", "")
        forked_span["attributes"]["gen_ai.tool.call.result"] = new_result
        forked_span["attributes"]["replay.tool_result"] = new_result

        tool_name = fork_span["attributes"].get("gen_ai.tool.name", "")
        tool_results = {tool_name: new_result} if tool_name else {}

        tool_call_id_map = self._build_tool_call_id_map(fork_span, all_spans)

        new_spans = [forked_span]
        for desc in self._get_descendants(fork_span["span_id"], all_spans):
            if self._is_llm_span(desc):
                replayed = self._rerun_llm(
                    desc, tool_results, tool_call_id_map, replay_trace_id, temperature
                )
                new_spans.append(replayed)
                new_map = json.loads(
                    replayed["attributes"].get("replay.tool_call_map_json", "{}")
                )
                tool_call_id_map.update(new_map)

            elif self._is_tool_span(desc):
                t_span = self._run_tool(desc, replay_trace_id, on_tool_pause)
                if t_span == "STOP":
                    break
                new_spans.append(t_span)
                t_name = desc["attributes"].get("gen_ai.tool.name", "")
                if t_name:
                    tool_results[t_name] = t_span["attributes"].get("replay.tool_result", "")

            else:
                new_spans.append(self._make_downstream_span(desc, replay_trace_id))

        return new_spans

    # ------------------------------------------------------------------ #
    # LLM fork path                                                        #
    # ------------------------------------------------------------------ #

    def _fork_llm(
        self,
        fork_span: Dict[str, Any],
        changes: Dict[str, Any],
        replay_trace_id: str,
        temperature: float,
        on_tool_pause: Optional[Callable],
    ) -> list:
        """
        Applies message changes then runs the full agent loop.
        Original downstream spans are discarded; the loop creates its own.
        """
        attrs = fork_span["attributes"]
        messages_json = attrs.get("replay.messages_json")
        messages = json.loads(messages_json) if messages_json else self._messages_from_attrs(attrs)

        # Apply requested message changes
        if "replay.messages_json" in changes:
            messages = json.loads(changes["replay.messages_json"])

        model = attrs.get("gen_ai.request.model", "gpt-3.5-turbo")
        tool_schemas = self.registry.get_all_schemas()

        # Include a forked marker so diff/display commands can show what changed
        forked_marker = self._apply_fork(fork_span, changes, replay_trace_id)
        loop_spans = self._run_agent_loop(
            messages, model, tool_schemas, temperature, replay_trace_id, on_tool_pause
        )
        return [forked_marker] + loop_spans

    def _run_agent_loop(
        self,
        messages: list,
        model: str,
        tool_schemas: list,
        temperature: float,
        replay_trace_id: str,
        on_tool_pause: Optional[Callable],
    ) -> list:
        """
        Drives the agent: calls LLM, executes tool calls, loops until a
        final text response with no tool calls.
        """
        new_spans = []
        current_messages = list(messages)

        while True:
            start = time.time()
            response = self._call_llm(
                model, current_messages, temperature,
                tools=tool_schemas if tool_schemas else None,
            )
            end = time.time()

            tool_calls = getattr(response, "tool_calls", None) or []

            new_spans.append(
                self._make_llm_span(model, current_messages, response, tool_calls, start, end, replay_trace_id)
            )

            if not tool_calls:
                break  # final text response — done

            # Add the assistant's tool-call decision to the message history
            current_messages.append({
                "role": "assistant",
                "content": response.content or "",
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments,
                        },
                    }
                    for tc in tool_calls
                ],
            })

            for tc in tool_calls:
                tool_name = tc.function.name
                try:
                    tool_args = json.loads(tc.function.arguments)
                except json.JSONDecodeError:
                    tool_args = {}

                result, t_span = self._execute_tool_for_loop(
                    tool_name, tool_args, tc.id, replay_trace_id, on_tool_pause
                )
                if t_span == "STOP":
                    return new_spans

                new_spans.append(t_span)
                current_messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": str(result),
                })

        return new_spans

    # ------------------------------------------------------------------ #
    # LLM calls                                                            #
    # ------------------------------------------------------------------ #

    def _call_llm(
        self,
        model: str,
        messages: list,
        temperature: float,
        tools: Optional[list] = None,
    ) -> Any:
        """
        Calls the LLM and returns the raw message object.
        Uses LiteLLM if installed, otherwise falls back to the OpenAI SDK.
        Raises on any failure — no silent swallowing.
        """
        kwargs: Dict[str, Any] = dict(model=model, messages=messages, temperature=temperature)
        if tools:
            kwargs["tools"] = tools

        try:
            import litellm
            return litellm.completion(**kwargs).choices[0].message
        except ImportError:
            pass

        try:
            from openai import OpenAI
        except ImportError:
            raise RuntimeError(
                "No LLM SDK found. Install one: pip install openai"
            )

        return OpenAI().chat.completions.create(**kwargs).choices[0].message

    def _rerun_llm(
        self,
        span: Dict[str, Any],
        tool_results: Dict[str, str],
        tool_call_id_map: Dict[str, str],
        replay_trace_id: str,
        temperature: float,
    ) -> Dict[str, Any]:
        """
        Re-runs a downstream LLM span with updated tool results injected
        into its stored message history.
        """
        attrs = span["attributes"]
        messages_json = attrs.get("replay.messages_json")
        messages = json.loads(messages_json) if messages_json else self._messages_from_attrs(attrs)
        messages = self._inject_tool_results(messages, tool_results, tool_call_id_map)

        model = attrs.get("gen_ai.request.model", "gpt-3.5-turbo")
        start = time.time()
        response = self._call_llm(model, messages, temperature)
        end = time.time()

        content = response.content if hasattr(response, "content") else str(response)

        replayed = copy.deepcopy(span)
        replayed["trace_id"] = replay_trace_id
        replayed["replay_type"] = "downstream"
        replayed["span_id"] = str(uuid.uuid4())[:16].replace("-", "")
        replayed["start_time"] = start * 1_000_000_000
        replayed["end_time"] = end * 1_000_000_000
        replayed["duration_ms"] = (end - start) * 1000
        replayed["status"] = "OK"
        replayed["attributes"] = {
            **attrs,
            "gen_ai.completion.0.content": content,
            "gen_ai.request.temperature": temperature,
            "replay.rerun": True,
        }
        return replayed

    # ------------------------------------------------------------------ #
    # Tool execution                                                       #
    # ------------------------------------------------------------------ #

    def _run_tool(
        self,
        span: Dict[str, Any],
        replay_trace_id: str,
        on_tool_pause: Optional[Callable],
    ) -> Any:
        """
        Handles a tool span in the tool fork path.
        Returns a result span or "STOP".
        """
        attrs = span["attributes"]
        tool_name = attrs.get("gen_ai.tool.name", "")
        tool_args = self._extract_tool_args(attrs)
        original_output = attrs.get("replay.tool_result", attrs.get("gen_ai.tool.call.result", ""))

        options = self.registry.get_available_options(tool_name)
        decision = self._decide_tool_action(tool_name, tool_args, original_output, options, on_tool_pause)

        if decision == "stop":
            return "STOP"

        if decision == "run":
            result = options["fn"](**tool_args)
            return self._make_tool_result_span(span, str(result), replay_trace_id, "ran for real")

        if decision == "alternative":
            result = options["replay_fn"](**tool_args)
            return self._make_tool_result_span(span, str(result), replay_trace_id, "alternative used")

        if decision == "provide":
            provided = input(f"\n    What should '{tool_name}' return? > ").strip()
            return self._make_tool_result_span(
                span,
                provided if provided else original_output,
                replay_trace_id,
                "engineer provided" if provided else "no output provided, used cached",
            )

        # skip — use cached
        return self._make_tool_result_span(span, original_output, replay_trace_id, "skipped, used cached")

    def _execute_tool_for_loop(
        self,
        tool_name: str,
        tool_args: Dict[str, Any],
        tool_call_id: str,
        replay_trace_id: str,
        on_tool_pause: Optional[Callable],
    ):
        """
        Executes a tool call inside the agent loop.
        Returns (result_str, span) or ("", "STOP").
        Raises if the tool is not registered and no on_tool_pause is provided.
        """
        options = self.registry.get_available_options(tool_name)
        start = time.time()

        if options["can_run_real"]:
            result = options["fn"](**tool_args)
            end = time.time()
            return str(result), self._make_agent_loop_tool_span(
                tool_name, tool_args, str(result), tool_call_id, start, end, replay_trace_id
            )

        if options["has_alternative"]:
            result = options["replay_fn"](**tool_args)
            end = time.time()
            return str(result), self._make_agent_loop_tool_span(
                tool_name, tool_args, str(result), tool_call_id, start, end, replay_trace_id
            )

        if on_tool_pause:
            decision = on_tool_pause(tool_name, tool_args, "")
            if decision == "stop":
                return "", "STOP"
            # "skip" — no original output in the loop context
            end = time.time()
            return "", self._make_agent_loop_tool_span(
                tool_name, tool_args, "", tool_call_id, start, end, replay_trace_id
            )

        raise RuntimeError(
            f"Tool '{tool_name}' is not registered. "
            "Add @replay.tool(safe=True) to enable real execution during LLM fork replay."
        )

    def _decide_tool_action(
        self,
        tool_name: str,
        tool_args: Dict[str, Any],
        original_output: str,
        options: Dict[str, Any],
        on_tool_pause: Optional[Callable],
    ) -> str:
        """Routes to the right action for a tool call."""
        preference_usable = (
            options["has_preference"]
            and not (options["preference"] == "run" and not options["can_run_real"])
            and not (options["preference"] == "alternative" and not options["has_alternative"])
        )
        if preference_usable:
            print(f"   ✓ {tool_name} — {options['preference']} (saved preference)")
            return options["preference"]

        if on_tool_pause:
            return on_tool_pause(tool_name, tool_args, original_output)

        return self._interactive_pause(tool_name, tool_args, original_output, options)

    def _interactive_pause(
        self,
        tool_name: str,
        tool_args: Dict[str, Any],
        original_output: str,
        options: Dict[str, Any],
    ) -> str:
        """Interactive CLI prompt for tool decisions."""
        print(f"\n⏸  Replay paused")
        print(f"   Tool:            {tool_name}")
        print(f"   Arguments:       {json.dumps(tool_args, indent=6)}")
        print(f"   Original output: {original_output[:100]}")
        print()

        if options["has_preference"]:
            print(f"   Last time you chose: {options['preference']} for '{tool_name}'")
            print()

        available = []
        if options["can_run_real"]:
            available.append(("run", "run the real tool"))
        if options["has_alternative"]:
            available.append(("alternative", "use your defined replay alternative"))
        available.append(("skip", "use cached output from original trace"))
        available.append(("stop", "stop replay here"))
        available.append(("provide", "manually enter what it should return"))

        if not options["can_run_real"] and not options["has_alternative"]:
            print(f"   ℹ  '{tool_name}' is not registered with @replay.tool(safe=True).")
            print()

        print("   What would you like to do?")
        for i, (key, label) in enumerate(available):
            print(f"   [{i+1}] {key:<12} — {label}")
        print()

        valid = {}
        for i, (key, _) in enumerate(available):
            valid[str(i + 1)] = key
            valid[key] = key

        while True:
            choice = input("   > ").strip().lower()
            if choice in valid:
                decision = valid[choice]
                break
            print(f"   Please enter a number between 1 and {len(available)}")

        if decision in ("run", "skip"):
            save = input(
                f"\n   Always {decision} for '{tool_name}' in future replays? [y/N] "
            ).strip().lower()
            if save == "y":
                self.registry.save_preference(tool_name, decision)
                print(f"   ✓ Saved preference for '{tool_name}'")

        print()
        return decision

    # ------------------------------------------------------------------ #
    # Message helpers                                                      #
    # ------------------------------------------------------------------ #

    def _inject_tool_results(
        self,
        messages: list,
        tool_results: Dict[str, str],
        tool_call_id_map: Dict[str, str],
    ) -> list:
        """Updates tool result messages with the current tool results."""
        if not tool_results or not tool_call_id_map:
            return messages

        updated = []
        for msg in messages:
            if msg.get("role") == "tool":
                tool_name = tool_call_id_map.get(msg.get("tool_call_id", ""), "")
                if tool_name in tool_results:
                    updated.append({**msg, "content": str(tool_results[tool_name])})
                else:
                    updated.append(msg)
            else:
                updated.append(msg)
        return updated

    def _messages_from_attrs(self, attrs: Dict[str, Any]) -> list:
        """
        Reconstructs the message list from raw gen_ai.prompt.* attributes.
        Fallback for traces captured before replay.messages_json was added.
        """
        messages = []
        i = 0
        while f"gen_ai.prompt.{i}.role" in attrs:
            role = attrs[f"gen_ai.prompt.{i}.role"]
            content = attrs.get(f"gen_ai.prompt.{i}.content", "")

            if role in ("system", "user"):
                messages.append({"role": role, "content": content})

            elif role == "assistant":
                msg: Dict[str, Any] = {"role": "assistant", "content": content}
                tool_calls = []
                j = 0
                while f"gen_ai.prompt.{i}.tool_calls.{j}.id" in attrs:
                    tool_calls.append({
                        "id": attrs[f"gen_ai.prompt.{i}.tool_calls.{j}.id"],
                        "type": "function",
                        "function": {
                            "name": attrs[f"gen_ai.prompt.{i}.tool_calls.{j}.name"],
                            "arguments": attrs.get(
                                f"gen_ai.prompt.{i}.tool_calls.{j}.arguments", "{}"
                            ),
                        },
                    })
                    j += 1
                if tool_calls:
                    msg["tool_calls"] = tool_calls
                messages.append(msg)

            elif role == "tool":
                messages.append({
                    "role": "tool",
                    "content": content,
                    "tool_call_id": attrs.get(f"gen_ai.prompt.{i}.tool_call_id", ""),
                })

            i += 1
        return messages

    # ------------------------------------------------------------------ #
    # Span factories                                                       #
    # ------------------------------------------------------------------ #

    def _make_llm_span(
        self,
        model: str,
        messages: list,
        response: Any,
        tool_calls: list,
        start: float,
        end: float,
        replay_trace_id: str,
    ) -> Dict[str, Any]:
        """Creates an LLM span for agent loop calls."""
        content = response.content if hasattr(response, "content") else str(response)
        attrs: Dict[str, Any] = {
            "gen_ai.request.model": model,
            "gen_ai.completion.0.content": content or "",
            "replay.rerun": True,
            "replay.messages_json": json.dumps(messages),
        }
        # Stamp at least one gen_ai.prompt.* so _is_llm_span recognises this span
        for i, msg in enumerate(messages):
            attrs[f"gen_ai.prompt.{i}.role"] = msg.get("role", "")
            attrs[f"gen_ai.prompt.{i}.content"] = str(msg.get("content", "") or "")

        if tool_calls:
            attrs["replay.tool_call_map_json"] = json.dumps(
                {tc.id: tc.function.name for tc in tool_calls}
            )

        return {
            "span_id": str(uuid.uuid4())[:16].replace("-", ""),
            "trace_id": replay_trace_id,
            "name": model,
            "parent_span_id": None,
            "start_time": int(start * 1_000_000_000),
            "end_time": int(end * 1_000_000_000),
            "duration_ms": (end - start) * 1000,
            "status": "OK",
            "replay_type": "downstream",
            "attributes": attrs,
        }

    def _make_agent_loop_tool_span(
        self,
        tool_name: str,
        tool_args: Dict[str, Any],
        result: str,
        tool_call_id: str,
        start: float,
        end: float,
        replay_trace_id: str,
    ) -> Dict[str, Any]:
        """Creates a tool span for agent loop calls."""
        return {
            "span_id": str(uuid.uuid4())[:16].replace("-", ""),
            "trace_id": replay_trace_id,
            "name": f"execute_tool.{tool_name}",
            "parent_span_id": None,
            "start_time": int(start * 1_000_000_000),
            "end_time": int(end * 1_000_000_000),
            "duration_ms": (end - start) * 1000,
            "status": "OK",
            "replay_type": "downstream",
            "attributes": {
                "gen_ai.tool.name": tool_name,
                "gen_ai.tool.call.arguments": json.dumps({"inputs": tool_args}),
                "gen_ai.tool.call.result": result,
                "gen_ai.tool.call.id": tool_call_id,
                "replay.tool_result": result,
                "replay.rerun": True,
            },
        }

    def _make_tool_result_span(
        self,
        original_span: Dict[str, Any],
        result: str,
        replay_trace_id: str,
        note: str = "",
    ) -> Dict[str, Any]:
        span = copy.deepcopy(original_span)
        span["trace_id"] = replay_trace_id
        span["replay_type"] = "downstream"
        span["span_id"] = str(uuid.uuid4())[:16].replace("-", "")
        span["attributes"]["gen_ai.tool.call.result"] = result
        span["attributes"]["replay.tool_result"] = result
        if note:
            span["attributes"]["replay.note"] = note
        return span

    def _make_cached_span(self, span: Dict[str, Any], replay_trace_id: str) -> Dict[str, Any]:
        s = copy.deepcopy(span)
        s["trace_id"] = replay_trace_id
        s["replay_type"] = "cached"
        return s

    def _make_downstream_span(self, span: Dict[str, Any], replay_trace_id: str) -> Dict[str, Any]:
        s = copy.deepcopy(span)
        s["trace_id"] = replay_trace_id
        s["replay_type"] = "downstream"
        s["span_id"] = str(uuid.uuid4())[:16].replace("-", "")
        return s

    def _apply_fork(
        self,
        span: Dict[str, Any],
        changes: Dict[str, Any],
        replay_trace_id: str,
    ) -> Dict[str, Any]:
        forked = copy.deepcopy(span)
        forked["trace_id"] = replay_trace_id
        forked["replay_type"] = "forked"
        forked["changes_applied"] = changes
        forked["span_id"] = str(uuid.uuid4())[:16].replace("-", "")
        for k, v in changes.items():
            forked["attributes"][k] = v
        return forked

    # ------------------------------------------------------------------ #
    # Span classification                                                  #
    # ------------------------------------------------------------------ #

    def _is_llm_span(self, span: Dict[str, Any]) -> bool:
        return any(k.startswith("gen_ai.prompt.") for k in span.get("attributes", {}))

    def _is_tool_span(self, span: Dict[str, Any]) -> bool:
        attrs = span.get("attributes", {})
        return "gen_ai.tool.name" in attrs and "gen_ai.tool.call.result" in attrs

    # ------------------------------------------------------------------ #
    # Trace helpers                                                        #
    # ------------------------------------------------------------------ #

    def _extract_tool_args(self, attrs: Dict[str, Any]) -> Dict[str, Any]:
        raw = attrs.get("gen_ai.tool.call.arguments", "{}")
        try:
            parsed = json.loads(raw)
            return parsed.get("inputs", parsed)
        except (json.JSONDecodeError, AttributeError):
            return {}

    def _build_tool_call_id_map(
        self, fork_span: Dict[str, Any], all_spans: list
    ) -> Dict[str, str]:
        """Extracts tool_call_id → tool_name from LLM spans before the fork."""
        id_map: Dict[str, str] = {}
        fork_time = fork_span["start_time"]
        for span in all_spans:
            if span["start_time"] < fork_time and self._is_llm_span(span):
                raw = span.get("attributes", {}).get("replay.tool_call_map_json", "{}")
                id_map.update(json.loads(raw))
        return id_map

    def _get_descendants(self, fork_span_id: str, all_spans: list) -> list:
        """Returns spans after the fork point that are not ancestors of it."""
        spans_by_id = {s["span_id"]: s for s in all_spans}
        fork_span = spans_by_id[fork_span_id]
        fork_time = fork_span["start_time"]

        # Walk the parent chain to collect all ancestor IDs
        ancestor_ids: set = set()
        parent_id = fork_span.get("parent_span_id")
        while parent_id:
            ancestor_ids.add(parent_id)
            parent = spans_by_id.get(parent_id)
            parent_id = parent.get("parent_span_id") if parent else None
        ancestor_ids.add(fork_span_id)

        return sorted(
            [s for s in all_spans if s["start_time"] > fork_time and s["span_id"] not in ancestor_ids],
            key=lambda s: s["start_time"],
        )

    def _generate_summary(
        self,
        fork_span: Dict[str, Any],
        changes: Dict[str, Any],
        downstream_count: int,
    ) -> str:
        readable_changes = []
        for k, v in changes.items():
            if k in ("gen_ai.tool.call.result", "replay.tool_result"):
                continue
            if k == "gen_ai.tool.call.arguments":
                try:
                    parsed = json.loads(v)
                    inner = parsed.get("inputs", parsed)
                    if isinstance(inner, dict):
                        for field, val in inner.items():
                            readable_changes.append(f"{field}='{str(val)[:30]}'")
                        continue
                except Exception:
                    pass
            if k == "replay.messages_json":
                try:
                    msgs = json.loads(v)
                    user_msgs = [m for m in msgs if m.get("role") == "user"]
                    if user_msgs:
                        readable_changes.append(f"user='{user_msgs[0]['content'][:30]}'")
                    continue
                except Exception:
                    pass
            readable_changes.append(f"{k}='{str(v)[:30]}'")

        changes_desc = ", ".join(readable_changes) if readable_changes else str(changes)
        return (
            f"Forked at '{fork_span['name']}' with changes: {changes_desc}. "
            f"{downstream_count} downstream span(s) affected."
        )

    def _save_replay(self, replay_result: Dict[str, Any]) -> None:
        filename = (
            f"{replay_result['original_trace_id']}"
            f".replay."
            f"{replay_result['replay_trace_id']}.json"
        )
        filepath = os.path.join(self.traces_dir, filename)
        with open(filepath, "w") as f:
            json.dump(replay_result, f, indent=2)
