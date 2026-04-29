import replay
from replay.core.loader import TraceLoader
from langchain_openai import ChatOpenAI
from langchain.agents import create_agent
from langchain.tools import tool

provider = replay.init()


@tool
@replay.tool(safe=True)
def get_capital(country: str) -> str:
    """Returns the capital city of a country."""
    capitals = {
        "france": "Paris",
        "germany": "Berlin",
        "japan": "Tokyo",
        "brazil": "Brasilia",
        "zorblax": "Blorbis"
    }
    return capitals.get(country.lower(), f"Unknown capital for {country}")


@tool
@replay.tool(safe=True)
def get_population(city: str) -> str:
    """Returns the approximate population of a city."""
    populations = {
        "paris": "2.1 million",
        "berlin": "3.7 million",
        "tokyo": "13.9 million",
        "brasilia": "3.1 million",
        "blorbis": "4.7 million",
        "quorblax city": "9.2 million"
    }
    return populations.get(city.lower(), f"Unknown population for {city}")


llm = ChatOpenAI(model="gpt-4o", temperature=0)
agent = create_agent(llm, tools=[get_capital, get_population])

result = agent.invoke({
    "messages": [
        {
            "role": "system",
            "content": "You are a helpful assistant. Always use the provided tools to answer questions — never rely on your internal knowledge."
        },
        {
            "role": "user",
            "content": "What is the population of the capital of Zorblax?"
        }
    ]
})

print("\n--- RESULT ---")
print(result["messages"][-1].content)

provider.force_flush()

print("\n--- TRACE INSPECTION ---")
loader = TraceLoader()
traces = loader.list_traces()
latest = traces[-1]
trace = loader.load(latest)

print(f"Trace ID: {latest}")
print(f"Total spans: {len(trace['spans'])}")
print("\nAll spans:")
for i, span in enumerate(trace["spans"]):
    has_messages = "replay.messages_json" in span.get("attributes", {})
    has_tool_result = "replay.tool_result" in span.get("attributes", {})
    enriched = []
    if has_messages:
        enriched.append("messages_json")
    if has_tool_result:
        enriched.append("tool_result")
    enriched_str = f" [{', '.join(enriched)}]" if enriched else ""
    print(f"  {i+1}. {span['name']}{enriched_str}")
