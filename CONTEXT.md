# Replay — Agent Trace Replay SDK

## What this is
Replay is a Python SDK that captures AI agent runs as replayable traces.
Engineers instrument their agent with one line, then fork any trace at any
span, change the inputs, and rerun from that point forward to debug failures.

Think: git for agent execution. You capture a run, fork it at the moment
things went wrong, change something, and see what would have happened.

## The core primitive
A trace is a tree of spans. Each span is one operation — an LLM call, a
tool call, a workflow step. Spans have parent-child relationships forming
a tree. The replay engine forks at any node, fast-forwards ancestors as
cached, reruns downstream LLM calls with updated context.

## Current file structure
```
replay/
  __init__.py           # engineers call replay.init() here
  tools.py              # @replay.tool decorator
  cli.py                # CLI commands: list, show, ids, fork, diff, explore
  core/
    setup.py            # TracerProvider, OpenTelemetry instrumentation
    engine.py           # replay engine — the core product
    loader.py           # reads traces from disk
    enrichment.py       # enriches spans with replay-specific attributes
    tool_registry.py    # tool declarations, preferences, pause decisions
  exporters/
    json_exporter.py    # writes spans to local JSON files
traces/                 # captured traces stored here
.replay/
  tool_preferences.json # saved CLI tool decisions
```

## How instrumentation works
Uses OpenTelemetry with auto-instrumentation for OpenAI and LangChain.
The enrichment processor runs at export time and adds:
- `replay.messages_json` — exact messages array on LLM spans
- `replay.tool_call_map_json` — tool_call_id to tool_name mapping
- `replay.tool_result` — unwrapped clean tool result (not LangChain blob)

This means the replay engine never reconstructs data from flattened
attributes — it reads pre-built structures directly.

## How replay works
1. Load trace, find fork span, get ancestors
2. Build context — tool_results and tool_call_id_map from all spans
   before fork point (not just ancestors — decision LLM span is often
   a sibling not an ancestor)
3. Fast forward ancestors as cached spans
4. Apply attribute overrides to fork span — no re-execution, engineer's
   changes are ground truth
5. Update context with changed attributes
6. For each descendant:
   - LLM span → read replay.messages_json, inject updated tool results
     using tool_call_id_map, rerun with OpenAI
   - Tool span → consult tool registry for decision
   - Everything else → copy as downstream
7. Save replay file as {original_trace_id}.replay.{replay_trace_id}.json

## Tool registry and pause mechanism
Engineers can declare tools with @replay.tool(safe=True/False).
During replay, tool spans go through this decision hierarchy:
1. Has saved CLI preference → use it automatically, no pause
2. No preference → pause and ask:
   - run (only shown if safe=True declared)
   - alternative (only shown if replay_fn defined)
   - provide (always shown — engineer manually enters expected output)
   - skip (always shown — use cached output from original trace)
   - stop (always shown)
After deciding, engineer can save preference for future replays.

## The explore command
Interactive terminal UI using blessed library.
Engineer navigates trace tree with arrow keys, presses Enter to fork.
Shows inputs for each span inline. Engineer edits inputs, replay runs.
For tool spans with real-world consequences, pause mechanism applies.
When called programmatically (replay.explore()) from within the
engineer's process, registered tools can execute for real with new args.
When called from CLI, tools pause and ask for manual output since CLI
is a separate process with no access to engineer's functions.

## Key technical decisions
- OpenTelemetry for capture — framework agnostic, works with anything
  OTel instruments (LangChain, LlamaIndex, raw OpenAI, etc.)
- Enrichment at export time not span processor — span processors can't
  set attributes after span ends in some OTel implementations
- tool_call_id_map built from all spans before fork point not just
  ancestors — decision LLM span is sibling of tool spans in LangGraph
- LangChain tool results are JSON blobs, unwrapped via replay.tool_result
- _is_llm_span and _is_tool_span check attributes not span names —
  framework agnostic, works for any OTel-instrumented framework

## What works right now
- replay.init() — one line setup
- Trace capture — OpenAI and LangChain auto-instrumented
- Span enrichment — replay-specific attributes added at export
- Trace storage — JSON files in traces/
- Trace loading and traversal — loader.py
- Tool registry — @replay.tool decorator, preferences, pause
- Replay engine — fork, cascade, downstream LLM rerun
- CLI — list, show, ids, fork, diff, explore

## What needs to be built next
1. Fix _is_llm_span and _is_tool_span to use attributes not span names
2. replay.explore() as programmatic entrypoint
3. replay run my_agent.py CLI command
4. Preferences CLI (replay preferences list/clear)
5. Web visualization UI
6. pip package setup

## Known limitations
- Tool "run for real" only works programmatically (process boundary)
- JSON file storage — needs real database for production
- Only tested with LangChain/LangGraph + OpenAI
- Streaming LLM responses not handled

## Tech stack
- Python 3.11
- OpenTelemetry (opentelemetry-api, opentelemetry-sdk)
- opentelemetry-instrumentation-openai
- opentelemetry-instrumentation-langchain
- LangChain 1.2 (uses create_agent, not AgentExecutor)
- click (CLI)
- blessed (interactive terminal UI)
- OpenAI Python SDK

## Test files
- test_setup.py — basic OpenAI capture test
- test_multi_span.py — full LangChain agent with two tools
- test_registry.py — tool registry test
- run_replay.py — CLI entrypoint (python run_replay.py <command>)