import type { Trace, Span, Replay, ReplayType } from "./types";

// Client-side fork simulation.
//
// The real `replay fork` command hands the fork point + downstream spans to the
// Python ReplayEngine, which makes live API calls. That engine isn't wired into
// this static console, so we reproduce the part that IS deterministic — which
// spans are cached vs. forked vs. re-run downstream — and produce an
// illustrative new output. Results are badged "simulated" in the UI.

export interface SimulatedReplay extends Replay {
  simulated: true;
  downstream_count: number;
}

function classify(spans: Span[], forkIdx: number): ReplayType[] {
  return spans.map((_, i) => (i < forkIdx ? "cached" : i === forkIdx ? "forked" : "downstream"));
}

// Best-effort illustrative output: substitute the changed value into the
// original final answer so the diff reads sensibly.
function deriveNewOutput(original: string, changed: Record<string, [string, string]>): string {
  let out = original;
  for (const [, [before, after]] of Object.entries(changed)) {
    if (before && after && before !== after && out.includes(before)) {
      out = out.split(before).join(after);
    }
  }
  if (out === original && Object.keys(changed).length) {
    const [, [before, after]] = Object.entries(changed)[0];
    out = `${original}\n\n↳ re-run with ${Object.keys(changed)[0]} "${before}" → "${after}"`;
  }
  return out;
}

export function simulateFork(
  trace: Trace,
  spanId: string,
  newInputs: Record<string, string>,
): SimulatedReplay {
  const spans = trace.spans;
  const forkIdx = spans.findIndex((s) => s.span_id === spanId);
  const forkSpan = spans[forkIdx];
  const types = classify(spans, forkIdx);

  // Build human-readable change map: field -> [before, after]
  const changePairs: Record<string, [string, string]> = {};
  const originalInputs = forkSpan.inputs;
  for (const [k, v] of Object.entries(newInputs)) {
    const before = originalInputs[k] ?? "";
    if (String(before) !== String(v)) changePairs[k] = [String(before), String(v)];
  }

  const originalFinal =
    [...spans].reverse().find((s) => s.kind === "llm" && s.output)?.output ?? "";
  const newFinal = deriveNewOutput(originalFinal, changePairs);

  const replaySpans: Span[] = spans.map((s, i) => {
    const rt = types[i];
    const copy: Span = { ...s, replay_type: rt };
    if (rt === "forked") {
      copy.changes_applied = Object.fromEntries(
        Object.entries(changePairs).map(([k, [, after]]) => [k, after]),
      );
      copy.field_changes = Object.entries(changePairs).map(([field, [before, after]]) => ({
        field,
        before,
        after,
      }));
      if (s.kind === "tool") copy.output = `(re-run) ${Object.values(newInputs)[0] ?? s.output}`;
    }
    if (rt === "downstream" && s.kind === "llm" && s.output) copy.output = newFinal;
    return copy;
  });

  const downstream = replaySpans.filter((s) => s.replay_type === "downstream").length;
  const changeStr = Object.entries(changePairs)
    .map(([k, [, after]]) => `${k}='${after}'`)
    .join(", ");

  return {
    simulated: true,
    replay_trace_id: `sim-${trace.trace_id.slice(0, 8)}-${forkSpan.span_id.slice(0, 6)}`,
    original_trace_id: trace.trace_id,
    fork_span_id: forkSpan.span_id,
    fork_span_name: forkSpan.display_name,
    created_at: new Date().toISOString(),
    changes: Object.fromEntries(Object.entries(changePairs).map(([k, [, a]]) => [k, a])),
    summary: `Forked at '${forkSpan.display_name}' with changes: ${changeStr || "(none)"}. ${downstream} downstream span(s) affected.`,
    final_output_before: originalFinal,
    final_output_after: newFinal,
    downstream_count: downstream,
    spans: replaySpans,
  };
}
