"""
LangGraph nodes for the pharma QMS complaint processing pipeline.

PRIMARY INGESTION GRAPH (8 stages):
  parse_input → extract_structured_fields → validate_and_normalize →
  check_completeness → assess_risk → generate_summary_actions →
  generate_root_cause_capa → finalize_response

CONVERSATIONAL CORRECTION GRAPH (4 stages):
  detect_update_intent → extract_field_patch → validate_patch → generate_assistant_ack
"""

import json
import re
from typing import Dict, Any

from app.agents.state import ComplaintAgentState
from app.agents.prompts import (
    EXTRACTION_SYSTEM_PROMPT,
    CHAT_CORRECTION_PROMPT,
    ROOT_CAUSE_CAPA_PROMPT,
)
from app.core.config import settings
from app.services.risk_engine import evaluate_ich_q9_risk


# ── Valid enums ────────────────────────────────────────────────────────────────

VALID_CATEGORIES = [
    "Product Quality",
    "Packaging",
    "Contamination",
    "Product Defect - Discoloration",
    "Product Defect - Foreign Matter",
    "Adverse Event",
    "Labeling",
    "Other",
]

VALID_STATUSES = ["Pending Triage", "Under Investigation", "CAPA Pending", "Closed"]
VALID_PRODUCT_TYPES = ["FDF", "API"]

# Fields required for completeness scoring
FDF_REQUIRED = ["product_name", "batch_number", "customer_name", "affected_quantity", "complaint_description"]
API_REQUIRED = ["product_name", "batch_number", "strength_or_grade", "affected_quantity", "complaint_description"]


# ─────────────────────────────────────────────────────────────────────────────
# PRIMARY INGESTION GRAPH NODES
# ─────────────────────────────────────────────────────────────────────────────

def parse_input_node(state: ComplaintAgentState) -> Dict[str, Any]:
    """Stage 1: Clean text, detect input_type, initialize operation."""
    raw = state.get("raw_text", "")

    # Clean text
    cleaned = re.sub(r'\r\n', '\n', raw)
    cleaned = re.sub(r'[ \t]+', ' ', cleaned)
    cleaned = cleaned.strip()

    # Detect input type heuristically
    input_type = state.get("input_type", "text")
    filename = state.get("source_filename", "") or ""
    if filename.lower().endswith(".pdf"):
        input_type = "pdf"
    elif "subject:" in cleaned.lower() and ("from:" in cleaned.lower() or "to:" in cleaned.lower()):
        input_type = "email"

    return {
        "raw_text": cleaned,
        "input_type": input_type,
        "operation": "NEW_COMPLAINT",
        "errors": [],
    }


