import click
import json
import os
from replay.core.loader import TraceLoader
from replay.core.engine import ReplayEngine

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
    return any(k.startswith("gen_ai.prompt.") for k in span.get("attributes", {}))


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
def cli():
    """
    Replay — fork any agent trace at any step and see what would have happened.
    """
    pass


@cli.command()
@click.option("--dir", "traces_dir", default="traces", help="Traces directory")
def list(traces_dir):
    """List all captured traces."""
    loader = TraceLoader(traces_dir)
    traces = loader.list_traces()

    if not traces:
        click.echo("No traces found. Run your agent with replay.init() to capture traces.")
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


@cli.command()
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
            prompt = attrs.get("gen_ai.prompt.0.content", "")
            completion = attrs.get("gen_ai.completion.0.content", "")
            tokens = attrs.get("llm.usage.total_tokens", "")

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


@cli.command()
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


@cli.command()
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


@cli.command()
@click.argument("replay_id")
@click.option("--dir", "traces_dir", default="traces", help="Traces directory")
def diff(replay_id, traces_dir):
    """Compare a replay against its original trace."""

    # find the replay file
    replay_files = [
        f for f in os.listdir(traces_dir)
        if ".replay." in f and replay_id in f
    ]

    if not replay_files:
        click.echo(red(f"No replay found matching: {replay_id}"))
        return

    filepath = os.path.join(traces_dir, replay_files[0])
    with open(filepath) as f:
        replay = json.load(f)

    loader = TraceLoader(traces_dir)
    original = loader.load(replay["original_trace_id"])

    click.echo()
    click.echo(bold("Diff: Original vs Replay"))
    click.echo(grey(f"Original: {replay['original_trace_id'][:16]}..."))
    click.echo(grey(f"Replay:   {replay['replay_trace_id'][:16]}..."))
    click.echo(grey(f"Changes:   {replay['changes']}"))
    click.echo()

    replay_spans = replay["spans"]
    replay_spans.sort(key=lambda s: s.get("start_time", 0))

    click.echo(bold("Spans:"))
    click.echo()

    for span in replay_spans:
        replay_type = span.get("replay_type", "unknown")
        colorize = span_type_color(replay_type)
        label = format_span_name(span)
        type_label = f"[{replay_type}]".ljust(12)

        click.echo(f"  {colorize(type_label)} {label}")

        # for forked spans show the changes applied
        if replay_type == "forked":
            changes = span.get("changes_applied", {})
            for attr, new_val in changes.items():
                # find the original value from the original trace
                orig_span = next(
                    (s for s in original["spans"]
                    if s["name"] == span["name"]
                    and abs(s["start_time"] - span.get("start_time", 0)) < 1e12),
                    None
                )
                if orig_span:
                    if attr == "gen_ai.tool.call.result":
                        orig_val = orig_span["attributes"].get(
                            "replay.tool_result",
                            orig_span["attributes"].get(attr, "")
                        )
                    else:
                        orig_val = orig_span["attributes"].get(attr, "")
                else:
                    orig_val = ""
                click.echo(f"             {red('before:')} {str(orig_val)[:70]}")
                click.echo(f"             {green('after:')}  {str(new_val)[:70]}")

        # for downstream LLM spans that were rerun, show the new output
        if (replay_type == "downstream"
                and _is_llm_span(span)
                and span.get("attributes", {}).get("replay.rerun")):

            new_output = span["attributes"].get("gen_ai.completion.0.content", "")

            # find the corresponding original span by name and approximate position
            orig_llm_spans = [
                s for s in original["spans"]
                if _is_llm_span(s)
            ]
            # match by position — nth LLM span in replay matches nth in original
            replay_llm_index = sum(
                1 for s in replay_spans[:replay_spans.index(span)]
                if _is_llm_span(s)
            )
            orig_span = (
                orig_llm_spans[replay_llm_index]
                if replay_llm_index < len(orig_llm_spans)
                else None
            )

            if orig_span:
                orig_output = orig_span["attributes"].get(
                    "gen_ai.completion.0.content", ""
                )
                if orig_output:
                    click.echo(f"             {red('before:')} {orig_output[:70]}")
                if new_output:
                    click.echo(f"             {green('after:')}  {new_output[:70]}")
            elif new_output:
                click.echo(f"             {green('output:')} {new_output[:70]}")

    click.echo()
    click.echo(bold("Legend:"))
    click.echo(f"  {grey('[cached]')}      not re-executed, used original output")
    click.echo(f"  {yellow('[forked]')}      changed input, real API call made")
    click.echo(f"  {blue('[downstream]')}  replayed after fork point")
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
        if any(k.startswith("gen_ai.prompt.") for k in attrs):
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
        elif any(k.startswith("gen_ai.prompt.") for k in attrs):
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
        return (
            any(k.startswith("gen_ai.prompt.") for k in attrs)
            or "gen_ai.tool.name" in attrs
        )

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
    from replay.tools import TOOL_SOURCES_FILE
    import replay as _replay

    if not os.path.exists(TOOL_SOURCES_FILE):
        return False

    source = open(TOOL_SOURCES_FILE).read()
    exec(source, {"replay": _replay})
    return True


@cli.command()
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


@cli.command()
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
            "Make sure your script calls replay.init() before running the agent."
        ))
        return

    latest = new_traces[-1]
    click.echo(green(f"✓ Trace captured: {latest[:16]}..."))
    click.echo()

    # open explore in this process — @replay.tool registrations are still live
    _run_explore(latest, traces_dir)


@cli.command()
@click.option("--dir", "traces_dir", default="traces", help="Traces directory")
@click.option("--port", default=7823, help="Port (default 7823)")
@click.option("--no-browser", is_flag=True, help="Don't open browser automatically")
def serve(traces_dir, port, no_browser):
    """
    Start the web visualization server.

    Loads saved tools from .replay/tool_sources.py so fork can run
    them for real — same as the explore command.

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

    from replay.server.app import app, init_server

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
    cli()