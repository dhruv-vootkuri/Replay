# Replay

**Git for agent execution.** Capture an AI agent run as a tree of spans, then fork any step, change the inputs, and rerun from that point forward to see what would have happened — in seconds, instead of re-running the whole agent from scratch.

When a multi-step agent fails, you don't want to rerun the world. You want to fork the trace at the broken step, apply a fix, and observe the new downstream behavior. Replay does exactly that.

---

## Install

### Requirements

| | |
|---|---|
| **Python** | 3.10 or newer (`python3 --version` to check) |
| **OS** | macOS, Linux, or Windows |
| **OpenAI API key** | Only for *capturing* new traces and for replays/pressure tests — browsing traces already on disk needs no key |
| **Node.js** | Not required. Only for the marketing site in `app/` — the Replay Console dashboard is pure Python |

If you don't have Python 3.10+: [python.org/downloads](https://www.python.org/downloads/), or `brew install python@3.11` on macOS.

### Install

```bash
git clone https://github.com/dhruv-vootkuri/Replay.git
cd Replay

python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

pip install -e ".[demo]"
```

That's it. `pip install -e ".[demo]"` installs the engine, the web console, and the LangChain packages needed to run the included demo agent, and puts a `replay` command on your PATH.

Leave off `[demo]` (`pip install -e .`) if you only want to explore and replay traces and won't be capturing new ones from a LangChain agent.

> Prefer the exact versions this was built against? `pip install -r requirements.txt` instead, then `pip install -e . --no-deps`.

### Verify it worked

The repo ships with real captured traces, so you can confirm everything works before writing a line of code or spending a cent:

```bash
replay list
```

```
4 trace(s) found:

  a7f3521dceaf7e37...
  18 spans  •  3 LLM calls  •  5 tool calls  •  5.3s
  ...
```

Then open the dashboard:

```bash
replay serve                      # → http://localhost:7823
```

Browse the traces, open any span, and read the replay log — all without an API key.

### Add your API key

Needed once you want to capture new traces or run replays and pressure tests (both make real model calls):

```bash
cp .env.example .env
# edit .env and set OPENAI_API_KEY=sk-...
```

Or export it directly:

```bash
export OPENAI_API_KEY=sk-...      # Windows: set OPENAI_API_KEY=sk-...
```

### Capture your first trace

```bash
python demo_agent.py              # runs the included trip-planner agent
replay list                       # your new trace is at the bottom
replay explore <trace_id>         # arrow keys to navigate, Enter to fork
```

### Troubleshooting

| Symptom | Fix |
|---|---|
| `replay: command not found` | The venv isn't active. `source venv/bin/activate` (Windows: `venv\Scripts\activate`) |
| `ModuleNotFoundError: No module named 'replay'` | Same cause — activate the venv, or re-run `pip install -e .` |
| `ModuleNotFoundError: langchain` when running `demo_agent.py` | Installed without the extra. Run `pip install -e ".[demo]"` |
| `AuthenticationError` / 401 from OpenAI | `OPENAI_API_KEY` isn't set or is invalid. See "Add your API key" above |
| `Address already in use` on `replay serve` | Another process has the port. Use `replay serve --port 8080` |
| `No traces found` | You're not in the repo root, or pointing elsewhere. `cd` to the repo, or pass `--dir path/to/traces` |

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

**Forking is repeatable.** When a replay finishes it is saved to its own `{original}.replay.{new}.json`, and the explorer reloads the *original* trace and hands navigation back to you — so you can move to a different span and fork again, as many times as you like in one session. The header tracks how many replays this session has saved. The original trace file is never modified, so every fork starts from the same ground truth.

### Replay Console — the live dashboard

```bash
replay serve            # opens http://localhost:7823
replay serve --port 8080
```

Everything the CLI does, live in a browser. Five views over the same traces directory:

| View | What's in it |
|---|---|
| **Overview** | Traces, spans, LLM calls, tool calls, tokens, replays and pressure-check pass rate at a glance, plus span-mix and tool-usage charts and the most recent activity |
| **Traces** | The trace list and a span tree per trace — open any span for its inputs, output, model and tokens, and fork it in place. Also shows every replay that trace has produced. |
| **Pressure tests** | Pick a system prompt, edit it, and replay it against every stored trace at once (see below) |
| **Replay log** | Every replay ever played — what changed, what the new answer was, and a full span-by-span diff against the original |
| **Tools** | The tool registry: which tools can run for real during a replay, and their saved preferences (editable) |

The console loads `.replay/tool_sources.py` the same way `explore` does, so replays started from the browser can run your tools for real.

### Pressure tests — one prompt against every trace

The workflow this exists for: you fork one trace, edit the system prompt, like the new answer — and now you need to know whether that edit breaks anything the agent has *already* been asked.

```bash
# from the console: Traces → any trace → "Pressure test this prompt against all traces"
# or from a fork result: "Pressure test this prompt against all traces"

# from the CLI:
replay prompts                                            # see the distinct system prompts
replay pressure --set-prompt "You are a terse assistant. Always use the tools."
replay pressure --from-prompt 0 --trace a7f35 --contains Tokyo
replay pressure-log                                       # every run
replay pressure-show <run_id>                             # one run's results
```

