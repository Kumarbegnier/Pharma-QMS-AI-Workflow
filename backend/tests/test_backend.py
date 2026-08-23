"""
Comprehensive backend test suite for AIVOA Pharma QMS.
"""

import sys
import os

# Ensure backend app is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# ── Use an isolated test database so tests don't conflict with live server ──
TEST_DB_PATH = os.path.join(os.path.dirname(__file__), "test_pharma_qms.db")
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"

# Remove stale test DB
if os.path.exists(TEST_DB_PATH):
    try:
        os.remove(TEST_DB_PATH)
    except PermissionError:
        pass  # Already open — tests will still run against it

import pytest
from app.core.database import engine, Base
from app.models.complaint import Complaint, ComplaintAIAnalysis, ComplaintSource, AuditLog, CapaTask

# Create all tables explicitly before TestClient
Base.metadata.create_all(bind=engine)

# Seed the database
from app.db.init_db import seed_database
seed_database()

from fastapi.testclient import TestClient
from app.main import app
from app.services.risk_engine import evaluate_ich_q9_risk
from app.services.complaint_service import calculate_text_similarity

client = TestClient(app)


# ── Health & AI Status ──────────────────────────────────────────────────────

def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    # Model may vary: assignment specified gemma2-9b-it (now decommissioned by Groq)
    # using llama-3.3-70b-versatile as functional equivalent on same platform
    assert "model" in data
    assert data["status"] == "ok"
    assert "groq_available" in data


# ── AI Intake ───────────────────────────────────────────────────────────────

