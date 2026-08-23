import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { loadComplaints } from '../features/complaints/complaintsSlice';

interface ComplaintsPageProps {
  onViewComplaint: (id: number) => void;
}

function getBadgeClass(severity: string) {
  if (severity === 'Critical') return 'badge-critical';
  if (severity === 'Major') return 'badge-major';
  return 'badge-minor';
}
function getRiskClass(risk: string) {
  if (risk === 'High') return 'badge-high';
  if (risk === 'Medium') return 'badge-medium';
  return 'badge-low';
}
function getStatusClass(status: string) {
  if (status === 'Pending Triage') return 'badge-pending';
  if (status === 'Under Investigation') return 'badge-investigating';
  if (status === 'CAPA Pending') return 'badge-capa';
  return 'badge-closed';
}
function formatDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}

const ComplaintsPage: React.FC<ComplaintsPageProps> = ({ onViewComplaint }) => {
  const dispatch = useAppDispatch();
  const { complaints, loading } = useAppSelector(s => s.complaints);
  const [search, setSearch] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (filterSeverity) params.severity = filterSeverity;
    if (filterStatus) params.status = filterStatus;
    dispatch(loadComplaints(params));
  }, [search, filterSeverity, filterStatus]);

  const handleExportCSV = () => {
    const headers = ['Complaint #', 'Product', 'Batch', 'Category', 'Severity', 'Risk', 'Status', 'Date'];
    const rows = complaints.map(c => [
      c.complaint_number, c.product_name, c.batch_number,
      c.complaint_category, c.severity, c.risk_level, c.status,
      formatDate(c.created_at),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'qms_complaints.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // Inline SVG search icon
  const SearchIcon = () => (
    <svg className="search-icon" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <circle cx={11} cy={11} r={8} /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
    </svg>
  );

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">
            Complaint Register
            {complaints.length > 0 && (
              <span style={{
                marginLeft: 10, fontSize: 13, fontWeight: 700, padding: '3px 10px',
                background: 'var(--accent-light)', color: 'var(--accent)', borderRadius: 20,
                border: '1px solid var(--accent-mid)', verticalAlign: 'middle'
              }}>
                {complaints.length}
              </span>
            )}
          </div>
          <div className="page-subtitle">All logged complaints — filterable, sortable, exportable</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={handleExportCSV}>
          ↓ Export CSV
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-input-wrap">
          <SearchIcon />
          <input
            type="text"
            className="form-control"
            placeholder="Search complaints, products, batches…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="form-control" style={{ width: 152 }}
          value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}>
          <option value="">All Severities</option>
          <option>Critical</option>
          <option>Major</option>
          <option>Minor</option>
        </select>
        <select className="form-control" style={{ width: 186 }}
          value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option>Pending Triage</option>
          <option>Under Investigation</option>
          <option>CAPA Pending</option>
          <option>Closed</option>
        </select>
        {(search || filterSeverity || filterStatus) && (
          <button className="btn btn-ghost btn-sm"
            onClick={() => { setSearch(''); setFilterSeverity(''); setFilterStatus(''); }}>
            ✕ Clear
          </button>
        )}
      </div>

      {/* Table or states */}
      {loading ? (
        <div className="empty-state">
          <div className="spinner spinner-dark" style={{ width: 28, height: 28, margin: '0 auto 14px', border: '3px solid var(--border-strong)', borderTopColor: 'var(--accent)' }} />
          <div className="empty-state-title">Loading complaints…</div>
        </div>
      ) : complaints.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🗂️</div>
          <div className="empty-state-title">No complaints found</div>
          <div className="empty-state-text">Try adjusting your search or filters.</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Complaint #</th>
                <th>Product</th>
                <th>Batch</th>
                <th>Category</th>
                <th>Type</th>
                <th>Severity</th>
                <th>Risk</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {complaints.map(c => (
                <tr key={c.id} onClick={() => onViewComplaint(c.id)}>
                  <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{c.complaint_number}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{c.product_name}</div>
                    {c.strength_or_grade && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.strength_or_grade}</div>
                    )}
                  </td>
                  <td><span className="data-mono" style={{ color: 'var(--text-secondary)' }}>{c.batch_number}</span></td>
                  <td style={{ maxWidth: 150, fontSize: '12px', color: 'var(--text-secondary)' }}>{c.complaint_category}</td>
                  <td>
                    <span className={`badge ${c.product_type === 'API' ? 'badge-api' : 'badge-fdf'}`}>
                      {c.product_type}
                    </span>
                  </td>
                  <td><span className={`badge ${getBadgeClass(c.severity)}`}>{c.severity}</span></td>
                  <td><span className={`badge ${getRiskClass(c.risk_level)}`}>{c.risk_level}</span></td>
                  <td><span className={`badge ${getStatusClass(c.status)}`}>{c.status}</span></td>
                  <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ComplaintsPage;
