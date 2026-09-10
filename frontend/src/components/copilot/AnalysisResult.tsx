import React from 'react';
import type { AIAnalysis } from '../../features/complaints/types';

/* ── ConfidenceScore ────────────────────────────────────────────────────── */
interface ConfidenceScoreProps {
  score: number;            // 0–1
  aiFieldCount: number;
}

export const ConfidenceScore: React.FC<ConfidenceScoreProps> = ({ score, aiFieldCount }) => {
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? '#16A34A' : pct >= 55 ? '#D97706' : '#DC2626';
  const bg    = pct >= 80 ? '#F0FDF4' : pct >= 55 ? '#FFFBEB' : '#FEF2F2';
  const border= pct >= 80 ? '#BBF7D0' : pct >= 55 ? '#FCD34D' : '#FECACA';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 12px', background: bg,
      border: `1px solid ${border}`, borderRadius: 8,
    }}>
      {/* Circular arc */}
      <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
        <svg width={44} height={44} viewBox="0 0 44 44" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={22} cy={22} r={18} fill="none" stroke={border} strokeWidth={4} />
          <circle
            cx={22} cy={22} r={18} fill="none"
            stroke={color} strokeWidth={4}
            strokeDasharray={`${2 * Math.PI * 18}`}
            strokeDashoffset={`${2 * Math.PI * 18 * (1 - score)}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.7s ease' }}
          />
        </svg>
        <span style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          fontSize: 11, fontWeight: 800, color,
        }}>
          {pct}%
        </span>
      </div>

      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>
          Complaint completeness
        </div>
        <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
          {aiFieldCount} fields extracted by AI
        </div>
      </div>
    </div>
  );
};

/* ── ExtractedData ──────────────────────────────────────────────────────── */
interface ExtractedDataProps {
  analysis: AIAnalysis;
}

function sev(s: string) {
  if (s === 'Critical') return { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' };
  if (s === 'Major')    return { bg: '#FFFBEB', color: '#D97706', border: '#FCD34D' };
  return                       { bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' };
}
function risk(r: string) {
  if (r === 'High')   return { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' };
  if (r === 'Medium') return { bg: '#FFFBEB', color: '#D97706', border: '#FCD34D' };
  return                     { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' };
}

const DataRow: React.FC<{ label: string; value: string | undefined | null }> = ({ label, value }) => {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 11.5 }}>
      <span style={{ color: '#94A3B8', fontWeight: 600, flexShrink: 0, width: 90 }}>{label}</span>
      <span style={{ color: '#1E293B', fontWeight: 500, wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
};

export const ExtractedData: React.FC<ExtractedDataProps> = ({ analysis }) => {
  const ef = analysis.extracted_fields || {};
  const sevStyle  = sev(analysis.suggested_severity);
  const riskStyle = risk(analysis.suggested_risk);

  return (
    <div style={{
      background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8,
      overflow: 'hidden',
    }}>
      {/* Section header */}
      <div style={{
        padding: '7px 12px', borderBottom: '1px solid #E2E8F0',
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'linear-gradient(135deg, #EFF6FF, #F0F9FF)',
      }}>
        <span style={{ fontSize: 10, color: '#2563EB' }}>✦</span>
        <span style={{
          fontSize: 9.5, fontWeight: 700, color: '#1D4ED8',
          textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>
          Key Extracted Fields
        </span>
      </div>

      {/* Field rows */}
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <DataRow label="Customer"  value={ef.customer_name} />
        <DataRow label="Product"   value={ef.product_name} />
        <DataRow label="Strength"  value={ef.strength_or_grade} />
        <DataRow label="Batch"     value={ef.batch_number} />
        <DataRow label="Quantity"  value={ef.affected_quantity} />
        <DataRow label="Category"  value={ef.complaint_category} />

        {/* Severity + Risk inline */}
        {(analysis.suggested_severity || analysis.suggested_risk) && (
          <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
            {analysis.suggested_severity && (
              <span style={{
                display: 'inline-flex', alignItems: 'center',
                padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                ...sevStyle,
              }}>
                {analysis.suggested_severity} severity
              </span>
            )}
            {analysis.suggested_risk && (
              <span style={{
                display: 'inline-flex', alignItems: 'center',
                padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                ...riskStyle,
              }}>
                {analysis.suggested_risk} risk
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* ── ApplyToForm ────────────────────────────────────────────────────────── */
interface ApplyToFormProps {
  applied: boolean;   // true = already applied to form (always true post-analysis)
  fieldCount: number;
  onScrollToForm?: () => void;
}

export const ApplyToForm: React.FC<ApplyToFormProps> = ({ applied, fieldCount, onScrollToForm }) => (
  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
    {applied ? (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', background: '#F0FDF4',
        border: '1px solid #BBF7D0', borderRadius: 7,
      }}>
        <span style={{ fontSize: 14, color: '#16A34A' }}>✓</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#15803D' }}>
            Applied to form
          </div>
          <div style={{ fontSize: 10.5, color: '#4ADE80' }}>
            {fieldCount} fields updated · Review and correct on the left
          </div>
        </div>
      </div>
    ) : (
      <button
        className="btn btn-primary"
        style={{ flex: 1, height: 36 }}
        onClick={onScrollToForm}
      >
        ✦ Apply to Form
      </button>
    )}
  </div>
);

/* ── AnalysisResult (container) ─────────────────────────────────────────── */
interface AnalysisResultProps {
  analysis: AIAnalysis;
  aiFieldCount: number;
}

const AnalysisResult: React.FC<AnalysisResultProps> = ({ analysis, aiFieldCount }) => (
  <div style={{
    margin: '0 12px 10px',
    display: 'flex', flexDirection: 'column', gap: 9,
  }}>
    {/* Success header */}
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 11px',
      background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8,
    }}>
      <span style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 22, height: 22, background: '#F0FDF4',
        border: '1.5px solid #BBF7D0', borderRadius: '50%',
        fontSize: 12, color: '#16A34A', fontWeight: 800,
      }}>✓</span>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A' }}>
          Analysis complete
        </div>
        <div style={{ fontSize: 10.5, color: '#64748B' }}>
          {analysis.is_fallback_used ? 'Demo fallback mode' : 'Powered by Groq · LangGraph'}
        </div>
      </div>
    </div>

    <ConfidenceScore score={analysis.completeness_score || 0} aiFieldCount={aiFieldCount} />
    <ExtractedData analysis={analysis} />
    <ApplyToForm applied fieldCount={aiFieldCount} />
  </div>
);

export default AnalysisResult;
