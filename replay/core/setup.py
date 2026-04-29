from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.instrumentation.openai import OpenAIInstrumentor
from opentelemetry.instrumentation.langchain import LangchainInstrumentor
from replay.exporters.json_exporter import JSONFileExporter


def setup_tracing(exporter=None, output_dir="traces"):
    provider = TracerProvider()

    if exporter is None:
        exporter = JSONFileExporter(output_dir=output_dir)

    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)

    OpenAIInstrumentor().instrument()
    LangchainInstrumentor().instrument()

    return provider


def get_tracer(name: str = "replay"):
    return trace.get_tracer(name)