import click
import json
import os
import sys
from floe.core.loader import TraceLoader
from floe.core.engine import ReplayEngine
from floe.core.auth import InvalidApiKey, verify_api_key

def _build_tree_nodes(spans, spans_by_id):
    """
    Builds a flat list of nodes with depth information
    for rendering the trace as an indented tree.
    """
    def get_depth(span_id, memo={}):
        if span_id in memo:
            return memo[span_id]
        span = spans_by_id.get(span_id)
        if not span or not span.get("parent_span_id"):
            memo[span_id] = 0
            return 0
        depth = 1 + get_depth(span["parent_span_id"], memo)
        memo[span_id] = depth
        return depth

    nodes = []
    for span in spans:
        nodes.append({
            "span": span,
            "depth": get_depth(span["span_id"])
        })

    return nodes


# color helpers so the output is readable
def green(text): return click.style(str(text), fg="green")
def red(text): return click.style(str(text), fg="red")
def yellow(text): return click.style(str(text), fg="yellow")
def blue(text): return click.style(str(text), fg="blue")
def grey(text): return click.style(str(text), fg="bright_black")
def bold(text): return click.style(str(text), bold=True)


def _is_llm_span(span):
    attrs = span.get("attributes", {})
    return (
        "gen_ai.input.messages" in attrs
        or "gen_ai.system_instructions" in attrs
        or any(k.startswith("gen_ai.prompt.") for k in attrs)
    )


def _is_tool_span(span):
    attrs = span.get("attributes", {})
    return "gen_ai.tool.name" in attrs and "gen_ai.tool.call.result" in attrs


def span_type_color(replay_type):
    """Color code spans by their replay type."""
    if replay_type == "cached":
        return grey
    elif replay_type == "forked":
        return yellow
    elif replay_type == "downstream":
        return blue
    else:
        return lambda x: x


def format_duration(ms):
    """Format duration nicely."""
    if ms is None:
        return "?"
    if ms < 1:
        return f"{ms:.2f}ms"
    if ms < 1000:
        return f"{ms:.0f}ms"
    return f"{ms/1000:.1f}s"


def format_span_name(span):
    """Format a span name with its type indicator."""
    name = span["name"]

    if _is_tool_span(span):
        tool_name = span.get("attributes", {}).get("gen_ai.tool.name", "")
        label = f"[tool] {tool_name or name}"
    elif _is_llm_span(span):
        label = f"[llm]  {name}"
    elif "workflow" in name or "invoke_agent" in name:
        label = f"[agent] {name}"
    elif "execute_task" in name:
        label = f"[task] {name}"
    else:
        label = f"[span] {name}"

    return label


@click.group()
def floe():
    """
    Floe — the API-key-gated CLI. `replay` is the only subcommand group
    today, but this top level is where anything else Floe-side would live.
    """
    # This callback runs before Click resolves *any* subcommand, including
    # `floe replay --help` and bare `floe replay` (which should just list
    # replay's own subcommands) — without this early return, both used to
    # fail on a missing/invalid key before ever reaching Click's own help
    # text, making the CLI's commands undiscoverable without a key first.
    # `len(sys.argv) <= 2` catches the bare-group case (`floe`, `floe
    # replay`); it'd need revisiting if a leaf command is ever added
    # directly under `floe` itself rather than under `replay`.
    if "--help" in sys.argv or "-h" in sys.argv or len(sys.argv) <= 2:
        return
    try:
        verify_api_key()
    except InvalidApiKey as exc:
        click.echo(click.style(f"Error: {exc}", fg="red"), err=True)
        sys.exit(1)


@floe.group()
def replay():
    """Fork any agent trace at any step and see what would have happened."""
    pass


@replay.command(name="list")
@click.option("--dir", "traces_dir", default="traces", help="Traces directory")
def list_cmd(traces_dir):
    """List all captured traces."""
    loader = TraceLoader(traces_dir)
    traces = loader.list_traces()

    if not traces:
        click.echo("No traces found. Run your agent with floe.init() to capture traces.")
        return

    click.echo(bold(f"\n{len(traces)} trace(s) found:\n"))

    for trace_id in reversed(traces):  # newest first
        trace = loader.load(trace_id)
        spans = trace["spans"]

        # find root span
        root = next((s for s in spans if s["parent_span_id"] is None), None)
        if not root:
            continue

        # calculate total duration
        duration = root.get("duration_ms")

        # count span types
        llm_spans = [s for s in spans if _is_llm_span(s)]
        tool_spans = [s for s in spans if _is_tool_span(s)]

        click.echo(f"  {bold(trace_id[:16])}...")
        click.echo(f"  {grey(trace['created_at'])}")
        click.echo(f"  {len(spans)} spans  •  {len(llm_spans)} LLM calls  •  {len(tool_spans)} tool calls  •  {format_duration(duration)}")
        click.echo()


