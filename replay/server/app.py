"""
The Replay dashboard API.

Everything the CLI can do is reachable here: list and inspect traces, fork any
span, read the log of every replay ever played, diff a replay against its
original, and pressure test a candidate system prompt against every stored
trace at once.
"""
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from replay.core import pressure as pressure_mod
from replay.core import replay_log
from replay.core import spans as sp
from replay.core.engine import ReplayEngine
from replay.core.loader import TraceLoader

app = FastAPI(title="Replay Console")

BASE_DIR = Path(__file__).parent

loader: TraceLoader = None
engine: ReplayEngine = None
runner: pressure_mod.PressureRunner = None
store: pressure_mod.PressureStore = None
TRACES_DIR = "traces"


def init_server(traces_dir: str = "traces"):
    global loader, engine, runner, store, TRACES_DIR
    TRACES_DIR = traces_dir
    loader = TraceLoader(traces_dir)
    engine = ReplayEngine(traces_dir)
    store = pressure_mod.PressureStore(traces_dir)
    runner = pressure_mod.PressureRunner(traces_dir, engine=engine)


# ------------------------------------------------------------------ #
# Enrichment                                                           #
# ------------------------------------------------------------------ #

def _enrich_span(span: Dict[str, Any], spans_by_id: Dict[str, Any]) -> Dict[str, Any]:
    attrs = span.get("attributes", {})
    stype = sp.span_type(span)
    tool_name = sp.tool_name_of(span)
    display_name = tool_name if (stype == "tool" and tool_name) else span.get("name", "")

    return {
        "span_id": span["span_id"],
        "name": span.get("name", ""),
        "display_name": display_name,
        "parent_span_id": span.get("parent_span_id"),
        "start_time": span.get("start_time"),
        "duration_ms": span.get("duration_ms"),
        "status": span.get("status", "UNSET"),
        "type": stype,
        "replay_type": span.get("replay_type"),
        "depth": sp.depth_of(span["span_id"], spans_by_id),
        "inputs": sp.inputs_of(span),
        "output": sp.output_of(span),
        "model": sp.model_of(span) if stype == "llm" else "",
        "tokens": sp.token_usage_of(span) if stype == "llm" else 0,
        "messages": sp.messages_of(span) if stype == "llm" else [],
        "is_forkable": stype in ("llm", "tool"),
        "note": attrs.get("replay.note", ""),
    }


def _trace_summary(trace_id: str, trace: Dict[str, Any], replay_counts: Dict[str, int]) -> Dict[str, Any]:
    all_spans = sp.sorted_spans(trace)
    root = sp.root_span(trace)
    prompt = sp.trace_system_prompt(trace)
    entry = sp.entry_llm_span(trace)

    return {
        "trace_id": trace_id,
        "created_at": trace.get("created_at", ""),
        "span_count": len(all_spans),
        "llm_count": len(sp.llm_spans(trace)),
        "tool_count": len(sp.tool_spans(trace)),
        "duration_ms": (root or {}).get("duration_ms"),
        "total_tokens": sp.trace_total_tokens(trace),
        "model": sp.model_of(entry) if entry else "",
        "question": sp.trace_question(trace),
        "final_output": sp.trace_final_output(trace),
        "system_prompt": prompt,
        "tools_called": sp.trace_tools_called(trace),
        "replay_count": replay_counts.get(trace_id, 0),
        "status": "ERROR" if any(
            s.get("status") == "ERROR" for s in all_spans
        ) else "OK",
    }


def _resolve_trace(trace_id: str) -> str:
    matches = [t for t in loader.list_traces() if t.startswith(trace_id)]
    if not matches:
        raise HTTPException(status_code=404, detail=f"No trace matching {trace_id!r}")
    return matches[0]


def _load_all_traces() -> List[Dict[str, Any]]:
    replay_counts = replay_log.replay_counts_by_trace(TRACES_DIR)
    summaries = []
    for trace_id in reversed(loader.list_traces()):  # newest first
        try:
            trace = loader.load(trace_id)
        except (OSError, json.JSONDecodeError, FileNotFoundError):
            continue
        summaries.append(_trace_summary(trace_id, trace, replay_counts))
    return summaries


# ------------------------------------------------------------------ #
# Meta & overview                                                      #
# ------------------------------------------------------------------ #