def extract_structured_fields_node(state: ComplaintAgentState) -> Dict[str, Any]:
    """
    Stage 2: Extract complaint fields using Groq gemma2-9b-it.
    Falls back to local regex heuristics if API unavailable.
    """
    text = state.get("raw_text", "")
    is_fallback = True
    extracted: dict = {}
    model_used = settings.PRIMARY_MODEL

    if settings.is_groq_available():
        try:
            from langchain_groq import ChatGroq
            from langchain_core.messages import SystemMessage, HumanMessage

            llm = ChatGroq(
                model_name=settings.PRIMARY_MODEL,
                groq_api_key=settings.GROQ_API_KEY,
                temperature=0.05,
                max_tokens=1200,
            )
            input_type = state.get("input_type", "text")
            style_hint = {
                "pdf": "extracted from a PDF document",
                "email": "an email message",
                "docx": "a Word document",
            }.get(input_type, "free-form text — may be a paragraph, story, informal message, or copied email")

            messages = [
                SystemMessage(content=EXTRACTION_SYSTEM_PROMPT),
                HumanMessage(content=(
                    f"The following is {style_hint}.\n"
                    f"Extract ALL available complaint information into the JSON schema.\n\n"
                    f"--- COMPLAINT TEXT ---\n{text}\n--- END ---"
                )),
            ]
            res = llm.invoke(messages)
            content = res.content.strip()

            # Strip markdown fences if present
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()

            extracted = json.loads(content)
            is_fallback = False
        except Exception as e:
            print(f"[LangGraph] Groq extraction failed, using local fallback: {e}")

    if is_fallback:
        extracted = _local_extraction_fallback(text)
        model_used = f"{settings.PRIMARY_MODEL} (Demo Fallback)"

    # Build confidence scores per-field
    field_confidence = _compute_field_confidence(extracted, text, is_fallback)

    # Build the complaint dict — sanitize null/empty strings to None
    def _val(v):
        if v is None:
            return None
        s = str(v).strip()
        return None if s.upper() in ("", "NULL", "NONE", "N/A", "NOT PROVIDED", "NOT AVAILABLE") else s

    complaint = {
        "source": _val(extracted.get("complaint_source")) or "Pharmacy",
        "customer_name": _val(extracted.get("customer_name")),
        "customer_type": _val(extracted.get("customer_type")) or "Pharmacy",
        "reporter_contact": _val(extracted.get("reporter_contact")),
        "product_type": _val(extracted.get("product_type")) or "FDF",
        "product_name": _val(extracted.get("product_name")),
        "strength_or_grade": _val(extracted.get("strength_or_grade")),
        "batch_number": _val(extracted.get("batch_number")),
        "manufacturing_date": _val(extracted.get("manufacturing_date")),
        "expiry_date": _val(extracted.get("expiry_date")),
        "affected_quantity": _val(extracted.get("affected_quantity")),
        "complaint_category": _val(extracted.get("complaint_category")) or "Product Quality",
        "complaint_date": _val(extracted.get("complaint_date")),
        "complaint_description": _val(extracted.get("complaint_description")) or text[:500],
        "originating_site_block": _val(extracted.get("originating_site_block")),
        "impacted_non_product_material": _val(extracted.get("impacted_non_product_material")),
        "patient_safety_indicators": extracted.get("patient_safety_indicators", False),
        # reporter_name surfaced for copilot display but not stored as a separate DB field
        "reporter_name": _val(extracted.get("reporter_name")),
    }

    return {
        "complaint": complaint,
        "field_confidence": field_confidence,
        "model_name": model_used,
        "is_fallback_used": is_fallback,
        "complaint_summary": extracted.get("complaint_summary", ""),
    }


def validate_and_normalize_node(state: ComplaintAgentState) -> Dict[str, Any]:
    """Stage 3: Normalize enums, uppercase batch, sanitize nulls."""
    complaint = dict(state.get("complaint", {}))

    # Normalize product_type
    pt = (complaint.get("product_type") or "FDF").strip().upper()
    complaint["product_type"] = pt if pt in VALID_PRODUCT_TYPES else "FDF"

    # Normalize complaint_category
    cat = complaint.get("complaint_category") or "Product Quality"
    if cat not in VALID_CATEGORIES:
        cat_lower = cat.lower()
        if "contam" in cat_lower or "foreign" in cat_lower or "particle" in cat_lower:
            cat = "Product Defect - Foreign Matter"
        elif "discolor" in cat_lower or "discolour" in cat_lower or "black spot" in cat_lower:
            cat = "Product Defect - Discoloration"
        elif "pack" in cat_lower or "foil" in cat_lower or "seal" in cat_lower or "blister" in cat_lower:
            cat = "Packaging"
        elif "adverse" in cat_lower or "reaction" in cat_lower or "harm" in cat_lower:
            cat = "Adverse Event"
        elif "label" in cat_lower or "barcode" in cat_lower:
            cat = "Labeling"
        elif "contamination" in cat_lower:
            cat = "Contamination"
        else:
            cat = "Product Quality"
    complaint["complaint_category"] = cat

    # Uppercase batch number
    if complaint.get("batch_number"):
        complaint["batch_number"] = complaint["batch_number"].strip().upper()

    # Clean product name
    if complaint.get("product_name"):
        complaint["product_name"] = complaint["product_name"].strip()

    return {"complaint": complaint}