@replay.command()
@click.argument("trace_id")
@click.option("--dir", "traces_dir", default="traces", help="Traces directory")
def show(trace_id, traces_dir):
    """Show a trace as a timeline."""
    loader = TraceLoader(traces_dir)

    # allow partial trace ID — match the first trace that starts with it
    all_traces = loader.list_traces()
    matches = [t for t in all_traces if t.startswith(trace_id)]

    if not matches:
        click.echo(red(f"No trace found matching: {trace_id}"))
        return

    full_trace_id = matches[0]
    trace = loader.load(full_trace_id)
    spans = trace["spans"]

    # sort by start time
    spans.sort(key=lambda s: s["start_time"])

    # find root
    root = next((s for s in spans if s["parent_span_id"] is None), None)
    total_duration = root["duration_ms"] if root else None

    click.echo()
    click.echo(bold(f"Trace: {full_trace_id}"))
    click.echo(grey(f"Captured: {trace['created_at']}"))
    click.echo(grey(f"Duration: {format_duration(total_duration)}"))
    click.echo(grey(f"Spans: {len(spans)}"))
    click.echo()
    click.echo(bold("Timeline:"))
    click.echo()

    # calculate indentation based on tree depth
    def get_depth(span_id, spans_by_id, memo={}):
        if span_id in memo:
            return memo[span_id]
        span = spans_by_id.get(span_id)
        if not span or not span["parent_span_id"]:
            memo[span_id] = 0
            return 0
        depth = 1 + get_depth(span["parent_span_id"], spans_by_id, memo)
        memo[span_id] = depth
        return depth

    spans_by_id = {s["span_id"]: s for s in spans}

    for i, span in enumerate(spans):
        depth = get_depth(span["span_id"], spans_by_id)
        indent = "  " * depth
        connector = "└─ " if depth > 0 else ""

        label = format_span_name(span)
        duration = format_duration(span.get("duration_ms"))
        status = span.get("status", "UNSET")

        if status == "ERROR":
            status_icon = red("✗")
        elif status in ("OK", "UNSET"):
            status_icon = green("✓")
        else:
            status_icon = yellow("?")

        click.echo(
            f"  {grey(str(i+1).rjust(2))}  {indent}{connector}"
            f"{status_icon} {label}  {grey(duration)}"
        )

        # show key attributes inline for LLM spans
        attrs = span.get("attributes", {})
        if _is_llm_span(span):
            prompt = attrs.get("gen_ai.system_instructions") or attrs.get("gen_ai.input.messages") or attrs.get("gen_ai.prompt.0.content", "")
            completion = attrs.get("gen_ai.output.messages") or attrs.get("gen_ai.completion.0.content", "")
            tokens = attrs.get("gen_ai.usage.total_tokens") or attrs.get("llm.usage.total_tokens", "")

            if prompt:
                click.echo(f"       {indent}   {grey('in:')}  {prompt[:60]}{'...' if len(prompt) > 60 else ''}")
            if completion:
                click.echo(f"       {indent}   {grey('out:')} {completion[:60]}{'...' if len(completion) > 60 else ''}")
            if tokens:
                click.echo(f"       {indent}   {grey('tokens:')} {tokens}")

        elif _is_tool_span(span):
            tool_name = attrs.get("gen_ai.tool.name", "")
            result = attrs.get("gen_ai.tool.call.result", "")
            if result:
                # parse the result JSON to get just the content
                try:
                    result_obj = json.loads(result)
                    content = result_obj.get("output", {}).get("kwargs", {}).get("content", result)
                except:
                    content = result
                click.echo(f"       {indent}   {grey('result:')} {str(content)[:60]}")

    click.echo()
    click.echo(grey(f"To fork this trace: replay fork {full_trace_id[:16]} <span_id> --input \"your new input\""))
    click.echo(grey(f"Span IDs shown with: replay show {full_trace_id[:16]} --ids"))
    click.echo()


@replay.command()
@click.argument("trace_id")
@click.option("--dir", "traces_dir", default="traces", help="Traces directory")
@click.option("--ids", is_flag=True, help="Show span IDs")
def ids(trace_id, traces_dir, ids):
    """Show a trace with span IDs visible."""
    loader = TraceLoader(traces_dir)

    all_traces = loader.list_traces()
    matches = [t for t in all_traces if t.startswith(trace_id)]

    if not matches:
        click.echo(red(f"No trace found matching: {trace_id}"))
        return

    full_trace_id = matches[0]
    trace = loader.load(full_trace_id)
    spans = trace["spans"]
    spans.sort(key=lambda s: s["start_time"])

    click.echo()
    click.echo(bold(f"Trace: {full_trace_id}"))
    click.echo()

    for i, span in enumerate(spans):
        label = format_span_name(span)
        click.echo(f"  {grey(str(i+1).rjust(2))}  {label}")
        click.echo(f"       {grey('id:')} {span['span_id']}")
    click.echo()


@replay.command()
@click.argument("trace_id")
@click.argument("span_id")
@click.option("--set", "attribute_overrides", multiple=True,
              help="Attribute override in format attribute=value. "
                   "Can be used multiple times. "
                   "e.g. --set gen_ai.completion.0.content='new response'")
@click.option("--temperature", default=0.0,
              help="Temperature for downstream LLM calls (default 0)")
@click.option("--dir", "traces_dir", default="traces",
              help="Traces directory")
def fork(trace_id, span_id, attribute_overrides, temperature, traces_dir):
    """
    Fork a trace at a specific span with attribute overrides.

    Examples:

        # change what an LLM said
        replay fork abc123 span456 --set gen_ai.completion.0.content="new response"

        # change what a tool returned
        replay fork abc123 span456 --set gen_ai.tool.call.result="Lyon"

        # change multiple attributes at once
        replay fork abc123 span456 \\
            --set gen_ai.tool.call.result="Lyon" \\
            --set gen_ai.completion.0.content="updated response"
    """
    loader = TraceLoader(traces_dir)
    engine = ReplayEngine(traces_dir)

    # allow partial trace ID
    all_traces = loader.list_traces()
    matches = [t for t in all_traces if t.startswith(trace_id)]
    if not matches:
        click.echo(red(f"No trace found matching: {trace_id}"))
        return

    full_trace_id = matches[0]
    trace = loader.load(full_trace_id)

    # find span — allow partial span ID
    all_spans = trace["spans"]
    span_matches = [s for s in all_spans if s["span_id"].startswith(span_id)]
    if not span_matches:
        click.echo(red(f"No span found matching: {span_id}"))
        return

    span = span_matches[0]

    # parse attribute overrides from --set flags
    if not attribute_overrides:
        click.echo(red("You must provide at least one --set attribute=value"))
        return

    changes = {}
    for override in attribute_overrides:
        if "=" not in override:
            click.echo(red(f"Invalid format: {override}. Use attribute=value"))
            return
        attr, _, value = override.partition("=")
        changes[attr.strip()] = value.strip()

    click.echo()
    click.echo(bold("Forking trace..."))
    click.echo(f"  Trace:   {full_trace_id[:16]}...")
    click.echo(f"  Span:    {span['name']} ({span['span_id']})")
    click.echo(f"  Changes:")
    for attr, val in changes.items():
        click.echo(f"           {grey(attr)} = {val}")
    click.echo()

    result = engine.replay(
        trace_id=full_trace_id,
        fork_span_id=span["span_id"],
        changes=changes,
        temperature=temperature
    )

    click.echo(green("✓ Replay complete"))
    click.echo()
    click.echo(bold("Summary:"))
    click.echo(f"  {result['summary']}")
    click.echo()

    # show forked span
    forked = next(
        (s for s in result["spans"] if s.get("replay_type") == "forked"),
        None
    )
    if forked:
        click.echo(bold("Forked span attributes:"))
        for attr, val in changes.items():
            click.echo(f"  {grey(attr)} = {val}")
        click.echo()

    # show final downstream LLM output
    downstream_llm = [
        s for s in result["spans"]
        if s.get("replay_type") == "downstream"
        and _is_llm_span(s)
        and s.get("attributes", {}).get("replay.rerun")
    ]

    if downstream_llm:
        final = downstream_llm[-1]
        final_output = final["attributes"].get(
            "gen_ai.completion.0.content", ""
        )
        if final_output:
            click.echo(bold("Final agent output after replay:"))
            click.echo(f"  {final_output}")
            click.echo()

    click.echo(grey(f"Replay ID: {result['replay_trace_id']}"))
    click.echo(grey(
        f"To compare: replay diff {result['replay_trace_id'][:16]}"
    ))
    click.echo()


