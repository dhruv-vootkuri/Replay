import json
import os
from typing import Optional


class TraceLoader:
    """
    Loads traces from JSON files on disk.
    Used by the replay engine to read stored traces.
    """

    def __init__(self, traces_dir: str = "traces"):
        self.traces_dir = traces_dir

    def load(self, trace_id: str) -> dict:
        """
        Loads a single trace by ID.

        Args:
            trace_id: the trace ID string, same as the filename without .json

        Returns:
            the full trace dictionary with all spans

        Raises:
            FileNotFoundError if the trace doesn't exist
        """
        filepath = os.path.join(self.traces_dir, f"{trace_id}.json")

        if not os.path.exists(filepath):
            raise FileNotFoundError(
                f"No trace found with ID {trace_id}. "
                f"Looking in: {filepath}"
            )

        with open(filepath, "r") as f:
            return json.load(f)

    def list_traces(self) -> list:
        if not os.path.exists(self.traces_dir):
            return []

        files = [
            f.replace(".json", "")
            for f in os.listdir(self.traces_dir)
            if f.endswith(".json") and ".replay." not in f  # exclude replay files
        ]

        files.sort(key=lambda x: os.path.getmtime(
            os.path.join(self.traces_dir, f"{x}.json")
        ))

        return files

    def get_span(self, trace_id: str, span_id: str) -> Optional[dict]:
        """
        Finds a specific span within a trace by its span ID.
        Used by the replay engine to locate the fork point.

        Args:
            trace_id: which trace to look in
            span_id: which span to find

        Returns:
            the span dictionary, or None if not found
        """
        trace = self.load(trace_id)
        return self._find_span(trace["spans"], span_id)

    def _find_span(self, spans: list, span_id: str) -> Optional[dict]:
        """
        Recursively searches for a span by ID.
        Handles nested spans if we add tree structure later.
        """
        for span in spans:
            if span["span_id"] == span_id:
                return span

        return None

    def get_root_span(self, trace_id: str) -> Optional[dict]:
        """
        Returns the root span of a trace — the one with no parent.
        This is the entry point for traversing the trace tree.
        """
        trace = self.load(trace_id)

        for span in trace["spans"]:
            if span["parent_span_id"] is None:
                return span

        return None

    def get_children(self, trace_id: str, span_id: str) -> list:
        """
        Returns all direct children of a given span.
        Used to traverse the tree during replay.
        """
        trace = self.load(trace_id)

        return [
            span for span in trace["spans"]
            if span["parent_span_id"] == span_id
        ]

    def get_ancestors(self, trace_id: str, span_id: str) -> list:
        """
        Returns all spans from the root down to the given span.
        This is the context reconstruction path —
        everything the agent knew before reaching this span.

        For example if the tree is A -> B -> C and you ask for
        ancestors of C, you get [A, B] in order from root to parent.
        """
        trace = self.load(trace_id)
        spans_by_id = {s["span_id"]: s for s in trace["spans"]}

        ancestors = []
        current = spans_by_id.get(span_id)

        # walk up the tree following parent_span_id
        # until we reach the root which has no parent
        while current and current["parent_span_id"]:
            parent = spans_by_id.get(current["parent_span_id"])
            if parent:
                ancestors.insert(0, parent)  # insert at front to keep root-first order
            current = parent

        return ancestors