def test_ai_intake_text():
    payload = {
        "text_content": (
            "Apollo Pharmacy reported discolored capsules in Amoxicillin Capsules 500 mg. "
            "Batch number AMX240602. Manufacturing date March 2026. Expiry February 2028. "
            "Reporter: priya.mehta@apollopharmacy.in. 12 capsules affected."
        ),
        "file_name": "test.txt",
    }
    r = client.post("/api/ai/intake/text", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert "analysis" in data
    analysis = data["analysis"]
    assert "field_confidence" in analysis
    assert "completeness_score" in analysis
    assert "suggested_severity" in analysis
    assert "extracted_fields" in analysis


# ── Chat Correction ─────────────────────────────────────────────────────────

def test_chat_correction():
    payload = {
        "draft_complaint": {
            "batch_number": "AMX240602",
            "affected_quantity": "12 capsules",
            "product_name": "Amoxicillin Capsules",
        },
        "user_message": "Sorry, the batch number should be BMX240602 and affected quantity is 48 capsules",
    }
    r = client.post("/api/ai/chat", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert "updates" in data
    assert "assistant_message" in data
    updates = data["updates"]
    assert "batch_number" in updates or "affected_quantity" in updates


# ── Risk Engine ──────────────────────────────────────────────────────────────

def test_risk_engine_critical():
    data = {
        "complaint_category": "Contamination",
        "complaint_description": "Foreign matter contamination found in API drum.",
        "product_name": "Metformin API",
    }
    sev, risk, safety, _just = evaluate_ich_q9_risk(data)
    assert sev == "Critical"
    assert risk == "High"


def test_risk_engine_major():
    data = {
        "complaint_category": "Product Defect - Discoloration",
        "complaint_description": "Discolored capsules found in bottle.",
        "product_name": "Amoxicillin 500mg",
    }
    sev, risk, _safety, _just = evaluate_ich_q9_risk(data)
    assert sev in ("Major", "Critical")


def test_risk_engine_minor():
    data = {
        "complaint_category": "Labeling",
        "complaint_description": "Label barcode not scanning properly.",
        "product_name": "Paracetamol 500mg",
    }
    sev, risk, _safety, _just = evaluate_ich_q9_risk(data)
    assert sev == "Minor"


# ── Text Similarity ─────────────────────────────────────────────────────────

def test_text_similarity():
    sim = calculate_text_similarity(
        "discolored capsules batch AMX",
        "discolored capsules batch AMX240602",
    )
    assert sim > 0.7


# ── Complaint CRUD ───────────────────────────────────────────────────────────

def test_save_and_retrieve_complaint():
    payload = {
        "source": "Pharmacy",
        "customer_name": "Test Pharmacy",
        "customer_type": "Pharmacy",
        "product_type": "FDF",
        "product_name": "Test Product 100mg",
        "batch_number": "TST20260001",
        "affected_quantity": "5 tablets",
        "complaint_category": "Product Defect - Discoloration",
        "complaint_description": "Test complaint for pytest verification",
        "severity": "Minor",
        "risk_level": "Low",
        "patient_safety_impact": False,
        "status": "Pending Triage",
    }
    r = client.post("/api/complaints", json=payload)
    assert r.status_code == 200
    created = r.json()
    assert "complaint_number" in created
    cid = created["id"]

    r2 = client.get(f"/api/complaints/{cid}")
    assert r2.status_code == 200
    assert r2.json()["id"] == cid


def test_complaints_list():
    r = client.get("/api/complaints")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) > 0


def test_stats():
    r = client.get("/api/complaints/stats")
    assert r.status_code == 200
    data = r.json()
    assert "total_complaints" in data
    assert data["total_complaints"] > 0


# ── Audit Log ────────────────────────────────────────────────────────────────

def test_audit_log():
    payload = {
        "source": "Email",
        "customer_name": "Audit Test Co",
        "product_type": "API",
        "product_name": "Test API",
        "batch_number": "AUD001",
        "complaint_description": "Audit test",
        "complaint_category": "Contamination",
        "severity": "Major",
        "risk_level": "High",
        "patient_safety_impact": False,
        "status": "Pending Triage",
    }
    r = client.post("/api/complaints", json=payload)
    assert r.status_code == 200
    cid = r.json()["id"]

    patch = {"batch_number": "AUD002"}
    r2 = client.patch(f"/api/complaints/{cid}", json=patch)
    assert r2.status_code == 200
    assert r2.json()["batch_number"] == "AUD002"

    r3 = client.get(f"/api/complaints/{cid}/audit")
    assert r3.status_code == 200
    logs = r3.json()
    assert isinstance(logs, list)
    assert len(logs) >= 2


def test_complaint_not_found():
    r = client.get("/api/complaints/99999")
    assert r.status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# File Intake Tests
# ─────────────────────────────────────────────────────────────────────────────

from tests.fixtures import (
    make_txt_bytes, make_pdf_bytes, make_docx_bytes, make_eml_bytes, COMPLAINT_TEXT
)
from app.services.document_parser import (
    parse_document_bytes, extract_text_from_eml, extract_text_from_docx,
    DocumentParseError
)
import pytest


def _post_file(filename: str, content: bytes, content_type: str = "application/octet-stream"):
    """Helper: POST a file to /api/ai/intake/file via TestClient."""
    return client.post(
        "/api/ai/intake/file",
        files={"file": (filename, content, content_type)},
    )


# ── Parser unit tests (no Groq call) ─────────────────────────────────────────

def test_parser_txt():
    text = parse_document_bytes(make_txt_bytes(), "complaint.txt")
    assert "Amoxicillin" in text
    assert "AMX240602" in text
    assert "Apollo Pharmacy" in text


def test_parser_pdf():
    pdf_bytes = make_pdf_bytes()
    text = parse_document_bytes(pdf_bytes, "complaint.pdf")
    assert len(text) > 30
    # Key fields should survive PDF round-trip
    assert "AMX240602" in text or "Amoxicillin" in text


def test_parser_docx():
    docx_bytes = make_docx_bytes()
    text = parse_document_bytes(docx_bytes, "complaint.docx")
    assert "Amoxicillin" in text
    assert "AMX240602" in text


def test_parser_eml():
    eml_bytes = make_eml_bytes()
    text = parse_document_bytes(eml_bytes, "complaint.eml")
    assert "Subject:" in text or "Amoxicillin" in text
    assert "AMX240602" in text


def test_parser_unsupported_extension():
    with pytest.raises(DocumentParseError, match="Unsupported file type"):
        parse_document_bytes(b"binary content", "malware.exe")


def test_parser_empty_file():
    with pytest.raises(DocumentParseError, match="empty"):
        parse_document_bytes(b"", "complaint.txt")


def test_parser_too_short_text():
    with pytest.raises(DocumentParseError):
        parse_document_bytes(b"hi", "short.txt")


# ── API endpoint tests ────────────────────────────────────────────────────────

def test_file_intake_txt():
    r = _post_file("complaint.txt", make_txt_bytes(), "text/plain")
    assert r.status_code == 200
    data = r.json()
    assert data["source_type"] == "file"
    assert data["filename"] == "complaint.txt"
    assert "analysis" in data
    ef = data["analysis"]["extracted_fields"]
    assert ef.get("batch_number") or ef.get("product_name")


def test_file_intake_pdf():
    r = _post_file("complaint.pdf", make_pdf_bytes(), "application/pdf")
    assert r.status_code == 200
    data = r.json()
    assert data["source_type"] == "file"
    assert data["filename"] == "complaint.pdf"
    assert "analysis" in data
    assert "extracted_text" in data


def test_file_intake_docx():
    r = _post_file(
        "complaint.docx",
        make_docx_bytes(),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    assert r.status_code == 200
    data = r.json()
    assert data["source_type"] == "file"
    ef = data["analysis"]["extracted_fields"]
    assert ef.get("product_name") or ef.get("batch_number")


def test_file_intake_eml():
    r = _post_file("complaint.eml", make_eml_bytes(), "message/rfc822")
    assert r.status_code == 200
    data = r.json()
    assert data["source_type"] == "file"
    assert data["filename"] == "complaint.eml"
    assert "analysis" in data


def test_file_intake_unsupported_extension():
    r = _post_file("payload.exe", b"MZ\x90\x00", "application/octet-stream")
    assert r.status_code == 400
    assert "Unsupported" in r.json()["detail"]


def test_file_intake_empty_file():
    r = _post_file("empty.txt", b"", "text/plain")
    assert r.status_code == 400
    assert "empty" in r.json()["detail"].lower()
