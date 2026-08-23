from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime


class FieldConfidenceItem(BaseModel):
    value: Any = None
    confidence: float = 0.90


# ── Chat Correction ────────────────────────────────────────────────────────────

class ChatCorrectionRequest(BaseModel):
    draft_complaint: Dict[str, Any]
    user_message: str


class ChatCorrectionResponse(BaseModel):
    updates: Dict[str, Any]
    assistant_message: str
    operation: str = "update_fields"


# ── Complaint Core ─────────────────────────────────────────────────────────────

class ComplaintBase(BaseModel):
    # Origin & Customer
    source: str = "Pharmacy"
    customer_name: Optional[str] = None
    customer_type: Optional[str] = None
    reporter_contact: Optional[str] = None

    # Product
    product_type: str = "FDF"
    product_name: str
    strength_or_grade: Optional[str] = None
    batch_number: str
    affected_quantity: Optional[str] = None
    manufacturing_date: Optional[str] = None
    expiry_date: Optional[str] = None

    # Complaint details
    complaint_category: str = "Product Quality"
    complaint_date: Optional[str] = None
    complaint_description: Optional[str] = None
    originating_site_block: Optional[str] = None
    impacted_non_product_material: Optional[str] = None

    # Risk
    severity: str = "Major"
    risk_level: str = "Medium"
    patient_safety_impact: bool = False
    initial_risk_assessment: Optional[str] = None
    suggested_next_action: Optional[str] = None

    # Status
    status: str = "Pending Triage"
    assigned_investigator: Optional[str] = None

    # AI generated lists
    missing_information: List[str] = Field(default_factory=list)
    possible_root_causes: List[str] = Field(default_factory=list)
    recommended_capa: List[str] = Field(default_factory=list)


class ComplaintCreate(ComplaintBase):
    pass


class ComplaintUpdate(BaseModel):
    source: Optional[str] = None
    customer_name: Optional[str] = None
    customer_type: Optional[str] = None
    reporter_contact: Optional[str] = None
    product_type: Optional[str] = None
    product_name: Optional[str] = None
    strength_or_grade: Optional[str] = None
    batch_number: Optional[str] = None
    affected_quantity: Optional[str] = None
    manufacturing_date: Optional[str] = None
    expiry_date: Optional[str] = None
    complaint_category: Optional[str] = None
    complaint_date: Optional[str] = None
    complaint_description: Optional[str] = None
    originating_site_block: Optional[str] = None
    impacted_non_product_material: Optional[str] = None
    severity: Optional[str] = None
    risk_level: Optional[str] = None
    patient_safety_impact: Optional[bool] = None
    initial_risk_assessment: Optional[str] = None
    suggested_next_action: Optional[str] = None
    status: Optional[str] = None
    assigned_investigator: Optional[str] = None
    missing_information: Optional[List[str]] = None
    possible_root_causes: Optional[List[str]] = None
    recommended_capa: Optional[List[str]] = None


# ── Sub-object schemas ─────────────────────────────────────────────────────────

class AuditLogSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    complaint_id: int
    field_name: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    change_source: str
    actor: str
    created_at: datetime


class CapaTaskSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    complaint_id: int
    action: str
    owner: str
    status: str
    due_date: Optional[str] = None
    created_at: datetime


class ComplaintResponse(ComplaintBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    complaint_number: str
    created_at: datetime
    updated_at: datetime
    audit_logs: List[AuditLogSchema] = Field(default_factory=list)
    capa_tasks: List[CapaTaskSchema] = Field(default_factory=list)


# ── AI Analysis ────────────────────────────────────────────────────────────────

class AIAnalysisResult(BaseModel):
    id: Optional[int] = None
    extracted_fields: Dict[str, Any] = Field(default_factory=dict)
    field_confidence: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    completeness_score: float = 0.85
    missing_information: List[str] = Field(default_factory=list)
    suggested_severity: str = "Major"
    suggested_risk: str = "Medium"
    patient_safety_impact: Optional[bool] = None
    risk_reasoning: str = ""
    suggested_next_action: str = "Route to QA Investigation"
    complaint_summary: str = ""
    possible_root_causes: List[str] = Field(default_factory=list)
    recommended_capa: List[str] = Field(default_factory=list)
    model_name: str = "llama-3.3-70b-versatile"
    is_fallback_used: bool = False


class DuplicateMatch(BaseModel):
    complaint_id: int
    complaint_number: str
    product_name: str
    batch_number: str
    complaint_category: str
    similarity_score: float
    matched_factors: List[str]


# ── Request / Stats ────────────────────────────────────────────────────────────

class AIIntakeRequest(BaseModel):
    text_content: str
    file_name: Optional[str] = "text_input.txt"


class StatsResponse(BaseModel):
    total_complaints: int
    open_investigations: int
    high_risk_count: int
    capa_pending_count: int
    categories_breakdown: Dict[str, int]
    risk_breakdown: Dict[str, int]
    severity_breakdown: Dict[str, int]
