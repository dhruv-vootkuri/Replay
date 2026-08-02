"""
The replay log — an index over every replay that has ever been played.

Every `engine.replay()` call writes `<original>.replay.<replay_id>.json` into
the traces directory.  Those files are the log; this module reads them back as
a queryable list and builds the original-vs-replay diff that both the CLI
`diff` command and the web dashboard render.
"""
import json
import os
from typing import Any, Dict, List, Optional

from replay.core import spans as sp


REPLAY_MARKER = ".replay."


# ------------------------------------------------------------------ #
# Reading the log                                                      #
# ------------------------------------------------------------------ #

def _replay_paths(traces_dir: str) -> List[str]:
    if not os.path.isdir(traces_dir):
        return []
    paths = [
        os.path.join(traces_dir, f)
        for f in os.listdir(traces_dir)
        if f.endswith(".json") and REPLAY_MARKER in f
    ]
    paths.sort(key=os.path.getmtime, reverse=True)  # newest first
    return paths


def load_replay(traces_dir: str, replay_id: str) -> Optional[Dict[str, Any]]:
    """Loads a replay by full or partial replay ID."""
    for path in _replay_paths(traces_dir):
        if replay_id in os.path.basename(path):
            with open(path) as f:
                return json.load(f)
    return None


def _readable_changes(replay: Dict[str, Any]) -> List[Dict[str, str]]:
    """
    The {field, before, after} view of what a replay changed.

    Replays written by the current engine carry this already, computed against
    the pre-fork span.  Older files don't, so we fall back to reporting the new
    values alone — without the original span we can't say what they replaced.
    """
    stored = replay.get("changes_readable")
    if stored:
        return stored

    readable: List[Dict[str, str]] = []
    for key, raw in (replay.get("changes") or {}).items():
        if key == "replay.messages_json":
            try:
                for msg in json.loads(raw):
                    role = msg.get("role", "")
                    if role in ("system", "user"):
                        readable.append({
                            "field": role,
                            "before": "",
                            "after": str(msg.get("content", "")),
                        })
            except (json.JSONDecodeError, TypeError):
                readable.append({"field": key, "before": "", "after": str(raw)})
        elif key == "gen_ai.tool.call.arguments":
            try:
                parsed = json.loads(raw)
                inner = parsed.get("inputs", parsed)
                for field, value in (inner or {}).items():
                    readable.append(
                        {"field": field, "before": "", "after": str(value)}
                    )
            except (json.JSONDecodeError, TypeError, AttributeError):
                readable.append({"field": key, "before": "", "after": str(raw)})
        else:
            readable.append({"field": key, "before": "", "after": str(raw)})
    return readable


def replay_index_entry(replay: Dict[str, Any]) -> Dict[str, Any]:
    """The log-row view of a replay — cheap enough to build for every file."""
    replay_spans = sp.sorted_spans(replay)
    by_type: Dict[str, int] = {}
    for span in replay_spans:
        kind = span.get("replay_type", "unknown")
        by_type[kind] = by_type.get(kind, 0) + 1

    rerun_llm = [
        s for s in replay_spans
        if sp.is_llm_span(s) and s.get("attributes", {}).get("replay.rerun")
    ]
    final_output = ""
    for span in reversed(rerun_llm):
        if sp.output_of(span).strip():
            final_output = sp.output_of(span)
            break

    fork_span = next(
        (s for s in replay_spans if s.get("replay_type") == "forked"), None
    )

    return {
        "replay_id": replay.get("replay_trace_id", ""),
        "original_trace_id": replay.get("original_trace_id", ""),
        "replayed_at": replay.get("replayed_at"),
        "summary": replay.get("summary", ""),
        "source": replay.get("source", "fork"),
        "run_id": replay.get("run_id"),
        "label": replay.get("label", ""),
        "fork_span_name": (fork_span or {}).get("name", ""),
        "fork_span_type": sp.span_type(fork_span) if fork_span else "",
        "span_count": len(replay_spans),
        "counts": by_type,
        "llm_calls": len(rerun_llm),
        "tools_called": [
            sp.tool_name_of(s) for s in replay_spans
            if sp.is_tool_span(s) and s.get("replay_type") == "downstream"
        ],
        "changes": _readable_changes(replay),
        "final_output": final_output,
    }


