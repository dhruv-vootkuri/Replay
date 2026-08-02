import json
import os
from datetime import datetime
from opentelemetry.sdk.trace.export import SpanExporter, SpanExportResult
from replay.core.enrichment import ReplayEnrichmentProcessor


class JSONFileExporter(SpanExporter):
    """
    Exports completed spans to a local JSON file.
    One file per trace, named by trace ID.
    Each span is appended as it completes.
    """

    def __init__(self, output_dir: str = "traces"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        self._enricher = ReplayEnrichmentProcessor()

    def export(self, spans):
        for span in spans:
            self._save_span(span)
        return SpanExportResult.SUCCESS

    def _save_span(self, span):
        trace_id = format(span.context.trace_id, '032x')
        filepath = os.path.join(self.output_dir, f"{trace_id}.json")

        span_dict = self._span_to_dict(span)

        # enrich with replay-specific attributes after conversion
        span_dict = self._enricher.enrich_span_dict(span_dict)

        if os.path.exists(filepath):
            with open(filepath, "r") as f:
                trace_data = json.load(f)
        else:
            trace_data = {
                "trace_id": trace_id,
                "created_at": datetime.utcnow().isoformat(),
                "spans": []
            }

        trace_data["spans"].append(span_dict)

        with open(filepath, "w") as f:
            json.dump(trace_data, f, indent=2)

    def _span_to_dict(self, span):
        # convert OpenTelemetry's internal span object
        # into a plain dictionary we can save as JSON
        return {
            "span_id": format(span.context.span_id, '016x'),
            "trace_id": format(span.context.trace_id, '032x'),
            "parent_span_id": format(span.parent.span_id, '016x') if span.parent else None,
            "name": span.name,
            "start_time": span.start_time,
            "end_time": span.end_time,
            "duration_ms": (span.end_time - span.start_time) / 1_000_000,
            "status": span.status.status_code.name,
            "attributes": dict(span.attributes) if span.attributes else {},
            "events": [
                {
                    "name": event.name,
                    "timestamp": event.timestamp,
                    "attributes": dict(event.attributes) if event.attributes else {}
                }
                for event in span.events
            ]
        }

    def shutdown(self):
        # called when the TracerProvider shuts down
        # nothing to clean up for file-based storage
        pass