@app.get("/api/meta")
def get_meta():
    schemas = engine.registry.get_all_schemas()
    return {
        "traces_dir": TRACES_DIR,
        "tools_loaded": len(schemas),
        "tool_names": [s["function"]["name"] for s in schemas],
        "has_api_key": bool(
            os.environ.get("OPENAI_API_KEY") or os.environ.get("ANTHROPIC_API_KEY")
        ),
        "checks": pressure_mod.CHECK_DEFS,
        "default_checks": pressure_mod.default_check_config(),
    }


@app.get("/api/stats")
def get_stats():
    traces = _load_all_traces()
    replays = replay_log.list_replays(TRACES_DIR)
    runs = store.list()

    tool_usage: Dict[str, int] = {}
    span_mix: Dict[str, int] = {}
    for summary in traces:
        for name in summary["tools_called"]:
            tool_usage[name] = tool_usage.get(name, 0) + 1

    for trace_id in loader.list_traces():
        try:
            trace = loader.load(trace_id)
        except (OSError, json.JSONDecodeError, FileNotFoundError):
            continue
        for span in trace.get("spans", []):
            kind = sp.span_type(span)
            span_mix[kind] = span_mix.get(kind, 0) + 1

    graded = sum(
        (r.get("totals", {}).get("graded") or 0) for r in runs
    )
    passed = sum((r.get("totals", {}).get("pass") or 0) for r in runs)

    return {
        "totals": {
            "traces": len(traces),
            "spans": sum(t["span_count"] for t in traces),
            "llm_calls": sum(t["llm_count"] for t in traces),
            "tool_calls": sum(t["tool_count"] for t in traces),
            "tokens": sum(t["total_tokens"] for t in traces),
            "replays": len(replays),
            "pressure_runs": len(runs),
            "prompts": len([
                p for p in pressure_mod.prompt_inventory(loader) if p["prompt"]
            ]),
            "checks_graded": graded,
            "checks_passed": passed,
            "pass_rate": (passed / graded) if graded else None,
        },
        "tool_usage": sorted(
            [{"name": k, "count": v} for k, v in tool_usage.items()],
            key=lambda d: d["count"],
            reverse=True,
        ),
        "span_mix": sorted(
            [{"type": k, "count": v} for k, v in span_mix.items()],
            key=lambda d: d["count"],
            reverse=True,
        ),
        "recent_traces": traces[:6],
        "recent_replays": replays[:6],
        "recent_runs": [_run_summary(r) for r in runs[:6]],
    }


# ------------------------------------------------------------------ #
# Traces                                                               #
# ------------------------------------------------------------------ #

@app.get("/api/traces")
def list_traces():
    return _load_all_traces()


@app.get("/api/traces/{trace_id}")
def get_trace(trace_id: str):
    full_id = _resolve_trace(trace_id)
    trace = loader.load(full_id)
    ordered = sp.sorted_spans(trace)
    spans_by_id = {s["span_id"]: s for s in ordered}
    replay_counts = replay_log.replay_counts_by_trace(TRACES_DIR)

    return {
        **_trace_summary(full_id, trace, replay_counts),
        "spans": [_enrich_span(s, spans_by_id) for s in ordered],
        "replays": replay_log.list_replays(TRACES_DIR, original_trace_id=full_id),
    }


@app.get("/api/traces/{trace_id}/raw")
def get_trace_raw(trace_id: str):
    return loader.load(_resolve_trace(trace_id))


class ForkRequest(BaseModel):
    span_id: str
    inputs: Dict[str, Any]
    temperature: float = 0.0


@app.post("/api/traces/{trace_id}/fork")
def fork_trace(trace_id: str, body: ForkRequest):
    full_id = _resolve_trace(trace_id)
    trace = loader.load(full_id)
    spans_by_id = {s["span_id"]: s for s in trace["spans"]}
    span = spans_by_id.get(body.span_id)
    if not span:
        raise HTTPException(status_code=404, detail="Span not found")

    changes = _build_changes(span, body.inputs)
    if not changes:
        raise HTTPException(
            status_code=400, detail="No changes could be built from those inputs"
        )

    try:
        result = engine.replay(
            trace_id=full_id,
            fork_span_id=body.span_id,
            changes=changes,
            temperature=body.temperature,
            on_tool_pause=pressure_mod._auto_tool_handler(engine),
            meta={"source": "fork"},
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"{type(exc).__name__}: {exc}")

    entry = replay_log.replay_index_entry(result)
    return {
        "replay_trace_id": result["replay_trace_id"],
        "summary": result["summary"],
        "final_output": entry["final_output"],
        "tools_called": entry["tools_called"],
    }