def check_completeness_node(state: ComplaintAgentState) -> Dict[str, Any]:
    """Stage 4: Score completeness 0-1, identify missing required fields."""
    complaint = state.get("complaint", {})
    product_type = complaint.get("product_type", "FDF")

    required = FDF_REQUIRED if product_type == "FDF" else API_REQUIRED
    missing = []
    present = 0

    for field in required:
        val = complaint.get(field)
        if val and str(val).strip() and str(val).strip().upper() not in ("NONE", "NULL", "N/A", "NOT PROVIDED"):
            present += 1
        else:
            missing.append(field)

    # Also flag important optional fields
    optional_checks = {
        "manufacturing_date": "Manufacturing date",
        "expiry_date": "Expiry date",
        "reporter_contact": "Reporter contact information",
    }
    for field, label in optional_checks.items():
        val = complaint.get(field)
        if not val or str(val).strip().upper() in ("NONE", "NULL", "N/A", "NOT PROVIDED"):
            missing.append(label)

    completeness = round(present / len(required), 2) if required else 1.0

    return {
        "completeness_score": completeness,
        "missing_fields": missing,
    }


def assess_risk_node(state: ComplaintAgentState) -> Dict[str, Any]:
    """Stage 5: ICH Q9-inspired rule-based risk assessment."""
    complaint = state.get("complaint", {})
    severity, risk_level, patient_safety, justification = evaluate_ich_q9_risk(complaint)

    return {
        "suggested_severity": severity,
        "risk_level": risk_level,
        "patient_safety_impact": patient_safety,
        "risk_reasoning": justification,
    }


def generate_summary_actions_node(state: ComplaintAgentState) -> Dict[str, Any]:
    """Stage 6: Generate complaint summary and suggested next action."""
    complaint = state.get("complaint", {})
    severity = state.get("suggested_severity", "Major")

    product = complaint.get("product_name", "Product")
    batch = complaint.get("batch_number", "")
    category = complaint.get("complaint_category", "quality defect")

    # Build summary if not already extracted
    summary = state.get("complaint_summary", "")
    if not summary:
        summary = (
            f"{category} complaint for {product}"
            + (f" (Batch: {batch})" if batch else "")
            + f". Severity: {severity}."
        )

    # Suggest next action based on severity
    action_map = {
        "Critical": (
            "IMMEDIATE ACTION REQUIRED: Quarantine all inventory from this batch within 24 hours. "
            "Initiate regulatory notification assessment. Retain samples. Convene Emergency QA Review."
        ),
        "Major": (
            "Route to QA Investigation. Issue retain sample testing request. "
            "Quarantine suspect batch pending investigation. Initiate CAPA within 5 business days."
        ),
        "Minor": (
            "Route to standard QA review queue. Assess whether corrective action is required. "
            "Close within 30 days if no systemic issue identified."
        ),
    }

    return {
        "complaint_summary": summary,
        "suggested_next_action": action_map.get(severity, action_map["Major"]),
    }


