import os, sys, json

# Set GROQ_API_KEY in your environment or .env before running this script
# export GROQ_API_KEY=your_key_here
if not os.environ.get("GROQ_API_KEY"):
    raise SystemExit("ERROR: GROQ_API_KEY environment variable not set.")
sys.path.insert(0, ".")

from app.agents.prompts import EXTRACTION_SYSTEM_PROMPT
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage

llm = ChatGroq(
    model_name="llama-3.3-70b-versatile",
    groq_api_key=os.environ["GROQ_API_KEY"],
    temperature=0.05,
    max_tokens=1200,
)

text = (
    "Apollo Pharmacy reported 12 capsules of Amoxicillin 500mg batch AMX240602 "
    "(Manufacturing March 2026, Expiry February 2028) showed brown discoloration. "
    "Reporter: Priya Mehta, priya.mehta@apollopharmacy.in. Customer type: Pharmacy."
)

res = llm.invoke([
    SystemMessage(content=EXTRACTION_SYSTEM_PROMPT),
    HumanMessage(content=f"Extract from this complaint:\n\n{text}")
])

content = res.content.strip()
print("=== RAW GROQ RESPONSE ===")
print(content[:1000])
print("\n=== JSON PARSE TEST ===")

# Try strip markdown fences
clean = content
if "```json" in clean:
    clean = clean.split("```json")[1].split("```")[0].strip()
elif "```" in clean:
    clean = clean.split("```")[1].split("```")[0].strip()

# Find first { ... } block
match = __import__('re').search(r'\{.*\}', clean, __import__('re').DOTALL)
if match:
    clean = match.group(0)

try:
    parsed = json.loads(clean)
    print("SUCCESS! Extracted fields:")
    for k, v in parsed.items():
        if v:
            print(f"  {k}: {v}")
except Exception as e:
    print(f"JSON parse failed: {e}")
    print("Cleaned content:")
    print(clean[:500])
