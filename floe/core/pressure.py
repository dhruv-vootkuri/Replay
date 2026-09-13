"""
Pressure tests — replay one changed system prompt against every stored trace.

The question this answers: *you edited the system prompt while exploring one
trace and the new answer looked fine — but is it fine for everything the agent
has ever been asked?*

A run takes a candidate system prompt, forks every selected trace at its entry
LLM call with that prompt swapped in, replays the whole agent loop, and grades
each replay against the original with a set of deterministic checks.  Nothing
here calls an LLM to judge; every check is something you could verify by hand.
"""
import json
import os
import re
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable, Dict, List, Optional

from floe.core import spans as sp
from floe.core.engine import ReplayEngine
from floe.core.loader import TraceLoader


PRESSURE_DIRNAME = "pressure"

# Verdicts, worst first — used to roll per-check statuses up to a run verdict.
VERDICT_ORDER = ["error", "fail", "warn", "pass", "skipped", "pending", "running"]
_SEVERITY_RANK = {"error": 4, "fail": 3, "warn": 2, "pass": 1, "skipped": 0}


# ------------------------------------------------------------------ #
# Check definitions                                                    #
# ------------------------------------------------------------------ #

CHECK_DEFS: List[Dict[str, Any]] = [
    {
        "id": "no_error_spans",
        "label": "No errored spans",
        "description": "Every span in the replay finished without an error status.",
        "severity": "fail",
        "default_enabled": True,
        "config": {},
        "needs_tools": False,
    },
    {
        "id": "tools_preserved",
        "label": "Tool usage preserved",
        "description": (
            "The replay still calls the tools the original called. Catches a "
            "prompt edit that quietly stops the agent from looking things up."
        ),
        "severity": "fail",
        "default_enabled": True,
        "config": {"mode": "superset"},
        "needs_tools": True,
    },
    {
        "id": "anchor_facts",
        "label": "Grounded facts survive",
        "description": (
            "Tool results that made it into the original answer still appear "
            "in the new answer — same facts, however the wording changed."
        ),
        "severity": "fail",
        "default_enabled": True,
        "config": {},
        "needs_tools": True,
    },
    {
        "id": "must_contain",
        "label": "Must contain",
        "description": "Every listed string appears in the new answer (case-insensitive).",
        "severity": "fail",
        "default_enabled": False,
        "config": {"values": []},
        "needs_tools": False,
    },
    {
        "id": "must_not_contain",
        "label": "Must not contain",
        "description": "None of the listed strings appear in the new answer.",
        "severity": "fail",
        "default_enabled": False,
        "config": {"values": []},
        "needs_tools": False,
    },
    {
        "id": "regex",
        "label": "Matches pattern",
        "description": "The new answer matches this regular expression.",
        "severity": "fail",
        "default_enabled": False,
        "config": {"pattern": ""},
        "needs_tools": False,
    },
    {
        "id": "similarity",
        "label": "Answer still similar",
        "description": (
            "Word overlap with the original answer stays above the threshold. "
            "A warning, not a failure — prompts are meant to change wording."
        ),
        "severity": "warn",
        "default_enabled": True,
        "config": {"threshold": 0.4},
        "needs_tools": False,
    },
    {
        "id": "max_extra_llm_calls",
        "label": "No extra reasoning steps",
        "description": "The replay takes at most this many more LLM calls than the original.",
        "severity": "warn",
        "default_enabled": True,
        "config": {"tolerance": 1},
        "needs_tools": False,
    },
]

CHECK_DEFS_BY_ID = {c["id"]: c for c in CHECK_DEFS}


def default_check_config() -> Dict[str, Any]:
    return {
        c["id"]: {"enabled": c["default_enabled"], **c["config"]}
        for c in CHECK_DEFS
    }


# ------------------------------------------------------------------ #
# Grading helpers                                                      #
# ------------------------------------------------------------------ #

_WORD_RE = re.compile(r"[a-z0-9]+")


def _tokens(text: str) -> set:
    return set(_WORD_RE.findall((text or "").lower()))