def list_replays(traces_dir: str, original_trace_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Every replay in the log, newest first."""
    entries = []
    for path in _replay_paths(traces_dir):
        try:
            with open(path) as f:
                replay = json.load(f)
        except (json.JSONDecodeError, OSError):
            continue
        if original_trace_id and replay.get("original_trace_id") != original_trace_id:
            continue
        entries.append(replay_index_entry(replay))
    return entries


def replay_counts_by_trace(traces_dir: str) -> Dict[str, int]:
    """How many times each original trace has been replayed."""
    counts: Dict[str, int] = {}
    for path in _replay_paths(traces_dir):
        base = os.path.basename(path)
        original = base.split(REPLAY_MARKER)[0]
        counts[original] = counts.get(original, 0) + 1
    return counts


# ------------------------------------------------------------------ #
# Diffing                                                              #
# ------------------------------------------------------------------ #

def build_diff(replay: Dict[str, Any], original: Dict[str, Any]) -> Dict[str, Any]:
    """
    Aligns a replay against its original trace and returns one row per replay
    span with before/after values.

    Alignment rules, mirroring what the engine actually did:
      cached      — reused verbatim, before == after
      forked      — before comes from the original span's attributes
      downstream  — the nth re-run LLM call lines up with the nth original
                    LLM call; tool calls line up by name in call order
    """
    replay_spans = sp.sorted_spans(replay)
    original_spans = sp.sorted_spans(original)
    original_by_id = {s["span_id"]: s for s in original_spans}
    original_llm = sp.llm_spans(original)
    original_tools = sp.tool_spans(original)

    fork_span_id = replay.get("fork_span_id")
    changes = replay.get("changes", {})

    rows: List[Dict[str, Any]] = []
    forked_fields: List[Dict[str, Any]] = []
    llm_cursor = 0
    tool_cursor = 0

    for span in replay_spans:
        kind = span.get("replay_type", "unknown")
        stype = sp.span_type(span)
        name = sp.tool_name_of(span) or span.get("name", "")
        attrs = span.get("attributes", {})
        after = sp.output_of(span)
        before = after
        changed = False
        fields: List[Dict[str, Any]] = []

        if kind == "cached":
            source = original_by_id.get(span["span_id"])
            before = sp.output_of(source) if source else after

        elif kind == "forked":
            source = original_by_id.get(fork_span_id) or original_by_id.get(
                span["span_id"]
            )
            applied = span.get("changes_applied", changes) or {}
            if replay.get("changes_readable"):
                fields = replay["changes_readable"]
            elif applied and source:
                if "replay.messages_json" in applied:
                    old_msgs = sp.messages_of(source)
                    try:
                        new_msgs = json.loads(applied["replay.messages_json"])
                    except (json.JSONDecodeError, TypeError):
                        new_msgs = []
                    for i, msg in enumerate(new_msgs):
                        old_content = (
                            str(old_msgs[i].get("content", ""))
                            if i < len(old_msgs) else ""
                        )
                        new_content = str(msg.get("content", "") or "")
                        if old_content != new_content:
                            fields.append({
                                "field": msg.get("role", f"message {i}"),
                                "before": old_content,
                                "after": new_content,
                            })
                else:
                    for attr, new_val in applied.items():
                        if attr == "gen_ai.tool.call.arguments":
                            old_args = sp.tool_args_of(source)
                            try:
                                parsed = json.loads(new_val)
                                new_args = parsed.get("inputs", parsed)
                            except (json.JSONDecodeError, TypeError):
                                new_args = {}
                            for field, value in (new_args or {}).items():
                                old_value = str(old_args.get(field, ""))
                                if old_value != str(value):
                                    fields.append({
                                        "field": field,
                                        "before": old_value,
                                        "after": str(value),
                                    })
                        else:
                            fields.append({
                                "field": attr,
                                "before": str(source.get("attributes", {}).get(attr, "")),
                                "after": str(new_val),
                            })
            before = sp.output_of(source) if source else ""
            changed = bool(fields)
            forked_fields = fields

        elif kind == "downstream":
            if sp.is_llm_span(span) and attrs.get("replay.rerun"):
                source = (
                    original_llm[llm_cursor]
                    if llm_cursor < len(original_llm) else None
                )
                llm_cursor += 1
                before = sp.output_of(source) if source else ""
                changed = before.strip() != after.strip()
            elif sp.is_tool_span(span):
                source = next(
                    (
                        s for s in original_tools[tool_cursor:]
                        if sp.tool_name_of(s) == name
                    ),
                    None,
                )
                if source:
                    tool_cursor = original_tools.index(source) + 1
                before = sp.output_of(source) if source else ""
                changed = before.strip() != after.strip()
            else:
                source = original_by_id.get(span["span_id"])
                before = sp.output_of(source) if source else after

        rows.append({
            "span_id": span.get("span_id"),
            "replay_type": kind,
            "span_type": stype,
            "name": name,
            "duration_ms": span.get("duration_ms"),
            "before": before,
            "after": after,
            "changed": changed,
            "fields": fields,
            "note": attrs.get("replay.note", ""),
        })

    entry = replay_index_entry(replay)
    # Replays written before the engine stored changes_readable have no record
    # of what they replaced — but here we have the original trace, so the
    # forked row's own before/after is the better answer for the header too.
    if not replay.get("changes_readable") and forked_fields:
        entry["changes"] = forked_fields
    return {
        **entry,
        "rows": rows,
        "final_before": sp.trace_final_output(original),
        "final_after": entry["final_output"],
    }