@replay.command()
@click.argument("replay_id")
@click.option("--dir", "traces_dir", default="traces", help="Traces directory")
def diff(replay_id, traces_dir):
    """Compare a replay against its original trace."""
    from floe.core import replay_log

    replay = replay_log.load_replay(traces_dir, replay_id)
    if replay is None:
        click.echo(red(f"No replay found matching: {replay_id}"))
        return

    loader = TraceLoader(traces_dir)
    try:
        original = loader.load(replay["original_trace_id"])
    except FileNotFoundError:
        click.echo(red(f"Original trace {replay['original_trace_id'][:16]} is gone."))
        return

    result = replay_log.build_diff(replay, original)

    click.echo()
    click.echo(bold("Diff: Original vs Replay"))
    click.echo(grey(f"Original: {result['original_trace_id'][:16]}..."))
    click.echo(grey(f"Replay:   {result['replay_id'][:16]}..."))
    click.echo(grey(f"Source:   {result['source']}"
                    f"{' — ' + result['label'] if result['label'] else ''}"))
    click.echo()

    if result["changes"]:
        click.echo(bold("Changed:"))
        for change in result["changes"]:
            click.echo(f"  {grey(change['field'])}")
            click.echo(f"    {red('before:')} {str(change.get('before', ''))[:80]}")
            click.echo(f"    {green('after:')}  {str(change.get('after', ''))[:80]}")
        click.echo()

    click.echo(bold("Spans:"))
    click.echo()
    for row in result["rows"]:
        colorize = span_type_color(row["replay_type"])
        type_label = f"[{row['replay_type']}]".ljust(12)
        note = f"  {grey(row['note'])}" if row["note"] else ""
        click.echo(f"  {colorize(type_label)} [{row['span_type']}] {row['name']}{note}")

        for field in row["fields"]:
            click.echo(f"             {grey(field['field'])}")
            click.echo(f"             {red('before:')} {str(field['before'])[:70]}")
            click.echo(f"             {green('after:')}  {str(field['after'])[:70]}")

        if row["changed"] and not row["fields"]:
            click.echo(f"             {red('before:')} {str(row['before'])[:70]}")
            click.echo(f"             {green('after:')}  {str(row['after'])[:70]}")

    click.echo()
    click.echo(bold("Final answer:"))
    click.echo(f"  {red('before:')} {result['final_before'][:100]}")
    click.echo(f"  {green('after:')}  {result['final_after'][:100]}")
    click.echo()
    click.echo(bold("Legend:"))
    click.echo(f"  {grey('[cached]')}      not re-executed, used original output")
    click.echo(f"  {yellow('[forked]')}      changed input, real API call made")
    click.echo(f"  {blue('[downstream]')}  replayed after fork point")
    click.echo()


@replay.command(name="replays")
@click.option("--dir", "traces_dir", default="traces", help="Traces directory")
@click.option("--trace", "trace_filter", default=None,
              help="Only replays of this original trace")
@click.option("--limit", default=20, help="How many to show (default 20)")
def replays_cmd(traces_dir, trace_filter, limit):
    """
    The replay log — every replay ever played, newest first.

        replay replays
        replay replays --trace a7f35 --limit 5
    """
    from floe.core import replay_log

    full_trace_id = None
    if trace_filter:
        loader = TraceLoader(traces_dir)
        matches = [t for t in loader.list_traces() if t.startswith(trace_filter)]
        if not matches:
            click.echo(red(f"No trace found matching: {trace_filter}"))
            return
        full_trace_id = matches[0]

    entries = replay_log.list_replays(traces_dir, original_trace_id=full_trace_id)
    if not entries:
        click.echo("No replays yet. Fork a trace or run a pressure test first.")
        return

    click.echo()
    click.echo(bold(f"{len(entries)} replay(s):"))
    click.echo()
    for entry in entries[:limit]:
        source = entry["source"]
        tag = yellow(f"[{source}]") if source == "pressure" else blue(f"[{source}]")
        click.echo(f"  {tag} {bold(entry['replay_id'][:16])} "
                   f"{grey('from ' + entry['original_trace_id'][:12])}")
        if entry["label"]:
            click.echo(f"       {grey('run:')} {entry['label']}")
        for change in entry["changes"]:
            click.echo(f"       {grey(change['field'] + ':')} "
                       f"{str(change.get('after', ''))[:64]}")
        if entry["final_output"]:
            click.echo(f"       {grey('answer:')} {entry['final_output'][:70]}")
        click.echo("       " + grey(f"{entry['span_count']} spans"))
        click.echo()


@replay.command(name="prompts")
@click.option("--dir", "traces_dir", default="traces", help="Traces directory")
def prompts_cmd(traces_dir):
    """
    Every distinct system prompt across your traces, and who uses it.

    This is the starting point for a pressure test — pick a prompt, edit it,
    then run it back against every trace that shares it.
    """
    from floe.core.pressure import prompt_inventory

    loader = TraceLoader(traces_dir)
    inventory = prompt_inventory(loader)
    if not inventory:
        click.echo("No traces found.")
        return

    click.echo()
    for i, bucket in enumerate(inventory):
        count = len(bucket["trace_ids"])
        if bucket["prompt"] is None:
            click.echo(grey(f"  [{i}] (no system prompt) — {count} trace(s)"))
            click.echo()
            continue
        models = f" · {', '.join(bucket['models'])}" if bucket["models"] else ""
        click.echo(bold(f"  [{i}] {count} trace(s){models}"))
        for line in bucket["prompt"].splitlines() or [""]:
            click.echo(f"      {line}")
        click.echo(grey("      " + "  ".join(t[:12] for t in bucket["trace_ids"])))
        click.echo()

    click.echo(grey("  Pressure test one of these:"))
    click.echo(grey("    replay pressure --from-prompt 0 --set-prompt \"your edited prompt\""))
    click.echo()