def generate_root_cause_capa_node(state: ComplaintAgentState) -> Dict[str, Any]:
    """Stage 7: Generate root cause analysis and CAPA using Groq or fallback."""
    complaint = state.get("complaint", {})
    severity = state.get("suggested_severity", "Major")
    causes = []
    capas = []

    if settings.is_groq_available():
        try:
            from langchain_groq import ChatGroq
            from langchain_core.messages import HumanMessage

            llm = ChatGroq(
                model_name=settings.PRIMARY_MODEL,
                groq_api_key=settings.GROQ_API_KEY,
                temperature=0.2,
                max_tokens=600,
            )
            prompt = ROOT_CAUSE_CAPA_PROMPT.format(
                product_name=complaint.get("product_name", "Unknown"),
                category=complaint.get("complaint_category", "Unknown"),
                description=complaint.get("complaint_description", ""),
                severity=severity,
            )
            res = llm.invoke([HumanMessage(content=prompt)])
            content = res.content.strip()
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            res_json = json.loads(content)
            causes = res_json.get("possible_root_causes", [])
            capas = res_json.get("recommended_capa", [])
        except Exception as e:
            print(f"[LangGraph] CAPA node Groq failed, using fallback: {e}")

    if not causes or not capas:
        batch = complaint.get("batch_number", "this batch")
        category = complaint.get("complaint_category", "")
        cat_lower = category.lower()

        if "discolor" in cat_lower or "discolour" in cat_lower:
            causes = [
                f"Inadequate storage conditions (temperature/humidity excursion) during transit for batch {batch}.",
                "Chemical degradation of active ingredient due to moisture ingress through compromised primary packaging.",
                "Cross-contamination with cleaning agent residue on manufacturing equipment.",
            ]
            capas = [
                f"Quarantine batch {batch} and initiate retain sample analysis within 24 hours.",
                "Inspect and recalibrate temperature monitoring equipment in storage and transit areas.",
                "Review packaging integrity test results; issue Supplier Corrective Action Request (SCAR) if packaging defect confirmed.",
            ]
        elif "contam" in cat_lower or "foreign" in cat_lower or "particle" in cat_lower:
            causes = [
                "Inadequate equipment cleaning validation — residual particulate from previous batch.",
                "Environmental monitoring gap in ISO-classified manufacturing area.",
                f"Drum integrity failure during transport allowing ingress of foreign material (batch {batch}).",
            ]
            capas = [
                f"IMMEDIATE: Quarantine batch {batch}. Withdraw all distributed quantities. Notify Regulatory Affairs.",
                "Conduct emergency equipment cleaning verification and swab testing.",
                "Issue SCAR to primary container supplier. Review incoming QC inspection criteria.",
            ]
        elif "seal" in cat_lower or "pack" in cat_lower or "foil" in cat_lower:
            causes = [
                f"Heat sealer temperature calibration drift on Blistering Line during manufacturing of batch {batch}.",
                "Substandard aluminum foil material from supplier — insufficient seal strength specification.",
                "Rough handling during secondary logistics causing blister deformation.",
            ]
            capas = [
                f"Quarantine batch {batch}. Perform leak and integrity testing on retained samples.",
                "Re-calibrate all heat-sealer units on blistering lines and verify against IQ/OQ/PQ records.",
                "Conduct supplier qualification audit for aluminum foil material. Update incoming QC acceptance criteria.",
            ]
        else:
            causes = [
                f"Process deviation during manufacturing of batch {batch} — root cause under investigation.",
                "Raw material quality non-conformance from approved supplier.",
                "Environmental or handling conditions outside specification during storage or distribution.",
            ]
            capas = [
                f"Quarantine batch {batch} and request retain sample testing within 48 hours.",
                "Initiate formal root cause investigation using Fishbone / 5-Why methodology.",
                "Review batch manufacturing records and in-process test data. Issue CAPA within 15 business days.",
            ]

    return {
        "possible_root_causes": causes,
        "recommended_capa": capas,
    }


def finalize_response_node(state: ComplaintAgentState) -> Dict[str, Any]:
    """Stage 8: Compose final AI message and set workflow version."""
    complaint = state.get("complaint", {})
    severity = state.get("suggested_severity", "Major")
    completeness = state.get("completeness_score", 0.0)
    missing = state.get("missing_fields", [])
    is_fallback = state.get("is_fallback_used", False)

    product = complaint.get("product_name", "the product")
    batch = complaint.get("batch_number", "unknown batch")

    ai_message = (
        f"I've analyzed the complaint for **{product}** (Batch: {batch}). "
        f"Completeness: {int(completeness * 100)}%. "
        f"Suggested Severity: **{severity}**. "
    )

    if missing:
        ai_message += f"Missing: {', '.join(missing[:3])}."

    if is_fallback:
        ai_message += " _(Demo Mode — Groq API not configured. Add GROQ_API_KEY for full AI extraction.)_"

    return {
        "ai_message": ai_message,
        "workflow_version": "2.0.0",
    }


# ─────────────────────────────────────────────────────────────────────────────
# CONVERSATIONAL CORRECTION GRAPH NODES
# ─────────────────────────────────────────────────────────────────────────────

def detect_update_intent_node(state: ComplaintAgentState) -> Dict[str, Any]:
    """Detect whether user message contains a field correction."""
    msg = (state.get("user_message") or "").lower()

    # Check for correction intent keywords
    correction_indicators = [
        "actually", "sorry", "correct", "change", "update", "wrong",
        "should be", "is actually", "no,", "not", "batch number is",
        "quantity is", "the product", "customer is"
    ]
    has_correction = any(kw in msg for kw in correction_indicators)

    return {
        "operation": "UPDATE_EXISTING_DRAFT" if has_correction else "NO_OP",
    }