def _build_changes(span: Dict[str, Any], inputs: Dict[str, Any]) -> Dict[str, Any]:
    """Human-readable form values back into engine-level attribute changes."""
    attrs = span.get("attributes", {})
    stype = sp.span_type(span)
    changes: Dict[str, Any] = {}

    if stype == "llm":
        messages = sp.messages_of(span)
        if not messages:
            return {}
        updated = []
        for msg in messages:
            role = msg.get("role")
            if role in ("user", "system") and role in inputs:
                updated.append({**msg, "content": inputs[role]})
            else:
                updated.append(msg)
        if "system" in inputs and not any(m.get("role") == "system" for m in messages):
            updated.insert(0, {"role": "system", "content": inputs["system"]})
        changes["replay.messages_json"] = json.dumps(updated)

    elif stype == "tool" or "gen_ai.tool.name" in attrs:
        raw = attrs.get("gen_ai.tool.call.arguments", "{}")
        try:
            parsed = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return {}
        inner = parsed.get("inputs", parsed) if isinstance(parsed, dict) else {}
        if not isinstance(inner, dict):
            return {}
        coerced = dict(inner)
        for key, value in inputs.items():
            coerced[key] = _coerce_like(inner.get(key), value)
        wrapped = (
            {**parsed, "inputs": coerced}
            if isinstance(parsed, dict) and "inputs" in parsed
            else coerced
        )
        changes["gen_ai.tool.call.arguments"] = json.dumps(wrapped)

    return changes


def _coerce_like(original: Any, new_value: Any) -> Any:
    """
    Form fields arrive as strings. If the original argument was a number or a
    bool, keep that type so the re-run tool gets what its signature expects.
    """
    if isinstance(new_value, str) and isinstance(original, bool):
        return new_value.strip().lower() in ("true", "1", "yes")
    if isinstance(new_value, str) and isinstance(original, (int, float)):
        try:
            return type(original)(new_value)
        except (TypeError, ValueError):
            return new_value
    return new_value


# ------------------------------------------------------------------ #
# Replay log                                                           #
# ------------------------------------------------------------------ #

@app.get("/api/replays")
def list_replays(trace_id: Optional[str] = None, run_id: Optional[str] = None):
    entries = replay_log.list_replays(TRACES_DIR, original_trace_id=trace_id)
    if run_id:
        entries = [e for e in entries if e.get("run_id") == run_id]
    return entries


@app.get("/api/replays/{replay_id}")
def get_replay(replay_id: str):
    replay = replay_log.load_replay(TRACES_DIR, replay_id)
    if replay is None:
        raise HTTPException(status_code=404, detail="Replay not found")

    ordered = sp.sorted_spans(replay)
    spans_by_id = {s["span_id"]: s for s in ordered}
    return {
        **replay_log.replay_index_entry(replay),
        "spans": [_enrich_span(s, spans_by_id) for s in ordered],
    }


@app.get("/api/replays/{replay_id}/diff")
def get_replay_diff(replay_id: str):
    replay = replay_log.load_replay(TRACES_DIR, replay_id)
    if replay is None:
        raise HTTPException(status_code=404, detail="Replay not found")
    try:
        original = loader.load(replay["original_trace_id"])
    except (FileNotFoundError, OSError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=404, detail=f"Original trace is gone: {exc}"
        )
    return replay_log.build_diff(replay, original)


# ------------------------------------------------------------------ #
# Prompts & pressure tests                                             #
# ------------------------------------------------------------------ #

@app.get("/api/prompts")
def list_prompts():
    inventory = pressure_mod.prompt_inventory(loader)
    return [
        {
            "prompt": bucket["prompt"],
            "trace_ids": bucket["trace_ids"],
            "trace_count": len(bucket["trace_ids"]),
            "models": bucket["models"],
        }
        for bucket in inventory
    ]