@replay.command(name="pressure")
@click.option("--dir", "traces_dir", default="traces", help="Traces directory")
@click.option("--set-prompt", "prompt_text", default=None,
              help="The candidate system prompt to test")
@click.option("--prompt-file", type=click.Path(exists=True), default=None,
              help="Read the candidate system prompt from a file")
@click.option("--from-prompt", "from_prompt", type=int, default=None,
              help="Start from prompt N in `replay prompts` (use with --set-prompt to edit it)")
@click.option("--trace", "trace_ids", multiple=True,
              help="Limit to these traces (repeatable). Default: all traces.")
@click.option("--contains", "contains", multiple=True,
              help="Require this string in every new answer (repeatable)")
@click.option("--not-contains", "not_contains", multiple=True,
              help="Forbid this string in every new answer (repeatable)")
@click.option("--similarity", default=0.4, show_default=True,
              help="Warn below this word-overlap with the original answer")
@click.option("--name", default="", help="Name for this run")
@click.option("--temperature", default=0.0, show_default=True,
              help="Temperature for replayed LLM calls")
@click.option("--parallel", default=2, show_default=True,
              help="How many traces to replay at once")
@click.option("--yes", is_flag=True, help="Skip the cost confirmation")
def pressure_cmd(traces_dir, prompt_text, prompt_file, from_prompt, trace_ids,
                 contains, not_contains, similarity, name, temperature,
                 parallel, yes):
    """
    Pressure test a system prompt against every stored trace.

    Replays each trace's whole agent loop with the candidate prompt swapped in,
    then grades the result against the original — did it keep calling its tools,
    did the grounded facts survive, is the answer still recognisable.

        # test an edited prompt against everything
        replay pressure --set-prompt "You are a terse assistant. Always use tools."

        # take prompt 0 from `replay prompts`, but only against two traces
        replay pressure --from-prompt 0 --trace a7f35 --trace 086fd

        # require a fact to survive
        replay pressure --prompt-file new_prompt.txt --contains Tokyo
    """
    import time
    from floe.core import pressure as P

    loader = TraceLoader(traces_dir)

    # -- resolve the candidate prompt
    if prompt_file:
        prompt = open(prompt_file).read().strip()
    elif prompt_text:
        prompt = prompt_text
    elif from_prompt is not None:
        inventory = P.prompt_inventory(loader)
        if from_prompt >= len(inventory) or inventory[from_prompt]["prompt"] is None:
            click.echo(red(f"No prompt [{from_prompt}] — see: replay prompts"))
            return
        prompt = inventory[from_prompt]["prompt"]
    else:
        click.echo(red(
            "Give a candidate prompt: --set-prompt, --prompt-file, or --from-prompt N"
        ))
        return

    # -- resolve traces
    available = loader.list_traces()
    if trace_ids:
        selected = []
        for raw in trace_ids:
            matches = [t for t in available if t.startswith(raw)]
            if not matches:
                click.echo(red(f"No trace found matching: {raw}"))
                return
            selected.append(matches[0])
        selected = list(dict.fromkeys(selected))
    else:
        selected = list(reversed(available))

    if not selected:
        click.echo(red("No traces to test against."))
        return

    if not _load_saved_tools():
        click.echo(yellow(
            "⚠  No saved tool sources (.replay/tool_sources.py) — replayed agents "
            "cannot call tools, so tool checks will be skipped."
        ))

    checks = P.default_check_config()
    checks["similarity"] = {"enabled": True, "threshold": similarity}
    if contains:
        checks["must_contain"] = {"enabled": True, "values": list(contains)}
    if not_contains:
        checks["must_not_contain"] = {"enabled": True, "values": list(not_contains)}

    click.echo()
    click.echo(bold("Candidate system prompt:"))
    for line in prompt.splitlines() or [""]:
        click.echo(f"  {line}")
    click.echo()
    click.echo(f"  Against {bold(len(selected))} trace(s) — each is a full agent replay "
               f"with real model calls.")
    click.echo()
    if not yes:
        click.confirm("  Run it?", abort=True)
        click.echo()

    runner = P.PressureRunner(traces_dir)
    run = runner.create(
        system_prompt=prompt,
        trace_ids=selected,
        checks=checks,
        name=name,
        temperature=temperature,
        concurrency=parallel,
    )
    for note in run["notes"]:
        click.echo(yellow(f"⚠  {note}"))
        click.echo()

    runner.start(run["run_id"])

    # -- stream results as they land
    reported = set()
    glyphs = {"pass": green("✓"), "warn": yellow("!"), "fail": red("✗"),
              "error": red("✗"), "skipped": grey("·")}
    while True:
        current = runner.store.load(run["run_id"])
        for result in current["results"]:
            key = result["trace_id"]
            if key in reported or result["status"] in ("pending", "running"):
                continue
            reported.add(key)
            glyph = glyphs.get(result["status"], "?")
            click.echo(f"  {glyph} {bold(result['trace_id'][:12])} "
                       f"{grey(result['status'])}")
            if result.get("question"):
                click.echo(f"      {grey('asked:')} {result['question'][:70]}")
            if result.get("error"):
                click.echo(f"      {grey(result['error'][:100])}")
            for check in result["checks"]:
                if check["status"] == "pass":
                    continue
                icon = glyphs.get(check["status"], "?")
                click.echo(f"      {icon} {check['label']}: {grey(check['detail'][:70])}")
            if result.get("replay"):
                click.echo(f"      {grey('new answer:')} "
                           f"{(result['replay']['final_output'] or '')[:70]}")
            click.echo()

        if not runner.is_running(run["run_id"]):
            break
        time.sleep(0.4)

    final = runner.store.load(run["run_id"])
    totals = final["totals"]
    verdict = final["verdict"]
    colorize = {"pass": green, "warn": yellow}.get(verdict, red)

    click.echo(bold("Verdict: ") + colorize(verdict.upper()))
    click.echo(
        f"  {green(str(totals['pass']) + ' pass')}  "
        f"{yellow(str(totals['warn']) + ' warn')}  "
        f"{red(str(totals['fail']) + ' fail')}  "
        f"{red(str(totals['error']) + ' error')}  "
        f"{grey(str(totals['skipped']) + ' skipped')}"
    )
    click.echo()
    click.echo(grey(f"  Run ID: {final['run_id']}"))
    click.echo(grey(f"  Details: replay pressure-show {final['run_id'][:12]}"))
    click.echo()


