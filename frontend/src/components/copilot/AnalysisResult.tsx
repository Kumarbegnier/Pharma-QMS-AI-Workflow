import React, { useState } from 'react';
import type { AIAnalysis, DuplicateMatch } from '../../features/complaints/types';
import ConfidenceBadge from './ConfidenceBadge';

// ── Helpers ──────────────────────────────────────────────────────────────────

function sevStyle(sev: string): { color: string; bg: string; border: string } {
  if (sev === 'Critical') return { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' };
  if (sev === 'Major')    return { color: '#D97706', bg: '#FFFBEB', border: '#FCD34D' };
  if (sev === 'Minor')    return { color: '#0284C7', bg: '#F0F9FF', border: '#BAE6FD' };
  return                         { color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' };
}
function riskStyle(risk: string): { color: string; bg: string; border: string } {
  if (risk === 'High')   return { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' };
  if (risk === 'Medium') return { color: '#D97706', bg: '#FFFBEB', border: '#FCD34D' };
  return                        { color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' };
}

function Tag({ label, styles }: { label: string; styles: { color: string; bg: string; border: string } }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 9px', borderRadius: 4, fontSize: 11.5, fontWeight: 700,
      background: styles.bg, color: styles.color, border: `1px solid ${styles.border}`,
    }}>
      {label}
    </span>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '5px 0', borderBottom: '1px solid #F1F5F9' }}>
      <span style={{ width: 110, fontSize: 11.5, fontWeight: 600, color: '#64748B', flexShrink: 0 }}>
        {label}
      </span>
      <span style={{
        fontSize: 12.5, color: '#0F172A', fontWeight: 500, wordBreak: 'break-word',
        fontFamily: mono ? 'JetBrains Mono, monospace' : undefined,
      }}>
        {value}
      </span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 800, color: '#94A3B8',
      textTransform: 'uppercase', letterSpacing: '0.7px',
      marginBottom: 8, marginTop: 4,
    }}>
      {children}
    </div>
  );
}

// ── AnalysisResult ────────────────────────────────────────────────────────────

interface AnalysisResultProps {
  analysis: AIAnalysis;
  duplicates: DuplicateMatch[];
  aiPopulatedFields: string[];
  onApplyToForm: () => void;
  onAnalyzeAgain: () => void;
  onClear: () => void;
}

