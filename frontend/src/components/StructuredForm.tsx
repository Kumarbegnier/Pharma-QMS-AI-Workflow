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
  'Product Quality', 'Packaging', 'Contamination',
  'Product Defect - Discoloration', 'Product Defect - Foreign Matter',
  'Adverse Event', 'Labeling', 'Other',
];

const CUSTOMER_TYPES = ['Pharmacy', 'Hospital', 'Clinic', 'Distributor', 'Patient', 'Other'];
const SOURCES = ['Pharmacy', 'Hospital', 'Email', 'Distributor', 'Patient', 'Other'];
const STATUSES = ['Pending Triage', 'Under Investigation', 'CAPA Pending', 'Closed'];

function getConfidenceBadge(fieldKey: string, confidence: Record<string, FieldConfidence>, aiFields: string[]) {
  if (!aiFields.includes(fieldKey)) return null;
  const fc = confidence[fieldKey];
  if (!fc) return null;
  const pct = Math.round(fc.confidence * 100);
  let cls = 'confidence-high';
  if (fc.confidence < 0.70) cls = 'confidence-low';
  else if (fc.confidence < 0.85) cls = 'confidence-medium';
  return <span className={`confidence-badge ${cls}`}>AI {pct}%</span>;
}

const StructuredForm: React.FC<StructuredFormProps> = ({ onSaved, onViewComplaint }) => {
  const dispatch = useAppDispatch();
  const { draft, analysis, extractionStatus, aiPopulatedFields, userReviewedFields, duplicates, loading } =
    useAppSelector(s => s.complaints);

  const confidence = analysis?.field_confidence || {};
  const isAIReady = extractionStatus === 'ready';
  const canSave = !loading && !!draft.product_name && !!draft.batch_number;

  const update = (field: string, value: any) => dispatch(updateFieldManually({ field, value }));

  const handleSave = async () => {
    const payload = {
      source: draft.source,
      customer_name: draft.customer_name,
      customer_type: draft.customer_type,
      reporter_contact: draft.reporter_contact,
      product_type: draft.product_type,
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

  const labelWithBadge = (label: string, field: string) => (
    <span className="form-label">
      {label}
      {isReviewed(field) && <span className="reviewed-badge">✓</span>}
      {!isReviewed(field) && getConfidenceBadge(field, confidence, aiPopulatedFields)}
    </span>
  );

  const completeness = analysis ? Math.round((analysis.completeness_score || 0) * 100) : null;
  const isReady = isAIReady;
  const statusClass: Record<string, string> = {
    'Pending Triage': 'badge-pending',
    'Under Investigation': 'badge-investigating',
    'CAPA Pending': 'badge-capa',
    'Closed': 'badge-closed',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="form-panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div className="form-panel-title">Log Customer Complaint</div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span className={`badge ${draft.product_type === 'API' ? 'badge-api' : 'badge-fdf'}`}>
              {draft.product_type === 'API' ? 'API' : 'FDF'}
            </span>
            <span className={`badge ${statusClass[draft.status] || 'badge-pending'}`}>
              {draft.status || 'Pending Triage'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isAIReady && (
            <span className="badge" style={{ background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>
              ✓ AI Analysis Complete
            </span>
          )}
          {extractionStatus === 'idle' && (
            <span style={{ fontSize: '11px', color: '#8896A7' }}>
              Upload a file or paste text to auto-fill
            </span>
          )}
        </div>
      </div>

      {/* Duplicate alert */}
      <DuplicateAlert duplicates={duplicates} onViewComplaint={onViewComplaint} />

      {/* Scrollable form body */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* Section 1: Origin & Customer */}
        <div className="form-section">
          <div className="form-section-title">Origin &amp; Customer</div>
          <div className="form-grid">
            <div className="form-group">
              {labelWithBadge('Complaint Source', 'source')}
              <select className={`form-control ${isAI('source') && !isReviewed('source') ? 'ai-populated' : ''}`}
                value={draft.source} onChange={e => update('source', e.target.value)}>
                {SOURCES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              {labelWithBadge('Customer Type', 'customer_type')}
              <select className={`form-control ${isAI('customer_type') && !isReviewed('customer_type') ? 'ai-populated' : ''}`}
                value={draft.customer_type} onChange={e => update('customer_type', e.target.value)}>
                {CUSTOMER_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              {labelWithBadge('Customer / Organization Name', 'customer_name')}
              <input type="text" className={`form-control ${isAI('customer_name') && !isReviewed('customer_name') ? 'ai-populated' : ''}`}
                value={draft.customer_name} onChange={e => update('customer_name', e.target.value)}
                placeholder="e.g. Apollo Pharmacy - Central Branch" />
            </div>
            <div className="form-group">
              {labelWithBadge('Reporter Contact', 'reporter_contact')}
              <input type="text" className={`form-control ${isAI('reporter_contact') && !isReviewed('reporter_contact') ? 'ai-populated' : ''}`}
                value={draft.reporter_contact} onChange={e => update('reporter_contact', e.target.value)}
                placeholder="Email or phone" />
            </div>
          </div>
        </div>

        {/* Section 2: Product & Batch */}
        <div className="form-section">
          <div className="form-section-title">Product &amp; Batch</div>

          {/* Product type toggle */}
          <div className="form-group" style={{ marginBottom: 16 }}>
            <span className="form-label">Product Type</span>
            <div className="product-type-toggle">
              <button
                className={`product-type-btn ${draft.product_type === 'FDF' ? 'selected-fdf' : ''}`}
                onClick={() => update('product_type', 'FDF')}
              >FDF</button>
              <button
                className={`product-type-btn ${draft.product_type === 'API' ? 'selected-api' : ''}`}
                onClick={() => update('product_type', 'API')}
              >API</button>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              {labelWithBadge('Product Name', 'product_name')}
              <input type="text" className={`form-control ${isAI('product_name') && !isReviewed('product_name') ? 'ai-populated' : ''}`}
                value={draft.product_name} onChange={e => update('product_name', e.target.value)}
                placeholder="e.g. Amoxicillin Capsules" />
            </div>
            <div className="form-group">
              {labelWithBadge(draft.product_type === 'API' ? 'Product Strength / Grade' : 'Product Strength', 'strength_or_grade')}
              <input type="text" className={`form-control ${isAI('strength_or_grade') && !isReviewed('strength_or_grade') ? 'ai-populated' : ''}`}
                value={draft.strength_or_grade} onChange={e => update('strength_or_grade', e.target.value)}
                placeholder={draft.product_type === 'API' ? 'e.g. IP/BP, USP' : 'e.g. 500 mg'} />
            </div>
            <div className="form-group">
              {labelWithBadge('Batch / Lot Number', 'batch_number')}
              <input type="text" className={`form-control data-mono ${isAI('batch_number') && !isReviewed('batch_number') ? 'ai-populated' : ''}`}
                value={draft.batch_number} onChange={e => update('batch_number', e.target.value.toUpperCase())}
                placeholder="e.g. AMX240602" />
            </div>
            <div className="form-group">
              {labelWithBadge('Quantity Affected', 'affected_quantity')}
              <input type="text" className={`form-control ${isAI('affected_quantity') && !isReviewed('affected_quantity') ? 'ai-populated' : ''}`}
                value={draft.affected_quantity} onChange={e => update('affected_quantity', e.target.value)}
                placeholder="e.g. 12 capsules / 25 kg" />
            </div>
            <div className="form-group">
              {labelWithBadge('Manufacturing Date', 'manufacturing_date')}
              <input type="text" className={`form-control ${isAI('manufacturing_date') && !isReviewed('manufacturing_date') ? 'ai-populated' : ''}`}
                value={draft.manufacturing_date} onChange={e => update('manufacturing_date', e.target.value)}
                placeholder="e.g. March 2026" />
            </div>
            <div className="form-group">
              {labelWithBadge('Expiry Date', 'expiry_date')}
              <input type="text" className={`form-control ${isAI('expiry_date') && !isReviewed('expiry_date') ? 'ai-populated' : ''}`}
                value={draft.expiry_date} onChange={e => update('expiry_date', e.target.value)}
                placeholder="e.g. February 2028" />
            </div>
          </div>
        </div>

        {/* Section 3: Complaint Details */}
        <div className="form-section">
          <div className="form-section-title">Complaint Details</div>
          <div className="form-grid">
            <div className="form-group">
              {labelWithBadge('Complaint Category', 'complaint_category')}
              <select className={`form-control ${isAI('complaint_category') && !isReviewed('complaint_category') ? 'ai-populated' : ''}`}
                value={draft.complaint_category} onChange={e => update('complaint_category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              {labelWithBadge('Complaint Date', 'complaint_date')}
              <input type="text" className={`form-control ${isAI('complaint_date') && !isReviewed('complaint_date') ? 'ai-populated' : ''}`}
                value={draft.complaint_date} onChange={e => update('complaint_date', e.target.value)}
                placeholder="e.g. 12 August 2026" />
            </div>
            <div className="form-group">
              {labelWithBadge('Originating Site / Block', 'originating_site_block')}
              <input type="text" className={`form-control ${isAI('originating_site_block') && !isReviewed('originating_site_block') ? 'ai-populated' : ''}`}
                value={draft.originating_site_block} onChange={e => update('originating_site_block', e.target.value)}
                placeholder="e.g. Manufacturing Block A" />
            </div>
            <div className="form-group">
              {labelWithBadge('Impacted Non-Product Material', 'impacted_non_product_material')}
              <input type="text" className={`form-control ${isAI('impacted_non_product_material') && !isReviewed('impacted_non_product_material') ? 'ai-populated' : ''}`}
                value={draft.impacted_non_product_material} onChange={e => update('impacted_non_product_material', e.target.value)}
                placeholder="e.g. Primary Packaging (Bottle)" />
            </div>
            <div className="form-group full">
              {labelWithBadge('Detailed Complaint Description', 'complaint_description')}
              <textarea rows={5} className={`form-control ${isAI('complaint_description') && !isReviewed('complaint_description') ? 'ai-populated' : ''}`}
                value={draft.complaint_description} onChange={e => update('complaint_description', e.target.value)}
                placeholder="Describe the quality defect, affected product details, observations made, any patient or business impact..." />
            </div>
          </div>
        </div>

        {/* Section 4: AI Risk Assessment (shown when analysis ready) */}
        {analysis && isAIReady && (
          <div className="form-section" style={{ paddingLeft: 0, paddingRight: 0, paddingBottom: 0 }}>
            <div style={{ padding: '0 24px 8px' }}>
              <div className="form-section-title">AI Risk Assessment</div>
            </div>
            <RiskAssessmentCard analysis={analysis} />
          </div>
        )}

        {/* Section 5: QMS tracking */}
        <div className="form-section">
          <div className="form-section-title">QMS Tracking</div>
          <div className="form-grid">
            <div className="form-group">
              <span className="form-label">Status</span>
              <select className="form-control" value={draft.status} onChange={e => update('status', e.target.value)}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <span className="form-label">Assigned Investigator</span>
              <input type="text" className="form-control" value={draft.assigned_investigator}
                onChange={e => update('assigned_investigator', e.target.value)}
                placeholder="e.g. Dr. Anita Desai" />
            </div>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="form-action-bar-container" style={{ position: 'sticky', bottom: 0, zIndex: 10, background: 'var(--surface)' }}>
        {completeness !== null && (
          <div style={{ width: '100%', height: '3px', background: '#F1F5F9' }}>
            <div style={{ width: `${completeness}%`, height: '100%', background: completeness > 80 ? '#16A34A' : completeness > 50 ? '#F59E0B' : '#DC2626', transition: 'width 0.3s ease' }} />
          </div>
        )}
        <div className="form-action-bar" style={{ position: 'static' }}>
          <div>
            {completeness !== null && (
              <div className="completeness-note">
                <span style={{ fontWeight: 600, color: '#374151' }}>Completeness: {completeness}%</span>
                {draft.missing_information?.length > 0 && <span style={{ fontSize: '10px' }}>Missing: {draft.missing_information.slice(0,2).join(', ')}</span>}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn btn-danger" onClick={() => dispatch(resetDraft())}>
              Clear
            </button>
            <button
              className="btn btn-lg btn-commit"
              disabled={!canSave}
              onClick={handleSave}
              title={!draft.product_name || !draft.batch_number ? 'Product name and batch number required' : ''}
            >
              {loading ? <><span className="spinner" /> Saving...</> : 'Commit to QMS Ledger'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StructuredForm;