def extract_field_patch_node(state: ComplaintAgentState) -> Dict[str, Any]:
    """Extract field updates from conversational message using Groq or regex fallback."""
    user_message = state.get("user_message", "")
    current_draft = state.get("complaint", {})
    updates: dict = {}
    assistant_message = ""

    if settings.is_groq_available():
        try:
            from langchain_groq import ChatGroq
            from langchain_core.messages import HumanMessage

            llm = ChatGroq(
                model_name=settings.PRIMARY_MODEL,
                groq_api_key=settings.GROQ_API_KEY,
                temperature=0.1,
                max_tokens=400,
            )
            prompt = CHAT_CORRECTION_PROMPT.format(
                current_draft=json.dumps(current_draft, indent=2),
                user_message=user_message,
            )
            res = llm.invoke([HumanMessage(content=prompt)])
            content = res.content.strip()
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            res_json = json.loads(content)
            updates = res_json.get("updates", {})
            assistant_message = res_json.get("assistant_message", "")
        except Exception as e:
            print(f"[LangGraph] Chat correction Groq failed, using regex fallback: {e}")

    if not updates:
        updates, assistant_message = _regex_field_patch_fallback(user_message)

    return {
        "field_updates": updates,
        "ai_message": assistant_message,
    }


def validate_patch_node(state: ComplaintAgentState) -> Dict[str, Any]:
    """Validate that patch fields are known complaint fields."""
    KNOWN_FIELDS = {
        "batch_number", "affected_quantity", "product_name", "strength_or_grade",
        "customer_name", "reporter_contact", "manufacturing_date", "expiry_date",
        "complaint_category", "complaint_description", "originating_site_block",
        "impacted_non_product_material", "source", "customer_type", "product_type",
    }
    updates = dict(state.get("field_updates", {}))

    # Remove unknown fields
    validated = {k: v for k, v in updates.items() if k in KNOWN_FIELDS and v is not None}

    # Apply updates to complaint
    complaint = dict(state.get("complaint", {}))
    complaint.update(validated)

    return {
        "field_updates": validated,
        "complaint": complaint,
    }


def generate_assistant_ack_node(state: ComplaintAgentState) -> Dict[str, Any]:
    """Generate friendly acknowledgment of applied field updates."""
    updates = state.get("field_updates", {})
    existing_msg = state.get("ai_message", "")

    if not updates:
        ai_message = existing_msg or (
            "I couldn't identify a specific field to update from your message. "
            "You can say things like: 'The batch number should be BMX240602' "
            "or 'The affected quantity is 48 capsules'."
        )
    elif existing_msg:
        ai_message = existing_msg
    else:
        field_descriptions = []
        for field, value in updates.items():
            label = field.replace("_", " ").title()
            field_descriptions.append(f"{label} → '{value}'")
        ai_message = f"Done! Updated: {'; '.join(field_descriptions)}. Please review the form."

    return {"ai_message": ai_message}