def _run_summary(run: Dict[str, Any]) -> Dict[str, Any]:
    """A pressure run without its per-trace detail — the list-row view."""
    return {
        "run_id": run["run_id"],
        "name": run.get("name", ""),
        "created_at": run.get("created_at"),
        "started_at": run.get("started_at"),
        "finished_at": run.get("finished_at"),
        "status": run.get("status", "queued"),
        "verdict": run.get("verdict", "pending"),
        "totals": run.get("totals", {}),
        "trace_count": len(run.get("trace_ids", [])),
        "system_prompt": run.get("system_prompt", ""),
        "notes": run.get("notes", []),
        "checks_enabled": [
            check_id for check_id, cfg in (run.get("checks") or {}).items()
            if cfg.get("enabled")
        ],
    }


class PressureRequest(BaseModel):
    system_prompt: str
    trace_ids: Optional[List[str]] = None
    checks: Optional[Dict[str, Any]] = None
    name: str = ""
    temperature: float = 0.0
    concurrency: int = 2
    include_unchanged: bool = False
    baseline_trace_id: Optional[str] = None


@app.post("/api/pressure")
def create_pressure_run(body: PressureRequest):
    if not body.system_prompt.strip():
        raise HTTPException(status_code=400, detail="A system prompt is required")

    available = loader.list_traces()
    if body.trace_ids:
        requested = []
        for raw in body.trace_ids:
            matches = [t for t in available if t.startswith(raw)]
            if matches:
                requested.append(matches[0])
        trace_ids = list(dict.fromkeys(requested))
    else:
        trace_ids = list(reversed(available))  # all traces, newest first

    if not trace_ids:
        raise HTTPException(status_code=400, detail="No traces to test against")

    run = runner.create(
        system_prompt=body.system_prompt,
        trace_ids=trace_ids,
        checks=body.checks,
        name=body.name,
        temperature=body.temperature,
        concurrency=body.concurrency,
        include_unchanged=body.include_unchanged,
        baseline_trace_id=body.baseline_trace_id,
    )
    runner.start(run["run_id"])
    return _run_summary(run)


@app.get("/api/pressure")
def list_pressure_runs():
    return [_run_summary(r) for r in store.list()]


@app.get("/api/pressure/{run_id}")
def get_pressure_run(run_id: str):
    run = store.load(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Pressure run not found")
    return {
        **run,
        "live": runner.is_running(run["run_id"]),
    }


@app.post("/api/pressure/{run_id}/cancel")
def cancel_pressure_run(run_id: str):
    run = store.load(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Pressure run not found")
    return {"cancelled": runner.cancel(run["run_id"])}


@app.delete("/api/pressure/{run_id}")
def delete_pressure_run(run_id: str):
    run = store.load(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Pressure run not found")
    if runner.is_running(run["run_id"]):
        raise HTTPException(status_code=409, detail="Run is still in flight")
    return {"deleted": store.delete(run["run_id"])}


# ------------------------------------------------------------------ #
# Tool registry                                                        #
# ------------------------------------------------------------------ #

@app.get("/api/tools")
def list_tools():
    registry = engine.registry
    schemas = {s["function"]["name"]: s["function"] for s in registry.get_all_schemas()}
    preferences = registry.list_preferences()

    names = sorted(set(schemas) | set(registry._tools) | set(preferences))
    tools = []
    for name in names:
        options = registry.get_available_options(name)
        function = schemas.get(name, {})
        tools.append({
            "name": name,
            "description": function.get("description", ""),
            "parameters": list(
                (function.get("parameters", {}).get("properties") or {}).keys()
            ),
            "can_run_real": options["can_run_real"],
            "has_alternative": options["has_alternative"],
            "preference": options["preference"],
            "registered": name in registry._tools,
        })
    return {
        "tools": tools,
        "sources_file": ".replay/tool_sources.py",
        "sources_exist": os.path.exists(".replay/tool_sources.py"),
    }


class PreferenceRequest(BaseModel):
    preference: Optional[str] = None


@app.post("/api/tools/{tool_name}/preference")
def set_tool_preference(tool_name: str, body: PreferenceRequest):
    if body.preference in (None, ""):
        engine.registry.clear_preference(tool_name)
        return {"tool": tool_name, "preference": None}
    if body.preference not in ("run", "skip", "alternative"):
        raise HTTPException(
            status_code=400,
            detail="preference must be one of: run, skip, alternative",
        )
    engine.registry.save_preference(tool_name, body.preference)
    return {"tool": tool_name, "preference": body.preference}


# Serve the dashboard — mounted last so /api routes win
app.mount("/", StaticFiles(directory=str(BASE_DIR / "static"), html=True), name="static")
