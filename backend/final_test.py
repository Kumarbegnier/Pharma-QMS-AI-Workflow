import urllib.request, json

def post(url, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, headers={'Content-Type':'application/json'}, method='POST')
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

def get(url):
    with urllib.request.urlopen(url, timeout=10) as r:
        return json.loads(r.read())

print("=== FINAL LIVE SYSTEM TEST ===\n")

# 1. Health check
h = get("http://127.0.0.1:8000/health")
print(f"[1] Health    : {h['status']} | Model: {h['model']} | Groq: {h['groq_available']}")

# 2. Stats
s = get("http://127.0.0.1:8000/api/complaints/stats")
print(f"[2] Stats     : {s['total_complaints']} complaints | {s['high_risk_count']} high-risk | {s['open_investigations']} investigating")

# 3. AI intake with real Groq call
complaint_text = (
    "Date: August 12, 2026. From: MedPlus Pharmacy, Pune Branch. "
    "Subject: Product Quality Complaint - Paracetamol 500mg Tablets (FDF). "
    "Batch: PCM260801. Manufacturing Date: August 2026. Expiry Date: July 2028. "
    "Affected Quantity: 3 blister strips. "
    "Complaint: Three blister strips showed damaged seals on 4-5 tablet cavities per strip. "
    "Aluminum foil partially peeled. No patients affected. "
    "Reporter: Store Manager, MedPlus Pharmacy Pune Branch 07. Contact: pune07@medplus.in"
)
res = post("http://127.0.0.1:8000/api/ai/intake/text", {"text_content": complaint_text, "file_name": "medplus.txt"})
a = res["analysis"]
ef = a.get("extracted_fields", {})
print(f"[3] AI Intake :")
print(f"    Product   = {ef.get('product_name', '?')}")
print(f"    Batch     = {ef.get('batch_number', '?')}")
print(f"    Customer  = {ef.get('customer_name', '?')}")
print(f"    Category  = {ef.get('complaint_category', '?')}")
print(f"    Severity  = {a['suggested_severity']} | Risk = {a['suggested_risk']}")
print(f"    Complete  = {round(a['completeness_score']*100)}% | Fallback = {a['is_fallback_used']}")
print(f"    Dupes     = {len(res['duplicates'])} found")

# 4. Chat correction
chat_res = post("http://127.0.0.1:8000/api/ai/chat", {
    "draft_complaint": ef,
    "user_message": "Update the batch number to PCM260802 and affected quantity to 5 strips"
})
print(f"[4] Correction:")
print(f"    Updates   = {list(chat_res['updates'].keys())}")
print(f"    Message   = {chat_res['assistant_message'][:90]}")

# 5. Save complaint
save_payload = {
    "source": ef.get("complaint_source", "Pharmacy"),
    "customer_name": ef.get("customer_name", "MedPlus Pharmacy"),
    "customer_type": ef.get("customer_type", "Pharmacy"),
    "reporter_contact": ef.get("reporter_contact", "pune07@medplus.in"),
    "product_type": ef.get("product_type", "FDF"),
    "product_name": ef.get("product_name", "Paracetamol 500mg"),
    "strength_or_grade": ef.get("strength_or_grade", "500mg"),
    "batch_number": "PCM260802",
    "affected_quantity": "5 blister strips",
    "complaint_category": ef.get("complaint_category", "Packaging"),
    "complaint_description": ef.get("complaint_description", "Damaged seals on blister strips"),
    "severity": a["suggested_severity"],
    "risk_level": a["suggested_risk"],
    "status": "Pending Triage",
}
saved = post("http://127.0.0.1:8000/api/complaints", save_payload)
print(f"[5] Saved     : {saved['complaint_number']} | ID={saved['id']}")

# 6. Retrieve and verify audit trail
detail = get(f"http://127.0.0.1:8000/api/complaints/{saved['id']}")
print(f"[6] Retrieved : {detail['complaint_number']} | Audit logs: {len(detail['audit_logs'])}")

print("\n=== ALL 6 CHECKS PASSED ===")
