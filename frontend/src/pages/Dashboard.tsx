import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { loadStats, loadComplaints } from '../features/complaints/complaintsSlice';

interface DashboardProps {
  onNavigate: (tab: string, id?: number) => void;
}

function getBadge(sev: string) {
  if (sev === 'Critical') return 'badge-critical';
  if (sev === 'Major') return 'badge-major';
  return 'badge-minor';
}
function getStatusBadge(status: string) {
  if (status === 'Closed') return 'badge-closed';
  if (status === 'CAPA Pending') return 'badge-capa';
  if (status === 'Under Investigation') return 'badge-investigating';
  return 'badge-pending';
}

const KPI_ICONS = ['📋', '🔍', '⚠️', '🔄'];
const KPI_COLORS = ['#6366F1', '#8B5CF6', '#E11D48', '#059669'];

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const dispatch = useAppDispatch();
  const { stats, complaints } = useAppSelector(s => s.complaints);

  useEffect(() => {
    dispatch(loadStats());
    dispatch(loadComplaints({}));
  }, []);

  const recentComplaints = complaints.slice(0, 6);
  const maxCat = stats ? Math.max(...Object.values(stats.categories_breakdown), 1) : 1;

  const kpis = [
    { label: 'Total Complaints', value: stats?.total_complaints, icon: '📋', sub: 'All time' },
    { label: 'Under Investigation', value: stats?.open_investigations, icon: '🔍', sub: 'Active cases' },
    { label: 'High Risk', value: stats?.high_risk_count, icon: '⚠️', sub: 'Needs attention' },
    { label: 'CAPA Pending', value: stats?.capa_pending_count, icon: '🔄', sub: 'Actions needed' },
  ];

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">QMS Dashboard ✨</div>
          <div className="page-subtitle">Pharma Complaint Intelligence Overview</div>
        </div>
        <button className="btn btn-primary btn-lg" onClick={() => onNavigate('workspace')}>
          + New Complaint
        </button>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        {kpis.map((k, i) => (
          <div key={i} className="kpi-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 22 }}>{k.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#C4B8E8', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                {k.sub}
              </span>
            </div>
            <div className="kpi-value" style={{ color: KPI_COLORS[i] }}>
              {k.value ?? '—'}
            </div>
            <div className="kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Category breakdown */}
        <div className="card">
          <div className="card-header">
            <span className="card-header-title">📊 Category Distribution</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {stats && Object.entries(stats.categories_breakdown)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, count], i) => {
                const pct = Math.round((count / maxCat) * 100);
                const colors = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6'];
                return (
                  <div key={cat}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: '12px' }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{cat}</span>
                      <span style={{ fontWeight: 700, color: colors[i % colors.length] }}>{count}</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--border-soft)', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 6,
                        background: `linear-gradient(90deg, ${colors[i % colors.length]}, ${colors[i % colors.length]}99)`,
                        width: `${pct}%`, transition: 'width 0.7s ease'
                      }} />
                    </div>
                  </div>
                );
              })}
            {!stats && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: '20px 0' }}>Loading…</div>
            )}
          </div>
        </div>

        {/* Severity & Risk */}
        <div className="card">
          <div className="card-header">
            <span className="card-header-title">🎯 Severity & Risk</span>
          </div>
          <div className="card-body">
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10 }}>Severity</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {stats && Object.entries(stats.severity_breakdown).map(([sev, count]) => (
                  <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className={`badge ${getBadge(sev)}`}>{sev}</span>
                    <span style={{ fontWeight: 800, fontSize: '18px', color: 'var(--text-primary)' }}>{count}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>complaints</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 14 }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10 }}>Risk Level</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {stats && Object.entries(stats.risk_breakdown).map(([risk, count]) => (
                  <div key={risk} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--surface-3)', borderRadius: 10, border: '1px solid var(--border-soft)' }}>
                    <span className={`badge ${risk === 'High' ? 'badge-high' : risk === 'Medium' ? 'badge-medium' : 'badge-low'}`}>{risk}</span>
                    <span style={{ fontWeight: 800, fontSize: '16px' }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent complaints */}
      <div className="card">
        <div className="card-header">
          <span className="card-header-title">🕐 Recent Complaints</span>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('complaints')}>
            View All →
          </button>
        </div>
        {recentComplaints.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🗂️</div>
            <div className="empty-state-title">No complaints logged yet</div>
            <div className="empty-state-text">Create your first complaint in the workspace.</div>
          </div>
        ) : (
          <div className="table-wrap" style={{ border: 'none', borderRadius: 0, boxShadow: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Complaint #</th>
                  <th>Product</th>
                  <th>Batch</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentComplaints.map(c => (
                  <tr key={c.id} onClick={() => onNavigate('complaint-detail', c.id)}>
                    <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{c.complaint_number}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.product_name}</div>
                      {c.strength_or_grade && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.strength_or_grade}</div>
                      )}
                    </td>
                    <td><span className="data-mono" style={{ color: 'var(--text-secondary)' }}>{c.batch_number}</span></td>
                    <td><span className={`badge ${getBadge(c.severity)}`}>{c.severity}</span></td>
                    <td><span className={`badge ${getStatusBadge(c.status)}`}>{c.status}</span></td>
                    <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {new Date(c.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