# ─────────────────────────────────────────────────────────────────────────────
# LOCAL FALLBACK HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _local_extraction_fallback(text: str) -> dict:
    """Smart regex + keyword fallback for offline/demo mode."""
    text_lower = text.lower()

    # Product Type
    product_type = "API" if any(kw in text_lower for kw in ["api", "active pharmaceutical", "bulk powder", "hdpe drum", "hydrochloride api", "ip/bp", "usp grade"]) else "FDF"

    # Product Name
    product = None
    product_patterns = [
        (r"product\s*(?:name)?[:\-]?\s*([A-Za-z ]+(?:\d+\s*mg)?)", 1),
        (r"([A-Za-z]+\s+(?:Capsules?|Tablets?|Syrup|Suspension|Injection|API|Hydrochloride|Sulfate|Chloride)\s*(?:\d+\s*(?:mg|mcg|g|ml|IU/ml))?)", 1),
    ]
    for pattern, group in product_patterns:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            product = m.group(group).strip()
            break

    # Specific product keywords
    if not product:
        if "amoxicillin" in text_lower:
            product = "Amoxicillin Capsules"
            if "500" in text:
                product = "Amoxicillin Capsules 500 mg"
        elif "metformin" in text_lower:
            product = "Metformin Hydrochloride API"
        elif "insulin" in text_lower:
            product = "Insulin Glargine"
        elif "paracetamol" in text_lower or "pcm" in text_lower:
            product = "Paracetamol 500mg Tablets"
        else:
            product = "Unknown Product"

    # Batch Number
    batch_match = re.search(
        r'(?:batch|lot|b\.?no|lot\s*#)[:\s#\-]*([A-Z0-9][A-Z0-9\-]{4,14})',
        text, re.IGNORECASE
    )
    batch = batch_match.group(1).upper() if batch_match else None

    # Strength / Grade
    strength_match = re.search(r'(\d+\s*(?:mg|mcg|g|IU/ml|%)\b)', text, re.IGNORECASE)
    grade_match = re.search(r'\b(IP/BP|USP|EP|BP|IP)\b', text)
    if strength_match:
        strength = strength_match.group(1)
    elif grade_match:
        strength = grade_match.group(1)
    else:
        strength = None

    # Customer Name
    cust_match = re.search(r'(?:from|reporter|complainant|company|organization|pharmacy)[:\s]+([A-Z][A-Za-z\s,\.]+(?:Pvt\.?|Ltd\.?|Inc\.?|Pharmacy|Hospital|Sciences)?)', text, re.IGNORECASE)
    if cust_match:
        customer_name = cust_match.group(1).strip()[:80]
    else:
        dr_match = re.search(r'(?:Dr\.|Mr\.|Mrs\.|Ms\.)\s+[A-Z][a-z]+\s+[A-Z][a-z]+', text)
        customer_name = dr_match.group(0) if dr_match else None

    # Customer Type
    if "pharmacy" in text_lower:
        customer_type = "Pharmacy"
    elif "hospital" in text_lower:
        customer_type = "Hospital"
    elif "distributor" in text_lower:
        customer_type = "Distributor"
    elif "clinic" in text_lower:
        customer_type = "Clinic"
    else:
        customer_type = "Pharmacy"

    # Reporter Contact
    email_match = re.search(r'[\w\.\-]+@[\w\.\-]+\.\w+', text)
    reporter_contact = email_match.group(0) if email_match else None

    # Dates
    mfg_match = re.search(r'(?:manufacturing|mfg|manufacture)[^\n]*?(?:date|:)[^\n]*?((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,]+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4})', text, re.IGNORECASE)
    manufacturing_date = mfg_match.group(1).strip() if mfg_match else None

    exp_match = re.search(r'(?:expiry|expiration|exp)[^\n]*?(?:date|:)[^\n]*?((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,]+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4})', text, re.IGNORECASE)
    expiry_date = exp_match.group(1).strip() if exp_match else None

    # Quantity
    qty_match = re.search(r'(?:quantity|qty|affected|quantity affected|received)[:\s]+([0-9]+(?:\.\d+)?\s*(?:capsules?|tablets?|kg|g|ml|vials?|bottles?|strips?|units?|drums?))', text, re.IGNORECASE)
    affected_quantity = qty_match.group(1).strip() if qty_match else None

    # Category
    complaint_category = "Product Quality"
    if any(kw in text_lower for kw in ["discolor", "discolour", "black spot", "brown"]):
        complaint_category = "Product Defect - Discoloration"
    elif any(kw in text_lower for kw in ["foreign matter", "contamination", "particle", "particulate", "contaminated"]):
        complaint_category = "Product Defect - Foreign Matter"
    elif any(kw in text_lower for kw in ["seal", "foil", "blister", "packaging", "leak"]):
        complaint_category = "Packaging"
    elif any(kw in text_lower for kw in ["adverse", "reaction", "nausea", "vomit", "hospitalized"]):
        complaint_category = "Adverse Event"
    elif any(kw in text_lower for kw in ["label", "barcode"]):
        complaint_category = "Labeling"

    # Summary
    summary = f"{complaint_category} complaint received for {product or 'product'}"
    if batch:
        summary += f" (Batch: {batch})"
    summary += f". Customer: {customer_name or 'Not specified'}. Demo mode — add Groq API key for full AI extraction."

    return {
        "complaint_source": "Pharmacy",
        "customer_name": customer_name,
        "customer_type": customer_type,
        "reporter_contact": reporter_contact,
        "product_type": product_type,
        "product_name": product,
        "strength_or_grade": strength,
        "batch_number": batch,
        "manufacturing_date": manufacturing_date,
        "expiry_date": expiry_date,
        "affected_quantity": affected_quantity,
        "complaint_category": complaint_category,
        "complaint_date": None,
        "complaint_description": text[:800] if len(text) > 100 else text,
        "originating_site_block": "Manufacturing",
        "impacted_non_product_material": "Primary Packaging" if "packaging" in complaint_category.lower() else None,
        "patient_safety_indicators": False,
        "quality_defect_indicators": [],
        "complaint_summary": summary,
        "missing_information": [
            f for f in ["batch_number", "manufacturing_date", "reporter_contact", "affected_quantity"]
            if not locals().get(f.replace("manufacturing_date", "manufacturing_date").replace("reporter_contact", "reporter_contact"))
        ],
    }