const AnalysisResult: React.FC<AnalysisResultProps> = ({
  analysis, duplicates, aiPopulatedFields,
  onApplyToForm, onAnalyzeAgain, onClear,
}) => {
  const [capaOpen, setCapaOpen] = useState(false);
  const [rcaOpen,  setRcaOpen]  = useState(false);

  const ef = analysis.extracted_fields ?? {};
  const fc = analysis.field_confidence  ?? {};

  // Fields with medium/low confidence that need review
  const reviewFields = Object.entries(fc).filter(([, v]) => v.confidence < 0.75);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ── Success header ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', background: '#F0FDF4',
        border: '1px solid #BBF7D0', borderRadius: 10,
      }}>
        <span style={{
          width: 26, height: 26, borderRadius: '50%',
          background: '#DCFCE7', border: '2px solid #86EFAC',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, color: '#16A34A', fontWeight: 800, flexShrink: 0,
        }}>✓</span>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: '#15803D' }}>
            Analysis Complete
          </div>
          <div style={{ fontSize: 11, color: '#4ADE80', marginTop: 2 }}>
            {aiPopulatedFields.length} fields extracted ·{' '}
            {analysis.is_fallback_used ? 'Demo mode' : `${analysis.model_name ?? 'Groq AI'}`}
          </div>
        </div>
      </div>

      {/* ── AI Confidence ──────────────────────────────────────────────── */}
      <ConfidenceBadge analysis={analysis} />

      {/* ── SECTION 1: Extracted Information ───────────────────────────── */}
      <div style={{
        background: '#FFFFFF', border: '1px solid #E2E8F0',
        borderRadius: 10, overflow: 'hidden',
      }}>
        <div style={{
          padding: '8px 12px', borderBottom: '1px solid #E2E8F0',
          background: '#F8FAFC',
          fontSize: 10, fontWeight: 800, color: '#64748B',
          textTransform: 'uppercase', letterSpacing: '0.7px',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ color: '#4F46E5' }}>✦</span> Extracted Information
        </div>
        <div style={{ padding: '8px 12px' }}>
          {ef.product_name     && <InfoRow label="Product"     value={ef.product_name} />}
          {ef.strength_or_grade && <InfoRow label="Strength"    value={ef.strength_or_grade} />}
          {ef.batch_number     && <InfoRow label="Batch / Lot"  value={ef.batch_number} mono />}
          {ef.customer_name    && <InfoRow label="Customer"     value={ef.customer_name} />}
          {ef.complaint_date   && <InfoRow label="Date"         value={ef.complaint_date} />}
          {ef.affected_quantity && <InfoRow label="Quantity"    value={ef.affected_quantity} />}
          {!ef.product_name && !ef.batch_number && (
            <div style={{ fontSize: 12, color: '#94A3B8', padding: '4px 0' }}>
              No product fields extracted.
            </div>
          )}
        </div>
      </div>

      {/* ── SECTION 2: Complaint Assessment ────────────────────────────── */}
      <div style={{
        background: '#FFFFFF', border: '1px solid #E2E8F0',
        borderRadius: 10, overflow: 'hidden',
      }}>
        <div style={{
          padding: '8px 12px', borderBottom: '1px solid #E2E8F0',
          background: '#F8FAFC',
          fontSize: 10, fontWeight: 800, color: '#64748B',
          textTransform: 'uppercase', letterSpacing: '0.7px',
        }}>
          Complaint Assessment
        </div>
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ef.complaint_category && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11.5, color: '#64748B', fontWeight: 600 }}>Category</span>
              <span style={{ fontSize: 12, color: '#0F172A', fontWeight: 500 }}>{ef.complaint_category}</span>
            </div>
          )}
          {analysis.suggested_severity && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11.5, color: '#64748B', fontWeight: 600 }}>Severity</span>
              <Tag label={analysis.suggested_severity} styles={sevStyle(analysis.suggested_severity)} />
            </div>
          )}
          {analysis.suggested_risk && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11.5, color: '#64748B', fontWeight: 600 }}>Risk Level</span>
              <Tag label={analysis.suggested_risk} styles={riskStyle(analysis.suggested_risk)} />
            </div>
          )}
          {analysis.completeness_score !== undefined && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11.5, color: '#64748B', fontWeight: 600 }}>Completeness</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A' }}>
                {Math.round(analysis.completeness_score * 100)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── SECTION 3: AI Insights ──────────────────────────────────────── */}
      {(analysis.possible_root_causes?.length > 0 || analysis.recommended_capa?.length > 0 ||
        analysis.suggested_next_action || duplicates?.length > 0) && (
        <div style={{
          background: '#FFFFFF', border: '1px solid #E2E8F0',
          borderRadius: 10, overflow: 'hidden',
        }}>
          <div style={{
            padding: '8px 12px', borderBottom: '1px solid #E2E8F0',
            background: '#F8FAFC',
            fontSize: 10, fontWeight: 800, color: '#64748B',
            textTransform: 'uppercase', letterSpacing: '0.7px',
          }}>
            AI Insights
          </div>
          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 9 }}>
            {/* Suggested next action */}
            {analysis.suggested_next_action && (
              <div>
                <SectionTitle>Suggested Next Action</SectionTitle>
                <div style={{
                  fontSize: 12.5, color: '#1E293B', lineHeight: 1.55,
                  padding: '7px 10px', background: '#EEF2FF',
                  borderLeft: '2.5px solid #6366F1', borderRadius: '0 6px 6px 0',
                }}>
                  {analysis.suggested_next_action}
                </div>
              </div>
            )}

            {/* Root causes — collapsible */}
            {analysis.possible_root_causes?.length > 0 && (
              <div>
                <button
                  onClick={() => setRcaOpen(v => !v)}
                  style={{
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 12, fontWeight: 700, color: '#334155',
                  }}
                >
                  <span style={{ fontSize: 10 }}>{rcaOpen ? '▾' : '▸'}</span>
                  Possible Root Causes ({analysis.possible_root_causes.length})
                </button>
                {rcaOpen && (
                  <div style={{ marginTop: 7, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {analysis.possible_root_causes.map((c, i) => (
                      <div key={i} style={{
                        fontSize: 12, color: '#334155', padding: '5px 9px',
                        background: '#F8FAFC', borderRadius: 5,
                        border: '1px solid #E2E8F0', lineHeight: 1.45,
                        display: 'flex', gap: 7,
                      }}>
                        <span style={{ color: '#94A3B8', flexShrink: 0 }}>–</span>{c}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* CAPA — collapsible */}
            {analysis.recommended_capa?.length > 0 && (
              <div>
                <button
                  onClick={() => setCapaOpen(v => !v)}
                  style={{
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 12, fontWeight: 700, color: '#334155',
                  }}
                >
                  <span style={{ fontSize: 10 }}>{capaOpen ? '▾' : '▸'}</span>
                  Suggested CAPA ({analysis.recommended_capa.length})
                </button>
                {capaOpen && (
                  <div style={{ marginTop: 7, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {analysis.recommended_capa.map((c, i) => (
                      <div key={i} style={{
                        fontSize: 12, color: '#334155', padding: '5px 9px',
                        background: '#F0FDF4', borderRadius: 5,
                        border: '1px solid #BBF7D0', lineHeight: 1.45,
                        display: 'flex', gap: 7,
                      }}>
                        <span style={{ color: '#16A34A', flexShrink: 0 }}>✓</span>{c}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Potential duplicate */}
            {duplicates?.length > 0 && (
              <div style={{
                padding: '8px 10px', background: '#FFFBEB',
                border: '1px solid #FCD34D', borderRadius: 7,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E', marginBottom: 5 }}>
                  ⚠ Potential Duplicate Complaint
                </div>
                {duplicates.slice(0, 2).map((d, i) => (
                  <div key={i} style={{ fontSize: 11.5, color: '#B45309', lineHeight: 1.5 }}>
                    {d.complaint_number} — {d.product_name} / {d.batch_number}
                    {' · '}
                    <strong>{Math.round(d.similarity_score * 100)}% similar</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SECTION 4: Uncertainty — fields needing review ─────────────── */}
      {reviewFields.length > 0 && (
        <div style={{
          padding: '10px 12px', background: '#FFFBEB',
          border: '1px solid #FCD34D', borderRadius: 10,
        }}>
          <div style={{
            fontSize: 11.5, fontWeight: 700, color: '#92400E', marginBottom: 8,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            ⚠ Review Required
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {reviewFields.slice(0, 4).map(([field, fc]) => (
              <div key={field} style={{ fontSize: 12 }}>
                <div style={{ fontWeight: 600, color: '#0F172A', marginBottom: 2 }}>
                  {field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5, color: '#334155',
                  }}>
                    {String(fc.value ?? '—')}
                  </span>
                  <span style={{
                    padding: '1px 7px', borderRadius: 4, fontSize: 10.5, fontWeight: 700,
                    background: fc.confidence < 0.55 ? '#FEF2F2' : '#FFFBEB',
                    color: fc.confidence < 0.55 ? '#DC2626' : '#D97706',
                    border: `1px solid ${fc.confidence < 0.55 ? '#FECACA' : '#FCD34D'}`,
                  }}>
                    {fc.confidence < 0.55 ? 'Low' : 'Medium'} confidence
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Primary Actions ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onApplyToForm}
          style={{
            flex: 1, height: 38, borderRadius: 8,
            background: '#0F172A', color: '#FFFFFF',
            border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          }}
        >
          Apply to Form
        </button>
        <button
          onClick={() => {/* focus form */}}
          style={{
            flex: 1, height: 38, borderRadius: 8,
            background: '#FFFFFF', color: '#334155',
            border: '1px solid #E2E8F0', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Review &amp; Edit
        </button>
      </div>

      {/* Secondary actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onAnalyzeAgain}
          style={{
            flex: 1, height: 32, borderRadius: 7,
            background: 'transparent', color: '#64748B',
            border: '1px solid #E2E8F0', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Analyze Again
        </button>
        <button
          onClick={onClear}
          style={{
            flex: 1, height: 32, borderRadius: 7,
            background: 'transparent', color: '#64748B',
            border: '1px solid #E2E8F0', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
};

export default AnalysisResult;
