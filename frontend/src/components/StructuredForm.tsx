import React from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { updateFieldManually, saveComplaint, resetDraft } from '../features/complaints/complaintsSlice';
import RiskAssessmentCard from './RiskAssessmentCard';
import DuplicateAlert from './DuplicateAlert';
import type { FieldConfidence } from '../features/complaints/types';

interface StructuredFormProps {
  onSaved?: (id: number) => void;
  onViewComplaint?: (id: number) => void;
}

const CATEGORIES = [
  'Product Defect - Discoloration',
  'Product Defect - Foreign Matter',
  'Contamination',
  'Packaging',
  'Product Quality',
  'Adverse Event',
  'Labeling',
  'Other',
];
const CUSTOMER_TYPES = ['Pharmacy', 'Hospital', 'Clinic', 'Distributor', 'Patient', 'Other'];
const SOURCES = ['Pharmacy', 'Hospital', 'Email', 'Distributor', 'Patient', 'Other'];
const STATUSES = ['Pending Triage', 'Under Investigation', 'CAPA Pending', 'Closed'];

function getConfidenceBadge(
  fieldKey: string,
  confidence: Record<string, FieldConfidence>,
  aiFields: string[],
) {
  if (!aiFields.includes(fieldKey)) return null;
  const fc = confidence[fieldKey];
  if (!fc) return null;
  const pct = Math.round(fc.confidence * 100);
  let cls = 'confidence-high';
  if (fc.confidence < 0.70) cls = 'confidence-low';
  else if (fc.confidence < 0.85) cls = 'confidence-medium';
  return <span className={`confidence-badge ${cls}`}>AI {pct}%</span>;
}

const statusBadgeClass: Record<string, string> = {
  'Pending Triage': 'badge-pending',
  'Under Investigation': 'badge-investigating',
  'CAPA Pending': 'badge-capa',
  'Closed': 'badge-closed',
};