def _compute_field_confidence(extracted: dict, original_text: str, is_fallback: bool) -> dict:
    """Compute per-field confidence scores based on extraction quality."""
    base_conf = 0.82 if is_fallback else 0.94
    field_confidence = {}

    fields_to_score = {
        "product_name": ("product_name", None),
        "batch_number": ("batch_number", r'(?:batch|lot)[:\s#]+[A-Z0-9]{4,}'),
        "customer_name": ("customer_name", None),
        "strength_or_grade": ("strength_or_grade", r'\d+\s*(?:mg|mcg|g|IU/ml|IP/BP)'),
        "manufacturing_date": ("manufacturing_date", r'(?:manufacture|mfg|manufacturing)'),
        "expiry_date": ("expiry_date", r'(?:expiry|expiration|exp)'),
        "affected_quantity": ("affected_quantity", r'\d+\s*(?:capsule|tablet|kg|mg|ml)'),
        "reporter_contact": ("reporter_contact", r'@|phone|tel'),
        "complaint_category": ("complaint_category", None),
        "complaint_description": ("complaint_description", None),
    }

    for field_key, (extracted_key, pattern) in fields_to_score.items():
        val = extracted.get(extracted_key)
        if not val:
            # Field not extracted
            field_confidence[field_key] = {"value": None, "confidence": 0.0}
        else:
            conf = base_conf
            # Boost confidence if pattern found in original text
            if pattern and re.search(pattern, original_text, re.IGNORECASE):
                conf = min(0.99, conf + 0.04)
            # Reduce confidence for inferred values
            if is_fallback:
                conf = max(0.60, conf - 0.10)
            field_confidence[field_key] = {"value": val, "confidence": round(conf, 2)}

    return field_confidence


def _regex_field_patch_fallback(user_message: str) -> tuple:
    """Regex-based field correction extractor for offline mode."""
    updates = {}
    msg = user_message

    # Batch number patterns
    batch_match = re.search(
        r'(?:batch(?:\s+(?:no|number|#))?|lot(?:\s+(?:no|number))?)\s+(?:is|should be|:)?\s*([A-Z0-9][A-Z0-9\-]{4,14})',
        msg, re.IGNORECASE
    )
    if batch_match:
        updates["batch_number"] = batch_match.group(1).upper()

    # Quantity patterns
    qty_match = re.search(
        r'(?:quantity|qty|affected quantity)\s+(?:is|should be|:)?\s*(\d+(?:\.\d+)?\s*(?:capsules?|tablets?|kg|g|ml|vials?|bottles?|strips?|units?|drums?))',
        msg, re.IGNORECASE
    )
    if qty_match:
        updates["affected_quantity"] = qty_match.group(1).strip()

    # Product name patterns
    prod_match = re.search(
        r'(?:product(?:\s+name)?)\s+(?:is|should be|:)?\s*"?([A-Za-z0-9 ]+(?:mg|mcg|g)?)"?',
        msg, re.IGNORECASE
    )
    if prod_match:
        updates["product_name"] = prod_match.group(1).strip()

    # Customer name
    cust_match = re.search(
        r'(?:customer|from|reporter)\s+(?:is|should be|:)?\s*"?([A-Za-z][A-Za-z\s,\.]+(?:Pvt\.?|Ltd\.?|Inc\.?|Pharmacy|Hospital)?)"?',
        msg, re.IGNORECASE
    )
    if cust_match:
        updates["customer_name"] = cust_match.group(1).strip()

    assistant_message = ""
    if updates:
        parts = [f"{k.replace('_', ' ').title()} → '{v}'" for k, v in updates.items()]
        assistant_message = f"Done! Updated: {'; '.join(parts)}. Please review the form."
    else:
        assistant_message = (
            "I couldn't identify a specific field to update. "
            "Try saying: 'The batch number is BMX240602' or 'The affected quantity is 48 capsules'."
        )

    return updates, assistant_message
