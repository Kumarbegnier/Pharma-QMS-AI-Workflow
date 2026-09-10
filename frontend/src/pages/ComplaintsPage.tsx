/**
 * ComplaintsPage — Premium redesign with stagger row animations,
 * improved filter bar, and polished table layout.
 * All data from existing Redux loadComplaints thunk — no mock data.
 */
import React, { useEffect, useState, useCallback, memo } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { loadComplaints } from '../features/complaints/complaintsSlice';

interface ComplaintsPageProps { onViewComplaint: (id: number) => void; }

// ── helpers ──────────────────────────────────────────────────────────────────
function sevClass(s: string) {
  if (s === 'Critical') return 'badge-critical';
  if (s === 'Major')    return 'badge-major';
  return 'badge-minor';
}
function riskClass(r: string) {
  if (r === 'High')   return 'badge-high';
  if (r === 'Medium') return 'badge-medium';
  return 'badge-low';
}
function statusClass(s: string) {
  if (s === 'Pending Triage')      return 'badge-pending';
  if (s === 'Under Investigation') return 'badge-investigating';
  if (s === 'CAPA Pending')        return 'badge-capa';
  return 'badge-closed';
}
function fmt(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}

// ── inline SVGs (no lucide-react) ────────────────────────────────────────────
const SearchIcon = () => (
  <svg className="search-icon" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <circle cx={11} cy={11} r={8} /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
  </svg>
);
const DownloadIcon = () => (
  <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" />
    <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
    <line x1={12} y1={15} x2={12} y2={3} strokeLinecap="round" />
  </svg>
);

// ── Skeleton row ──────────────────────────────────────────────────────────────
const SkeletonRow = memo<{ delay: number }>(({ delay }) => (
  <tr style={{ animation: `fadeUp 0.4s ease ${delay}ms both` }}>
    {[80, 120, 90, 110, 50, 60, 55, 90, 70].map((w, i) => (
      <td key={i}>
        <div style={{
          height: 12, width: w, borderRadius: 4,
          background: 'linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.4s ease-in-out infinite',
        }} />
      </td>
    ))}
  </tr>
));

