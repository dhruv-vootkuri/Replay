from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.instrumentation.openai import OpenAIInstrumentor
from floe.exporters.json_exporter import JSONFileExporter


def setup_tracing(exporter=None, output_dir="traces"):
    provider = TracerProvider()

    if exporter is None:
        exporter = JSONFileExporter(output_dir=output_dir)

    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)

    OpenAIInstrumentor().instrument()

    # opentelemetry-instrumentation-langchain pulls in langchain_core at
    # import time, which floe only installs via the optional `demo` extra
    # (pip install "floe-ai[demo]") — most installs just replay traces
    # already on disk and never touch LangChain. This was previously a
    # top-level import in this module, which crashed *every* `floe`
    # command (even read-only ones like `replay list`) for anyone who
    # installed plain `floe-ai` without that extra, since floe/__init__.py
    # imports this module unconditionally.
    try:
        from opentelemetry.instrumentation.langchain import LangchainInstrumentor
        LangchainInstrumentor().instrument()
    except ImportError:
        pass

    return provider


def get_tracer(name: str = "replay"):
    return trace.get_tracer(name)