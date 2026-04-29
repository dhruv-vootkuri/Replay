import replay
from replay.core.tool_registry import get_registry

# test 1 — safe tool
@replay.tool(safe=True)
def search_knowledge_base(query: str) -> str:
    return f"results for {query}"

# test 2 — unsafe tool with replay alternative
@replay.tool(safe=False)
def send_email(recipient: str, body: str) -> str:
    return f"sent to {recipient}"

@send_email.replay
def send_email_safe(recipient: str, body: str) -> str:
    return f"would have sent to {recipient}"

# test 3 — no declaration
def update_database(user_id: str, value: str) -> str:
    return "updated"

registry = get_registry()

print("search_knowledge_base:", registry.get_decision("search_knowledge_base"))
print("send_email:", registry.get_decision("send_email"))
print("update_database:", registry.get_decision("update_database"))

# test saved preferences
registry.save_preference("update_database", "skip")
print("update_database after saving preference:", registry.get_decision("update_database"))

# verify it was written to disk
import json, os
if os.path.exists(".replay/tool_preferences.json"):
    with open(".replay/tool_preferences.json") as f:
        print("Saved preferences:", json.load(f))