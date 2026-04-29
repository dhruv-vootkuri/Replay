import replay
from replay.core.loader import TraceLoader

# load all traces on disk
loader = TraceLoader()
traces = loader.list_traces()

print(f"Found {len(traces)} trace(s):")
for trace_id in traces:
    print(f"\nTrace: {trace_id}")
    
    root = loader.get_root_span(trace_id)
    print(f"Root span: {root['name']}")
    print(f"Duration: {root['duration_ms']:.0f}ms")
    print(f"Input: {root['attributes'].get('gen_ai.prompt.0.content')}")
    print(f"Output: {root['attributes'].get('gen_ai.completion.0.content')}")