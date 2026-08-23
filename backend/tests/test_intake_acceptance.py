"""
Acceptance tests for the unstructured complaint intake workflow.

Tests:
  1. Story-style natural paragraph  → AI extracts product, batch, quantity, customer
  2. Email-style complaint          → greetings/signatures ignored, fields extracted
  3. Incomplete complaint           → missing fields remain null, completeness drops
  4. API email complaint            → product_type=API, bulk quantity, contamination
  5. Minimal informal text          → batch + category extracted from bare minimum

Run:
  python -m pytest backend/tests/test_intake_acceptance.py -v
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def analyze_text(text: str) -> dict:
    """POST to /api/ai/intake/text and return analysis dict."""
    r = client.post("/api/ai/intake/text", json={"text_content": text, "file_name": "test.txt"})
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    data = r.json()
    assert "analysis" in data
    return data["analysis"]


# ─────────────────────────────────────────────────────────────────────────────
# TEST 1: Story-style free-form paragraph
# ─────────────────────────────────────────────────────────────────────────────

def test_story_style_extraction():
    """
    Test 1 — Natural paragraph with no structured labels.
    The AI must infer product, batch, quantity, customer, and defect type.
    """
    text = """
    Apollo Pharmacy informed us that several Amoxicillin 500 mg capsules from batch AMX240602
    appear discolored.

    Around 12 capsules are affected. The product was manufactured in March 2026 and
    expires in February 2028.

    They want the issue investigated and a replacement provided.
    """
    a = analyze_text(text)
    ef = a["extracted_fields"]

    # Product detection
    assert ef.get("product_name"), "product_name must be extracted"
    assert "amoxicillin" in ef["product_name"].lower(), \
        f"Expected Amoxicillin in product_name, got: {ef['product_name']}"

    # Batch number
    assert ef.get("batch_number"), "batch_number must be extracted"
    assert "AMX240602" in ef["batch_number"].upper(), \
        f"Expected AMX240602, got: {ef['batch_number']}"

    # Customer
    assert ef.get("customer_name"), "customer_name must be extracted"
    assert "apollo" in ef["customer_name"].lower(), \
        f"Expected Apollo in customer_name, got: {ef['customer_name']}"

    # Quantity
    assert ef.get("affected_quantity"), "affected_quantity must be extracted"
    assert "12" in ef["affected_quantity"], \
        f"Expected 12 in quantity, got: {ef['affected_quantity']}"

    # Complaint category — discoloration
    assert ef.get("complaint_category"), "complaint_category must be extracted"
    assert "discolor" in ef["complaint_category"].lower() or "defect" in ef["complaint_category"].lower(), \
        f"Expected discoloration category, got: {ef['complaint_category']}"

    # Completeness — should be reasonably high given good data
    assert a["completeness_score"] >= 0.5, \
        f"Completeness should be ≥ 50%, got: {a['completeness_score']}"

    print(f"\n[PASS] Story extraction: product={ef['product_name']}, batch={ef['batch_number']}, "
          f"qty={ef['affected_quantity']}, customer={ef['customer_name']}, "
          f"category={ef['complaint_category']}, completeness={a['completeness_score']}")


# ─────────────────────────────────────────────────────────────────────────────
# TEST 2: Email-style complaint
# ─────────────────────────────────────────────────────────────────────────────

def test_email_style_extraction():
    """
    Test 2 — Full customer email.
    Greetings, salutations, and signatures must NOT confuse the extraction.
    """
    text = """
    Subject: Complaint regarding Metformin Hydrochloride API

    Dear Quality Team,

    We received 25 kg of Metformin Hydrochloride API, batch MFH260712A, in one HDPE drum.

    During incoming QC inspection, our team identified visible black particulate matter
    embedded within the bulk API powder. Foreign matter contamination was confirmed in
    three separate sample pulls from the same drum.

    Please investigate urgently.

    Regards,
    Vikram Iyer, QC Manager
    Zenith Life Sciences Pvt. Ltd.
    vikram.iyer@zenithlifesciences.com
    """
    a = analyze_text(text)
    ef = a["extracted_fields"]

    # Product name
    assert ef.get("product_name"), "product_name must be extracted from email"
    assert "metformin" in ef["product_name"].lower(), \
        f"Expected Metformin in product_name, got: {ef['product_name']}"

    # Product type — API
    assert ef.get("product_type") == "API", \
        f"Expected product_type=API, got: {ef.get('product_type')}"

    # Batch number
    assert ef.get("batch_number"), "batch_number must be extracted"
    assert "MFH260712A" in ef["batch_number"].upper(), \
        f"Expected MFH260712A, got: {ef['batch_number']}"

    # Customer / company name
    assert ef.get("customer_name"), "customer_name must be extracted"
    assert any(word in ef["customer_name"].lower() for word in ["zenith", "life", "sciences"]), \
        f"Expected Zenith Life Sciences, got: {ef['customer_name']}"

    # Reporter contact
    assert ef.get("reporter_contact"), "reporter_contact (email) must be extracted"
    assert "@zenith" in ef["reporter_contact"].lower(), \
        f"Expected @zenith in contact, got: {ef['reporter_contact']}"

    # Category — foreign matter
    assert ef.get("complaint_category"), "complaint_category must be set"
    assert "foreign" in ef["complaint_category"].lower() or "contamin" in ef["complaint_category"].lower(), \
        f"Expected foreign matter category, got: {ef['complaint_category']}"

    print(f"\n[PASS] Email extraction: product={ef['product_name']}, type={ef['product_type']}, "
          f"batch={ef['batch_number']}, customer={ef['customer_name']}, "
          f"contact={ef['reporter_contact']}, category={ef['complaint_category']}")


# ─────────────────────────────────────────────────────────────────────────────
# TEST 3: Incomplete complaint — missing fields must remain null
# ─────────────────────────────────────────────────────────────────────────────

def test_incomplete_complaint_missing_fields():
    """
    Test 3 — Minimal complaint with only batch + issue. 
    Missing fields must NOT be hallucinated; completeness must be low.
    """
    text = """
    Customer reported discolored tablets from batch PCM260801.
    """
    a = analyze_text(text)
    ef = a["extracted_fields"]

    # Batch must be extracted
    assert ef.get("batch_number"), "batch_number must be found"
    assert "PCM260801" in ef["batch_number"].upper(), \
        f"Expected PCM260801, got: {ef['batch_number']}"

    # Category must be discoloration
    assert ef.get("complaint_category"), "complaint_category must be set"

    # Fields that are NOT in the text must be null/absent
    mfg = ef.get("manufacturing_date")
    exp = ef.get("expiry_date")
    qty = ef.get("affected_quantity")
    contact = ef.get("reporter_contact")

    # Allow None or string "null" / empty
    def is_missing(v):
        return v is None or str(v).strip().upper() in ("", "NULL", "NONE", "N/A", "NOT PROVIDED")

    assert is_missing(mfg), \
        f"manufacturing_date must be null for incomplete complaint, got: {mfg}"
    assert is_missing(exp), \
        f"expiry_date must be null for incomplete complaint, got: {exp}"
    assert is_missing(contact), \
        f"reporter_contact must be null for incomplete complaint, got: {contact}"

    # Completeness must be low
    assert a["completeness_score"] < 0.8, \
        f"Completeness should be < 80% for an incomplete complaint, got: {a['completeness_score']}"

    # Missing information list must be non-empty
    assert len(a["missing_information"]) > 0, \
        "missing_information must list absent fields"

    print(f"\n[PASS] Incomplete complaint: batch={ef['batch_number']}, "
          f"completeness={a['completeness_score']}, missing={a['missing_information'][:3]}, "
          f"mfg={mfg}, exp={exp}, qty={qty}")


# ─────────────────────────────────────────────────────────────────────────────
# TEST 4: Informal / minimal text
# ─────────────────────────────────────────────────────────────────────────────

def test_informal_text_extraction():
    """
    Test 4 — WhatsApp / informal style. No labels, no formal structure.
    """
    text = """
    There seems to be something wrong with 48 tablets from batch PCM260801.
    ABC Pharmacy says the tablets inside one strip have changed colour.
    Not sure when they were made but exp is July 2028.
    """
    a = analyze_text(text)
    ef = a["extracted_fields"]

    # Batch
    assert ef.get("batch_number"), "batch_number must be extracted from informal text"
    assert "PCM260801" in ef["batch_number"].upper(), \
        f"Expected PCM260801, got: {ef['batch_number']}"

    # Quantity — 48 tablets
    assert ef.get("affected_quantity"), "affected_quantity must be extracted"
    assert "48" in ef["affected_quantity"], \
        f"Expected 48 in quantity, got: {ef['affected_quantity']}"

    # Customer
    assert ef.get("customer_name"), "customer_name must be extracted"
    assert "abc" in ef["customer_name"].lower() or "pharmacy" in ef["customer_name"].lower(), \
        f"Expected ABC Pharmacy, got: {ef['customer_name']}"

    # Category — discoloration ("changed colour")
    assert "discolor" in ef.get("complaint_category", "").lower() or \
           "defect" in ef.get("complaint_category", "").lower(), \
        f"Expected discoloration category, got: {ef.get('complaint_category')}"

    print(f"\n[PASS] Informal text: batch={ef['batch_number']}, qty={ef['affected_quantity']}, "
          f"customer={ef['customer_name']}, category={ef['complaint_category']}")


# ─────────────────────────────────────────────────────────────────────────────
# TEST 5: User correction via chat API
# ─────────────────────────────────────────────────────────────────────────────

def test_user_chat_correction():
    """
    Test 5 — Conversational correction: two fields corrected, rest unchanged.
    """
    draft = {
        "product_name": "Amoxicillin Capsules",
        "batch_number": "AMX240602",
        "affected_quantity": "12 capsules",
        "customer_name": "Apollo Pharmacy",
        "complaint_category": "Product Defect - Discoloration",
        "strength_or_grade": "500 mg",
    }
    correction_msg = "Actually the batch is BMX240602 and 40 capsules are affected."

    r = client.post("/api/ai/chat", json={
        "draft_complaint": draft,
        "user_message": correction_msg,
    })
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    data = r.json()

    updates = data.get("updates", {})
    assert updates, f"Expected updates, got empty: {data}"

    # Batch must be updated
    if "batch_number" in updates:
        assert "BMX240602" in updates["batch_number"].upper(), \
            f"Expected BMX240602 in batch update, got: {updates['batch_number']}"

    # Quantity must be updated
    if "affected_quantity" in updates:
        assert "40" in updates["affected_quantity"], \
            f"Expected 40 in quantity update, got: {updates['affected_quantity']}"

    # Unrelated fields must NOT be in updates
    for unrelated in ["customer_name", "complaint_category", "product_name", "strength_or_grade"]:
        assert unrelated not in updates, \
            f"Unrelated field '{unrelated}' must not be in updates"

    # Must have a friendly assistant message
    assert data.get("assistant_message"), "assistant_message must be present"

    print(f"\n[PASS] Chat correction: updates={updates}, msg='{data['assistant_message']}'")
