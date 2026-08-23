"""
FastAPI routes for complaint management and AI intake workflows.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.core.config import settings
from app.schemas.complaint import (
    ComplaintCreate, ComplaintUpdate, ComplaintResponse,
    AIAnalysisResult, AIIntakeRequest, DuplicateMatch,
    StatsResponse, AuditLogSchema, ChatCorrectionRequest, ChatCorrectionResponse,
)
from app.services.complaint_service import (
    create_complaint, patch_complaint_fields, get_complaint_stats,
    find_duplicate_complaints,
)
from app.services.document_parser import parse_document_bytes, DocumentParseError, MAX_FILE_BYTES
from app.agents.complaint_graph import complaint_ingestion_graph, complaint_patch_graph
from app.models.complaint import Complaint, ComplaintAIAnalysis, AuditLog

router = APIRouter(tags=["Complaints"])


# ── AI Intake Endpoints ───────────────────────────────────────────────────────

@router.post("/api/ai/intake/text")
def ai_intake_text(request: AIIntakeRequest, db: Session = Depends(get_db)):
    """Trigger 8-stage LangGraph ingestion workflow on text input."""
    initial_state = {
        "raw_text": request.text_content,
        "source_filename": request.file_name or "text_input.txt",
    }

    # Run LangGraph ingestion graph
    final_state = complaint_ingestion_graph.invoke(initial_state)

    complaint_fields = final_state.get("complaint", {})

    # Find duplicates from DB
    duplicates = find_duplicate_complaints(
        db=db,
        product_name=complaint_fields.get("product_name", ""),
        batch_number=complaint_fields.get("batch_number", ""),
        complaint_category=complaint_fields.get("complaint_category", ""),
        description=complaint_fields.get("complaint_description", ""),
    )

    # Save AI analysis record (unlinked to complaint for now)
    ai_record = ComplaintAIAnalysis(
        complaint_id=None,
        model_name=final_state.get("model_name", settings.PRIMARY_MODEL),
        workflow_version=final_state.get("workflow_version", "2.0.0"),
        extracted_fields_json=complaint_fields,
        field_confidence_json=final_state.get("field_confidence", {}),
        completeness_score=final_state.get("completeness_score", 0.85),
        missing_information=final_state.get("missing_fields", []),
        suggested_severity=final_state.get("suggested_severity", "Major"),
        suggested_risk=final_state.get("risk_level", "Medium"),
        risk_reasoning=final_state.get("risk_reasoning", ""),
        suggested_next_action=final_state.get("suggested_next_action", ""),
        complaint_summary=final_state.get("complaint_summary", ""),
        possible_root_causes=final_state.get("possible_root_causes", []),
        recommended_capa=final_state.get("recommended_capa", []),
        is_fallback_used=final_state.get("is_fallback_used", False),
    )
    db.add(ai_record)
    db.commit()
    db.refresh(ai_record)

    # Build the response
    analysis = AIAnalysisResult(
        id=ai_record.id,
        extracted_fields=complaint_fields,
        field_confidence=final_state.get("field_confidence", {}),
        completeness_score=final_state.get("completeness_score", 0.85),
        missing_information=final_state.get("missing_fields", []),
        suggested_severity=final_state.get("suggested_severity", "Major"),
        suggested_risk=final_state.get("risk_level", "Medium"),
        patient_safety_impact=final_state.get("patient_safety_impact"),
        risk_reasoning=final_state.get("risk_reasoning", ""),
        suggested_next_action=final_state.get("suggested_next_action", ""),
        complaint_summary=final_state.get("complaint_summary", ""),
        possible_root_causes=final_state.get("possible_root_causes", []),
        recommended_capa=final_state.get("recommended_capa", []),
        model_name=final_state.get("model_name", settings.PRIMARY_MODEL),
        is_fallback_used=final_state.get("is_fallback_used", False),
    )

    return {
        "ai_analysis_id": ai_record.id,
        "analysis": analysis.model_dump(),
        "duplicates": [d.model_dump() for d in duplicates],
    }


@router.post("/api/ai/intake/file")
async def ai_intake_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Extract text from an uploaded complaint file and run the LangGraph ingestion pipeline.

    Supported formats: PDF, DOCX, TXT, EML, MD, CSV
    Max size: 10 MB

    Response is identical in schema to /api/ai/intake/text, plus:
      - source_type: "file"
      - filename: original filename
      - extracted_text: the raw text fed to the AI
    """
    # ── 1. Read file with size guard ───────────────────────────────────────────
    contents = await file.read(MAX_FILE_BYTES + 1)
    if len(contents) > MAX_FILE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds the 10 MB size limit.",
        )

    filename = file.filename or "upload.txt"

    # ── 2. Extract text (format-specific) ─────────────────────────────────────
    try:
        extracted_text = parse_document_bytes(
            content=contents,
            filename=filename,
            content_type=file.content_type,
        )
    except DocumentParseError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error parsing file: {exc}",
        )

    # ── 3. Run same LangGraph pipeline as text intake ─────────────────────────
    initial_state = {
        "raw_text": extracted_text,
        "source_filename": filename,
        "input_type": _detect_input_type(filename),
    }

    final_state = complaint_ingestion_graph.invoke(initial_state)
    complaint_fields = final_state.get("complaint", {})

    # ── 4. Duplicate check ────────────────────────────────────────────────────
    duplicates = find_duplicate_complaints(
        db=db,
        product_name=complaint_fields.get("product_name", ""),
        batch_number=complaint_fields.get("batch_number", ""),
        complaint_category=complaint_fields.get("complaint_category", ""),
        description=complaint_fields.get("complaint_description", ""),
    )

    # ── 5. Persist AI analysis record ─────────────────────────────────────────
    ai_record = ComplaintAIAnalysis(
        complaint_id=None,
        model_name=final_state.get("model_name", settings.PRIMARY_MODEL),
        workflow_version=final_state.get("workflow_version", "2.0.0"),
        extracted_fields_json=complaint_fields,
        field_confidence_json=final_state.get("field_confidence", {}),
        completeness_score=final_state.get("completeness_score", 0.85),
        missing_information=final_state.get("missing_fields", []),
        suggested_severity=final_state.get("suggested_severity", "Major"),
        suggested_risk=final_state.get("risk_level", "Medium"),
        risk_reasoning=final_state.get("risk_reasoning", ""),
        suggested_next_action=final_state.get("suggested_next_action", ""),
        complaint_summary=final_state.get("complaint_summary", ""),
        possible_root_causes=final_state.get("possible_root_causes", []),
        recommended_capa=final_state.get("recommended_capa", []),
        is_fallback_used=final_state.get("is_fallback_used", False),
    )
    db.add(ai_record)
    db.commit()
    db.refresh(ai_record)

    # ── 6. Build response (same shape as text intake + file metadata) ──────────
    analysis = AIAnalysisResult(
        id=ai_record.id,
        extracted_fields=complaint_fields,
        field_confidence=final_state.get("field_confidence", {}),
        completeness_score=final_state.get("completeness_score", 0.85),
        missing_information=final_state.get("missing_fields", []),
        suggested_severity=final_state.get("suggested_severity", "Major"),
        suggested_risk=final_state.get("risk_level", "Medium"),
        patient_safety_impact=final_state.get("patient_safety_impact"),
        risk_reasoning=final_state.get("risk_reasoning", ""),
        suggested_next_action=final_state.get("suggested_next_action", ""),
        complaint_summary=final_state.get("complaint_summary", ""),
        possible_root_causes=final_state.get("possible_root_causes", []),
        recommended_capa=final_state.get("recommended_capa", []),
        model_name=final_state.get("model_name", settings.PRIMARY_MODEL),
        is_fallback_used=final_state.get("is_fallback_used", False),
    )

    return {
        "source_type": "file",
        "filename": filename,
        "extracted_text": extracted_text[:2000],   # truncated for logging; full text was sent to AI
        "ai_analysis_id": ai_record.id,
        "analysis": analysis.model_dump(),
        "duplicates": [d.model_dump() for d in duplicates],
    }