def similarity(a: str, b: str) -> float:
    """Jaccard overlap of word sets. 1.0 for identical wording, 0.0 for nothing shared."""
    ta, tb = _tokens(a), _tokens(b)
    if not ta and not tb:
        return 1.0
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def anchor_facts(tool_results: List[str], final_output: str) -> List[str]:
    """
    Tool results that visibly landed in the final answer.  These are the facts
    the answer is grounded in, so they are what a prompt change must not lose.
    """
    haystack = (final_output or "").lower()
    facts = []
    for result in tool_results:
        value = (result or "").strip()
        # Very short or sentence-long results make unreliable anchors.
        if len(value) < 2 or len(value) > 60:
            continue
        if value.lower() in haystack and value not in facts:
            facts.append(value)
    return facts


def _worst(statuses: List[str]) -> str:
    if not statuses:
        return "pass"
    return max(statuses, key=lambda s: _SEVERITY_RANK.get(s, 0))


def _signature(trace_like: Dict[str, Any], replay: bool = False) -> Dict[str, Any]:
    """The graded surface of a trace or a replay: answer, tools, step count."""
    if replay:
        all_spans = sp.sorted_spans(trace_like)
        rerun_llm = [
            s for s in all_spans
            if sp.is_llm_span(s) and s.get("attributes", {}).get("replay.rerun")
        ]
        final_output = ""
        for span in reversed(rerun_llm):
            if sp.output_of(span).strip():
                final_output = sp.output_of(span)
                break
        tools = [
            sp.tool_name_of(s) for s in all_spans
            if sp.is_tool_span(s) and s.get("replay_type") == "downstream"
        ]
        tool_results = [
            sp.output_of(s) for s in all_spans
            if sp.is_tool_span(s) and s.get("replay_type") == "downstream"
        ]
        errored = [
            s.get("name", "") for s in all_spans
            if s.get("status") == "ERROR" and s.get("replay_type") != "cached"
        ]
        return {
            "final_output": final_output,
            "tools": tools,
            "tool_results": tool_results,
            "llm_calls": len(rerun_llm),
            "errored_spans": errored,
        }

    return {
        "final_output": sp.trace_final_output(trace_like),
        "tools": sp.trace_tools_called(trace_like),
        "tool_results": sp.trace_tool_results(trace_like),
        "llm_calls": len(sp.llm_spans(trace_like)),
        "errored_spans": [
            s.get("name", "") for s in sp.sorted_spans(trace_like)
            if s.get("status") == "ERROR"
        ],
    }


