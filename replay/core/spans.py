"""
Shared span classification and extraction helpers.

The CLI, the web server, the replay log and the pressure suite all need to
answer the same questions about a span dict — is it an LLM call, is it a tool
call, what did it output, what messages went into it.  Those answers live here
so the four callers can't drift apart.
"""
import json
from typing import Any, Dict, List, Optional


# ------------------------------------------------------------------ #
# Classification                                                       #
# ------------------------------------------------------------------ #

def is_llm_span(span: Dict[str, Any]) -> bool:
    return any(k.startswith("gen_ai.prompt.") for k in span.get("attributes", {}))


def is_tool_span(span: Dict[str, Any]) -> bool:
    attrs = span.get("attributes", {})
    return "gen_ai.tool.name" in attrs and "gen_ai.tool.call.result" in attrs


def span_type(span: Dict[str, Any]) -> str:
    if is_llm_span(span):
        return "llm"
    if is_tool_span(span):
        return "tool"
    name = span.get("name", "")
    if "workflow" in name or "invoke_agent" in name:
        return "agent"
    if "execute_task" in name:
        return "task"
    return "span"


# ------------------------------------------------------------------ #
# Extraction                                                           #
# ------------------------------------------------------------------ #

def messages_of(span: Dict[str, Any]) -> List[Dict[str, Any]]:
    """The message history that went into an LLM span."""
    raw = span.get("attributes", {}).get("replay.messages_json")
    if not raw:
        return []
    try:
        msgs = json.loads(raw)
        return msgs if isinstance(msgs, list) else []
    except (json.JSONDecodeError, TypeError):
        return []


def system_prompt_of(span: Dict[str, Any]) -> Optional[str]:
    """The system message content of an LLM span, if it has one."""
    for msg in messages_of(span):
        if msg.get("role") == "system":
            return str(msg.get("content") or "")
    return None


def user_message_of(span: Dict[str, Any]) -> Optional[str]:
    for msg in messages_of(span):
        if msg.get("role") == "user":
            return str(msg.get("content") or "")
    return None


def tool_name_of(span: Dict[str, Any]) -> str:
    return span.get("attributes", {}).get("gen_ai.tool.name", "")


def tool_args_of(span: Dict[str, Any]) -> Dict[str, Any]:
    raw = span.get("attributes", {}).get("gen_ai.tool.call.arguments", "{}")
    try:
        parsed = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return {}
    if not isinstance(parsed, dict):
        return {}
    inner = parsed.get("inputs", parsed)
    return inner if isinstance(inner, dict) else {}


def output_of(span: Dict[str, Any]) -> str:
    """The human-meaningful output of a span — completion text or tool result."""
    attrs = span.get("attributes", {})
    if is_llm_span(span):
        return str(attrs.get("gen_ai.completion.0.content", "") or "")
    if is_tool_span(span):
        return str(
            attrs.get("replay.tool_result", attrs.get("gen_ai.tool.call.result", ""))
            or ""
        )
    return ""


def inputs_of(span: Dict[str, Any]) -> Dict[str, Any]:
    """Editable, human-readable inputs — what the fork form renders."""
    attrs = span.get("attributes", {})

    if is_llm_span(span):
        inputs: Dict[str, Any] = {}
        for msg in messages_of(span):
            role = msg.get("role")
            if role == "user":
                inputs["user"] = msg.get("content", "")
            elif role == "system":
                inputs["system"] = msg.get("content", "")
        return inputs

    if "gen_ai.tool.name" in attrs:
        return tool_args_of(span)

    return {}


def model_of(span: Dict[str, Any]) -> str:
    attrs = span.get("attributes", {})
    return str(
        attrs.get("gen_ai.request.model", attrs.get("gen_ai.response.model", "")) or ""
    )


