from replay.core.loader import TraceLoader
from replay.core.engine import ReplayEngine

loader = TraceLoader()
engine = ReplayEngine()

# load the most recent trace
traces = loader.list_traces()
trace_id = traces[-1]
print(f"Replaying trace: {trace_id}")

# find the first ChatOpenAI.chat span — this is what we'll fork
trace = loader.load(trace_id)
llm_span = next(
    s for s in trace["spans"]
    if s["name"] == "ChatOpenAI.chat"
)

print(f"Forking at: {llm_span['name']} ({llm_span['span_id']})")
print(f"Original input: {llm_span['attributes'].get('gen_ai.prompt.0.content')}")

# replay with a different question
result = engine.replay(
    trace_id=trace_id,
    fork_span_id=llm_span["span_id"],
    change={"input": "What is the capital of Germany and what is its population?"},
    temperature=0.0
)

print(f"\n--- REPLAY RESULT ---")
print(f"Replay trace ID: {result['replay_trace_id']}")
print(f"Summary: {result['summary']}")
print(f"Total replayed spans: {len(result['spans'])}")

# find the forked span and show what changed
forked = next(s for s in result["spans"] if s.get("replay_type") == "forked")
print(f"\nForked span output:")
print(forked["attributes"].get("gen_ai.completion.0.content"))