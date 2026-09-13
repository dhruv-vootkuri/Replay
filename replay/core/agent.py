"""
The pressure agent — pressure tests that re-run themselves.

`replay pressure` answers "is this prompt edit safe?" once, when a human asks.
This runs that same question on a loop: you register a watch (a system prompt
plus the checks it should hold to), and every cycle the agent replays it
against the traces it has not yet covered — new captures included — and tells
you the moment something that used to pass starts failing.

Design constraints, inherited deliberately from pressure.py:

* **No new grading.**  A cycle is a plain `PressureRunner` run.  Every verdict
  still comes from `evaluate()`, so it is still something you could check by
  hand.  Nothing here asks a model to judge a model.
* **Non-interactive.**  Cycles run unattended, so tools use the same
  `_auto_tool_handler` policy the suite already uses: run what was declared
  safe, fall back to the registered alternative, skip rather than block.
* **State is separate from runs.**  Watches live in `traces/agent/`, not
  `traces/pressure/`, because `PressureStore._files()` treats every `*.json`
  under its directory as a run and would try to parse agent state as one.

The regression signal is the point.  A single run tells you a verdict; a watch
remembers the last verdict per trace, so it can say *this trace passed on the
previous cycle and fails now* — which is the thing you actually want paging
you, and it costs nothing extra to compute.
"""
import json
import os
import threading
import time
import uuid
from typing import Any, Callable, Dict, List, Optional

from replay.core import pressure as P
from replay.core.engine import ReplayEngine
from replay.core.loader import TraceLoader


AGENT_DIRNAME = "agent"

# A cycle replays every uncovered trace with real model calls, so the floor is
# deliberately coarse — this is not a millisecond-latency control loop.
MIN_INTERVAL_SECONDS = 30
DEFAULT_INTERVAL_SECONDS = 1800


def parse_interval(text: str) -> int:
    """
    '30s' / '15m' / '2h' -> seconds.  A bare number is minutes, because that is
    what people mean when they type `--every 30`.
    """
    raw = str(text or "").strip().lower()
    if not raw:
        raise ValueError("empty interval")

    units = {"s": 1, "m": 60, "h": 3600, "d": 86400}
    if raw[-1] in units:
        value, multiplier = raw[:-1], units[raw[-1]]
    else:
        value, multiplier = raw, 60

    try:
        seconds = int(float(value) * multiplier)
    except ValueError:
        raise ValueError(f"could not read '{text}' as an interval (try 30s, 15m, 2h)")

    if seconds < MIN_INTERVAL_SECONDS:
        raise ValueError(
            f"interval {text} is below the {MIN_INTERVAL_SECONDS}s floor — "
            "each cycle is a full agent replay per trace"
        )
    return seconds


def format_interval(seconds: int) -> str:
    for unit, size in (("h", 3600), ("m", 60)):
        if seconds >= size and seconds % size == 0:
            return f"{seconds // size}{unit}"
    return f"{seconds}s"


# ------------------------------------------------------------------ #
# Watch storage                                                        #
# ------------------------------------------------------------------ #

class WatchStore:
    """Watches on disk, one JSON file per watch. Mirrors PressureStore."""

    def __init__(self, traces_dir: str = "traces"):
        self.dir = os.path.join(traces_dir, AGENT_DIRNAME)

    def path_for(self, watch_id: str) -> str:
        return os.path.join(self.dir, f"{watch_id}.json")

    def save(self, watch: Dict[str, Any]) -> None:
        os.makedirs(self.dir, exist_ok=True)
        tmp = self.path_for(watch["watch_id"]) + ".tmp"
        with open(tmp, "w") as f:
            json.dump(watch, f, indent=2)
        os.replace(tmp, self.path_for(watch["watch_id"]))

    def load(self, watch_id: str) -> Optional[Dict[str, Any]]:
        path = self.path_for(watch_id)
        if not os.path.exists(path):
            for candidate in self._files():  # allow partial IDs, as elsewhere
                if os.path.basename(candidate).startswith(watch_id):
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
        watches = []
        for path in self._files():
            try:
                with open(path) as f:
                    watches.append(json.load(f))
            except (OSError, json.JSONDecodeError):
                continue
        return watches

    def delete(self, watch_id: str) -> bool:
        watch = self.load(watch_id)
        if watch is None:
            return False
        path = self.path_for(watch["watch_id"])
        if os.path.exists(path):
            os.remove(path)
            return True
        return False