def token_usage_of(span: Dict[str, Any]) -> int:
    attrs = span.get("attributes", {})
    for key in ("llm.usage.total_tokens", "gen_ai.usage.total_tokens"):
        val = attrs.get(key)
        if isinstance(val, (int, float)):
            return int(val)
        if isinstance(val, str) and val.isdigit():
            return int(val)
    return 0


# ------------------------------------------------------------------ #
# Trace-level views                                                    #
# ------------------------------------------------------------------ #

def sorted_spans(trace: Dict[str, Any]) -> List[Dict[str, Any]]:
    return sorted(trace.get("spans", []), key=lambda s: s.get("start_time") or 0)


def depth_of(span_id: str, spans_by_id: Dict[str, Dict[str, Any]]) -> int:
    depth = 0
    current = spans_by_id.get(span_id)
    seen = set()
    while current and current.get("parent_span_id") and current["span_id"] not in seen:
        seen.add(current["span_id"])
        depth += 1
        current = spans_by_id.get(current["parent_span_id"])
    return depth


def root_span(trace: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    spans = trace.get("spans", [])
    root = next((s for s in spans if s.get("parent_span_id") is None), None)
    if root:
        return root
    return sorted_spans(trace)[0] if spans else None


def llm_spans(trace: Dict[str, Any]) -> List[Dict[str, Any]]:
    return [s for s in sorted_spans(trace) if is_llm_span(s)]


def tool_spans(trace: Dict[str, Any]) -> List[Dict[str, Any]]:
    return [s for s in sorted_spans(trace) if is_tool_span(s)]


def entry_llm_span(trace: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    The first LLM call of a trace — the one whose message history holds the
    system prompt the agent was configured with.  This is the span a
    system-prompt pressure test forks at.
    """
    candidates = llm_spans(trace)
    if not candidates:
        return None
    with_messages = [s for s in candidates if messages_of(s)]
    return with_messages[0] if with_messages else candidates[0]


def trace_system_prompt(trace: Dict[str, Any]) -> Optional[str]:
    entry = entry_llm_span(trace)
    return system_prompt_of(entry) if entry else None


def trace_question(trace: Dict[str, Any]) -> str:
    """The user's opening question — the trace's headline in a list."""
    entry = entry_llm_span(trace)
    if entry:
        user = user_message_of(entry)
        if user:
            return user
    for span in sorted_spans(trace):
        raw = span.get("attributes", {}).get("gen_ai.task.input")
        if not raw:
            continue
        try:
            parsed = json.loads(raw)
            msgs = parsed.get("inputs", {}).get("messages", [])
            if msgs:
                return str(msgs[0].get("content", ""))
        except (json.JSONDecodeError, TypeError, AttributeError):
            continue
    return ""


def trace_final_output(trace: Dict[str, Any]) -> str:
    """The last thing the agent said."""
    for span in reversed(llm_spans(trace)):
        out = output_of(span)
        if out.strip():
            return out
    return ""


def trace_tools_called(trace: Dict[str, Any]) -> List[str]:
    """Tool names in call order, duplicates kept."""
    return [tool_name_of(s) for s in tool_spans(trace) if tool_name_of(s)]


def trace_tool_results(trace: Dict[str, Any]) -> List[str]:
    return [output_of(s) for s in tool_spans(trace) if output_of(s).strip()]


def trace_total_tokens(trace: Dict[str, Any]) -> int:
    return sum(token_usage_of(s) for s in llm_spans(trace))


def build_messages_with_system(
    messages: List[Dict[str, Any]], system_prompt: str
) -> List[Dict[str, Any]]:
    """
    Returns a copy of `messages` whose system message is `system_prompt`.
    If there was no system message, one is prepended.
    """
    updated = []
    replaced = False
    for msg in messages:
        if msg.get("role") == "system" and not replaced:
            updated.append({**msg, "content": system_prompt})
            replaced = True
        else:
            updated.append(dict(msg))
    if not replaced:
        updated.insert(0, {"role": "system", "content": system_prompt})
    return updated
