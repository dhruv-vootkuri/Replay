"""
Replay demo agent — a multi-tool "trip planner".

Why LangChain (not a hand-rolled OpenAI loop): Replay captures tool spans
from OpenTelemetry auto-instrumentation. The raw OpenAI SDK only emits LLM
completion spans, so a manual `for call in tool_calls` loop produces a trace
with *zero tool spans* — nothing to fork. Running the tools through a
LangChain agent makes the langchain instrumentor emit real
`gen_ai.tool.name` / `gen_ai.tool.call.result` spans, which is exactly what
the replay engine forks.

IMPORTANT — tools must be SELF-CONTAINED:
Replay snapshots each @replay.tool function's *source* into
.replay/tool_sources.py so `explore`/`serve` can re-run tools without
re-importing this script. That snapshot does NOT include module-level
globals, so a tool that references a module-level dict raises NameError on
replay. Every tool below therefore defines its own data inline.

Each tool is decorated twice:
    @tool               -> makes it a LangChain BaseTool (for capture)
    @replay.tool(safe=) -> registers it with Replay (for re-run on replay)

Usage:
    export OPENAI_API_KEY=sk-...
    venv/bin/python -m replay.cli run demo_agent.py     # capture + explore
    # or just capture a trace:
    venv/bin/python demo_agent.py
"""
import replay
from langchain.agents import create_agent
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI

replay.init()  # one line: OTel tracing -> ./traces

MODEL = "gpt-4o-mini"  # any tool-calling OpenAI model works


@tool
@replay.tool(safe=True)
def get_capital(country: str) -> str:
    """Return the capital city of a country."""
    capitals = {
        "france": "Paris", "germany": "Berlin", "japan": "Tokyo",
        "brazil": "Brasilia",
        "zorblax": "Blorbis",  # fictional -> forces a real tool call
    }
    return capitals.get(country.lower(), f"Unknown capital for {country}")


@tool
@replay.tool(safe=True)
def get_population(city: str) -> str:
    """Return the approximate population of a city."""
    populations = {
        "paris": "2.1M", "berlin": "3.7M", "tokyo": "13.9M",
        "brasilia": "3.1M", "blorbis": "4.7M", "osaka": "2.7M",
    }
    return populations.get(city.lower(), f"Unknown population for {city}")


@tool
@replay.tool(safe=True)
def get_weather(city: str) -> str:
    """Return the current weather in a city."""
    weather = {
        "paris": "14°C, light rain", "berlin": "11°C, cloudy",
        "tokyo": "22°C, clear", "brasilia": "28°C, humid",
        "blorbis": "31°C, three suns", "osaka": "23°C, breezy",
    }
    return weather.get(city.lower(), f"No weather data for {city}")


@tool
@replay.tool(safe=True)
def get_currency(country: str) -> str:
    """Return the ISO currency code used by a country."""
    currencies = {
        "france": "EUR", "germany": "EUR", "japan": "JPY",
        "brazil": "BRL", "zorblax": "ZBX",
    }
    return currencies.get(country.lower(), f"Unknown currency for {country}")


@tool
@replay.tool(safe=True)
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
    print("\n=== Final answer ===")
    print(result["messages"][-1].content)


if __name__ == "__main__":
    main()
