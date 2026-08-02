import inspect
import os
import textwrap
from typing import Callable, Optional
from replay.core.tool_registry import get_registry

TOOL_SOURCES_FILE = ".replay/tool_sources.py"


def _save_tool_source(fn: Callable, safe: bool, tool_name: str) -> None:
    """
    Appends the source of fn to .replay/tool_sources.py so the CLI can
    load tools without re-running the full agent script.
    Strips all decorators from the source and prepends @replay.tool(safe=...).
    """
    try:
        raw = inspect.getsource(fn)
        # dedent in case fn is defined inside a class or nested scope
        raw = textwrap.dedent(raw)
        lines = raw.splitlines()
        # strip decorator lines (lines starting with @) before the def
        while lines and lines[0].strip().startswith("@"):
            lines.pop(0)
        func_source = "\n".join(lines)

        entry = (
            f"@replay.tool(safe={safe!r})\n"
            f"{func_source}\n\n"
        )

        os.makedirs(".replay", exist_ok=True)

        # read existing file so we can replace a previous entry for this tool
        existing = ""
        if os.path.exists(TOOL_SOURCES_FILE):
            with open(TOOL_SOURCES_FILE) as f:
                existing = f.read()

        # replace existing entry for this tool_name if present
        import re
        pattern = (
            r"@replay\.tool\([^)]*\)\s*\ndef "
            + re.escape(tool_name)
            + r"\b.*?(?=\n@replay\.tool|\Z)"
        )
        if re.search(pattern, existing, re.DOTALL):
            updated = re.sub(pattern, entry.rstrip(), existing, flags=re.DOTALL)
        else:
            header = "import replay\n\n" if not existing else ""
            updated = existing + header + entry

        with open(TOOL_SOURCES_FILE, "w") as f:
            f.write(updated)

    except Exception:
        # never crash the user's script due to source saving
        pass


def tool(safe: bool = False, name: Optional[str] = None):
    def decorator(fn: Callable) -> Callable:
        tool_name = name or fn.__name__
        registry = get_registry()
        registry.register(
            name=tool_name,
            safe=safe,
            replay_fn=None,
            fn=fn
        )
        _save_tool_source(fn, safe, tool_name)

        def replay_decorator(replay_fn: Callable) -> Callable:
            registry.register(
                name=tool_name,
                safe=safe,
                replay_fn=replay_fn,
                fn=fn
            )
            return replay_fn

        fn.replay = replay_decorator
        fn._replay_tool_name = tool_name
        return fn

    return decorator