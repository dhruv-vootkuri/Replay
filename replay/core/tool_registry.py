import json
import os
from typing import Any, Callable, Dict, Optional


class ToolConfig:
    """
    Configuration for a single tool.
    Stores the engineer's declarations and replay implementation.
    """

    def __init__(
        self,
        name: str,
        safe: bool = False,
        replay_fn: Optional[Callable] = None,
        fn: Optional[Callable] = None
    ):
        # the name of the tool — matches gen_ai.tool.name in spans
        self.name = name

        # safe=True means run the real tool during replay
        # safe=False means pause and ask (unless replay_fn is defined)
        self.safe = safe

        # optional replay implementation
        # if defined, always used instead of pausing or running real tool
        self.replay_fn = replay_fn
    
        self.fn = fn

    def should_pause(self) -> bool:
        """
        Returns True if this tool requires a pause during replay.
        A tool needs to pause if:
        - it's not safe (has real-world consequences)
        - and it has no replay alternative defined
        """
        return not self.safe and self.replay_fn is None

    def __repr__(self):
        return (
            f"ToolConfig(name={self.name}, safe={self.safe}, "
            f"has_replay_fn={self.replay_fn is not None})"
        )


class ToolRegistry:
    """
    Central registry for all tool declarations.

    Handles three sources of information in priority order:
    1. Replay alternatives (replay_fn) — highest priority, always used
    2. safe=True declarations — run real tool, no pause
    3. CLI preferences — saved decisions from previous replay sessions
    4. Unknown tools — pause and ask
    """

    # path to saved CLI preferences
    PREFERENCES_FILE = ".replay/tool_preferences.json"

    def __init__(self):
        # tools registered via @replay.tool decorator
        self._tools: Dict[str, ToolConfig] = {}

        # preferences saved from CLI decisions
        # format: { "tool_name": "run" | "skip" | "stop" }
        self._preferences: Dict[str, str] = {}

        # load saved preferences from disk if they exist
        self._load_preferences()

    def register(
    self,
    name: str,
    safe: bool = False,
    replay_fn: Optional[Callable] = None,
    fn: Optional[Callable] = None
) -> None:
        self._tools[name] = ToolConfig(
            name=name,
            safe=safe,
            replay_fn=replay_fn,
            fn=fn
        )

    def get_config(self, tool_name: str) -> Optional[ToolConfig]:
        """Returns the ToolConfig for a tool, or None if not registered."""
        return self._tools.get(tool_name)

    def get_decision(self, tool_name: str) -> Optional[str]:
        """
        Returns None always — the pause mechanism always asks.
        
        This method now only provides information to the pause prompt
        about what options are available for this tool.
        Use get_available_options() for that instead.
        """
        return None

    def get_available_options(self, tool_name: str) -> Dict[str, Any]:
        """
        Returns what options are available for this tool during replay.
        The pause mechanism uses this to build the right prompt.

        Returns a dict with:
        - can_run_real: bool — tool is declared safe to run
        - has_alternative: bool — replay_fn is defined
        - has_preference: bool — saved CLI preference exists
        - preference: str | None — the saved preference if it exists
        - replay_fn: callable | None — the alternative function if defined
        - fn: callable | None — the real function if registered
        """
        config = self._tools.get(tool_name)
        preference = self._preferences.get(tool_name)

        return {
            "can_run_real": config.safe if config else False,
            "has_alternative": (
                config.replay_fn is not None if config else False
            ),
            "has_preference": preference is not None,
            "preference": preference,
            "replay_fn": config.replay_fn if config else None,
            "fn": config.fn if config else None
        }

    def save_preference(self, tool_name: str, decision: str) -> None:
        """
        Saves a CLI decision for a tool so it applies automatically
        in future replay sessions.

        Args:
            tool_name: the tool this preference applies to
            decision: "run", "skip", or "stop"
        """
        self._preferences[tool_name] = decision
        self._persist_preferences()

    def has_preference(self, tool_name: str) -> bool:
        """Returns True if a saved preference exists for this tool."""
        return tool_name in self._preferences

    def clear_preference(self, tool_name: str) -> None:
        """Removes a saved preference for a tool."""
        if tool_name in self._preferences:
            del self._preferences[tool_name]
            self._persist_preferences()

    def list_preferences(self) -> Dict[str, str]:
        """Returns all saved preferences."""
        return dict(self._preferences)

    def get_all_schemas(self) -> list:
        """
        Returns OpenAI-compatible tool schemas for all registered tools
        that have a callable function. Used by the LLM fork agent loop to
        let the LLM know which tools are available.
        """
        import inspect
        try:
            from typing import get_type_hints
        except ImportError:
            get_type_hints = lambda fn: {}

        TYPE_MAP = {int: "integer", float: "number", bool: "boolean"}
        schemas = []

        for name, config in self._tools.items():
            if not config.fn:
                continue
            fn = config.fn
            sig = inspect.signature(fn)
            try:
                hints = get_type_hints(fn)
            except Exception:
                hints = {}

            properties = {}
            required = []
            for param_name, param in sig.parameters.items():
                hint = hints.get(param_name, str)
                json_type = TYPE_MAP.get(hint, "string")
                properties[param_name] = {"type": json_type}
                if param.default is inspect.Parameter.empty:
                    required.append(param_name)

            schemas.append({
                "type": "function",
                "function": {
                    "name": name,
                    "description": inspect.getdoc(fn) or "",
                    "parameters": {
                        "type": "object",
                        "properties": properties,
                        "required": required,
                    },
                },
            })

        return schemas

    def _load_preferences(self) -> None:
        """Loads saved preferences from disk."""
        if os.path.exists(self.PREFERENCES_FILE):
            try:
                with open(self.PREFERENCES_FILE, "r") as f:
                    data = json.load(f)
                    self._preferences = data.get("tool_preferences", {})
            except (json.JSONDecodeError, IOError):
                # if file is corrupted or unreadable, start fresh
                self._preferences = {}

    def _persist_preferences(self) -> None:
        """Saves current preferences to disk."""
        # create the .replay directory if it doesn't exist
        os.makedirs(".replay", exist_ok=True)

        with open(self.PREFERENCES_FILE, "w") as f:
            json.dump(
                {"tool_preferences": self._preferences},
                f,
                indent=2
            )


# global registry instance
# this is what the @replay.tool decorator registers into
# and what the engine reads from
_registry = ToolRegistry()


def get_registry() -> ToolRegistry:
    """Returns the global tool registry."""
    return _registry