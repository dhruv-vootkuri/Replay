from openai import OpenAI
client = OpenAI()

response = client.chat.completions.create(
    model="gpt-3.5-turbo",
    temperature=0,
    messages=[
    {"role": "user", "content": "What is the capital of Zorblax and what is its population?"},
    {"role": "assistant", "content": "", "tool_calls": [
        {"id": "call_1", "type": "function", "function": {"name": "get_capital", "arguments": "{\"country\": \"Zorblax\"}"}},
        {"id": "call_2", "type": "function", "function": {"name": "get_population", "arguments": "{\"city\": \"Blorbis\"}"}}
    ]},
    {"role": "tool", "content": "Blorbis", "tool_call_id": "call_1"},
    {"role": "tool", "content": "4.7 million", "tool_call_id": "call_2"}
]
)
print(response.choices[0].message.content)