const StructuredForm: React.FC<StructuredFormProps> = ({ onSaved, onViewComplaint }) => {
  const dispatch = useAppDispatch();
  const {
    draft, analysis, extractionStatus, aiPopulatedFields, userReviewedFields, duplicates, loading,
  } = useAppSelector(s => s.complaints);

  const confidence = analysis?.field_confidence || {};
  const isAIReady = extractionStatus === 'ready';
  const canSave = !loading && !!draft.product_name && !!draft.batch_number;

  const update = (field: string, value: any) =>
    dispatch(updateFieldManually({ field, value }));

  const handleSave = async () => {
    const payload = {
      source: draft.source,
      customer_name: draft.customer_name,
      customer_type: draft.customer_type,
      reporter_contact: draft.reporter_contact,
      product_type: draft.product_type || 'FDF',
      product_name: draft.product_name,
      strength_or_grade: draft.strength_or_grade,
      batch_number: draft.batch_number,
      affected_quantity: draft.affected_quantity,
      manufacturing_date: draft.manufacturing_date,
      expiry_date: draft.expiry_date,
      complaint_date: draft.complaint_date,
      complaint_category: draft.complaint_category,
      complaint_description: draft.complaint_description,
      originating_site_block: draft.originating_site_block,
      impacted_non_product_material: draft.impacted_non_product_material,
      severity: draft.suggested_severity || 'Major',
      risk_level: draft.risk_level || 'Medium',
      patient_safety_impact: draft.patient_safety_impact || false,
      initial_risk_assessment: analysis?.risk_reasoning || '',
      suggested_next_action: analysis?.suggested_next_action || '',
      status: 'Pending Triage',
      assigned_investigator: draft.assigned_investigator,
      missing_information: draft.missing_information,
      possible_root_causes: draft.possible_root_causes,
      recommended_capa: draft.recommended_capa,
    };
    const result = await dispatch(saveComplaint(payload));
    if (saveComplaint.fulfilled.match(result)) {
      const savedId = result.payload?.id;
      if (onSaved && savedId) onSaved(savedId);
      dispatch(resetDraft());
    }
  };

  const isAI = (f: string) => aiPopulatedFields.includes(f);
  const isReviewed = (f: string) => userReviewedFields.includes(f);

  /** Label row: label text + badge on the right */
  const FieldLabel = ({ label, field }: { label: string; field: string }) => (
    <span className="form-label">
      {label}
      {isReviewed(field) ? (
        <span className="reviewed-badge" style={{ marginLeft: 'auto' }}>✓ Reviewed</span>
      ) : isAI(field) ? (
        <span className="ai-tag" style={{ marginLeft: 'auto' }}>AI</span>
      ) : null}
    </span>
  );

  /** Input class: ai-populated when AI filled and not yet reviewed by user */
  const fieldCls = (field: string) =>
    isAI(field) && !isReviewed(field) ? 'ai-populated' : '';

  const completeness = analysis ? Math.round((analysis.completeness_score || 0) * 100) : null;
  const complClass = completeness === null ? '' : completeness >= 80 ? 'high' : completeness >= 50 ? 'medium' : 'low';

  // Show FDF/API badge only after AI has set it
  const showTypeBadge = isAIReady && draft.product_type;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Panel header ─────────────────────────────────────────────── */}
      <div className="form-panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div>
            <div className="form-panel-title">Log Customer Complaint</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {showTypeBadge && (
              <span className={`badge ${draft.product_type === 'API' ? 'badge-api' : 'badge-fdf'}`}>
                {draft.product_type}
              </span>
            )}
            <span className={`badge ${statusBadgeClass[draft.status] || 'badge-pending'}`}>
              {draft.status || 'Pending Triage'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isAIReady && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 11, fontWeight: 600, color: '#16A34A',
              padding: '2px 8px', background: '#F0FDF4',
              border: '1px solid #BBF7D0', borderRadius: 4,
            }}>
              ✓ AI analysis complete
            </span>
          )}
          {extractionStatus === 'idle' && (
            <span style={{ fontSize: 11, color: '#94A3B8' }}>
              Upload or paste a complaint to auto-fill
            </span>
          )}
        </div>
      </div>

      {/* Duplicate alert */}
      <DuplicateAlert duplicates={duplicates} onViewComplaint={onViewComplaint} />

      {/* ── Scrollable form body ─────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* SECTION 1: Origin & Customer */}
        <div className="form-section">
          <div className="form-section-title">Origin &amp; Customer</div>
          <div className="form-grid">
            <div className="form-group">
              <FieldLabel label="Complaint Source" field="source" />
              <select
                className={`form-control ${fieldCls('source')}`}
                value={draft.source}
                onChange={e => update('source', e.target.value)}
              >
                <option value="">Select source</option>
                {SOURCES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <FieldLabel label="Customer Type" field="customer_type" />
              <select
                className={`form-control ${fieldCls('customer_type')}`}
                value={draft.customer_type}
                onChange={e => update('customer_type', e.target.value)}
              >
                <option value="">Select customer type</option>
                {CUSTOMER_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <FieldLabel label="Customer / Organization" field="customer_name" />
              <input
                type="text"
                className={`form-control ${fieldCls('customer_name')}`}
                value={draft.customer_name}
                onChange={e => update('customer_name', e.target.value)}
                placeholder="e.g. Apollo Pharmacy"
              />
            </div>
            <div className="form-group">
              <FieldLabel label="Reporter Contact" field="reporter_contact" />
              <input
                type="text"
                className={`form-control ${fieldCls('reporter_contact')}`}
                value={draft.reporter_contact}
                onChange={e => update('reporter_contact', e.target.value)}
                placeholder="Email or phone"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: Product & Batch */}
        <div className="form-section">
          <div className="form-section-title">Product &amp; Batch</div>

          {/* Product type toggle */}
          <div className="form-group" style={{ marginBottom: 12 }}>
            <span className="form-label">
              Product Type
              {isAI('product_type') && !isReviewed('product_type') && (
                <span className="ai-tag" style={{ marginLeft: 'auto' }}>AI</span>
              )}
            </span>
            <div className="product-type-toggle">
              <button
                className={`product-type-btn ${draft.product_type === 'FDF' ? 'selected-fdf' : ''}`}
                onClick={() => update('product_type', 'FDF')}
              >
                FDF
              </button>
              <button
                className={`product-type-btn ${draft.product_type === 'API' ? 'selected-api' : ''}`}
                onClick={() => update('product_type', 'API')}
              >
                API
              </button>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <FieldLabel label="Product Name" field="product_name" />
              <input
                type="text"
                className={`form-control ${fieldCls('product_name')}`}
                value={draft.product_name}
                onChange={e => update('product_name', e.target.value)}
                placeholder="e.g. Amoxicillin Capsules"
              />
            </div>
            <div className="form-group">
              <FieldLabel
                label={draft.product_type === 'API' ? 'Grade / Specification' : 'Strength'}
                field="strength_or_grade"
              />
              <input
                type="text"
                className={`form-control ${fieldCls('strength_or_grade')}`}
                value={draft.strength_or_grade}
                onChange={e => update('strength_or_grade', e.target.value)}
                placeholder={draft.product_type === 'API' ? 'e.g. IP/BP, USP' : 'e.g. 500 mg'}
              />
            </div>
            <div className="form-group">
              <FieldLabel label="Batch / Lot Number" field="batch_number" />
              <input
                type="text"
                className={`form-control data-mono ${fieldCls('batch_number')}`}
                value={draft.batch_number}
                onChange={e => update('batch_number', e.target.value.toUpperCase())}
                placeholder="e.g. AMX240602"
              />
            </div>
            <div className="form-group">
              <FieldLabel label="Quantity Affected" field="affected_quantity" />
              <input
                type="text"
                className={`form-control ${fieldCls('affected_quantity')}`}
                value={draft.affected_quantity}
                onChange={e => update('affected_quantity', e.target.value)}
                placeholder="e.g. 12 capsules"
              />
            </div>
            <div className="form-group">
              <FieldLabel label="Manufacturing Date" field="manufacturing_date" />
              <input
                type="text"
                className={`form-control ${fieldCls('manufacturing_date')}`}
                value={draft.manufacturing_date}
                onChange={e => update('manufacturing_date', e.target.value)}
                placeholder="e.g. March 2026"
              />
            </div>
            <div className="form-group">
              <FieldLabel label="Expiry Date" field="expiry_date" />
              <input
                type="text"
                className={`form-control ${fieldCls('expiry_date')}`}
                value={draft.expiry_date}
                onChange={e => update('expiry_date', e.target.value)}
                placeholder="e.g. February 2028"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: Complaint Details */}
        <div className="form-section">
          <div className="form-section-title">Complaint Details</div>
          <div className="form-grid">
            <div className="form-group">
              <FieldLabel label="Complaint Category" field="complaint_category" />
              <select
                className={`form-control ${fieldCls('complaint_category')}`}
                value={draft.complaint_category}
                onChange={e => update('complaint_category', e.target.value)}
              >
                <option value="">Select category</option>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <FieldLabel label="Complaint Date" field="complaint_date" />
              <input
                type="text"
                className={`form-control ${fieldCls('complaint_date')}`}
                value={draft.complaint_date}
                onChange={e => update('complaint_date', e.target.value)}
                placeholder="e.g. 12 August 2026"
              />
            </div>
            <div className="form-group">
              <FieldLabel label="Originating Site / Block" field="originating_site_block" />
              <input
                type="text"
                className={`form-control ${fieldCls('originating_site_block')}`}
                value={draft.originating_site_block}
                onChange={e => update('originating_site_block', e.target.value)}
                placeholder="e.g. Manufacturing Block A"
              />
            </div>
            <div className="form-group">
              <FieldLabel label="Impacted Material" field="impacted_non_product_material" />
              <input
                type="text"
                className={`form-control ${fieldCls('impacted_non_product_material')}`}
                value={draft.impacted_non_product_material}
                onChange={e => update('impacted_non_product_material', e.target.value)}
                placeholder="e.g. Primary Packaging"
              />
            </div>
            <div className="form-group full">
              <FieldLabel label="Detailed Complaint Description" field="complaint_description" />
              <textarea
                rows={4}
                className={`form-control ${fieldCls('complaint_description')}`}
                value={draft.complaint_description}
                onChange={e => update('complaint_description', e.target.value)}
                placeholder="Describe the quality defect, observations, and any patient or business impact…"
              />
            </div>
          </div>
        </div>

        {/* SECTION 4: AI Risk Assessment */}
        {analysis && isAIReady && (
          <div className="form-section" style={{ paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 }}>
            <div style={{ padding: '12px 20px 6px' }}>
              <div className="form-section-title">AI Risk Assessment</div>
            </div>
            <RiskAssessmentCard analysis={analysis} />
          </div>
        )}

        {/* SECTION 5: QMS Tracking */}
        <div className="form-section">
          <div className="form-section-title">QMS Tracking</div>
          <div className="form-grid">
            <div className="form-group">
              <span className="form-label">Status</span>
              <select
                className="form-control"
                value={draft.status}
                onChange={e => update('status', e.target.value)}
              >
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <span className="form-label">Assigned Investigator</span>
              <input
                type="text"
                className="form-control"
                value={draft.assigned_investigator}
                onChange={e => update('assigned_investigator', e.target.value)}
                placeholder="e.g. Dr. Anita Desai"
              />
            </div>
          </div>
        </div>

      </div>{/* end scrollable body */}

      {/* ── Sticky action footer ─────────────────────────────────────── */}
      <div style={{ position: 'sticky', bottom: 0, zIndex: 10, background: 'var(--surface)' }}>
        {/* Completeness bar */}
        {completeness !== null && (
          <div className="completeness-bar-line">
            <div
              className={`completeness-bar-line-fill ${complClass}`}
              style={{ width: `${completeness}%` }}
            />
          </div>
        )}

        <div className="form-action-bar">
          <div>
            {completeness !== null ? (
              <div className="completeness-note">
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  {completeness}% complete
                </span>
                {draft.missing_information?.length > 0 && (
                  <span style={{ marginLeft: 6, color: '#94A3B8' }}>
                    · Missing: {draft.missing_information.slice(0, 2).join(', ')}
                    {draft.missing_information.length > 2 && ` +${draft.missing_information.length - 2}`}
                  </span>
                )}
                {aiPopulatedFields.length > 0 && (
                  <span style={{ marginLeft: 6, color: '#6366F1', fontSize: 10.5 }}>
                    · {aiPopulatedFields.length} fields by AI
                  </span>
                )}
              </div>
            ) : (
              <div className="completeness-note">Awaiting complaint analysis</div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="btn btn-danger"
              onClick={() => dispatch(resetDraft())}
            >
              Reset Form
            </button>
            <button
              className="btn btn-lg btn-commit"
              disabled={!canSave}
              onClick={handleSave}
              title={!canSave ? 'Product name and batch number are required' : 'Commit this complaint to the QMS ledger'}
            >
              {loading
                ? <><span className="spinner" /> Saving…</>
                : 'Commit to QMS Ledger'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StructuredForm;