# ------------------------------------------------------------------ #
# The agent                                                            #
# ------------------------------------------------------------------ #

class PressureAgent:
    """
    Drives watches on an interval.

    One cycle = pick the traces this watch has not covered yet (or all of them,
    on a full sweep), hand them to a normal PressureRunner run, wait for it,
    then diff the per-trace verdicts against what they were last cycle.
    """

    def __init__(self, traces_dir: str = "traces", engine: Optional[ReplayEngine] = None):
        self.traces_dir = traces_dir
        self.loader = TraceLoader(traces_dir)
        self.engine = engine or ReplayEngine(traces_dir)
        self.runner = P.PressureRunner(traces_dir, engine=self.engine)
        self.store = WatchStore(traces_dir)
        self._stop = threading.Event()

    # -- watches ------------------------------------------------------ #

    def create_watch(
        self,
        system_prompt: str,
        name: str = "",
        checks: Optional[Dict[str, Any]] = None,
        interval_seconds: int = DEFAULT_INTERVAL_SECONDS,
        temperature: float = 0.0,
        concurrency: int = 2,
        trace_ids: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        watch = {
            "watch_id": uuid.uuid4().hex,
            "name": name or f"Watch {time.strftime('%b %d %H:%M')}",
            "created_at": time.time(),
            "system_prompt": system_prompt,
            "checks": checks or P.default_check_config(),
            "interval_seconds": interval_seconds,
            "temperature": temperature,
            "concurrency": concurrency,
            # None = every trace, re-evaluated each cycle so new captures are
            # picked up automatically. A fixed list pins the watch instead.
            "pinned_trace_ids": list(trace_ids) if trace_ids else None,
            "covered_trace_ids": [],      # what we have already graded
            "last_status": {},            # trace_id -> last verdict
            "cycles": [],                 # newest last; trimmed to CYCLE_HISTORY
            "last_run_at": None,
            "enabled": True,
        }
        self.store.save(watch)
        return watch

    CYCLE_HISTORY = 20

    def pending_traces(self, watch: Dict[str, Any], full: bool = False) -> List[str]:
        """Traces this cycle should grade."""
        if watch.get("pinned_trace_ids"):
            available = [
                t for t in self.loader.list_traces()
                if t in set(watch["pinned_trace_ids"])
            ]
        else:
            available = self.loader.list_traces()

        if full:
            return list(reversed(available))

        covered = set(watch.get("covered_trace_ids") or [])
        return [t for t in reversed(available) if t not in covered]

    # -- one cycle ---------------------------------------------------- #

    def run_cycle(
        self,
        watch_id: str,
        full: bool = False,
        on_event: Optional[Callable[[str, Dict[str, Any]], None]] = None,
    ) -> Dict[str, Any]:
        """
        Run a single cycle. Returns a cycle record; also appended to the watch.

        `on_event` receives ("cycle_start" | "run_done" | "cycle_done", payload)
        so a CLI can stream progress without this module importing click.
        """
        watch = self.store.load(watch_id)
        if watch is None:
            raise KeyError(watch_id)

        targets = self.pending_traces(watch, full=full)
        started = time.time()

        cycle: Dict[str, Any] = {
            "cycle_id": uuid.uuid4().hex[:12],
            "started_at": started,
            "finished_at": None,
            "full_sweep": full,
            "trace_ids": targets,
            "run_id": None,
            "verdict": "pass",
            "totals": {},
            "regressions": [],   # passed before, not now — the reason this exists
            "recoveries": [],    # failed before, passing now
            "new_traces": [],
            "skipped": False,
        }

        if on_event:
            on_event("cycle_start", {"watch": watch, "cycle": cycle})

        if not targets:
            # Nothing new since last time. Record it cheaply and move on —
            # an idle cycle should not cost a model call.
            cycle.update(finished_at=time.time(), skipped=True, verdict="idle")
            self._append_cycle(watch_id, cycle, {})
            if on_event:
                on_event("cycle_done", {"cycle": cycle})
            return cycle

        covered = set(watch.get("covered_trace_ids") or [])
        cycle["new_traces"] = [t for t in targets if t not in covered]

        run = self.runner.create(
            system_prompt=watch["system_prompt"],
            trace_ids=targets,
            checks=watch["checks"],
            name=f"{watch['name']} · cycle {len(watch.get('cycles', [])) + 1}",
            temperature=watch.get("temperature", 0.0),
            concurrency=watch.get("concurrency", 2),
            # A watch re-runs its OWN saved prompt, which is usually the prompt
            # the trace already ran on. Without this, _run_one skips every
            # trace as "already runs on the candidate prompt" and a cycle is a
            # no-op that silently reports nothing.
            include_unchanged=True,
        )
        cycle["run_id"] = run["run_id"]
        self.runner.start(run["run_id"])

        while self.runner.is_running(run["run_id"]):
            if self._stop.is_set():
                self.runner.cancel(run["run_id"])
                break
            time.sleep(0.4)

        final = self.runner.store.load(run["run_id"]) or run
        cycle["totals"] = final.get("totals", {})
        cycle["verdict"] = final.get("verdict", "pending")

        previous = dict(watch.get("last_status") or {})
        current: Dict[str, str] = {}
        for result in final.get("results", []):
            trace_id = result["trace_id"]
            status = result.get("status", "pending")
            current[trace_id] = status

            was, now = previous.get(trace_id), status
            if was in ("pass", "warn") and now in ("fail", "error"):
                cycle["regressions"].append({
                    "trace_id": trace_id,
                    "was": was,
                    "now": now,
                    "question": result.get("question", ""),
                    "failed_checks": [
                        c["label"] for c in result.get("checks", [])
                        if c["status"] in ("fail", "error")
                    ],
                    "replay_id": result.get("replay_id"),
                })
            elif was in ("fail", "error") and now in ("pass", "warn"):
                cycle["recoveries"].append({
                    "trace_id": trace_id, "was": was, "now": now,
                })

        cycle["finished_at"] = time.time()
        self._append_cycle(watch_id, cycle, current)

        if on_event:
            on_event("cycle_done", {"cycle": cycle, "run": final})
        return cycle

    def _append_cycle(
        self, watch_id: str, cycle: Dict[str, Any], statuses: Dict[str, str]
    ) -> None:
        watch = self.store.load(watch_id)
        if watch is None:
            return
        watch.setdefault("cycles", []).append(cycle)
        watch["cycles"] = watch["cycles"][-self.CYCLE_HISTORY:]
        watch["last_run_at"] = cycle["finished_at"] or time.time()
        if statuses:
            watch["last_status"] = {**(watch.get("last_status") or {}), **statuses}
            watch["covered_trace_ids"] = sorted(
                set(watch.get("covered_trace_ids") or []) | set(statuses)
            )
        self.store.save(watch)

    # -- the loop ----------------------------------------------------- #

    def stop(self) -> None:
        self._stop.set()

    def loop(
        self,
        watch_id: str,
        once: bool = False,
        full_first: bool = True,
        on_event: Optional[Callable[[str, Dict[str, Any]], None]] = None,
    ) -> None:
        """
        Run cycles until stopped. The first cycle is a full sweep by default so
        there is a baseline to detect regressions against; later cycles only
        pick up traces that appeared since.
        """
        self._stop.clear()
        first = True

        while not self._stop.is_set():
            watch = self.store.load(watch_id)
            if watch is None or not watch.get("enabled", True):
                return

            self.run_cycle(
                watch_id,
                full=(first and full_first),
                on_event=on_event,
            )
            first = False

            if once:
                return

            interval = watch.get("interval_seconds", DEFAULT_INTERVAL_SECONDS)
            if on_event:
                on_event("sleeping", {"seconds": interval})
            # Event-based wait so a stop lands immediately instead of after the
            # full interval.
            if self._stop.wait(timeout=interval):
                return