// ── Complaint row (animated) ──────────────────────────────────────────────────
const ComplaintRow = memo<{
  c: any; index: number; onClick: (id: number) => void;
}>(({ c, index, onClick }) => (
  <tr
    key={c.id}
    onClick={() => onClick(c.id)}
    style={{
      animation: `fadeUp 0.35s ease ${Math.min(index * 45, 400)}ms both`,
      cursor: 'pointer',
    }}
  >
    {/* Complaint # */}
    <td>
      <span style={{
        fontWeight: 800, color: '#4F46E5',
        fontSize: 12.5, letterSpacing: '-0.2px',
      }}>
        {c.complaint_number}
      </span>
    </td>

    {/* Product */}
    <td>
      <div style={{ fontWeight: 600, color: '#0F172A', fontSize: 13 }}>{c.product_name}</div>
      {c.strength_or_grade && (
        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{c.strength_or_grade}</div>
      )}
    </td>

    {/* Batch */}
    <td>
      <span className="data-mono" style={{ color: '#475569', fontSize: 12 }}>
        {c.batch_number || '—'}
      </span>
    </td>

    {/* Category */}
    <td style={{ maxWidth: 160 }}>
      <span style={{
        fontSize: 12, color: '#64748B', display: 'block',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {c.complaint_category || '—'}
      </span>
    </td>

    {/* Type */}
    <td>
      <span className={`badge ${c.product_type === 'API' ? 'badge-api' : 'badge-fdf'}`}>
        {c.product_type || '—'}
      </span>
    </td>

    {/* Severity */}
    <td><span className={`badge ${sevClass(c.severity)}`}>{c.severity}</span></td>

    {/* Risk */}
    <td><span className={`badge ${riskClass(c.risk_level)}`}>{c.risk_level}</span></td>

    {/* Status */}
    <td>
      <span className={`badge ${statusClass(c.status)}`} style={{ whiteSpace: 'nowrap' }}>
        {c.status}
      </span>
    </td>

    {/* Date */}
    <td>
      <span style={{ fontSize: 11.5, color: '#94A3B8', whiteSpace: 'nowrap' }}>
        {fmt(c.created_at)}
      </span>
    </td>
  </tr>
));

// ── Page ──────────────────────────────────────────────────────────────────────
const ComplaintsPage: React.FC<ComplaintsPageProps> = ({ onViewComplaint }) => {
  const dispatch = useAppDispatch();
  const { complaints, loading } = useAppSelector(s => s.complaints);
  const [search,         setSearch]         = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterStatus,   setFilterStatus]   = useState('');

  useEffect(() => {
    const params: Record<string, string> = {};
    if (search)         params.search   = search;
    if (filterSeverity) params.severity = filterSeverity;
    if (filterStatus)   params.status   = filterStatus;
    dispatch(loadComplaints(params));
  }, [search, filterSeverity, filterStatus, dispatch]);

  const clearFilters = useCallback(() => {
    setSearch(''); setFilterSeverity(''); setFilterStatus('');
  }, []);

  const handleExportCSV = useCallback(() => {
    const headers = ['Complaint #','Product','Batch','Category','Severity','Risk','Status','Date'];
    const rows = complaints.map(c => [
      c.complaint_number, c.product_name, c.batch_number,
      c.complaint_category, c.severity, c.risk_level, c.status, fmt(c.created_at),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v ?? ''}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'qms_complaints.csv'; a.click();
    URL.revokeObjectURL(url);
  }, [complaints]);

  const hasFilters = search || filterSeverity || filterStatus;

  return (
    <div className="page-container">
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            Complaint Register
            {complaints.length > 0 && (
              <span style={{
                fontSize: 12, fontWeight: 700, padding: '3px 10px',
                background: '#EEF2FF', color: '#4F46E5',
                borderRadius: 20, border: '1px solid #C7D2FE',
                letterSpacing: 0,
              }}>
                {complaints.length}
              </span>
            )}
          </div>
          <div className="page-subtitle">All logged complaints — filterable, sortable, exportable</div>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleExportCSV}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <DownloadIcon /> Export CSV
        </button>
      </div>

      {/* ── Filter bar ── */}
      <div style={{
        display: 'flex', gap: 10, marginBottom: 20,
        flexWrap: 'wrap', alignItems: 'center',
        padding: '12px 16px',
        background: '#FFFFFF', borderRadius: 14,
        border: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
      }}>
        {/* Search */}
        <div className="search-input-wrap" style={{ flex: 1 }}>
          <SearchIcon />
          <input
            type="text"
            className="form-control"
            placeholder="Search complaints, products, batches…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Severity filter */}
        <select
          className="form-control"
          style={{ width: 150 }}
          value={filterSeverity}
          onChange={e => setFilterSeverity(e.target.value)}
        >
          <option value="">All Severities</option>
          <option>Critical</option>
          <option>Major</option>
          <option>Minor</option>
        </select>

        {/* Status filter */}
        <select
          className="form-control"
          style={{ width: 185 }}
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option>Pending Triage</option>
          <option>Under Investigation</option>
          <option>CAPA Pending</option>
          <option>Closed</option>
        </select>

        {/* Clear */}
        {hasFilters && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={clearFilters}
            style={{ color: '#DC2626', flexShrink: 0 }}
          >
            ✕ Clear
          </button>
        )}

        {/* Active filter pills */}
        {filterSeverity && (
          <span style={{
            padding: '3px 10px', borderRadius: 20, fontSize: 11.5,
            fontWeight: 600, background: '#FEF2F2', color: '#DC2626',
            border: '1px solid #FECACA', display: 'flex', alignItems: 'center', gap: 5,
          }}>
            {filterSeverity}
            <span
              style={{ cursor: 'pointer', opacity: 0.7 }}
              onClick={() => setFilterSeverity('')}
            >×</span>
          </span>
        )}
        {filterStatus && (
          <span style={{
            padding: '3px 10px', borderRadius: 20, fontSize: 11.5,
            fontWeight: 600, background: '#EFF6FF', color: '#1D4ED8',
            border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', gap: 5,
          }}>
            {filterStatus}
            <span
              style={{ cursor: 'pointer', opacity: 0.7 }}
              onClick={() => setFilterStatus('')}
            >×</span>
          </span>
        )}
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {['Complaint #','Product','Batch','Category','Type','Severity','Risk','Status','Date'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonRow key={i} delay={i * 50} />
              ))}
            </tbody>
          </table>
        </div>
      ) : complaints.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🗂️</div>
          <div className="empty-state-title">No complaints found</div>
          <div className="empty-state-text">
            {hasFilters
              ? 'Try adjusting your search or clearing filters.'
              : 'Log your first complaint in the Workspace.'}
          </div>
          {hasFilters && (
            <button
              className="btn btn-secondary btn-sm"
              style={{ marginTop: 16 }}
              onClick={clearFilters}
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {['Complaint #','Product','Batch','Category','Type','Severity','Risk','Status','Date'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {complaints.map((c, i) => (
                <ComplaintRow
                  key={c.id}
                  c={c}
                  index={i}
                  onClick={onViewComplaint}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ComplaintsPage;
