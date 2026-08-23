import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { loadComplaints } from '../features/complaints/complaintsSlice';
import type { Complaint } from '../features/complaints/types';

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

  return (
    <div className="page-container">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="page-title">Complaint Register</div>
          <span className="badge badge-minor" style={{ background: '#F1F5F9', color: '#475569', border: '1px solid #E4E8EF' }}>
            {complaints.length}
          </span>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={handleExportCSV}>
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: 200, maxWidth: 340 }}>
          <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#8896A7' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            className="form-control"
            style={{ paddingLeft: '32px' }}
            placeholder="Search complaints, products, batches..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="form-control" style={{ width: 160 }}
          value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}>
          <option value="">All Severities</option>
          <option>Critical</option>
          <option>Major</option>
          <option>Minor</option>
        </select>
        <select className="form-control" style={{ width: 200 }}
          value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option>Pending Triage</option>
          <option>Under Investigation</option>
          <option>CAPA Pending</option>
          <option>Closed</option>
        </select>
      </div>

      {loading ? (
        <div className="empty-state">
          <div className="spinner spinner-dark" style={{ margin: '0 auto 12px' }} />
          <div className="empty-state-title">Loading complaints...</div>
        </div>
      ) : complaints.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
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
                <tr key={c.id} onClick={() => onViewComplaint(c.id)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 600, color: '#3B82F6' }}>{c.complaint_number}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{c.product_name}</div>
                    {c.strength_or_grade && (
                      <div style={{ fontSize: '11px', color: '#8896A7' }}>{c.strength_or_grade}</div>
                    )}
                  </td>
                  <td><span className="data-mono">{c.batch_number}</span></td>
                  <td style={{ maxWidth: 160, fontSize: '12px' }}>{c.complaint_category}</td>
                  <td>
                    <span className={`badge ${c.product_type === 'API' ? 'badge-api' : 'badge-fdf'}`}>
                      {c.product_type}
                    </span>
                  </td>
                  <td><span className={`badge ${getBadgeClass(c.severity)}`}>{c.severity}</span></td>
                  <td><span className={`badge ${getRiskClass(c.risk_level)}`}>{c.risk_level}</span></td>
                  <td><span className={`badge ${getStatusClass(c.status)}`}>{c.status}</span></td>
                  <td style={{ color: '#8896A7', fontSize: '11px' }}>{formatDate(c.created_at)}</td>
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
