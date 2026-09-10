/**
 * Dashboard — Premium QMS Intelligence Overview
 *
 * Data sources (unchanged):
 *   loadStats()      → GET /api/complaints/stats
 *   loadComplaints() → GET /api/complaints
 *   Redux: stats.total_complaints, open_investigations, high_risk_count,
 *          capa_pending_count, categories_breakdown, risk_breakdown,
 *          severity_breakdown, complaints[]
 *
 * Visuals (zero external charting libs):
 *   - KPI cards with colour ring + subtle shimmer skeleton
 *   - Animated SVG horizontal bar chart for categories
 *   - SVG donut rings for severity + risk
 *   - Activity feed (timeline style) for recent complaints
 */

import React, { useEffect, memo, useMemo, useRef, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { loadStats, loadComplaints } from '../features/complaints/complaintsSlice';

interface DashboardProps { onNavigate: (tab: string, id?: number) => void; }

// ── Colour helpers ────────────────────────────────────────────────────────────

function sevStyle(s: string) {
  if (s === 'Critical') return { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', dot: '#DC2626' };
  if (s === 'Major')    return { color: '#D97706', bg: '#FFFBEB', border: '#FCD34D', dot: '#D97706' };
  if (s === 'Minor')    return { color: '#0284C7', bg: '#EFF6FF', border: '#BAE6FD', dot: '#0284C7' };
  return                       { color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', dot: '#16A34A' };
}
function riskStyle(r: string) {
  if (r === 'High')   return { color: '#DC2626', bg: '#FEF2F2', ring: '#EF4444' };
  if (r === 'Medium') return { color: '#D97706', bg: '#FFFBEB', ring: '#F59E0B' };
  return                     { color: '#16A34A', bg: '#F0FDF4', ring: '#22C55E' };
}
function statusStyle(s: string) {
  if (s === 'Closed')               return { color: '#059669', bg: '#F0FDF4', dot: '#22C55E' };
  if (s === 'CAPA Pending')         return { color: '#D97706', bg: '#FFFBEB', dot: '#F59E0B' };
  if (s === 'Under Investigation')  return { color: '#7C3AED', bg: '#F5F3FF', dot: '#8B5CF6' };
  return                                   { color: '#0284C7', bg: '#EFF6FF', dot: '#38BDF8' };  // Pending Triage
}

// ── Skeleton shimmer ──────────────────────────────────────────────────────────

const Shimmer = ({ w = '100%', h = 16, r = 6 }: { w?: string | number; h?: number; r?: string | number }) => (
  <div style={{
    width: w, height: h, borderRadius: r,
    background: 'linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.4s ease-in-out infinite',
  }} />
);

// ── useCountUp — counts from 0 to target over `duration` ms (easeOut) ────────
function useCountUp(target: number | undefined, duration = 900): number {
  const [count, setCount] = React.useState(0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const prevTarget = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (target === undefined || target === prevTarget.current) return;
    prevTarget.current = target;
    const startVal = 0;
    cancelAnimationFrame(rafRef.current);

    const step = (now: number) => {
      if (!startRef.current) startRef.current = now;
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const ease = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(startVal + (target - startVal) * ease));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    startRef.current = 0;
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return count;
}

// ── KPI card ──────────────────────────────────────────────────────────────────

interface KpiProps {
  label: string; value: number | undefined; sub: string;
  icon: string; ringColor: string; iconBg: string;
  loading: boolean;
}

const KpiCard = memo<KpiProps>(({ label, value, sub, icon, ringColor, iconBg, loading }) => {
  const displayCount = useCountUp(value);

  return (
  <div style={{
    background: '#FFFFFF', borderRadius: 16,
    border: '1px solid #E2E8F0',
    padding: '18px 20px',
    display: 'flex', flexDirection: 'column', gap: 14,
    boxShadow: '0 1px 4px rgba(15,23,42,0.05)',
    transition: 'box-shadow 0.15s',
  }}
    onMouseOver={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(15,23,42,0.09)'}
    onMouseOut={e  => e.currentTarget.style.boxShadow = '0 1px 4px rgba(15,23,42,0.05)'}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      {/* Icon circle */}
      <div style={{
        width: 42, height: 42, borderRadius: 12,
        background: iconBg, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 20, flexShrink: 0,
        boxShadow: `inset 0 0 0 1.5px ${ringColor}30`,
      }}>
        {icon}
      </div>
      {/* Sub label */}
      <span style={{
        fontSize: 10, fontWeight: 700, color: '#94A3B8',
        textTransform: 'uppercase', letterSpacing: '0.6px', paddingTop: 3,
      }}>{sub}</span>
    </div>

    {loading ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Shimmer h={28} w={60} />
        <Shimmer h={12} w="70%" />
      </div>
    ) : (
      <div>
        <div style={{
          fontSize: 30, fontWeight: 900, color: ringColor,
          letterSpacing: '-1px', lineHeight: 1, marginBottom: 4,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {displayCount}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>{label}</div>
      </div>
    )}

    {/* Colour accent bar at bottom */}
    <div style={{
      height: 3, borderRadius: 3,
      background: `linear-gradient(90deg, ${ringColor}, ${ringColor}44)`,
      width: loading ? '0%' : '100%',
      transition: 'width 0.8s ease 0.3s',
    }} />
  </div>
  );
});



// ── SVG Horizontal Bar Chart (categories) ─────────────────────────────────────

const CHART_COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444'];

const CategoryChart = memo<{ data: Record<string, number>; loading: boolean }>(({ data, loading }) => {
  const sorted = useMemo(() =>
    Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 7),
    [data]
  );
  const max = sorted[0]?.[1] ?? 1;
  const BAR_H = 22, GAP = 10, LABEL_W = 120, BAR_AREA = 200;

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>
      {[90, 65, 80, 45, 55].map((w, i) => (
        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Shimmer w={LABEL_W} h={12} />
          <Shimmer w={`${w}%`} h={BAR_H} r={4} />
        </div>
      ))}
    </div>
  );
  if (!sorted.length) return (
    <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 12, padding: '20px 0' }}>No data yet</div>
  );

  const svgH = sorted.length * (BAR_H + GAP) - GAP + 4;
  return (
    <svg width="100%" viewBox={`0 0 ${LABEL_W + BAR_AREA + 50} ${svgH}`} style={{ overflow: 'visible' }}>
      {sorted.map(([cat, cnt], i) => {
        const barW = Math.max(4, (cnt / max) * BAR_AREA);
        const y    = i * (BAR_H + GAP);
        const color = CHART_COLORS[i % CHART_COLORS.length];
        const label = cat.length > 16 ? cat.slice(0, 15) + '…' : cat;
        return (
          <g key={cat}>
            {/* Label */}
            <text x={LABEL_W - 8} y={y + BAR_H / 2 + 4.5}
              textAnchor="end" fontSize="11" fill="#64748B" fontWeight="500">
              {label}
            </text>
            {/* Background track */}
            <rect x={LABEL_W} y={y} width={BAR_AREA} height={BAR_H}
              rx="5" fill="#F8FAFC" />
            {/* Animated bar */}
            <rect x={LABEL_W} y={y} width={barW} height={BAR_H}
              rx="5" fill={color} opacity="0.9"
              style={{
                transformOrigin: `${LABEL_W}px 0`,
                animation: `barGrow 0.7s ease ${i * 0.08}s both`,
              }}
            />
            {/* Count label */}
            <text x={LABEL_W + barW + 6} y={y + BAR_H / 2 + 4.5}
              fontSize="11" fill={color} fontWeight="800">
              {cnt}
            </text>
          </g>
        );
      })}
    </svg>
  );
});

// ── SVG Donut segment helper ──────────────────────────────────────────────────

function donutSlices(values: number[], colors: string[], r = 40, cx = 50, cy = 50, sw = 14) {
  const total = values.reduce((s, v) => s + v, 0) || 1;
  const circ  = 2 * Math.PI * r;
  let offset  = -circ / 4; // start at top
  return values.map((v, i) => {
    const dash = (v / total) * circ;
    const gap  = circ - dash;
    const el = (
      <circle key={i} cx={cx} cy={cy} r={r}
        fill="none" stroke={colors[i]} strokeWidth={sw}
        strokeDasharray={`${dash} ${gap}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: `stroke-dasharray 0.8s ease ${i * 0.15}s` }}
      />
    );
    offset -= dash;
    return el;
  });
}

// ── Donut card (severity / risk) ──────────────────────────────────────────────

const DonutCard = memo<{
  title: string; data: Record<string, number>; colorFn: (k: string) => { ring: string; color: string; bg: string };
  loading: boolean;
}>(({ title, data, colorFn, loading }) => {
  const entries = Object.entries(data);
  const values  = entries.map(([, v]) => v);
  const colors  = entries.map(([k]) => colorFn(k).ring ?? '#94A3B8');
  const total   = values.reduce((s, v) => s + v, 0);

  return (
    <div style={{
      background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0',
      padding: '18px 20px', boxShadow: '0 1px 4px rgba(15,23,42,0.05)',
      display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      <div style={{
        fontSize: 12, fontWeight: 700, color: '#0F172A',
        textTransform: 'uppercase', letterSpacing: '0.5px',
      }}>{title}</div>

      {loading ? (
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <Shimmer w={100} h={100} r="50%" />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3].map(i => <Shimmer key={i} w="80%" h={14} />)}
          </div>
        </div>
      ) : !entries.length ? (
        <div style={{ color: '#94A3B8', fontSize: 12, textAlign: 'center' }}>No data</div>
      ) : (
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          {/* Donut */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <svg width={100} height={100} viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#F1F5F9" strokeWidth="14" />
              {donutSlices(values, colors)}
            </svg>
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#0F172A', lineHeight: 1 }}>{total}</div>
              <div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 600 }}>total</div>
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
            {entries.map(([k, v]) => {
              const st = colorFn(k);
              return (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: st.ring ?? st.color,
                  }} />
                  <span style={{ fontSize: 11.5, color: '#334155', fontWeight: 600, flex: 1 }}>{k}</span>
                  <span style={{
                    fontSize: 13, fontWeight: 800,
                    color: st.color, minWidth: 20, textAlign: 'right',
                  }}>{v}</span>
                  <span style={{
                    fontSize: 10, color: '#94A3B8',
                    minWidth: 32, textAlign: 'right',
                  }}>
                    {Math.round((v / total) * 100)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

// ── Activity feed (recent complaints) ─────────────────────────────────────────

const ActivityFeed = memo<{
  complaints: any[]; loading: boolean;
  onNavigate: (tab: string, id?: number) => void;
}>(({ complaints, loading, onNavigate }) => (
  <div style={{
    background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0',
    padding: '18px 20px', boxShadow: '0 1px 4px rgba(15,23,42,0.05)',
  }}>
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Recent Activity
      </div>
      <button
        onClick={() => onNavigate('complaints')}
        style={{
          background: 'none', border: '1px solid #E2E8F0', borderRadius: 8,
          padding: '4px 10px', fontSize: 11.5, fontWeight: 600, color: '#4F46E5',
          cursor: 'pointer', transition: 'all 0.13s',
        }}
        onMouseOver={e => { e.currentTarget.style.background = '#EEF2FF'; e.currentTarget.style.borderColor = '#C7D2FE'; }}
        onMouseOut={e  => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = '#E2E8F0'; }}
      >
        View all →
      </button>
    </div>

    {loading ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <Shimmer w={10} h={10} r="50%" />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <Shimmer w="60%" h={13} />
              <Shimmer w="40%" h={11} />
            </div>
            <Shimmer w={60} h={22} r={6} />
          </div>
        ))}
      </div>
    ) : complaints.length === 0 ? (
      <div style={{ textAlign: 'center', padding: '28px 0', color: '#94A3B8' }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🗂️</div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>No complaints yet</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>Create your first in the workspace.</div>
      </div>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {complaints.map((c, i) => {
          const ss = sevStyle(c.severity);
          const ts = statusStyle(c.status);
          const date = new Date(c.created_at);
          const isLast = i === complaints.length - 1;
          return (
            <div
              key={c.id}
              onClick={() => onNavigate('complaint-detail', c.id)}
              style={{
                display: 'flex', gap: 12, alignItems: 'flex-start',
                padding: '10px 8px', cursor: 'pointer', borderRadius: 10,
                transition: 'background 0.12s', position: 'relative',
                marginBottom: isLast ? 0 : 2,
              }}
              onMouseOver={e => e.currentTarget.style.background = '#F8FAFC'}
              onMouseOut={e  => e.currentTarget.style.background = 'transparent'}
            >
              {/* Timeline dot + line */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: 3 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: ts.dot, flexShrink: 0,
                  boxShadow: `0 0 0 3px ${ts.bg}`,
                }} />
                {!isLast && (
                  <div style={{ width: 1.5, flex: 1, background: '#F1F5F9', marginTop: 4, minHeight: 20 }} />
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                  <span style={{
                    fontSize: 12, fontWeight: 800, color: '#4F46E5',
                    whiteSpace: 'nowrap',
                  }}>
                    {c.complaint_number}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: '#0F172A',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {c.product_name}
                    {c.strength_or_grade ? ` ${c.strength_or_grade}` : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {c.batch_number && (
                    <span style={{
                      fontSize: 10.5, fontFamily: 'JetBrains Mono, monospace',
                      color: '#64748B', fontWeight: 500,
                    }}>
                      {c.batch_number}
                    </span>
                  )}
                  {c.complaint_category && (
                    <span style={{ fontSize: 10.5, color: '#94A3B8' }}>· {c.complaint_category}</span>
                  )}
                </div>
              </div>

              {/* Right: badges + date */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
                <span style={{
                  padding: '2px 8px', borderRadius: 5, fontSize: 10.5, fontWeight: 700,
                  background: ss.bg, color: ss.color, border: `1px solid ${ss.border}`,
                }}>
                  {c.severity}
                </span>
                <span style={{
                  padding: '2px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600,
                  background: ts.bg, color: ts.color,
                }}>
                  {c.status}
                </span>
                <span style={{ fontSize: 10, color: '#CBD5E1', whiteSpace: 'nowrap' }}>
                  {date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
));

// ── Dashboard root ────────────────────────────────────────────────────────────

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const dispatch = useAppDispatch();
  const { stats, complaints, loading } = useAppSelector(s => s.complaints);
  const actLoading = loading;

  useEffect(() => {
    dispatch(loadStats());
    dispatch(loadComplaints({}));
  }, [dispatch]);

  const recent = useMemo(() => complaints.slice(0, 8), [complaints]);

  const kpis = [
    {
      label: 'Total Complaints',    value: stats?.total_complaints,
      sub: 'All time', icon: '📋',
      ringColor: '#6366F1', iconBg: '#EEF2FF',
    },
    {
      label: 'Under Investigation', value: stats?.open_investigations,
      sub: 'Active', icon: '🔍',
      ringColor: '#8B5CF6', iconBg: '#F5F3FF',
    },
    {
      label: 'High Risk',           value: stats?.high_risk_count,
      sub: 'Needs attention', icon: '⚠️',
      ringColor: '#DC2626', iconBg: '#FEF2F2',
    },
    {
      label: 'CAPA Pending',        value: stats?.capa_pending_count,
      sub: 'Actions needed', icon: '🔄',
      ringColor: '#059669', iconBg: '#F0FDF4',
    },
  ];

  return (
    <div style={{
      minHeight: '100vh', background: '#F8FAFC',
      padding: '24px', maxWidth: 1200, margin: '0 auto',
    }}>
      {/* ── Page header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 24,
      }}>
        <div>
          <div style={{
            fontSize: 22, fontWeight: 900, color: '#0F172A',
            letterSpacing: '-0.6px', marginBottom: 4,
          }}>
            QMS Dashboard
          </div>
          <div style={{ fontSize: 13, color: '#64748B', fontWeight: 500 }}>
            Pharma complaint intelligence overview
          </div>
        </div>
        <button
          onClick={() => onNavigate('workspace')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 18px', borderRadius: 12,
            background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
            color: '#FFFFFF', border: 'none',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 3px 10px rgba(99,102,241,0.35)',
            transition: 'all 0.15s',
          }}
          onMouseOver={e => e.currentTarget.style.boxShadow = '0 5px 18px rgba(99,102,241,0.45)'}
          onMouseOut={e  => e.currentTarget.style.boxShadow = '0 3px 10px rgba(99,102,241,0.35)'}
        >
          <span style={{ fontSize: 15 }}>+</span> New Complaint
        </button>
      </div>

      {/* ── KPI grid ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 14, marginBottom: 20,
      }}>
        {kpis.map((k, i) => (
          <KpiCard key={i} {...k} loading={loading} />
        ))}
      </div>

      {/* ── Charts row ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        gap: 14, marginBottom: 20,
      }}>
        {/* Category bar chart */}
        <div style={{
          gridColumn: '1 / 2',
          background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0',
          padding: '18px 20px', boxShadow: '0 1px 4px rgba(15,23,42,0.05)',
        }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: '#0F172A',
            textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16,
          }}>
            Category Breakdown
          </div>
          <CategoryChart data={stats?.categories_breakdown ?? {}} loading={loading} />
        </div>

        {/* Severity donut */}
        <DonutCard
          title="Severity Distribution"
          data={stats?.severity_breakdown ?? {}}
          colorFn={k => ({ ring: sevStyle(k).dot, color: sevStyle(k).color, bg: sevStyle(k).bg })}
          loading={loading}
        />

        {/* Risk donut */}
        <DonutCard
          title="Risk Level Distribution"
          data={stats?.risk_breakdown ?? {}}
          colorFn={k => riskStyle(k)}
          loading={loading}
        />
      </div>

      {/* ── Activity feed ── */}
      <ActivityFeed
        complaints={recent}
        loading={actLoading}
        onNavigate={onNavigate}
      />
    </div>
  );
};

export default Dashboard;
