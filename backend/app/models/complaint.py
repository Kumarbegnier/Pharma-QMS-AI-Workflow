from sqlalchemy import Column, Integer, String, Text, Boolean, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(Integer, primary_key=True, index=True)
    complaint_number = Column(String(50), unique=True, index=True)

    # Origin & Customer
    source = Column(String(50), default="Pharmacy")
    customer_name = Column(String(150), nullable=True)
    customer_type = Column(String(80), nullable=True)
    reporter_contact = Column(String(200), nullable=True)

    # Product
    product_type = Column(String(20), default="FDF")   # FDF | API
    product_name = Column(String(150), index=True)
    strength_or_grade = Column(String(100), nullable=True)
    batch_number = Column(String(50), index=True)
    affected_quantity = Column(String(100), nullable=True)
    manufacturing_date = Column(String(50), nullable=True)
    expiry_date = Column(String(50), nullable=True)

    # Complaint context
    complaint_category = Column(String(150), default="Product Quality")
    complaint_date = Column(String(50), nullable=True)
    complaint_description = Column(Text, nullable=True)
    originating_site_block = Column(String(100), nullable=True)
    impacted_non_product_material = Column(String(200), nullable=True)

    # Risk & QMS values
    severity = Column(String(20), default="Major")          # Critical | Major | Minor
    risk_level = Column(String(20), default="Medium")       # High | Medium | Low
    patient_safety_impact = Column(Boolean, default=False)
    initial_risk_assessment = Column(Text, nullable=True)
    suggested_next_action = Column(Text, nullable=True)

    # Workflow status
    status = Column(String(50), default="Pending Triage")   # Pending Triage | Under Investigation | CAPA Pending | Closed
    assigned_investigator = Column(String(100), nullable=True)

    # AI-generated JSON lists
    missing_information = Column(JSON, default=list)
    possible_root_causes = Column(JSON, default=list)
    recommended_capa = Column(JSON, default=list)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    ai_analyses = relationship("ComplaintAIAnalysis", back_populates="complaint", cascade="all, delete-orphan")
    sources = relationship("ComplaintSource", back_populates="complaint", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="complaint", cascade="all, delete-orphan", order_by="AuditLog.created_at")
    capa_tasks = relationship("CapaTask", back_populates="complaint", cascade="all, delete-orphan")


class ComplaintAIAnalysis(Base):
    __tablename__ = "complaint_ai_analyses"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id"), nullable=True)

    model_name = Column(String(80), default="gemma2-9b-it")
    workflow_version = Column(String(20), default="2.0.0")

    extracted_fields_json = Column(JSON)           # all extracted raw fields
    field_confidence_json = Column(JSON)           # {field: {value, confidence}}

    completeness_score = Column(Float, default=0.85)
    missing_information = Column(JSON, default=list)

    suggested_severity = Column(String(20), default="Major")
    suggested_risk = Column(String(20), default="Medium")
    risk_reasoning = Column(Text, nullable=True)
    suggested_next_action = Column(Text, nullable=True)

    complaint_summary = Column(Text, nullable=True)
    possible_root_causes = Column(JSON, default=list)
    recommended_capa = Column(JSON, default=list)

    is_fallback_used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    complaint = relationship("Complaint", back_populates="ai_analyses")


class ComplaintSource(Base):
    __tablename__ = "complaint_sources"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id"), nullable=True)

    raw_text = Column(Text)
    file_name = Column(String(200), nullable=True)
    file_type = Column(String(50), default="text")   # text | pdf | email
    created_at = Column(DateTime, default=datetime.utcnow)

    complaint = relationship("Complaint", back_populates="sources")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id"))

    field_name = Column(String(100))          # e.g. batch_number, status, COMPLAINT_LOGGED
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    change_source = Column(String(50), default="SYSTEM")   # AI | USER | SYSTEM
    actor = Column(String(100), default="System")
    created_at = Column(DateTime, default=datetime.utcnow)

    complaint = relationship("Complaint", back_populates="audit_logs")


class CapaTask(Base):
    __tablename__ = "capa_tasks"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id"))

    action = Column(Text)
    owner = Column(String(100), default="QA Specialist")
    status = Column(String(50), default="Open")    # Open | In Progress | Completed
    due_date = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    complaint = relationship("Complaint", back_populates="capa_tasks")
