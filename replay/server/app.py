import json
import os
from pathlib import Path
from typing import Any, Dict

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from replay.core.loader import TraceLoader
from replay.core.engine import ReplayEngine

app = FastAPI(title="Replay")

BASE_DIR = Path(__file__).parent

loader: TraceLoader = None
engine: ReplayEngine = None


def init_server(traces_dir: str = "traces"):
    global loader, engine
    loader = TraceLoader(traces_dir)
    engine = ReplayEngine(traces_dir)


# ------------------------------------------------------------------ #
# Span helpers                                                         #
# ------------------------------------------------------------------ #

def _is_llm_span(span):
    return any(k.startswith("gen_ai.prompt.") for k in span.get("attributes", {}))


def _is_tool_span(span):
    attrs = span.get("attributes", {})
    return "gen_ai.tool.name" in attrs and "gen_ai.tool.call.result" in attrs


def _get_span_type(span):
    if _is_llm_span(span):
        return "llm"
    if _is_tool_span(span):
        return "tool"
    name = span["name"]
    if "workflow" in name or "invoke_agent" in name:
        return "agent"
    if "execute_task" in name:
        return "task"
    return "span"


def _get_span_inputs(span):
    attrs = span.get("attributes", {})
    inputs = {}

    if _is_llm_span(span):
        messages_json = attrs.get("replay.messages_json")
        if messages_json:
            for msg in json.loads(messages_json):
                if msg["role"] == "user":
                    inputs["user"] = msg["content"]
                elif msg["role"] == "system":
                    inputs["system"] = msg["content"]
        return inputs

    if "gen_ai.tool.name" in attrs:
        raw = attrs.get("gen_ai.tool.call.arguments", "{}")
        try:
            parsed = json.loads(raw)
            args = parsed.get("inputs", parsed)
            if isinstance(args, dict):
                inputs = args
        except Exception:
            pass
        return inputs

    return inputs


def _get_depth(span_id, spans_by_id):
    depth = 0
    current = spans_by_id.get(span_id)
    while current and current.get("parent_span_id"):
        depth += 1
        current = spans_by_id.get(current["parent_span_id"])
    return depth


def _enrich_span(span, spans_by_id):
    attrs = span.get("attributes", {})
    span_type = _get_span_type(span)
    inputs = _get_span_inputs(span)
    depth = _get_depth(span["span_id"], spans_by_id)
    tool_name = attrs.get("gen_ai.tool.name", "")

    display_name = tool_name if (span_type == "tool" and tool_name) else span["name"]

    output = ""
    if span_type == "llm":
        output = attrs.get("gen_ai.completion.0.content", "")
    elif span_type == "tool":
        output = attrs.get(
            "replay.tool_result",
            attrs.get("gen_ai.tool.call.result", "")
        )

    return {
        "span_id": span["span_id"],
        "name": span["name"],
        "display_name": display_name,
        "parent_span_id": span.get("parent_span_id"),
        "start_time": span.get("start_time"),
        "duration_ms": span.get("duration_ms"),
        "status": span.get("status", "UNSET"),
        "type": span_type,
        "depth": depth,
        "inputs": inputs,
        "output": output,
        "is_forkable": span_type in ("llm", "tool"),
        "attributes": attrs,
    }


def _build_changes(attrs: dict, span_type: str, inputs: dict) -> dict:
    """Converts human-readable inputs back into engine-level attribute changes."""
    changes = {}

    if span_type == "llm":
        messages_json = attrs.get("replay.messages_json")
        if messages_json:
            messages = json.loads(messages_json)
            updated = []
            for msg in messages:
                if msg["role"] == "user" and "user" in inputs:
                    updated.append({**msg, "content": inputs["user"]})
                elif msg["role"] == "system" and "system" in inputs:
                    updated.append({**msg, "content": inputs["system"]})
                else:
                    updated.append(msg)
            changes["replay.messages_json"] = json.dumps(updated)

    elif span_type == "tool":
        raw = attrs.get("gen_ai.tool.call.arguments", "{}")
        try:
            parsed = json.loads(raw)
            inner = parsed.get("inputs", parsed)
            if isinstance(inner, dict):
                inner.update(inputs)
                parsed = {"inputs": inner} if "inputs" in parsed else inner
                changes["gen_ai.tool.call.arguments"] = json.dumps(parsed)
        except Exception:
            pass

    return changes


# ------------------------------------------------------------------ #
# Routes                                                               #
# ------------------------------------------------------------------ #

@app.get("/api/traces")
def list_traces():
    traces = loader.list_traces()
    result = []
    for trace_id in reversed(traces):
        try:
            trace = loader.load(trace_id)
            spans = trace["spans"]
            root = next((s for s in spans if s.get("parent_span_id") is None), None)
            result.append({
                "trace_id": trace_id,
                "created_at": trace.get("created_at", ""),
                "span_count": len(spans),
                "llm_count": sum(1 for s in spans if _is_llm_span(s)),
                "tool_count": sum(1 for s in spans if _is_tool_span(s)),
                "duration_ms": root.get("duration_ms") if root else None,
            })
        except Exception:
            continue
    return result


@app.get("/api/traces/{trace_id}")
def get_trace(trace_id: str):
    matches = [t for t in loader.list_traces() if t.startswith(trace_id)]
    if not matches:
        raise HTTPException(status_code=404, detail="Trace not found")

    trace = loader.load(matches[0])
    spans = sorted(trace["spans"], key=lambda s: s.get("start_time", 0))
    spans_by_id = {s["span_id"]: s for s in spans}

    return {
        "trace_id": matches[0],
        "created_at": trace.get("created_at", ""),
        "spans": [_enrich_span(s, spans_by_id) for s in spans],
    }


class ForkRequest(BaseModel):
    span_id: str
    inputs: Dict[str, Any]


@app.post("/api/traces/{trace_id}/fork")
def fork_trace(trace_id: str, body: ForkRequest):
    matches = [t for t in loader.list_traces() if t.startswith(trace_id)]
    if not matches:
        raise HTTPException(status_code=404, detail="Trace not found")

    trace = loader.load(matches[0])
    spans_by_id = {s["span_id"]: s for s in trace["spans"]}
    span = spans_by_id.get(body.span_id)
    if not span:
        raise HTTPException(status_code=404, detail="Span not found")

    span_type = _get_span_type(span)
    changes = _build_changes(span.get("attributes", {}), span_type, body.inputs)
    if not changes:
        raise HTTPException(status_code=400, detail="No changes could be built from inputs")

    def auto_tool_handler(tool_name, tool_args, original_output):
        opts = engine.registry.get_available_options(tool_name)
        return "run" if opts["can_run_real"] else "skip"

    try:
        result = engine.replay(
            trace_id=matches[0],
            fork_span_id=body.span_id,
            changes=changes,
            temperature=0.0,
            on_tool_pause=auto_tool_handler,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    downstream_llm = [
        s for s in result["spans"]
        if s.get("replay_type") == "downstream"
        and _is_llm_span(s)
        and s.get("attributes", {}).get("replay.rerun")
    ]

    final_output = ""
    if downstream_llm:
        final_output = downstream_llm[-1]["attributes"].get(
            "gen_ai.completion.0.content", ""
        )

    return {
        "replay_trace_id": result["replay_trace_id"],
        "summary": result["summary"],
        "final_output": final_output,
    }


# Serve the frontend — must be last so API routes take priority
app.mount("/", StaticFiles(directory=str(BASE_DIR / "static"), html=True), name="static")