Each selected trace is forked at its **entry LLM call** with the candidate prompt swapped in (or added, if the trace had none), then the whole agent loop is replayed — real model calls, real tool calls — and graded against the original run:

| Check | Fails when |
|---|---|
| **Produced an answer** | the replay ended without a final answer |
| **No errored spans** | any replayed span came back with an error status |
| **Tool usage preserved** | the agent stopped calling a tool the original called — the classic way a prompt edit quietly turns a grounded agent into a guessing one |
| **Grounded facts survive** | a tool result that was quoted in the original answer is missing from the new one |
| **Must contain / must not contain / matches pattern** | your own assertions on the new answer |
| **Answer still similar** *(warning)* | word overlap with the original answer drops below a threshold |
| **No extra reasoning steps** *(warning)* | the replay takes more LLM calls than the original, past a tolerance |

Nothing here asks a model to judge a model — every check is something you could verify by hand. Blocking checks fail the run; warnings flag it without failing. Runs stream results live, can be cancelled mid-flight, and are stored under `traces/pressure/` so the history survives a restart. Every replay they produce also lands in the replay log, tagged with the run it came from.

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
| `replay serve [--port N]` | Start the Replay Console — the web dashboard |
| `replay replays [--trace <id>]` | The replay log — every replay ever played, newest first |
| `replay prompts` | Every distinct system prompt across your traces, and which traces use it |
| `replay pressure --set-prompt "…"` | Pressure test a candidate system prompt against every trace |
| `replay pressure-log` | List every pressure run |
| `replay pressure-show <run_id>` | Full per-trace results of one pressure run |

All `<trace_id>`, `<span_id>`, `<replay_id>` and `<run_id>` arguments accept partial prefixes.

---

## Quickstart

Assumes you've done the [Install](#install) above and your venv is active.

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
export OPENAI_API_KEY=sk-...           # or put it in .env
python my_agent.py
replay list                            # see the captured trace
replay explore <trace_id>              # fork at any step
replay serve                           # or browse everything at localhost:7823
```

---

## Architecture

```
replay/
  __init__.py           # replay.init(), replay.explore()
  tools.py              # @replay.tool decorator
  cli.py                # CLI commands (list, show, ids, fork, diff, explore,
                        #   run, serve, replays, prompts, pressure*)
  core/
    setup.py            # TracerProvider + OTel auto-instrumentation
    engine.py           # the replay engine — fork, cascade, downstream rerun
    loader.py           # reads traces from disk
    enrichment.py       # adds replay.* attributes at export time
    tool_registry.py    # tool declarations, preferences, pause decisions
    spans.py            # shared span classification/extraction (one source of truth
                        #   for the CLI, server, replay log and pressure suite)
    replay_log.py       # indexes every played replay + builds original-vs-replay diffs
    pressure.py         # pressure suite — checks, run storage, threaded runner
    span.py             # span helpers
    trace.py            # trace helpers
    tracer.py           # tracer wrappers
  exporters/
    json_exporter.py    # writes spans to local JSON files
  server/
    app.py              # FastAPI API behind the Replay Console
    static/             # dashboard frontend (index.html, app.js, style.css)
traces/                  # captured traces (JSON)
  *.replay.*.json        # every replay played, the replay log reads these
  pressure/*.json        # one file per pressure run — config, results, verdict
.replay/
  tool_preferences.json # saved CLI tool decisions
  tool_sources.py       # snapshotted @replay.tool sources
```

Key design decisions:
- **Enrichment at export time, not via span processor** — some OTel implementations don't allow setting attributes after a span ends; the exporter is the only safe place
- **`tool_call_id_map` is built from all spans before the fork point**, not just ancestors, because in LangGraph the decision LLM span is a sibling of the tool spans, not an ancestor
- **Span type detection uses attributes, not span names**, so the engine works for any OTel-instrumented framework rather than being LangChain-specific
- **A pressure test is just a fork with a policy** — it reuses the same engine path as a manual system-prompt fork, so anything the console can replay by hand, the suite can replay across every trace
- **Pressure checks are deterministic** — no LLM-as-judge. Every verdict traces back to something you could check yourself, which is what makes a red result actionable
- **The replay files are the log** — nothing separate to keep in sync; `replay_log.py` indexes the `*.replay.*.json` the engine already writes

---

## Tech stack

Python 3.11 · OpenTelemetry (api, sdk) · `opentelemetry-instrumentation-openai` · `opentelemetry-instrumentation-langchain` · OpenAI Python SDK · LangChain 1.2 · `click` (CLI) · `blessed` (TUI) · `fastapi` + `uvicorn` (web UI)

---

## Status & limitations

- Tool **"run for real"** during replay only works when the explorer runs in the same process as your `@replay.tool` registrations (use `replay.explore()` programmatically, or `replay run my_agent.py`)
- JSON file storage — fine for local dev; production usage will want a real database
- Tested primarily with LangChain/LangGraph + OpenAI; other OTel-instrumented frameworks should work but have less coverage
- Streaming LLM responses are not yet handled
- Installs from source (`pip install -e .`) — not published to PyPI yet
- A pressure run costs one full agent replay per trace — real model calls, real spend. Start with a few traces before pointing it at everything.
- Pressure runs execute in the server/CLI process with a thread pool; there is no queue or worker, so a very large trace set is better split across runs
