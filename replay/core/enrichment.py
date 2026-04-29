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
        return any(k.startswith("gen_ai.prompt.") for k in attrs)

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
        i = 0

        while f"gen_ai.prompt.{i}.role" in attrs:
            role = attrs[f"gen_ai.prompt.{i}.role"]
            content = attrs.get(f"gen_ai.prompt.{i}.content", "")

            if role in ("system", "user"):
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