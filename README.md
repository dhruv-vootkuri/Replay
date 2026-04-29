# Replay

**Git for agent execution.** Capture an AI agent run as a tree of spans, then fork any step, change the inputs, and rerun from that point forward to see what would have happened — in seconds, instead of re-running the whole agent from scratch.

When a multi-step agent fails, you don't want to rerun the world. You want to fork the trace at the broken step, apply a fix, and observe the new downstream behavior. Replay does exactly that.

---

## Features

### One-line instrumentation

```python
import replay
replay.init()
```

That's the whole setup. Replay attaches to OpenTelemetry and auto-instruments anything OTel knows about.

### Framework-agnostic capture

Built on OpenTelemetry, so it captures runs from anything OTel can see:
- **OpenAI** Python SDK (auto-instrumented)
- **LangChain / LangGraph** (auto-instrumented, including `create_agent`)
- **LlamaIndex**, raw OTel spans, and any other OTel-instrumented framework
- Tool calls, LLM calls, agent workflows, custom spans

### Fork-and-replay engine

Pick any span in any captured trace and fork it:

1. Ancestors of the fork point are kept as **cached** (not re-executed)
2. The fork span gets your **attribute overrides** applied — your changes are ground truth, no re-execution of that step
3. **Downstream LLM calls** are re-run with updated context (new tool results threaded in via `tool_call_id`, new messages rebuilt from `replay.messages_json`)
4. **Downstream tool calls** consult the tool registry to decide whether to run for real, use an alternative, accept a manually provided output, or skip
5. The replay is saved as `{original_trace_id}.replay.{replay_trace_id}.json` so you can diff it against the original

### Tool registry with pause/resume

Declare your tools so replay knows how to handle them when they're hit downstream of a fork:

```python
@replay.tool(safe=True)            # safe to run for real during replay
def get_weather(city: str): ...

@replay.tool(safe=False)           # has real-world side effects — replay will pause
def send_email(to: str, body: str): ...

@replay.tool(replay_fn=mock_db)    # provide an alternative impl just for replay
def query_prod_db(sql: str): ...
```

When a tool span is hit during replay, the engine consults this decision hierarchy:

1. **Saved CLI preference** → run automatically with the user's prior choice
2. **No preference** → pause and prompt the user:
   - **run** — execute the real tool (only if `safe=True`)
   - **alternative** — call the registered `replay_fn` (only if defined)
   - **provide** — manually type the expected output
   - **skip** — reuse the cached output from the original trace
   - **stop** — abort the replay

Decisions can be saved to `.replay/tool_preferences.json` for future runs.

### Interactive terminal explorer

```bash
replay explore <trace_id>
```

A `blessed`-based TUI that renders the trace as a navigable tree. Arrow keys to move, Enter to fork at the highlighted span. Inputs are shown inline; you edit them in place and the replay runs against your edits. Forkable spans (LLM and tool) are marked with a green diamond.

### Web visualization UI

```bash
replay serve            # opens http://localhost:7823
replay serve --port 8080
```

A FastAPI + static-frontend dashboard for browsing and diffing traces in the browser, with the same fork/replay semantics as the CLI.

### Auto-explore on exit

Set the `REPLAY` env var and the explorer opens automatically when your script finishes:

```bash
REPLAY=1 python my_agent.py
```

No code changes needed beyond `replay.init()`.

### Programmatic exploration