@replay.command(name="pressure-log")
@click.option("--dir", "traces_dir", default="traces", help="Traces directory")
def pressure_log_cmd(traces_dir):
    """List every pressure run, newest first."""
    from floe.core.pressure import PressureStore

    runs = PressureStore(traces_dir).list()
    if not runs:
        click.echo("No pressure runs yet. Start one with: replay pressure --set-prompt \"...\"")
        return

    click.echo()
    for run in runs:
        totals = run.get("totals", {})
        verdict = run.get("verdict", "pending")
        colorize = {"pass": green, "warn": yellow}.get(verdict, red)
        click.echo(f"  {colorize('[' + verdict + ']')} {bold(run['name'])} "
                   f"{grey(run['run_id'][:12])}")
        click.echo(f"      {len(run['trace_ids'])} trace(s) · {run['status']} · "
                   f"{totals.get('pass', 0)} pass, {totals.get('warn', 0)} warn, "
                   f"{totals.get('fail', 0)} fail, {totals.get('error', 0)} error")
        click.echo(f"      {grey(run['system_prompt'][:76])}")
        click.echo()


@replay.command(name="pressure-show")
@click.argument("run_id")
@click.option("--dir", "traces_dir", default="traces", help="Traces directory")
def pressure_show_cmd(run_id, traces_dir):
    """Show the full results of one pressure run."""
    from floe.core.pressure import PressureStore

    run = PressureStore(traces_dir).load(run_id)
    if run is None:
        click.echo(red(f"No pressure run matching: {run_id}"))
        return

    glyphs = {"pass": green("✓"), "warn": yellow("!"), "fail": red("✗"),
              "error": red("✗"), "skipped": grey("·"), "pending": grey("·"),
              "running": yellow("◔")}

    click.echo()
    click.echo(bold(run["name"]))
    click.echo(grey(f"{run['run_id']} · {run['status']} · "
                    f"{len(run['trace_ids'])} trace(s)"))
    click.echo()
    click.echo(bold("Candidate system prompt:"))
    for line in run["system_prompt"].splitlines() or [""]:
        click.echo(f"  {line}")
    click.echo()

    for result in run["results"]:
        click.echo(f"  {glyphs.get(result['status'], '?')} "
                   f"{bold(result['trace_id'][:12])} {grey(result['status'])}")
        if result.get("question"):
            click.echo(f"      {grey('asked:')} {result['question'][:74]}")
        if result.get("error"):
            click.echo(f"      {grey(result['error'][:100])}")
        for check in result["checks"]:
            icon = glyphs.get(check["status"], "?")
            click.echo(f"      {icon} {check['label']}: {grey(check['detail'][:70])}")
        if result.get("original"):
            click.echo(f"      {red('before:')} "
                       f"{(result['original']['final_output'] or '')[:70]}")
        if result.get("replay"):
            click.echo(f"      {green('after:')}  "
                       f"{(result['replay']['final_output'] or '')[:70]}")
            if result.get("replay_id"):
                click.echo(f"      {grey('diff:')} replay diff {result['replay_id'][:12]}")
        click.echo()

    totals = run.get("totals", {})
    click.echo(bold("Totals: ")
               + f"{green(str(totals.get('pass', 0)) + ' pass')}  "
                 f"{yellow(str(totals.get('warn', 0)) + ' warn')}  "
                 f"{red(str(totals.get('fail', 0)) + ' fail')}  "
                 f"{red(str(totals.get('error', 0)) + ' error')}  "
                 f"{grey(str(totals.get('skipped', 0)) + ' skipped')}")
    click.echo()

