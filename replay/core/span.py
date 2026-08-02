import uuid
import time
from dataclasses import dataclass, field
from typing import Any, Dict, Optional
from enum import Enum


class SpanType(Enum):
    LLM = "llm"
    TOOL = "tool"
    RETRIEVAL = "retrieval"
    AGENT = "agent"
    CUSTOM = "custom"


class SpanStatus(Enum):
    SUCCESS = "success"
    ERROR = "error"
    RUNNING = "running"


@dataclass
class Span:
    # Identity
    span_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    trace_id: str = ""
    parent_span_id: Optional[str] = None

    # What this span is
    name: str = ""
    type: SpanType = SpanType.CUSTOM
    step_number: int = 0

    # Timing
    started_at: float = field(default_factory=time.time)
    ended_at: Optional[float] = None
    duration_ms: Optional[float] = None

    # Data
    inputs: Dict[str, Any] = field(default_factory=dict)
    outputs: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)

    # Status
    status: SpanStatus = SpanStatus.RUNNING
    error: Optional[str] = None

    # Children — this is how we build the tree
    children: list = field(default_factory=list)

    def end(self, outputs: Dict[str, Any] = None, error: str = None):
        self.ended_at = time.time()
        self.duration_ms = (self.ended_at - self.started_at) * 1000
        
        if error:
            self.status = SpanStatus.ERROR
            self.error = error
        else:
            self.status = SpanStatus.SUCCESS
            if outputs:
                self.outputs = outputs

    def add_child(self, span: "Span"):
        span.parent_span_id = self.span_id
        span.trace_id = self.trace_id
        self.children.append(span)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "span_id": self.span_id,
            "trace_id": self.trace_id,
            "parent_span_id": self.parent_span_id,
            "name": self.name,
            "type": self.type.value,
            "step_number": self.step_number,
            "started_at": self.started_at,
            "ended_at": self.ended_at,
            "duration_ms": self.duration_ms,
            "inputs": self.inputs,
            "outputs": self.outputs,
            "metadata": self.metadata,
            "status": self.status.value,
            "error": self.error,
            "children": [child.to_dict() for child in self.children]
        }