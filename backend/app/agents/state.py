from typing import TypedDict, List, Dict, Any, Optional


class ComplaintAgentState(TypedDict, total=False):
    # ── Input ──────────────────────────────────────────────────────────────────
    raw_text: str
    input_type: str            # "text" | "pdf" | "email"
    source_filename: Optional[str]

    # ── Operation mode ─────────────────────────────────────────────────────────
    operation: str             # "NEW_COMPLAINT" | "UPDATE_EXISTING_DRAFT"
    user_message: Optional[str]

    # ── Extracted complaint fields ──────────────────────────────────────────────
    complaint: dict            # flattened dict of all extracted fields

    # ── Conversational patch ────────────────────────────────────────────────────
    field_updates: dict        # {field_name: new_value}

    # ── Completeness ───────────────────────────────────────────────────────────
    missing_fields: list
    completeness_score: float

    # ── Risk ───────────────────────────────────────────────────────────────────
    suggested_severity: str
    risk_level: str
    patient_safety_impact: bool
    risk_reasoning: str

    # ── Copilot output ─────────────────────────────────────────────────────────
    complaint_summary: str
    suggested_next_action: str
    possible_root_causes: list
    recommended_capa: list

    # ── Duplicate detection ────────────────────────────────────────────────────
    duplicate_matches: list

    # ── Per-field AI confidence ────────────────────────────────────────────────
    field_confidence: dict     # {field_name: {"value": ..., "confidence": float}}

    # ── Assistant message ──────────────────────────────────────────────────────
    ai_message: str

    # ── Meta ───────────────────────────────────────────────────────────────────
    model_name: str
    workflow_version: str
    is_fallback_used: bool
    errors: list