def _run_explore(full_trace_id, traces_dir):
    """
    Core explore logic. Runs the interactive terminal UI for a given trace.
    Called by both the 'explore' CLI command and the 'run' command.
    Because this runs in the caller's process, any tools registered via
    @replay.tool are available — fork can run them for real.
    """
    import blessed
    import json as _json

    loader = TraceLoader(traces_dir)
    engine = ReplayEngine(traces_dir)

    trace = loader.load(full_trace_id)
    spans = trace["spans"]
    spans.sort(key=lambda s: s["start_time"])

    # build tree structure for display
    spans_by_id = {s["span_id"]: s for s in spans}
    tree_nodes = _build_tree_nodes(spans, spans_by_id)

    term = blessed.Terminal()
    selected = 0
    scroll_offset = 0

    def get_span_inputs(span):
        """Extract human readable inputs from a span."""
        attrs = span.get("attributes", {})
        inputs = {}

        # LLM span — show messages
        if _is_llm_span(span):
            messages_json = attrs.get("replay.messages_json")
            if messages_json:
                messages = _json.loads(messages_json)
                for msg in messages:
                    if msg["role"] == "user":
                        inputs["user"] = msg["content"]
                    elif msg["role"] == "system":
                        inputs["system"] = msg["content"]
            return inputs, "llm"

        # tool span — show arguments
        if "gen_ai.tool.name" in attrs:
            raw_args = attrs.get("gen_ai.tool.call.arguments", "{}")
            try:
                parsed = _json.loads(raw_args)
                args = parsed.get("inputs", parsed)
                if isinstance(args, dict):
                    inputs = args
            except Exception:
                pass
            return inputs, "tool"

        # root agent span — show initial query
        task_input = attrs.get("gen_ai.task.input", "")
        if task_input:
            try:
                parsed = _json.loads(task_input)
                msgs = parsed.get("inputs", {}).get("messages", [])
                if msgs:
                    inputs["query"] = msgs[0].get("content", "")
            except Exception:
                pass

        return inputs, "other"

    def get_span_label(node):
        """Get display label for a span."""
        span = node["span"]
        name = span["name"]
        attrs = span.get("attributes", {})

        if "execute_tool" in name:
            tool_name = attrs.get("gen_ai.tool.name", name)
            return f"[tool]  {tool_name}"
        elif _is_llm_span(span):
            return f"[llm]   {name}"
        elif "invoke_agent" in name:
            return f"[agent] {name}"
        elif "workflow" in name:
            return f"[flow]  {name}"
        elif "execute_task" in name:
            task = attrs.get("gen_ai.task.name", "")
            return f"[task]  {task or name}"
        return f"[span]  {name}"

    def is_forkable(node):
        """Only LLM and tool spans are forkable."""
        span = node["span"]
        attrs = span.get("attributes", {})
        return _is_llm_span(span) or "gen_ai.tool.name" in attrs

    def render(selected_idx):
        """Render the full explore UI."""
        lines = []
        lines.append("")
        lines.append(
            bold(f"  Trace: {full_trace_id[:16]}...")
            + grey(f"  ({len(spans)} spans)")
        )
        lines.append(
            grey("  ↑↓ navigate  Enter fork  q quit")
        )
        lines.append("")

        visible_nodes = tree_nodes
        for i, node in enumerate(visible_nodes):
            span = node["span"]
            depth = node["depth"]
            indent = "  " * (depth + 1)
            connector = "├── " if depth > 0 else ""

            label = get_span_label(node)
            duration = format_duration(span.get("duration_ms"))
            forkable = is_forkable(node)

            inputs, span_type = get_span_inputs(span)

            # highlight selected row
            if i == selected_idx:
                prefix = term.reverse
                suffix = term.normal
            else:
                prefix = ""
                suffix = ""

            # show forkable indicator
            fork_indicator = green("◆") if forkable else grey("·")

            line = (
                f"{prefix}  {fork_indicator} "
                f"{indent}{connector}"
                f"{label}  {grey(duration)}"
                f"{suffix}"
            )
            lines.append(line)

            # show inputs inline for selected span
            if i == selected_idx and inputs:
                for key, val in inputs.items():
                    val_str = str(val)[:60]
                    if len(str(val)) > 60:
                        val_str += "..."
                    lines.append(
                        f"     {indent}    "
                        f"{grey(key + ':')} {val_str}"
                    )

        lines.append("")
        if is_forkable(tree_nodes[selected_idx]):
            lines.append(
                green("  Press Enter to fork at this step")
            )
        else:
            lines.append(
                grey("  This span is not forkable (no editable inputs)")
            )
        lines.append("")

        return "\n".join(lines)

    def do_fork(node):
        """Handle forking at the selected span."""
        # restore normal terminal before any input
        click.echo(term.normal_cursor)
        click.echo(term.exit_fullscreen)
        # reset terminal to normal mode so input echoes correctly
        import os
        os.system("stty sane")
        
        span = node["span"]
        inputs, span_type = get_span_inputs(span)
        attrs = span.get("attributes", {})

        click.echo(term.clear)
        click.echo()
        click.echo(bold(f"  Fork at: {get_span_label(node)}"))
        click.echo()
        click.echo("  Current inputs:")
        for key, val in inputs.items():
            click.echo(f"    {grey(key + ':')} {val}")
        click.echo()
        click.echo(
            grey("  Edit inputs below. Leave blank to keep original.")
        )
        click.echo()

        new_inputs = {}
        for key, original_val in inputs.items():
            new_val = click.prompt(
                f"    {key}",
                default="",
                show_default=False
            ).strip()
            new_inputs[key] = new_val if new_val else original_val

        # nothing changed
        if new_inputs == inputs:
            click.echo()
            click.echo(yellow("  No changes made. Replay cancelled."))
            click.pause()
            return

        click.echo()
        click.echo(bold("  Changes:"))
        for key, val in new_inputs.items():
            if val != inputs.get(key):
                click.echo(
                    f"    {grey(key + ':')} "
                    f"{red(str(inputs.get(key, ''))[:40])} → "
                    f"{green(str(val)[:40])}"
                )

        click.echo()

        # build the changes dict in engine terms
        changes = {}

        if span_type == "llm":
            # for LLM spans, rebuild messages_json with new values
            messages_json = attrs.get("replay.messages_json")
            if messages_json:
                messages = _json.loads(messages_json)
                updated = []
                for msg in messages:
                    if msg["role"] == "user" and "user" in new_inputs:
                        updated.append({
                            **msg,
                            "content": new_inputs["user"]
                        })
                    elif msg["role"] == "system" and "system" in new_inputs:
                        updated.append({
                            **msg,
                            "content": new_inputs["system"]
                        })
                    else:
                        updated.append(msg)
                changes["replay.messages_json"] = _json.dumps(updated)

        elif span_type == "tool":
            # for tool spans, update the arguments
            raw_args = attrs.get("gen_ai.tool.call.arguments", "{}")
            try:
                parsed = _json.loads(raw_args)
                inner = parsed.get("inputs", parsed)
                if isinstance(inner, dict):
                    inner.update(new_inputs)
                    if "inputs" in parsed:
                        parsed["inputs"] = inner
                    else:
                        parsed = inner
                    changes["gen_ai.tool.call.arguments"] = _json.dumps(
                        parsed
                    )
            except Exception:
                pass

        if not changes:
            click.echo(yellow("  Could not build changes. Cancelled."))
            click.pause()
            return

        click.echo(bold("  Running replay..."))
        click.echo()

        try:
            result = engine.replay(
                trace_id=full_trace_id,
                fork_span_id=span["span_id"],
                changes=changes,
                temperature=0.0
            )

            click.echo(green("  ✓ Replay complete"))
            click.echo()
            click.echo(f"  {result['summary']}")
            click.echo()

            # show final LLM output if there is one
            downstream_llm = [
                s for s in result["spans"]
                if s.get("replay_type") == "downstream"
                and s.get("attributes", {}).get("replay.rerun")
            ]
            if downstream_llm:
                final = downstream_llm[-1]
                output = final["attributes"].get(
                    "gen_ai.completion.0.content", ""
                )
                if output:
                    click.echo(bold("  Final output:"))
                    click.echo(f"  {output}")
                    click.echo()

            click.echo(
                grey(
                    f"  Replay ID: {result['replay_trace_id'][:16]}..."
                )
            )
            click.echo(
                grey(
                    f"  Run: replay diff "
                    f"{result['replay_trace_id'][:16]} to compare"
                )
            )

        except Exception as e:
            click.echo(red(f"  Replay failed: {e}"))

        click.echo()
        click.pause("  Press any key to return to explorer...")

    # main interactive loop
    with term.fullscreen(), term.cbreak(), term.hidden_cursor():
        while True:
            click.echo(term.clear + render(selected))

            key = term.inkey(timeout=None)

            if key.name == "KEY_UP":
                selected = max(0, selected - 1)

            elif key.name == "KEY_DOWN":
                selected = min(len(tree_nodes) - 1, selected + 1)

            elif key.name == "KEY_ENTER" or key == "\n":
                if is_forkable(tree_nodes[selected]):
                    click.echo(term.normal_cursor)
                    click.echo(term.exit_fullscreen)
                    do_fork(tree_nodes[selected])
                    # re-enter fullscreen after fork
                    click.echo(term.enter_fullscreen)
                    click.echo(term.hide_cursor)

            elif key.lower() == "q":
                break

    click.echo(term.normal)


