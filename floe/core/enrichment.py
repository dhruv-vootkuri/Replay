import json
from typing import Any, Dict


class ReplayEnrichmentProcessor:
    """
    Enriches span dictionaries with replay-specific attributes.
    
    Works on plain span dicts after export — avoids the OpenTelemetry
    restriction on setting attributes after a span has ended.
    
    Works for any framework that produces gen_ai.prompt.* attributes
    following the OpenTelemetry semantic conventions for LLM calls.
    """

    def enrich_span_dict(self, span_dict: Dict[str, Any]) -> Dict[str, Any]:
        """
        Main entry point. Enriches a span dict in place and returns it.
        """
        attrs = span_dict.get("attributes", {})

        if self._is_llm_span(attrs):
            self._enrich_llm_span(span_dict, attrs)

        if self._is_tool_span(attrs):
            self._enrich_tool_span(span_dict, attrs)

        return span_dict

    def _is_llm_span(self, attrs: Dict[str, Any]) -> bool:
        return (
            "gen_ai.input.messages" in attrs
            or "gen_ai.system_instructions" in attrs
            or any(k.startswith("gen_ai.prompt.") for k in attrs)
        )

    def _is_tool_span(self, attrs: Dict[str, Any]) -> bool:
        return (
            "gen_ai.tool.name" in attrs
            and "gen_ai.tool.call.result" in attrs
        )

    def _enrich_llm_span(
        self,
        span_dict: Dict[str, Any],
        attrs: Dict[str, Any]
    ) -> None:
        messages = self._extract_messages(attrs)
        if messages:
            span_dict["attributes"]["replay.messages_json"] = (
                json.dumps(messages)
            )

        tool_call_map = self._extract_tool_call_map(attrs)
        if tool_call_map:
            span_dict["attributes"]["replay.tool_call_map_json"] = (
                json.dumps(tool_call_map)
            )

    def _enrich_tool_span(
        self,
        span_dict: Dict[str, Any],
        attrs: Dict[str, Any]
    ) -> None:
        raw = attrs.get("gen_ai.tool.call.result", "")
        unwrapped = self._unwrap_tool_result(raw)
        span_dict["attributes"]["replay.tool_result"] = unwrapped

    def _extract_messages(self, attrs: Dict[str, Any]) -> list:
        messages = []

        # opentelemetry-instrumentation-openai 0.53.3 emits the system
        # prompt as its own gen_ai.system_instructions attribute — a JSON
        # array of {"type": "text", "content": ...} blocks — separate from
        # every other message, which itself moved from the old indexed
        # gen_ai.prompt.{i}.role/content scheme to a single gen_ai.input.
        # messages JSON array of {"role", "parts": [...]} objects. Without
        # handling both of these, replay.messages_json came out empty for
        # every LLM span captured under the currently pinned instrumentation
        # version — the system prompt (and the rest of the conversation)
        # was invisible everywhere that reads it: the explore UI's and the
        # dashboard's fork forms.
        system_instructions = attrs.get("gen_ai.system_instructions")
        if system_instructions:
            content = self._flatten_text_blocks(system_instructions)
            if content:
                messages.append({"role": "system", "content": content})

        if "gen_ai.input.messages" in attrs:
            messages.extend(self._extract_new_schema_messages(attrs["gen_ai.input.messages"]))
            return messages

        # Fallback: the older indexed gen_ai.prompt.{i}.role/content scheme,
        # for traces captured under an older instrumentation version.
        i = 0
        while f"gen_ai.prompt.{i}.role" in attrs:
            role = attrs[f"gen_ai.prompt.{i}.role"]
            content = attrs.get(f"gen_ai.prompt.{i}.content", "")

            if role == "system" and messages and messages[0]["role"] == "system":
                pass  # already added from gen_ai.system_instructions above
            elif role in ("system", "user"):
                messages.append({"role": role, "content": content})

            elif role == "assistant":
                msg: Dict[str, Any] = {
                    "role": "assistant",
                    "content": content
                }
                tool_calls = []
                j = 0
                while f"gen_ai.prompt.{i}.tool_calls.{j}.id" in attrs:
                    tool_calls.append({
                        "id": attrs[
                            f"gen_ai.prompt.{i}.tool_calls.{j}.id"
                        ],
                        "type": "function",
                        "function": {
                            "name": attrs[
                                f"gen_ai.prompt.{i}.tool_calls.{j}.name"
                            ],
                            "arguments": attrs.get(
                                f"gen_ai.prompt.{i}.tool_calls.{j}.arguments",
                                "{}"
                            )
                        }
                    })
                    j += 1
                if tool_calls:
                    msg["tool_calls"] = tool_calls
                messages.append(msg)

            elif role == "tool":
                messages.append({
                    "role": "tool",
                    "content": content,
                    "tool_call_id": attrs.get(
                        f"gen_ai.prompt.{i}.tool_call_id", ""
                    )
                })

            i += 1

        return messages

    def _flatten_text_blocks(self, raw: Any) -> str:
        """Joins a JSON array of {"type": "text", "content": ...} blocks."""
        try:
            blocks = json.loads(raw) if isinstance(raw, str) else raw
        except (json.JSONDecodeError, TypeError):
            return ""
        if not isinstance(blocks, list):
            return str(blocks) if blocks else ""
        return "\n".join(
            b.get("content", "") for b in blocks if isinstance(b, dict) and b.get("content")
        )

    def _extract_new_schema_messages(self, raw: Any) -> list:
        """
        Parses the current OTel GenAI semconv message format: a JSON array
        of {"role", "parts": [{"type": "text"|"tool_call"|
        "tool_call_response", ...}]} objects, into this module's normalized
        {"role", "content", "tool_calls"?, "tool_call_id"?} shape — the same
        shape the old gen_ai.prompt.{i}.* scheme produced, since engine.py
        and the CLI/dashboard fork forms are all built against that shape.
        """
        try:
            parsed = json.loads(raw) if isinstance(raw, str) else raw
        except (json.JSONDecodeError, TypeError):
            return []
        if not isinstance(parsed, list):
            return []

        messages = []
        for msg in parsed:
            if not isinstance(msg, dict):
                continue
            role = msg.get("role")
            parts = msg.get("parts", [])
            if not isinstance(parts, list):
                parts = []

            text_chunks = []
            tool_calls = []
            tool_call_id = ""
            for part in parts:
                if not isinstance(part, dict):
                    continue
                ptype = part.get("type")
                if ptype == "text":
                    text_chunks.append(part.get("content", ""))
                elif ptype == "tool_call":
                    arguments = part.get("arguments", {})
                    tool_calls.append({
                        "id": part.get("id", ""),
                        "type": "function",
                        "function": {
                            "name": part.get("name", ""),
                            "arguments": arguments if isinstance(arguments, str) else json.dumps(arguments),
                        },
                    })
                elif ptype == "tool_call_response":
                    text_chunks.append(str(part.get("response", "")))
                    tool_call_id = part.get("id", tool_call_id)

            entry: Dict[str, Any] = {"role": role, "content": "\n".join(text_chunks)}
            if tool_calls:
                entry["tool_calls"] = tool_calls
            if role == "tool":
                entry["tool_call_id"] = tool_call_id
            messages.append(entry)

        return messages

    def _extract_tool_call_map(
        self,
        attrs: Dict[str, Any]
    ) -> Dict[str, str]:
        tool_call_map = {}
        j = 0
        while f"gen_ai.completion.0.tool_calls.{j}.id" in attrs:
            tc_id = attrs[f"gen_ai.completion.0.tool_calls.{j}.id"]
            tc_name = attrs[f"gen_ai.completion.0.tool_calls.{j}.name"]
            tool_call_map[tc_id] = tc_name
            j += 1
        return tool_call_map

    def _unwrap_tool_result(self, raw: str) -> str:
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict) and "output" in parsed:
                content = (
                    parsed["output"]
                    .get("kwargs", {})
                    .get("content", None)
                )
                if content is not None:
                    return str(content)
        except (json.JSONDecodeError, TypeError, AttributeError):
            pass
        return raw