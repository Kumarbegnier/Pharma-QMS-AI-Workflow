"""
Complaint service — business logic layer for complaint CRUD and analysis.
"""

from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
import difflib

from app.models.complaint import Complaint, ComplaintAIAnalysis, AuditLog, CapaTask
from app.schemas.complaint import (
    ComplaintCreate, ComplaintUpdate, DuplicateMatch, StatsResponse
)


def generate_complaint_number(db: Session) -> str:
    """Generate a unique QMS complaint ID: CMP-YYYY-NNNN."""
    count = db.query(Complaint).count()
    year = datetime.now().year
    return f"CMP-{year}-{(count + 1):04d}"


def calculate_text_similarity(text1: str, text2: str) -> float:
    """Difflib sequence matcher ratio."""
    if not text1 or not text2:
        return 0.0
    return difflib.SequenceMatcher(None, text1.lower()[:500], text2.lower()[:500]).ratio()


def find_duplicate_complaints(
    db: Session,
    product_name: str,
    batch_number: str,
    complaint_category: str,
    description: str,
    exclude_id: Optional[int] = None,
) -> List[DuplicateMatch]:
    """
    Weighted duplicate detection.
    Score = batch(0.40) + product(0.25) + category(0.15) + description(0.20)
    """
    existing = db.query(Complaint).all()
    matches: List[DuplicateMatch] = []

    t_prod = (product_name or "").strip().lower()
    t_batch = (batch_number or "").strip().lower()
    t_cat = (complaint_category or "").strip().lower()

    for cmp in existing:
        if exclude_id and cmp.id == exclude_id:
            continue

        factors = []

        # Batch match (40%)
        c_batch = (cmp.batch_number or "").strip().lower()
        batch_match = 1.0 if t_batch and c_batch and t_batch == c_batch else 0.0
        if batch_match > 0:
            factors.append("Matching Batch Number")

        # Product match (25%)
        c_prod = (cmp.product_name or "").strip().lower()
        prod_match = 1.0 if t_prod and c_prod and (t_prod in c_prod or c_prod in t_prod) else 0.0
        if prod_match > 0:
            factors.append("Matching Product")

        # Category match (15%)
        c_cat = (cmp.complaint_category or "").strip().lower()
        cat_match = 1.0 if t_cat and c_cat and t_cat == c_cat else 0.0
        if cat_match > 0:
            factors.append("Matching Category")

        # Description similarity (20%)
        desc_sim = calculate_text_similarity(description, cmp.complaint_description or "")
        if desc_sim > 0.35:
            factors.append(f"Description Similarity ({int(desc_sim * 100)}%)")

        score = (batch_match * 0.40) + (prod_match * 0.25) + (cat_match * 0.15) + (desc_sim * 0.20)

        if score >= 0.40:
            matches.append(DuplicateMatch(
                complaint_id=cmp.id,
                complaint_number=cmp.complaint_number or f"CMP-SEED-{cmp.id}",
                product_name=cmp.product_name or "",
                batch_number=cmp.batch_number or "",
                complaint_category=cmp.complaint_category or "",
                similarity_score=round(score, 2),
                matched_factors=factors,
            ))

    matches.sort(key=lambda x: x.similarity_score, reverse=True)
    return matches[:5]


