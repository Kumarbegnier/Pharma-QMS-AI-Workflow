import React from 'react';
import type { AIAnalysis } from '../../features/complaints/types';

// ── ConfidenceBadge ──────────────────────────────────────────────────────────
// Derives confidence tier from completeness_score + field_confidence map.
// Uses ACTUAL backend values — no random generation.

function deriveConfidence(analysis: AIAnalysis): {
  tier: 'High' | 'Medium' | 'Low';
  pct: number;
  color: string;
  bg: string;
  border: string;
} {
  const pct = Math.round((analysis.completeness_score ?? 0) * 100);
  if (pct >= 80) return { tier: 'High',   pct, color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' };
  if (pct >= 55) return { tier: 'Medium', pct, color: '#D97706', bg: '#FFFBEB', border: '#FCD34D' };
  return             { tier: 'Low',    pct, color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' };
}

interface ConfidenceBadgeProps {
  analysis: AIAnalysis;
  compact?: boolean;
}

const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({ analysis, compact }) => {
  const c = deriveConfidence(analysis);
  if (compact) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 9px', borderRadius: 20,
        fontSize: 11.5, fontWeight: 700,
        background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      }}>
        {c.tier} confidence · {c.pct}%
      </span>
    );
  }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 12px', borderRadius: 8,
      background: c.bg, border: `1px solid ${c.border}`,
    }}>
      {/* Arc ring */}
      <div style={{ position: 'relative', width: 42, height: 42, flexShrink: 0 }}>
        <svg width={42} height={42} viewBox="0 0 42 42" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={21} cy={21} r={17} fill="none" stroke={c.border} strokeWidth={4} />
          <circle
            cx={21} cy={21} r={17} fill="none" stroke={c.color} strokeWidth={4}
            strokeDasharray={`${2 * Math.PI * 17}`}
            strokeDashoffset={`${2 * Math.PI * 17 * (1 - (analysis.completeness_score ?? 0))}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <span style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: 10.5, fontWeight: 800, color: c.color,
        }}>
          {c.pct}%
        </span>
      </div>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A' }}>
          AI Confidence
        </div>
        <div style={{ fontSize: 11.5, color: c.color, fontWeight: 600, marginTop: 2 }}>
          {c.tier} confidence · {c.pct}% complete
        </div>
        {analysis.is_fallback_used && (
          <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 2 }}>
            Demo fallback mode — add GROQ_API_KEY for full AI
          </div>
        )}
      </div>
    </div>
  );
};

export default ConfidenceBadge;
