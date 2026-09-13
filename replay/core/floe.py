"""
The entry point for using this package against a Floe API key.

ReplayEngine is only reachable as a child of a validated Floe instance —
there's no way to get a working engine without first passing a valid key
here:

    from replay import Floe

    floe = Floe(api_key="fl-...")
    floe.engine.replay(trace_id=..., fork_span_id=..., changes={...})

Direct `ReplayEngine(...)` construction still works too (the CLI and the
FastAPI server both do it that way, reading REPLAY_API_KEY from the
environment instead) — Floe is the recommended, explicit-key entry point
for embedding this package in your own code, not a replacement for that.
"""
from replay.core.auth import verify_api_key
from replay.core.engine import ReplayEngine


class Floe:
    def __init__(self, api_key: str, traces_dir: str = "traces", floe_url: str = None):
        verify_api_key(api_key, floe_url)
        self.api_key = api_key
        self.floe_url = floe_url
        self.engine = ReplayEngine(traces_dir=traces_dir, api_key=api_key, floe_url=floe_url)
