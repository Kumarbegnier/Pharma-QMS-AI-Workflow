import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { loadStats, loadComplaints } from '../features/complaints/complaintsSlice';

interface DashboardProps {
  onNavigate: (tab: string, id?: number) => void;
}

function getSeverityColor(sev: string) {
  if (sev === 'Critical') return '#DC2626';
  if (sev === 'Major') return '#D97706';
  return '#2563EB';
}

function getBadge(sev: string) {
  if (sev === 'Critical') return 'badge-critical';
  if (sev === 'Major') return 'badge-major';
  return 'badge-minor';
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const dispatch = useAppDispatch();
  const { stats, complaints } = useAppSelector(s => s.complaints);

  useEffect(() => {
    dispatch(loadStats());
    dispatch(loadComplaints({}));
  }, []);

  const recentComplaints = complaints.slice(0, 5);
  const maxCat = stats ? Math.max(...Object.values(stats.categories_breakdown), 1) : 1;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div className="page-title">QMS Dashboard</div>
          <div className="page-subtitle">Pharma Complaint Management Overview</div>
        </div>
        <button className="btn btn-primary" onClick={() => onNavigate('workspace')}>
          + New Complaint
        </button>
      </div>

      {/* KPI cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-value" style={{ color: '#1E293B' }}>{stats?.total_complaints ?? '—'}</div>
          <div className="kpi-label">Total Complaints</div>
          <div style={{ fontSize: '10px', color: '#16A34A', marginTop: '4px', fontWeight: 600 }}>↑ 12% vs last month</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value" style={{ color: '#3B82F6' }}>{stats?.open_investigations ?? '—'}</div>
          <div className="kpi-label">Under Investigation</div>
          <div style={{ fontSize: '10px', color: '#8896A7', marginTop: '4px' }}>Active cases</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value" style={{ color: '#DC2626' }}>{stats?.high_risk_count ?? '—'}</div>
          <div className="kpi-label">High Risk</div>
          <div style={{ fontSize: '10px', color: '#DC2626', marginTop: '4px', fontWeight: 600 }}>Requires immediate action</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value" style={{ color: '#8B5CF6' }}>{stats?.capa_pending_count ?? '—'}</div>
          <div className="kpi-label">CAPA Pending</div>
          <div style={{ fontSize: '10px', color: '#8896A7', marginTop: '4px' }}>Pending closure</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Categories */}
        <div className="card">
          <div className="card-header"><span className="card-header-title">Category Distribution</span></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {stats && Object.entries(stats.categories_breakdown)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, count]) => (
                <div key={cat}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '12px' }}>
                    <span style={{ color: '#475569' }}>{cat}</span>
                    <span style={{ fontWeight: 600 }}>{count}</span>
                  </div>
                  <div style={{ height: 5, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'linear-gradient(90deg, #3B82F6, #93C5FD)', borderRadius: 3, width: `${(count / maxCat) * 100}%`, transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Severity & Risk */}
        <div className="card">
          <div className="card-header"><span className="card-header-title">Severity &amp; Risk Breakdown</span></div>
          <div className="card-body">
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#8896A7', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Severity</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {stats && Object.entries(stats.severity_breakdown).map(([sev, count]) => (
                  <div key={sev} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#F8FAFC', borderLeft: `3px solid ${getSeverityColor(sev)}`, borderRadius: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A' }}>{sev}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: '#0F172A' }}>{count}</span>
                      <span style={{ fontSize: '10px', color: '#8896A7' }}>cases</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#8896A7', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Risk Level</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {stats && Object.entries(stats.risk_breakdown).map(([risk, count]) => (
                  <div key={risk} style={{ flex: 1, padding: '10px', background: '#F8FAFC', borderRadius: '6px', border: '1px solid #E4E8EF', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '2px' }}>{risk} Risk</div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>{count}</div>
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
          <span className="card-header-title">Recent Complaints</span>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('complaints')}>View All</button>
        </div>
        {recentComplaints.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-text">No complaints logged yet.</div>
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
                  <tr key={c.id} onClick={() => onNavigate('complaint-detail', c.id)} style={{ cursor: 'pointer' }}>
                    <td style={{ fontWeight: 600, color: '#3B82F6' }}>{c.complaint_number}</td>
                    <td>{c.product_name}</td>
                    <td><span className="data-mono">{c.batch_number}</span></td>
                    <td><span className={`badge ${getBadge(c.severity)}`}>{c.severity}</span></td>
                    <td><span className={`badge ${c.status === 'Closed' ? 'badge-closed' : c.status === 'CAPA Pending' ? 'badge-capa' : c.status === 'Under Investigation' ? 'badge-investigating' : 'badge-pending'}`}>{c.status}</span></td>
                    <td style={{ fontSize: '11px', color: '#8896A7' }}>
                      {new Date(c.created_at).toLocaleDateString('en-IN')}
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