def _load_saved_tools() -> bool:
    """
    Loads tool function definitions from .replay/tool_sources.py and
    registers them into the tool registry so fork can run them for real.
    Returns True if tools were loaded, False if no sources file exists.
    """
    from floe.tools import TOOL_SOURCES_FILE
    # Bound as "replay" (not "floe") on purpose — every existing
    # .replay/tool_sources.py file was snapshotted with @replay.tool(...)
    # decorators (see tools.py's save_source, which still writes that
    # exact string), so this name needs to keep resolving to the real
    # package regardless of what floe/replay are actually called at the
    # top level.
    import floe as _replay

    if not os.path.exists(TOOL_SOURCES_FILE):
        return False

    source = open(TOOL_SOURCES_FILE).read()
    exec(source, {"replay": _replay})
    return True


@replay.command()
@click.argument("trace_id")
@click.option("--dir", "traces_dir", default="traces", help="Traces directory")
@click.option("--reload-tools", "reload_script", default=None, metavar="SCRIPT",
              help="Re-run SCRIPT to update saved tool sources, then explore.")
def explore(trace_id, traces_dir, reload_script):
    """
    Interactively explore a trace and fork at any step.

    Tools registered with @replay.tool are loaded automatically from
    .replay/tool_sources.py — no need to re-run your agent script.

    If your tool implementations changed, refresh the saved sources:

        replay explore f6caa --reload-tools my_agent.py
    """
    import runpy

    if reload_script:
        click.echo()
        click.echo(yellow(
            f"⚠  --reload-tools will re-run {reload_script} to update "
            f"saved tool sources."
        ))
        click.confirm("  Continue?", abort=True)
        click.echo()
        click.echo(bold(f"Running {reload_script}..."))
        try:
            runpy.run_path(reload_script, run_name="__main__")
        except SystemExit:
            pass
        except Exception as e:
            click.echo(red(f"Script raised an exception: {e}"))
            click.echo(grey("Tool sources may be partially updated."))
        click.echo(green("✓ Tool sources updated"))
        click.echo()
    else:
        if not _load_saved_tools():
            click.echo(red(
                "No saved tool sources found (.replay/tool_sources.py).\n"
                "Run your agent script once normally to register tools:\n\n"
                "    python your_agent.py\n\n"
                "Then explore without re-running:\n\n"
                f"    replay explore {trace_id}"
            ))
            return
        click.echo(green("✓ Tools loaded"))
        click.echo()

    loader = TraceLoader(traces_dir)
    all_traces = loader.list_traces()
    matches = [t for t in all_traces if t.startswith(trace_id)]
    if not matches:
        click.echo(red(f"No trace found matching: {trace_id}"))
        return

    _run_explore(matches[0], traces_dir)


@replay.command()
@click.argument("script")
@click.option("--dir", "traces_dir", default="traces", help="Traces directory")
def run(script, traces_dir):
    """
    Run an agent script and explore the captured trace.

    Executes the script in the current process so any tools registered
    with @replay.tool are available during replay — fork can run them
    for real without hitting the process boundary.

    Example:

        replay run my_agent.py
    """
    import runpy

    loader = TraceLoader(traces_dir)
    existing = set(loader.list_traces())

    click.echo()
    click.echo(bold(f"Running {script}..."))
    click.echo()

    try:
        runpy.run_path(script, run_name="__main__")
    except SystemExit:
        pass
    except Exception as e:
        click.echo(red(f"\nScript raised an exception: {e}"))
        click.echo(grey("Checking for traces captured before the error..."))
        click.echo()

    # flush any buffered spans the script didn't flush itself
    try:
        from opentelemetry import trace as otel_trace
        otel_trace.get_tracer_provider().force_flush()
    except Exception:
        pass

    new_traces = [t for t in loader.list_traces() if t not in existing]

    if not new_traces:
        click.echo(yellow("No new traces captured."))
        click.echo(grey(
            "Make sure your script calls floe.init() before running the agent."
        ))
        return

    latest = new_traces[-1]
    click.echo(green(f"✓ Trace captured: {latest[:16]}..."))
    click.echo()

    # open explore in this process — @replay.tool registrations are still live
    _run_explore(latest, traces_dir)