Open the explorer from inside your own process — useful when you want registered tools to actually execute during fork (CLI invocations are a separate process and can't reach back into your tool functions):

```python
import replay
replay.init()
run_my_agent()
replay.explore()                     # open the latest trace
replay.explore("f6caa")              # specific trace by partial ID
```

### Run-and-explore in one command

```bash
replay run my_agent.py
```

Executes your script in the current process (so `@replay.tool` registrations stay live), captures the trace, and drops you straight into the explorer when it finishes.

### Diff replays against originals

```bash
replay diff <replay_id>
```

Side-by-side `before` / `after` comparison for every changed span: forked attributes, re-run LLM outputs, and which spans were cached vs. re-executed.

### Span enrichment

At export time, replay adds three attributes to every span so the engine never has to reconstruct data from flattened OTel attributes:

- `replay.messages_json` — full messages array on LLM spans
- `replay.tool_call_map_json` — `tool_call_id` → `tool_name` mapping
- `replay.tool_result` — unwrapped tool result (LangChain wraps results in JSON blobs; this is the clean version)

### Saved tool sources

The first time you run an agent script, replay snapshots your `@replay.tool` function definitions to `.replay/tool_sources.py`. That means you can `replay explore` later **without re-running the agent**, and the explorer can still execute your tools for real.

If your tool implementations change, refresh the snapshot:

```bash
replay explore <trace_id> --reload-tools my_agent.py
```

---

## CLI reference

| Command | What it does |
|---|---|
| `replay list` | List all captured traces with span counts and durations |
| `replay show <trace_id>` | Render a trace as an indented timeline with inputs/outputs/tokens |
| `replay ids <trace_id>` | Same as `show`, but prints span IDs (useful before forking) |
| `replay fork <trace_id> <span_id> --set attr=value [--set ...]` | Fork at a span, override attributes, rerun downstream |
| `replay diff <replay_id>` | Compare a replay against its original trace |
| `replay explore <trace_id>` | Interactive TUI for navigating and forking |
| `replay run <script.py>` | Run an agent script and explore the resulting trace |
| `replay serve [--port N]` | Start the web visualization UI |

All `<trace_id>` and `<span_id>` arguments accept partial prefixes.

---

## Quickstart

```python
# my_agent.py
import replay
from langchain.agents import create_agent
# ...

replay.init()                         # one line

@replay.tool(safe=True)
def get_weather(city: str) -> str:
    return f"It's sunny in {city}."

agent = create_agent(model="gpt-4", tools=[get_weather])
agent.invoke({"messages": [{"role": "user", "content": "Weather in Paris?"}]})
```

```bash
python my_agent.py
replay list                            # see the captured trace
replay explore <trace_id>              # fork at any step
```

---

## Architecture

```
replay/
  __init__.py           # replay.init(), replay.explore()
  tools.py              # @replay.tool decorator
  cli.py                # CLI commands (list, show, ids, fork, diff, explore, run, serve)
  core/
    setup.py            # TracerProvider + OTel auto-instrumentation
    engine.py           # the replay engine — fork, cascade, downstream rerun
    loader.py           # reads traces from disk
    enrichment.py       # adds replay.* attributes at export time
    tool_registry.py    # tool declarations, preferences, pause decisions
    span.py             # span helpers
    trace.py            # trace helpers
    tracer.py           # tracer wrappers
  exporters/
    json_exporter.py    # writes spans to local JSON files
  server/
    app.py              # FastAPI web UI
    static/             # frontend (index.html, app.js, style.css)
traces/                  # captured traces (JSON)
.replay/
  tool_preferences.json # saved CLI tool decisions
  tool_sources.py       # snapshotted @replay.tool sources
```

Key design decisions:
- **Enrichment at export time, not via span processor** — some OTel implementations don't allow setting attributes after a span ends; the exporter is the only safe place
- **`tool_call_id_map` is built from all spans before the fork point**, not just ancestors, because in LangGraph the decision LLM span is a sibling of the tool spans, not an ancestor
- **Span type detection uses attributes, not span names**, so the engine works for any OTel-instrumented framework rather than being LangChain-specific

---

## Tech stack

Python 3.11 · OpenTelemetry (api, sdk) · `opentelemetry-instrumentation-openai` · `opentelemetry-instrumentation-langchain` · OpenAI Python SDK · LangChain 1.2 · `click` (CLI) · `blessed` (TUI) · `fastapi` + `uvicorn` (web UI)

---

## Status & limitations

- Tool **"run for real"** during replay only works when the explorer runs in the same process as your `@replay.tool` registrations (use `replay.explore()` programmatically, or `replay run my_agent.py`)
- JSON file storage — fine for local dev; production usage will want a real database
- Tested primarily with LangChain/LangGraph + OpenAI; other OTel-instrumented frameworks should work but have less coverage
- Streaming LLM responses are not yet handled
- No pip package yet — install from source