def _detect_input_type(filename: str) -> str:
    """Map filename extension to input_type hint for LangGraph state."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return {"pdf": "pdf", "eml": "email", "docx": "docx"}.get(ext, "text")


@router.post("/api/ai/chat", response_model=ChatCorrectionResponse)
def ai_chat_correction(request: ChatCorrectionRequest):
    """Run conversational correction graph for field patching."""
    initial_state = {
        "complaint": request.draft_complaint,
        "user_message": request.user_message,
    }

    final_state = complaint_patch_graph.invoke(initial_state)

    return ChatCorrectionResponse(
        updates=final_state.get("field_updates", {}),
        assistant_message=final_state.get("ai_message", "No update detected."),
        operation=final_state.get("operation", "no_update"),
    )


# ── Complaint CRUD Endpoints ──────────────────────────────────────────────────

@router.post("/api/complaints", response_model=ComplaintResponse)
def save_complaint(payload: ComplaintCreate, db: Session = Depends(get_db)):
    """Save a human-reviewed complaint to the QMS database."""
    return create_complaint(db, payload)


@router.get("/api/complaints", response_model=List[ComplaintResponse])
def list_complaints(
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    risk_level: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """List complaints with optional filtering."""
    query = db.query(Complaint)

    if status:
        query = query.filter(Complaint.status == status)
    if severity:
        query = query.filter(Complaint.severity == severity)
    if risk_level:
        query = query.filter(Complaint.risk_level == risk_level)
    if search:
        s = f"%{search}%"
        query = query.filter(
            (Complaint.complaint_number.like(s)) |
            (Complaint.product_name.like(s)) |
            (Complaint.batch_number.like(s)) |
            (Complaint.customer_name.like(s))
        )

    return query.order_by(Complaint.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/api/complaints/stats", response_model=StatsResponse)
def get_stats(db: Session = Depends(get_db)):
    """Return dashboard statistics."""
    return get_complaint_stats(db)


@router.get("/api/complaints/{complaint_id}", response_model=ComplaintResponse)
def get_complaint(complaint_id: int, db: Session = Depends(get_db)):
    """Get a single complaint by ID."""
    cmp = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not cmp:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return cmp


@router.patch("/api/complaints/{complaint_id}", response_model=ComplaintResponse)
def update_complaint(complaint_id: int, payload: ComplaintUpdate, db: Session = Depends(get_db)):
    """Patch complaint fields with audit trail."""
    updates = payload.model_dump(exclude_unset=True)
    result = patch_complaint_fields(db, complaint_id, updates)
    if not result:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return result


@router.get("/api/complaints/{complaint_id}/audit", response_model=List[AuditLogSchema])
def get_audit_log(complaint_id: int, db: Session = Depends(get_db)):
    """Get audit trail for a complaint."""
    logs = db.query(AuditLog).filter(
        AuditLog.complaint_id == complaint_id
    ).order_by(AuditLog.created_at.asc()).all()
    return logs
