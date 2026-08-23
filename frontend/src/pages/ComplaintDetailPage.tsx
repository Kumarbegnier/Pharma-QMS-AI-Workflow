import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { loadComplaint, patchComplaint } from '../features/complaints/complaintsSlice';

interface ComplaintDetailPageProps {
  complaintId: number;
  onBack: () => void;
}

const STATUSES = ['Pending Triage', 'Under Investigation', 'CAPA Pending', 'Closed'];

function sev(s: string) {
  if (s === 'Critical') return 'badge-critical';
  if (s === 'Major') return 'badge-major';
  return 'badge-minor';
}

function fmt(iso: string) {
  try { return new Date(iso).toLocaleString('en-IN'); }
  catch { return iso; }
}

const ComplaintDetailPage: React.FC<ComplaintDetailPageProps> = ({ complaintId, onBack }) => {
  const dispatch = useAppDispatch();
  const complaint = useAppSelector(s => s.complaints.selectedComplaint);

  useEffect(() => {
    dispatch(loadComplaint(complaintId));
  }, [complaintId]);

  if (!complaint) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <div className="spinner spinner-dark" style={{ margin: '0 auto 12px' }} />
          <div className="empty-state-title">Loading complaint...</div>
        </div>
      </div>
    );
  }

  const advanceStatus = () => {
    const idx = STATUSES.indexOf(complaint.status);
    if (idx < STATUSES.length - 1) {
      dispatch(patchComplaint({ id: complaint.id, updates: { status: STATUSES[idx + 1] } }));
    }
  };

  const statusIdx = STATUSES.indexOf(complaint.status);

  return (
    <div className="page-container">
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: '12px', color: '#94A3B8' }}>
        <button className="btn btn-secondary btn-sm" onClick={onBack}>← Back</button>
        <span>Complaints</span>
        <span>›</span>
        <span style={{ color: '#1E293B', fontWeight: 600 }}>{complaint.complaint_number}</span>
      </div>

      {/* Header */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: 4 }}>{complaint.complaint_number}</div>
            <div style={{ fontSize: '14px', color: '#475569', marginBottom: 8 }}>
              {complaint.product_name}
              {complaint.strength_or_grade && ` · ${complaint.strength_or_grade}`}
              {complaint.batch_number && ` · Batch: ${complaint.batch_number}`}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className={`badge ${sev(complaint.severity)}`}>{complaint.severity}</span>
              <span className={`badge ${complaint.risk_level === 'High' ? 'badge-high' : complaint.risk_level === 'Medium' ? 'badge-medium' : 'badge-low'}`}>
                {complaint.risk_level} Risk
              </span>
              <span className={`badge ${complaint.product_type === 'API' ? 'badge-api' : 'badge-fdf'}`}>
                {complaint.product_type}
              </span>
              {complaint.patient_safety_impact && (
                <span className="badge badge-critical">⚠ Patient Safety</span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ fontSize: '11px', color: '#94A3B8' }}>Status</div>
            <span className={`badge ${complaint.status === 'Pending Triage' ? 'badge-pending' : complaint.status === 'Under Investigation' ? 'badge-investigating' : complaint.status === 'CAPA Pending' ? 'badge-capa' : 'badge-closed'}`} style={{ fontSize: '12px', padding: '4px 12px' }}>
              {complaint.status}
            </span>
            {statusIdx < STATUSES.length - 1 && (
              <button className="btn btn-primary btn-sm" onClick={advanceStatus}>
                → Advance to {STATUSES[statusIdx + 1]}
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Complaint details */}
        <div className="card">
          <div className="card-header"><span className="card-header-title">Complaint Details</span></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              ['Complaint Category', complaint.complaint_category],
              ['Customer', complaint.customer_name || '—'],
              ['Customer Type', complaint.customer_type || '—'],
              ['Reporter Contact', complaint.reporter_contact || '—'],
              ['Originating Site', complaint.originating_site_block || '—'],
              ['Impacted Material', complaint.impacted_non_product_material || '—'],
              ['Affected Quantity', complaint.affected_quantity || '—'],
              ['Manufacturing Date', complaint.manufacturing_date || '—'],
              ['Expiry Date', complaint.expiry_date || '—'],
              ['Assigned To', complaint.assigned_investigator || '—'],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', gap: 8, fontSize: '12.5px' }}>
                <span style={{ color: '#94A3B8', minWidth: 130, flexShrink: 0 }}>{label}</span>
                <span style={{ fontWeight: 500 }}>{value}</span>
              </div>
            ))}
            {complaint.complaint_description && (
              <div style={{ marginTop: 8, fontSize: '12.5px', color: '#475569', lineHeight: 1.6, padding: '10px', background: '#F8F9FA', borderRadius: 6 }}>
                {complaint.complaint_description}
              </div>
            )}
          </div>
        </div>

        {/* AI Recommendations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {complaint.possible_root_causes?.length > 0 && (
            <div className="card">
              <div className="card-header"><span className="card-header-title">Possible Root Causes</span></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {complaint.possible_root_causes.map((c, i) => (
                  <div key={i} className="risk-list-item">{c}</div>
                ))}
              </div>
            </div>
          )}
          {complaint.recommended_capa?.length > 0 && (
            <div className="card">
              <div className="card-header"><span className="card-header-title">Recommended CAPA</span></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {complaint.recommended_capa.map((c, i) => (
                  <div key={i} className="risk-list-item">{c}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CAPA Tasks */}
      {complaint.capa_tasks?.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-header-title">CAPA Tasks ({complaint.capa_tasks.length})</span></div>
          <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th>Due Date</th>
                </tr>
              </thead>
              <tbody>
                {complaint.capa_tasks.map(task => (
                  <tr key={task.id}>
                    <td style={{ fontSize: '12px' }}>{task.action}</td>
                    <td>{task.owner}</td>
                    <td>
                      <span className={`badge ${task.status === 'Completed' ? 'badge-closed' : task.status === 'In Progress' ? 'badge-investigating' : 'badge-pending'}`}>
                        {task.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '11px', color: '#94A3B8' }}>{task.due_date || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audit Trail */}
      {complaint.audit_logs?.length > 0 && (
        <div className="card">
          <div className="card-header"><span className="card-header-title">Audit Trail ({complaint.audit_logs.length})</span></div>
          <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Old Value</th>
                  <th>New Value</th>
                  <th>Source</th>
                  <th>Actor</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {complaint.audit_logs.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '11px' }}>{log.field_name}</td>
                    <td style={{ fontSize: '11px', color: '#94A3B8', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.old_value || '—'}</td>
                    <td style={{ fontSize: '11px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.new_value || '—'}</td>
                    <td>
                      <span className={`audit-source-${(log.change_source || 'system').toLowerCase()}`}>
                        {log.change_source}
                      </span>
                    </td>
                    <td style={{ fontSize: '11px' }}>{log.actor}</td>
                    <td style={{ fontSize: '10px', color: '#94A3B8' }}>{fmt(log.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComplaintDetailPage;