DEMO_SCRIPT = '''"""
Floe demo agent — a multi-tool "trip planner".

Generated by `floe replay demo`. Why LangChain (not a hand-rolled OpenAI
loop): Replay captures tool spans from OpenTelemetry auto-instrumentation.
The raw OpenAI SDK only emits LLM completion spans, so a manual
`for call in tool_calls` loop produces a trace with *zero tool spans* —
nothing to fork. Running the tools through a LangChain agent makes the
langchain instrumentor emit real `gen_ai.tool.name` /
`gen_ai.tool.call.result` spans, which is exactly what the replay engine
forks.

IMPORTANT — tools must be SELF-CONTAINED:
Replay snapshots each @floe.tool function's *source* into
.replay/tool_sources.py so `explore`/`serve` can re-run tools without
re-importing this script. That snapshot does NOT include module-level
globals, so a tool that references a module-level dict raises NameError on
replay. Every tool below therefore defines its own data inline.

Each tool is decorated twice:
    @tool             -> makes it a LangChain BaseTool (for capture)
    @floe.tool(safe=) -> registers it with Replay (for re-run on replay)

Setup:
    pip install "floe-ai[demo]"
    export OPENAI_API_KEY=sk-...

Usage:
    floe replay run demo.py     # capture + explore
    # or just capture a trace:
    python demo.py
"""
import floe
from langchain.agents import create_agent
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI

floe.init()  # one line: OTel tracing -> ./traces

MODEL = "gpt-4o-mini"  # any tool-calling OpenAI model works


@tool
@floe.tool(safe=True)
def get_capital(country: str) -> str:
    """Return the capital city of a country."""
    capitals = {
        "france": "Paris", "germany": "Berlin", "japan": "Tokyo",
        "brazil": "Brasilia",
        "zorblax": "Blorbis",  # fictional -> forces a real tool call
    }
    return capitals.get(country.lower(), f"Unknown capital for {country}")


@tool
@floe.tool(safe=True)
def get_population(city: str) -> str:
    """Return the approximate population of a city."""
    populations = {
        "paris": "2.1M", "berlin": "3.7M", "tokyo": "13.9M",
        "brasilia": "3.1M", "blorbis": "4.7M", "osaka": "2.7M",
    }
    return populations.get(city.lower(), f"Unknown population for {city}")


@tool
@floe.tool(safe=True)
def get_weather(city: str) -> str:
    """Return the current weather in a city."""
    weather = {
        "paris": "14°C, light rain", "berlin": "11°C, cloudy",
        "tokyo": "22°C, clear", "brasilia": "28°C, humid",
        "blorbis": "31°C, three suns", "osaka": "23°C, breezy",
    }
    return weather.get(city.lower(), f"No weather data for {city}")


@tool
@floe.tool(safe=True)
def get_currency(country: str) -> str:
    """Return the ISO currency code used by a country."""
    currencies = {
        "france": "EUR", "germany": "EUR", "japan": "JPY",
        "brazil": "BRL", "zorblax": "ZBX",
    }
    return currencies.get(country.lower(), f"Unknown currency for {country}")


@tool
@floe.tool(safe=True)
def convert_from_usd(amount: float, to_currency: str) -> str:
    """Convert an amount in USD into the given currency code."""
    usd_rates = {"EUR": 0.92, "JPY": 157.0, "BRL": 5.4, "ZBX": 0.5, "USD": 1.0}
    rate = usd_rates.get(to_currency.upper())
    if rate is None:
        return f"No exchange rate for {to_currency}"
    return f"{amount} USD = {amount * rate:.2f} {to_currency.upper()}"


TOOLS = [get_capital, get_population, get_weather, get_currency, convert_from_usd]


def main():
    agent = create_agent(
        ChatOpenAI(model=MODEL, temperature=0),
        TOOLS,
        system_prompt=(
            "You are a concise trip-planning assistant. Always use the tools "
            "to look up facts — never answer capitals, populations, weather, "
            "or currency from memory."
        ),
    )

    question = (
        "I'm planning a trip to Japan. What's its capital, that city's "
        "population and current weather, and how much is 100 USD in the "
        "local currency? Give me a one-line summary."
    )

    result = agent.invoke({"messages": [{"role": "user", "content": question}]})
    print("\\n=== Final answer ===")
    print(result["messages"][-1].content)


if __name__ == "__main__":
    main()
'''


@replay.command()
@click.option("--out", "output_path", default="demo.py", show_default=True,
              help="Where to write the demo script")
@click.option("--force", is_flag=True, help="Overwrite the file if it already exists")
def demo(output_path, force):
    """
    Write out a ready-to-run demo agent script.

    Generates a self-contained LangChain "trip planner" agent that calls
    five tools — no traces directory or repo checkout required, since the
    script is generated fresh from what's installed in this environment.

        floe replay demo                # writes ./demo.py
        pip install "floe-ai[demo]"
        export OPENAI_API_KEY=sk-...
        floe replay run demo.py         # capture a trace + explore it
    """
    if os.path.exists(output_path) and not force:
        click.echo(red(f"{output_path} already exists. Use --force to overwrite."))
        return

    with open(output_path, "w") as f:
        f.write(DEMO_SCRIPT)

    click.echo(green(f"✓ Wrote {output_path}"))
    click.echo()
    click.echo(bold("Next steps:"))
    click.echo(f"  {grey('1.')} pip install \"floe-ai[demo]\"")
    click.echo(f"  {grey('2.')} export OPENAI_API_KEY=sk-...")
    click.echo(f"  {grey('3.')} floe replay run {output_path}")


@replay.command()
@click.option("--dir", "traces_dir", default="traces", help="Traces directory")
@click.option("--port", default=7823, help="Port (default 7823)")
@click.option("--no-browser", is_flag=True, help="Don't open browser automatically")
def serve(traces_dir, port, no_browser):
    """
    Start the Replay Console — the web dashboard.

    Everything the CLI does, live in a browser: browse traces, fork any span,
    read the log of every replay ever played with its diff, and pressure test a
    candidate system prompt against all of your traces at once.

    Loads saved tools from .replay/tool_sources.py so replays can run them for
    real — same as the explore command.

        replay serve
        replay serve --port 8080
    """
    try:
        import uvicorn
    except ImportError:
        click.echo(red("uvicorn not installed. Run: pip install uvicorn"))
        return

    try:
        from fastapi import FastAPI  # noqa: just checking
    except ImportError:
        click.echo(red("fastapi not installed. Run: pip install fastapi"))
        return

    from floe.server.app import app, init_server

    click.echo()
    if not _load_saved_tools():
        click.echo(yellow(
            "⚠  No saved tool sources found (.replay/tool_sources.py).\n"
            "   Run your agent script once so tools can be loaded.\n"
            "   Fork 'run for real' will be unavailable until then."
        ))
    else:
        click.echo(green("✓ Tools loaded"))

    init_server(traces_dir)

    url = f"http://localhost:{port}"
    click.echo(bold(f"\n  Replay UI → {url}\n"))

    if not no_browser:
        import threading
        import webbrowser

        def _open():
            import time
            time.sleep(0.6)
            webbrowser.open(url)

        threading.Thread(target=_open, daemon=True).start()

    uvicorn.run(app, host="0.0.0.0", port=port, log_level="warning")


if __name__ == "__main__":
    floe()