def create_complaint(
    db: Session,
    schema: ComplaintCreate,
    actor: str = "Quality Assurance Officer",
) -> Complaint:
    """Create a new complaint with initial audit log entry."""
    complaint_num = generate_complaint_number(db)

    complaint = Complaint(
        complaint_number=complaint_num,
        source=schema.source,
        customer_name=schema.customer_name,
        customer_type=schema.customer_type,
        reporter_contact=schema.reporter_contact,
        product_type=schema.product_type,
        product_name=schema.product_name,
        strength_or_grade=schema.strength_or_grade,
        batch_number=schema.batch_number,
        affected_quantity=schema.affected_quantity,
        manufacturing_date=schema.manufacturing_date,
        expiry_date=schema.expiry_date,
        complaint_category=schema.complaint_category,
        complaint_date=schema.complaint_date,
        complaint_description=schema.complaint_description,
        originating_site_block=schema.originating_site_block,
        impacted_non_product_material=schema.impacted_non_product_material,
        severity=schema.severity,
        risk_level=schema.risk_level,
        patient_safety_impact=schema.patient_safety_impact,
        initial_risk_assessment=schema.initial_risk_assessment,
        suggested_next_action=schema.suggested_next_action,
        status=schema.status or "Pending Triage",
        assigned_investigator=schema.assigned_investigator,
        missing_information=schema.missing_information,
        possible_root_causes=schema.possible_root_causes,
        recommended_capa=schema.recommended_capa,
    )
    db.add(complaint)
    db.commit()
    db.refresh(complaint)

    # Initial audit entry
    audit = AuditLog(
        complaint_id=complaint.id,
        field_name="COMPLAINT_LOGGED",
        old_value=None,
        new_value=f"Complaint {complaint_num} logged for {complaint.product_name} (Batch: {complaint.batch_number})",
        change_source="SYSTEM",
        actor=actor,
    )
    db.add(audit)

    # Auto-create CAPA tasks if recommended
    if schema.recommended_capa:
        for idx, capa_text in enumerate(schema.recommended_capa[:3]):
            task = CapaTask(
                complaint_id=complaint.id,
                action=capa_text,
                owner="QA Manager",
                status="Open",
            )
            db.add(task)

    db.commit()
    db.refresh(complaint)
    return complaint


def patch_complaint_fields(
    db: Session,
    complaint_id: int,
    updates: dict,
    actor: str = "Quality Assurance Officer",
    change_source: str = "USER",
) -> Optional[Complaint]:
    """Patch individual complaint fields with audit trail."""
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        return None

    for field, new_value in updates.items():
        if new_value is None:
            continue
        if not hasattr(complaint, field):
            continue
        old_value = getattr(complaint, field)
        if str(old_value) == str(new_value):
            continue

        setattr(complaint, field, new_value)

        audit = AuditLog(
            complaint_id=complaint.id,
            field_name=field,
            old_value=str(old_value) if old_value is not None else None,
            new_value=str(new_value),
            change_source=change_source,
            actor=actor,
        )
        db.add(audit)

    db.commit()
    db.refresh(complaint)
    return complaint


def get_complaint_stats(db: Session) -> StatsResponse:
    """Compute dashboard statistics."""
    total = db.query(Complaint).count()
    open_inv = db.query(Complaint).filter(
        Complaint.status.in_(["Pending Triage", "Under Investigation"])
    ).count()
    high_risk = db.query(Complaint).filter(Complaint.risk_level == "High").count()
    capa_pending = db.query(Complaint).filter(Complaint.status == "CAPA Pending").count()

    # Category breakdown
    cat_counts = {}
    for cat, cnt in db.query(Complaint.complaint_category, func.count(Complaint.id)).group_by(Complaint.complaint_category).all():
        cat_counts[cat or "Uncategorized"] = cnt

    # Risk breakdown
    risk_counts = {}
    for r, cnt in db.query(Complaint.risk_level, func.count(Complaint.id)).group_by(Complaint.risk_level).all():
        risk_counts[r or "Medium"] = cnt

    # Severity breakdown
    sev_counts = {}
    for s, cnt in db.query(Complaint.severity, func.count(Complaint.id)).group_by(Complaint.severity).all():
        sev_counts[s or "Major"] = cnt

    return StatsResponse(
        total_complaints=total,
        open_investigations=open_inv,
        high_risk_count=high_risk,
        capa_pending_count=capa_pending,
        categories_breakdown=cat_counts,
        risk_breakdown=risk_counts,
        severity_breakdown=sev_counts,
    )