def evaluate(
    baseline: Dict[str, Any],
    candidate: Dict[str, Any],
    checks: Dict[str, Any],
    disabled_reason: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Runs every enabled check and returns one result per check."""
    results: List[Dict[str, Any]] = []

    def add(check_id: str, status: str, detail: str) -> None:
        definition = CHECK_DEFS_BY_ID[check_id]
        results.append({
            "id": check_id,
            "label": definition["label"],
            "severity": definition["severity"],
            "status": status,
            "detail": detail,
        })

    for definition in CHECK_DEFS:
        check_id = definition["id"]
        config = checks.get(check_id) or {}
        if not config.get("enabled"):
            continue

        if definition["needs_tools"] and disabled_reason:
            add(check_id, "skipped", disabled_reason)
            continue

        severity = definition["severity"]

        if check_id == "no_error_spans":
            errored = candidate["errored_spans"]
            add(
                check_id,
                "pass" if not errored else severity,
                "no errored spans" if not errored
                else f"errored: {', '.join(errored[:3])}",
            )

        elif check_id == "tools_preserved":
            original_set = set(baseline["tools"])
            new_set = set(candidate["tools"])
            if not original_set:
                add(check_id, "skipped", "the original trace called no tools")
            elif config.get("mode") == "exact":
                extra = new_set - original_set
                missing = original_set - new_set
                ok = not extra and not missing
                detail = "same tools called" if ok else ", ".join(
                    ([f"missing {', '.join(sorted(missing))}"] if missing else [])
                    + ([f"extra {', '.join(sorted(extra))}"] if extra else [])
                )
                add(check_id, "pass" if ok else severity, detail)
            else:
                missing = original_set - new_set
                add(
                    check_id,
                    "pass" if not missing else severity,
                    f"all {len(original_set)} original tool(s) still called"
                    if not missing
                    else f"no longer calls {', '.join(sorted(missing))}",
                )

        elif check_id == "anchor_facts":
            expected = anchor_facts(baseline["tool_results"], baseline["final_output"])
            if not expected:
                add(check_id, "skipped", "no tool result was quotable in the original answer")
            else:
                haystack = (candidate["final_output"] or "").lower()
                lost = [f for f in expected if f.lower() not in haystack]
                add(
                    check_id,
                    "pass" if not lost else severity,
                    f"all {len(expected)} grounded fact(s) present"
                    if not lost
                    else f"dropped: {', '.join(lost[:4])}",
                )

        elif check_id == "must_contain":
            values = [v for v in (config.get("values") or []) if str(v).strip()]
            if not values:
                add(check_id, "skipped", "no strings configured")
            else:
                haystack = (candidate["final_output"] or "").lower()
                missing = [v for v in values if str(v).lower() not in haystack]
                add(
                    check_id,
                    "pass" if not missing else severity,
                    "all present" if not missing else f"missing: {', '.join(missing)}",
                )

        elif check_id == "must_not_contain":
            values = [v for v in (config.get("values") or []) if str(v).strip()]
            if not values:
                add(check_id, "skipped", "no strings configured")
            else:
                haystack = (candidate["final_output"] or "").lower()
                found = [v for v in values if str(v).lower() in haystack]
                add(
                    check_id,
                    "pass" if not found else severity,
                    "none present" if not found else f"found: {', '.join(found)}",
                )

        elif check_id == "regex":
            pattern = config.get("pattern") or ""
            if not pattern.strip():
                add(check_id, "skipped", "no pattern configured")
            else:
                try:
                    matched = re.search(pattern, candidate["final_output"] or "", re.I)
                    add(
                        check_id,
                        "pass" if matched else severity,
                        f"/{pattern}/ matched" if matched else f"/{pattern}/ did not match",
                    )
                except re.error as exc:
                    add(check_id, "error", f"invalid pattern: {exc}")

        elif check_id == "similarity":
            threshold = float(config.get("threshold", 0.4) or 0.4)
            score = similarity(baseline["final_output"], candidate["final_output"])
            add(
                check_id,
                "pass" if score >= threshold else severity,
                f"{score:.0%} word overlap (threshold {threshold:.0%})",
            )

        elif check_id == "max_extra_llm_calls":
            tolerance = int(config.get("tolerance", 1) or 0)
            extra = candidate["llm_calls"] - baseline["llm_calls"]
            add(
                check_id,
                "pass" if extra <= tolerance else severity,
                f"{candidate['llm_calls']} LLM call(s) vs {baseline['llm_calls']} "
                f"originally ({extra:+d}, tolerance {tolerance})",
            )

    return results


# ------------------------------------------------------------------ #
# Prompt inventory                                                     #
# ------------------------------------------------------------------ #

def prompt_inventory(loader: TraceLoader) -> List[Dict[str, Any]]:
    """
    Every distinct system prompt across all traces, with the traces using it.
    This is what makes "pressure test against all traces" a one-click action:
    pick a prompt, edit it, run it against everything that shares it.
    """
    by_prompt: Dict[str, Dict[str, Any]] = {}
    no_prompt: List[str] = []

    for trace_id in reversed(loader.list_traces()):
        try:
            trace = loader.load(trace_id)
        except (OSError, json.JSONDecodeError, FileNotFoundError):
            continue
        prompt = sp.trace_system_prompt(trace)
        if prompt is None:
            no_prompt.append(trace_id)
            continue
        bucket = by_prompt.setdefault(
            prompt, {"prompt": prompt, "trace_ids": [], "models": []}
        )
        bucket["trace_ids"].append(trace_id)
        entry = sp.entry_llm_span(trace)
        model = sp.model_of(entry) if entry else ""
        if model and model not in bucket["models"]:
            bucket["models"].append(model)

    inventory = sorted(
        by_prompt.values(), key=lambda b: len(b["trace_ids"]), reverse=True
    )
    if no_prompt:
        inventory.append(
            {"prompt": None, "trace_ids": no_prompt, "models": []}
        )
    return inventory


# ------------------------------------------------------------------ #
# Run storage                                                          #
# ------------------------------------------------------------------ #

class PressureStore:
    """Pressure runs on disk, one JSON file per run."""

    def __init__(self, traces_dir: str = "traces"):
        self.dir = os.path.join(traces_dir, PRESSURE_DIRNAME)

    def path_for(self, run_id: str) -> str:
        return os.path.join(self.dir, f"{run_id}.json")

    def save(self, run: Dict[str, Any]) -> None:
        os.makedirs(self.dir, exist_ok=True)
        tmp = self.path_for(run["run_id"]) + ".tmp"
        with open(tmp, "w") as f:
            json.dump(run, f, indent=2)
        os.replace(tmp, self.path_for(run["run_id"]))

    def load(self, run_id: str) -> Optional[Dict[str, Any]]:
        path = self.path_for(run_id)
        if not os.path.exists(path):
            # allow partial IDs
            for candidate in self._files():
                if os.path.basename(candidate).startswith(run_id):
                    path = candidate
                    break
            else:
                return None
        try:
            with open(path) as f:
                return json.load(f)
        except (OSError, json.JSONDecodeError):
            return None

    def _files(self) -> List[str]:
        if not os.path.isdir(self.dir):
            return []
        paths = [
            os.path.join(self.dir, f)
            for f in os.listdir(self.dir)
            if f.endswith(".json")
        ]
        paths.sort(key=os.path.getmtime, reverse=True)
        return paths

    def list(self) -> List[Dict[str, Any]]:
        runs = []
        for path in self._files():
            try:
                with open(path) as f:
                    runs.append(json.load(f))
            except (OSError, json.JSONDecodeError):
                continue
        return runs

    def delete(self, run_id: str) -> bool:
        path = self.path_for(run_id)
        if os.path.exists(path):
            os.remove(path)
            return True
        return False


# ------------------------------------------------------------------ #
# The runner                                                           #
# ------------------------------------------------------------------ #

def summarize(run: Dict[str, Any]) -> Dict[str, Any]:
    """Run totals, recomputed from results. Cheap, so always derived not stored stale."""
    totals = {k: 0 for k in ("pass", "warn", "fail", "error", "skipped", "pending", "running")}
    for result in run.get("results", []):
        status = result.get("status", "pending")
        totals[status] = totals.get(status, 0) + 1
    totals["total"] = len(run.get("results", []))
    graded = totals["pass"] + totals["warn"] + totals["fail"] + totals["error"]
    totals["graded"] = graded
    totals["pass_rate"] = (totals["pass"] / graded) if graded else None
    return totals


def run_verdict(run: Dict[str, Any]) -> str:
    statuses = [r.get("status") for r in run.get("results", [])]
    graded = [s for s in statuses if s in _SEVERITY_RANK]
    if not graded:
        return "pending"
    return _worst(graded)


class PressureRunner:
    """
    Executes pressure runs in background threads and keeps them pollable.

    Results are written to disk after every trace finishes, so a run survives a
    server restart mid-flight (it will show as interrupted, with whatever
    results it got).
    """

    def __init__(self, traces_dir: str = "traces", engine: Optional[ReplayEngine] = None):
        self.traces_dir = traces_dir
        self.loader = TraceLoader(traces_dir)
        self.engine = engine or ReplayEngine(traces_dir)
        self.store = PressureStore(traces_dir)
        self._lock = threading.Lock()
        self._cancelled: set = set()
        self._threads: Dict[str, threading.Thread] = {}

    # -- lifecycle ---------------------------------------------------- #

    def create(
        self,
        system_prompt: str,
        trace_ids: List[str],
        checks: Optional[Dict[str, Any]] = None,
        name: str = "",
        temperature: float = 0.0,
        concurrency: int = 2,
        include_unchanged: bool = False,
        baseline_trace_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        run_id = uuid.uuid4().hex
        checks = checks or default_check_config()

        notes: List[str] = []
        tools_available = bool(self.engine.registry.get_all_schemas())
        if not tools_available:
            notes.append(
                "No tools are registered, so the replayed agent cannot call any. "
                "Tool-dependent checks were skipped — run your agent script once "
                "(or start the server with tools loaded) to enable them."
            )

        results = []
        for trace_id in trace_ids:
            results.append({
                "trace_id": trace_id,
                "status": "pending",
                "question": "",
                "checks": [],
                "error": None,
            })

        run = {
            "run_id": run_id,
            "name": name or f"Prompt run {time.strftime('%b %d %H:%M')}",
            "created_at": time.time(),
            "started_at": None,
            "finished_at": None,
            "status": "queued",
            "system_prompt": system_prompt,
            "baseline_trace_id": baseline_trace_id,
            "trace_ids": list(trace_ids),
            "checks": checks,
            "temperature": temperature,
            "concurrency": max(1, min(int(concurrency or 1), 8)),
            "include_unchanged": include_unchanged,
            "tools_available": tools_available,
            "notes": notes,
            "results": results,
        }
        run["totals"] = summarize(run)
        run["verdict"] = "pending"
        self.store.save(run)
        return run

    def start(self, run_id: str) -> None:
        thread = threading.Thread(target=self._drive, args=(run_id,), daemon=True)
        with self._lock:
            self._threads[run_id] = thread
        thread.start()

    def cancel(self, run_id: str) -> bool:
        run = self.store.load(run_id)
        if not run or run["status"] in ("done", "cancelled"):
            return False
        with self._lock:
            self._cancelled.add(run_id)
        return True

    def is_running(self, run_id: str) -> bool:
        with self._lock:
            thread = self._threads.get(run_id)
        return bool(thread and thread.is_alive())

    # -- execution ---------------------------------------------------- #

    def _update(self, run_id: str, mutate: Callable[[Dict[str, Any]], None]) -> Dict[str, Any]:
        """Read-modify-write a run file under the lock."""
        with self._lock:
            run = self.store.load(run_id)
            if run is None:
                raise KeyError(run_id)
            mutate(run)
            run["totals"] = summarize(run)
            run["verdict"] = run_verdict(run)
            self.store.save(run)
            return run

    def _drive(self, run_id: str) -> None:
        run = self.store.load(run_id)
        if run is None:
            return

        self._update(run_id, lambda r: r.update(
            status="running", started_at=time.time()
        ))

        disabled_reason = (
            None if run["tools_available"]
            else "no tools registered in this session"
        )

        def work(index: int) -> None:
            with self._lock:
                cancelled = run_id in self._cancelled
            if cancelled:
                return
            self._update(run_id, lambda r: r["results"][index].update(status="running"))
            try:
                result = self._run_one(
                    run["results"][index]["trace_id"],
                    run["system_prompt"],
                    run["checks"],
                    run["temperature"],
                    run_id,
                    run["name"],
                    run["include_unchanged"],
                    disabled_reason,
                )
            except Exception as exc:  # keep the rest of the suite going
                result = {
                    **run["results"][index],
                    "status": "error",
                    "error": f"{type(exc).__name__}: {exc}",
                }
            self._update(run_id, lambda r: r["results"].__setitem__(index, result))

        try:
            with ThreadPoolExecutor(max_workers=run["concurrency"]) as pool:
                list(pool.map(work, range(len(run["results"]))))
        finally:
            with self._lock:
                cancelled = run_id in self._cancelled
                self._cancelled.discard(run_id)

            def finish(r: Dict[str, Any]) -> None:
                r["status"] = "cancelled" if cancelled else "done"
                r["finished_at"] = time.time()
                for result in r["results"]:
                    if result["status"] in ("pending", "running"):
                        result["status"] = "skipped"
                        result["error"] = "cancelled before it ran" if cancelled else None

            self._update(run_id, finish)

    def _run_one(
        self,
        trace_id: str,
        system_prompt: str,
        checks: Dict[str, Any],
        temperature: float,
        run_id: str,
        run_name: str,
        include_unchanged: bool,
        disabled_reason: Optional[str],
    ) -> Dict[str, Any]:
        started = time.time()
        result: Dict[str, Any] = {
            "trace_id": trace_id,
            "status": "pending",
            "question": "",
            "old_system_prompt": None,
            "checks": [],
            "error": None,
            "replay_id": None,
            "original": None,
            "replay": None,
            "duration_ms": None,
        }

        try:
            trace = self.loader.load(trace_id)
        except (FileNotFoundError, OSError, json.JSONDecodeError) as exc:
            result.update(status="error", error=f"could not load trace: {exc}")
            return result

        result["question"] = sp.trace_question(trace)
        entry = sp.entry_llm_span(trace)

        if entry is None:
            result.update(
                status="skipped",
                error="no LLM call in this trace, so there is no prompt to swap",
            )
            return result

        old_prompt = sp.system_prompt_of(entry)
        result["old_system_prompt"] = old_prompt

        if old_prompt == system_prompt and not include_unchanged:
            result.update(
                status="skipped",
                error="this trace already runs on the candidate prompt",
            )
            return result

        messages = sp.messages_of(entry)
        if not messages:
            result.update(
                status="skipped",
                error="the entry LLM span has no captured message history",
            )
            return result

        baseline = _signature(trace)
        result["original"] = {
            "final_output": baseline["final_output"],
            "tools": baseline["tools"],
            "llm_calls": baseline["llm_calls"],
        }

        new_messages = sp.build_messages_with_system(messages, system_prompt)

        try:
            replay = self.engine.replay(
                trace_id=trace_id,
                fork_span_id=entry["span_id"],
                changes={"replay.messages_json": json.dumps(new_messages)},
                temperature=temperature,
                on_tool_pause=_auto_tool_handler(self.engine),
                meta={
                    "source": "pressure",
                    "run_id": run_id,
                    "label": run_name,
                },
            )
        except Exception as exc:  # a failed replay is a test result, not a crash
            result.update(
                status="error",
                error=f"{type(exc).__name__}: {exc}",
                duration_ms=(time.time() - started) * 1000,
            )
            return result

        candidate = _signature(replay, replay=True)
        result["replay_id"] = replay["replay_trace_id"]
        result["replay"] = {
            "final_output": candidate["final_output"],
            "tools": candidate["tools"],
            "llm_calls": candidate["llm_calls"],
        }

        check_results = evaluate(baseline, candidate, checks, disabled_reason)
        if not candidate["final_output"].strip():
            check_results.insert(0, {
                "id": "completed",
                "label": "Produced an answer",
                "severity": "fail",
                "status": "fail",
                "detail": "the replay ended without a final answer",
            })
        else:
            check_results.insert(0, {
                "id": "completed",
                "label": "Produced an answer",
                "severity": "fail",
                "status": "pass",
                "detail": "the replay reached a final answer",
            })

        result["checks"] = check_results
        result["status"] = _worst([c["status"] for c in check_results])
        result["duration_ms"] = (time.time() - started) * 1000
        return result


def _auto_tool_handler(engine: ReplayEngine) -> Callable:
    """
    Non-interactive tool policy for automated runs: run tools that were declared
    safe, fall back to the replay alternative, otherwise skip rather than block.
    """
    def handler(tool_name: str, tool_args: Dict[str, Any], original_output: str) -> str:
        options = engine.registry.get_available_options(tool_name)
        if options["can_run_real"]:
            return "run"
        if options["has_alternative"]:
            return "alternative"
        return "skip"

    return handler
