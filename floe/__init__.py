import os
import atexit

from floe.core.setup import setup_tracing, get_tracer
from floe.core.loader import TraceLoader
from floe.core.engine import ReplayEngine
from floe.core.floe import Floe
from floe.core.tool_registry import get_registry
from floe.tools import tool


def init(api_key: str = None, output_dir: str = "traces", exporter=None):
    """
    Initialize replay tracing.
    Returns the TracerProvider so callers can force_flush if needed.

    If the REPLAY environment variable is set, automatically opens the
    explore UI when the script exits — no extra code needed:

        REPLAY=1 python my_agent.py
    """
    provider = setup_tracing(exporter=exporter, output_dir=output_dir)

    if os.environ.get("REPLAY"):
        def _on_exit():
            try:
                from opentelemetry import trace as otel_trace
                otel_trace.get_tracer_provider().force_flush()
            except Exception:
                pass
            explore(traces_dir=output_dir)

        atexit.register(_on_exit)

    return provider


def explore(trace_id: str = None, traces_dir: str = "traces"):
    """
    Open the interactive explore UI in the current process.

    All tools registered via @replay.tool in this process are available —
    fork can run them for real without hitting the process boundary.

    Args:
        trace_id:   trace to open (partial ID ok). Defaults to latest.
        traces_dir: where traces are stored. Defaults to "traces".

    Usage:
        floe.explore()                    # latest trace
        floe.explore("f6caa")             # specific trace
        floe.explore(traces_dir="runs")   # custom directory
    """
    from floe.cli import _run_explore

    loader = TraceLoader(traces_dir)
    all_traces = loader.list_traces()

    if not all_traces:
        print("No traces found. Run your agent with floe.init() first.")
        return

    if trace_id:
        matches = [t for t in all_traces if t.startswith(trace_id)]
        if not matches:
            print(f"No trace found matching: {trace_id}")
            return
        full_trace_id = matches[0]
    else:
        full_trace_id = all_traces[-1]

    _run_explore(full_trace_id, traces_dir)


span = get_tracer
loader = TraceLoader
engine = ReplayEngine