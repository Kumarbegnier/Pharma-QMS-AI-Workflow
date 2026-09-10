/**
 * AIVOA Copilot — Gemini-style conversational AI interface
 * IMPROVED: richer result card with tab UI, shimmer loading, stagger animations,
 *           polished typography, smarter composer, better empty state.
 *
 * Backend integration unchanged:
 *   POST /api/ai/intake/text  → analyzeComplaintText thunk
 *   POST /api/ai/intake/file  → analyzeComplaintFile thunk
 *   POST /api/ai/chat         → sendChatCorrection thunk
 */

import React, {
  useRef, useState, useEffect, useCallback, useLayoutEffect, memo,
} from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  analyzeComplaintText, analyzeComplaintFile, sendChatCorrection,
  updateFieldManually, resetDraft, fetchAIStatus,
} from '../../features/complaints/complaintsSlice';
import type { AIAnalysis, ComplaintDraft, DuplicateMatch } from '../../features/complaints/types';
import AnalysisProgress from './AnalysisProgress';
import ConflictDialog   from './ConflictDialog';
import type { ConflictItem } from './ConflictDialog';

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCEPTED_EXT  = ['.pdf', '.txt', '.docx', '.eml', '.md'];
const FILE_LABEL_MAP: Record<string, string> = {
  '.pdf': 'PDF', '.docx': 'DOCX', '.txt': 'TXT', '.eml': 'EML', '.md': 'MD',
};
const FIELD_MAP: Record<string, keyof ComplaintDraft> = {
  source: 'source', customer_name: 'customer_name', customer_type: 'customer_type',
  reporter_contact: 'reporter_contact', product_type: 'product_type',
  product_name: 'product_name', strength_or_grade: 'strength_or_grade',
  batch_number: 'batch_number', affected_quantity: 'affected_quantity',
  manufacturing_date: 'manufacturing_date', expiry_date: 'expiry_date',
  complaint_category: 'complaint_category', complaint_date: 'complaint_date',
  complaint_description: 'complaint_description', originating_site_block: 'originating_site_block',
  impacted_non_product_material: 'impacted_non_product_material',
};

// ── Style helpers ─────────────────────────────────────────────────────────────

function sevColor(s: string) {
  if (s === 'Critical') return { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' };
  if (s === 'Major')    return { color: '#D97706', bg: '#FFFBEB', border: '#FCD34D' };
  if (s === 'Minor')    return { color: '#0284C7', bg: '#EFF6FF', border: '#BAE6FD' };
  return                       { color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' };
}
function riskColor(r: string) {
  if (r === 'High')   return { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' };
  if (r === 'Medium') return { color: '#D97706', bg: '#FFFBEB', border: '#FCD34D' };
  return                     { color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' };
}
function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Pill badge ────────────────────────────────────────────────────────────────

const Pill = memo(({ label, c }: { label: string; c: { color: string; bg: string; border: string } }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center',
    padding: '3px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 700,
    background: c.bg, color: c.color, border: `1px solid ${c.border}`,
    letterSpacing: '0.1px',
  }}>
    {label}
  </span>
));

// ── Loading dots (for AI "thinking" header) ───────────────────────────────────

const LoadingDots = memo(() => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
    {[0, 1, 2].map(i => (
      <span key={i} style={{
        width: 5, height: 5, borderRadius: '50%',
        background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
        display: 'block',
        animation: `pulse-dot 1.4s ease-in-out ${i * 0.18}s infinite`,
      }} />
    ))}
  </div>
));

// ── EmptyState ────────────────────────────────────────────────────────────────

const EmptyState = memo(() => (
  <div style={{
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '44px 28px', textAlign: 'center', minHeight: 240,
    animation: 'fadeUp 0.35s ease',
  }}>
    {/* Pulsing sparkle icon */}
    <div style={{
      width: 52, height: 52, borderRadius: '50%', marginBottom: 18,
      background: 'linear-gradient(135deg, #EEF2FF, #F5F3FF)',
      border: '1.5px solid #C7D2FE',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'pulse-glow 3s ease-in-out infinite',
    }}>
      <span style={{
        fontSize: 22,
        background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
      }}>✦</span>
    </div>
    <div style={{
      fontSize: 17, fontWeight: 700, color: '#0F172A',
      letterSpacing: '-0.4px', marginBottom: 10, lineHeight: 1.3,
    }}>
      How can I help with<br />this complaint?
    </div>
    <div style={{
      fontSize: 13, color: '#94A3B8', lineHeight: 1.65, maxWidth: 260,
    }}>
      Paste a customer complaint, email, or message below. Or attach a PDF, DOCX, TXT, or EML file.
    </div>
    {/* Capability hints row */}
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center',
      marginTop: 20,
    }}>
      {['Extract fields', 'Assess risk', 'Root cause', 'CAPA', 'Duplicates'].map(h => (
        <span key={h} style={{
          padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500,
          background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B',
        }}>
          {h}
        </span>
      ))}
    </div>
  </div>
));

// ── UserMessage ───────────────────────────────────────────────────────────────

interface UserMessageProps {
  text: string;
  file: { name: string; size: number } | null;
  time: Date;
}

const UserMessage = memo<UserMessageProps>(({ text, file, time }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
    marginBottom: 20, animation: 'fadeUp 0.2s ease',
  }}>
    <div style={{
      fontSize: 10, fontWeight: 700, color: '#CBD5E1',
      textTransform: 'uppercase', letterSpacing: '0.7px',
      marginBottom: 5, display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <span>You</span>
      <span style={{ fontWeight: 400, letterSpacing: 0 }}>{fmtTime(time)}</span>
    </div>
    <div style={{
      maxWidth: '84%', background: '#0F172A', color: '#FFFFFF',
      borderRadius: '18px 18px 4px 18px',
      padding: '11px 15px', fontSize: 13, lineHeight: 1.6,
      wordBreak: 'break-word',
      boxShadow: '0 2px 8px rgba(15,23,42,0.18)',
    }}>
      {file && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 9px', borderRadius: 7,
          background: 'rgba(255,255,255,0.10)',
          border: '1px solid rgba(255,255,255,0.08)',
          marginBottom: text ? 8 : 0, fontSize: 12, fontWeight: 600,
        }}>
          <span style={{ fontSize: 13 }}>📄</span>
          <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {file.name}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10.5 }}>{fmtSize(file.size)}</span>
        </div>
      )}
      {text && (
        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
          {text.length > 300 ? text.slice(0, 300) + '…' : text}
        </div>
      )}
    </div>
  </div>
));

// ── AIResultCard — Tabbed design ──────────────────────────────────────────────

type Tab = 'info' | 'risk' | 'insights';

interface AIResultCardProps {
  analysis: AIAnalysis;
  duplicates: DuplicateMatch[];
  aiPopulatedFields: string[];
  onApplyToForm: () => void;
  onClear: () => void;
}

const STAT_FIELD_LABEL: Record<string, string> = {
  product_name: 'Product', strength_or_grade: 'Strength', batch_number: 'Batch / Lot',
  customer_name: 'Customer', complaint_date: 'Date', affected_quantity: 'Quantity',
  complaint_category: 'Category', source: 'Source',
};

const AIResultCard = memo<AIResultCardProps>(({ analysis, duplicates, aiPopulatedFields, onApplyToForm, onClear }) => {
  const [activeTab, setActiveTab] = useState<Tab>('info');
  const ef = analysis.extracted_fields ?? {};
  const fc = analysis.field_confidence  ?? {};
  const completeness   = Math.round((analysis.completeness_score ?? 0) * 100);
  const reviewFields   = Object.entries(fc).filter(([, v]) => v.confidence < 0.75);

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'info',     label: 'Extracted' },
    { key: 'risk',     label: 'Risk' },
    { key: 'insights', label: 'Insights', count: (analysis.possible_root_causes?.length ?? 0) + (analysis.recommended_capa?.length ?? 0) },
  ];

  return (
    <div style={{ marginBottom: 20, animation: 'fadeUp 0.25s ease' }}>
      {/* AI attribution row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10,
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%',
          background: 'linear-gradient(135deg, #EEF2FF, #F5F3FF)',
          border: '1.5px solid #C7D2FE',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span style={{
            fontSize: 10,
            background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            fontWeight: 800,
          }}>✦</span>
        </div>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: '#4F46E5' }}>AIVOA Copilot</span>
        <span style={{ fontSize: 10.5, color: '#CBD5E1' }}>·</span>
        <span style={{ fontSize: 10.5, color: '#94A3B8' }}>
          {aiPopulatedFields.length} fields extracted · {completeness}% complete
          {analysis.is_fallback_used ? ' · Demo mode' : ''}
        </span>
      </div>

      {/* Card */}
      <div style={{
        background: '#FFFFFF', borderRadius: 18,
        border: '1px solid #E2E8F0',
        overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(15,23,42,0.06)',
      }}>
        {/* Success header strip */}
        <div style={{
          padding: '14px 16px 12px',
          background: 'linear-gradient(135deg, #F8FAFC 0%, #FFFFFF 100%)',
          borderBottom: '1px solid #F1F5F9',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3,
            }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 18, height: 18, borderRadius: '50%',
                background: '#DCFCE7', border: '1.5px solid #86EFAC',
                fontSize: 10, color: '#16A34A', fontWeight: 800, flexShrink: 0,
              }}>✓</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.3px' }}>
                Analysis complete
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#64748B', paddingLeft: 25 }}>
              I extracted the following information from the complaint.
            </div>
          </div>
          {/* Completeness ring */}
          <div style={{ flexShrink: 0 }}>
            <svg width={40} height={40} viewBox="0 0 40 40" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx={20} cy={20} r={16} fill="none" stroke="#F1F5F9" strokeWidth={4} />
              <circle
                cx={20} cy={20} r={16} fill="none"
                stroke={completeness >= 80 ? '#16A34A' : completeness >= 55 ? '#D97706' : '#DC2626'}
                strokeWidth={4}
                strokeDasharray={`${2 * Math.PI * 16}`}
                strokeDashoffset={`${2 * Math.PI * 16 * (1 - (analysis.completeness_score ?? 0))}`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 1s ease 0.2s' }}
              />
            </svg>
            <div style={{
              position: 'relative', marginTop: -34, textAlign: 'center',
              fontSize: 10, fontWeight: 800,
              color: completeness >= 80 ? '#16A34A' : completeness >= 55 ? '#D97706' : '#DC2626',
            }}>
              {completeness}%
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{
          display: 'flex', borderBottom: '1px solid #F1F5F9',
          background: '#FAFAFA', padding: '0 16px',
        }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: '9px 12px', border: 'none', background: 'transparent',
                fontSize: 12, fontWeight: activeTab === t.key ? 700 : 500,
                color: activeTab === t.key ? '#4F46E5' : '#94A3B8',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                borderBottom: `2px solid ${activeTab === t.key ? '#4F46E5' : 'transparent'}`,
                marginBottom: -1, transition: 'all 0.15s',
              }}
            >
              {t.label}
              {t.count ? (
                <span style={{
                  padding: '1px 5px', borderRadius: 10,
                  background: activeTab === t.key ? '#EEF2FF' : '#F1F5F9',
                  color: activeTab === t.key ? '#4F46E5' : '#94A3B8',
                  fontSize: 10, fontWeight: 700,
                }}>
                  {t.count}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ padding: '14px 16px', animation: 'fadeUp 0.18s ease' }}>

          {/* ── INFO TAB ── */}
          {activeTab === 'info' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(STAT_FIELD_LABEL).map(([field, label], i) => {
                const val = ef[field];
                if (!val) return null;
                const conf = fc[field];
                const isLowConf = conf && conf.confidence < 0.75;
                return (
                  <div key={field} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '8px 10px', borderRadius: 9,
                    background: i % 2 === 0 ? '#FAFAFA' : '#FFFFFF',
                    border: '1px solid #F1F5F9',
                    animation: `fadeUp 0.2s ease ${i * 0.04}s both`,
                  }}>
                    <div style={{ width: 78, fontSize: 10.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0, paddingTop: 2 }}>
                      {label}
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{
                        fontSize: 13, fontWeight: 600, color: '#0F172A',
                        fontFamily: field === 'batch_number' ? 'JetBrains Mono, monospace' : undefined,
                      }}>
                        {String(val)}
                      </span>
                      {field === 'product_name' && ef.strength_or_grade && (
                        <span style={{ fontSize: 11.5, color: '#64748B', marginLeft: 6 }}>
                          {ef.strength_or_grade}
                        </span>
                      )}
                    </div>
                    {isLowConf && (
                      <span style={{
                        padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                        background: '#FFFBEB', color: '#D97706', border: '1px solid #FCD34D', flexShrink: 0,
                      }}>
                        Review
                      </span>
                    )}
                  </div>
                );
              })}
              {!Object.keys(STAT_FIELD_LABEL).some(k => ef[k]) && (
                <div style={{ fontSize: 12.5, color: '#94A3B8', textAlign: 'center', padding: '12px 0' }}>
                  No structured fields could be extracted.
                </div>
              )}
            </div>
          )}

          {/* ── RISK TAB ── */}
          {activeTab === 'risk' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, animation: 'fadeUp 0.18s ease' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {analysis.suggested_severity && (
                  <div style={{ padding: '12px 14px', background: '#FAFAFA', border: '1px solid #F1F5F9', borderRadius: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 7 }}>Severity</div>
                    <Pill label={analysis.suggested_severity} c={sevColor(analysis.suggested_severity)} />
                  </div>
                )}
                {analysis.suggested_risk && (
                  <div style={{ padding: '12px 14px', background: '#FAFAFA', border: '1px solid #F1F5F9', borderRadius: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 7 }}>Risk Level</div>
                    <Pill label={analysis.suggested_risk} c={riskColor(analysis.suggested_risk)} />
                  </div>
                )}
              </div>

              {analysis.risk_reasoning && (
                <div style={{
                  padding: '10px 12px', background: '#EEF2FF',
                  borderLeft: '3px solid #6366F1', borderRadius: '0 10px 10px 0',
                  fontSize: 12.5, color: '#1E1B4B', lineHeight: 1.6,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#6366F1', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>
                    Risk Reasoning
                  </div>
                  {analysis.risk_reasoning}
                </div>
              )}

              {analysis.patient_safety_impact !== undefined && analysis.patient_safety_impact !== null && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 12px', borderRadius: 9,
                  background: analysis.patient_safety_impact ? '#FEF2F2' : '#F0FDF4',
                  border: `1px solid ${analysis.patient_safety_impact ? '#FECACA' : '#BBF7D0'}`,
                }}>
                  <span style={{ fontSize: 15 }}>{analysis.patient_safety_impact ? '⚠' : '✓'}</span>
                  <span style={{
                    fontSize: 12.5, fontWeight: 600,
                    color: analysis.patient_safety_impact ? '#DC2626' : '#16A34A',
                  }}>
                    Patient safety impact: {String(analysis.patient_safety_impact)}
                  </span>
                </div>
              )}

              {/* Low-confidence fields */}
              {reviewFields.length > 0 && (
                <div style={{
                  padding: '10px 12px', background: '#FFFBEB',
                  border: '1px solid #FCD34D', borderRadius: 10,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#92400E', marginBottom: 8 }}>
                    ⚠ {reviewFields.length} field{reviewFields.length > 1 ? 's' : ''} need review
                  </div>
                  {reviewFields.slice(0, 4).map(([field, fconf]) => (
                    <div key={field} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '4px 0', borderBottom: '1px solid #FEF3C7', fontSize: 11.5,
                    }}>
                      <span style={{ color: '#92400E', fontWeight: 600 }}>
                        {field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </span>
                      <span style={{
                        fontSize: 10.5, padding: '1px 6px', borderRadius: 4, fontWeight: 700,
                        background: fconf.confidence < 0.55 ? '#FEF2F2' : '#FFFBEB',
                        color: fconf.confidence < 0.55 ? '#DC2626' : '#D97706',
                      }}>
                        {Math.round(fconf.confidence * 100)}% conf.
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── INSIGHTS TAB ── */}
          {activeTab === 'insights' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'fadeUp 0.18s ease' }}>
              {analysis.suggested_next_action && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 7 }}>
                    Suggested Next Action
                  </div>
                  <div style={{
                    padding: '10px 12px', background: '#EEF2FF',
                    borderLeft: '3px solid #6366F1', borderRadius: '0 10px 10px 0',
                    fontSize: 12.5, color: '#1E1B4B', lineHeight: 1.6,
                  }}>
                    {analysis.suggested_next_action}
                  </div>
                </div>
              )}

              {analysis.possible_root_causes?.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 7 }}>
                    Possible Root Causes
                  </div>
                  {analysis.possible_root_causes.map((c, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: 9, padding: '7px 0',
                      borderBottom: i < analysis.possible_root_causes.length - 1 ? '1px solid #F1F5F9' : 'none',
                      animation: `fadeUp 0.18s ease ${i * 0.06}s both`,
                    }}>
                      <span style={{
                        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                        background: '#EEF2FF', border: '1.5px solid #C7D2FE',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 800, color: '#4F46E5', marginTop: 2,
                      }}>
                        {i + 1}
                      </span>
                      <span style={{ fontSize: 12.5, color: '#334155', lineHeight: 1.55 }}>{c}</span>
                    </div>
                  ))}
                </div>
              )}

              {analysis.recommended_capa?.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 7 }}>
                    Suggested CAPA
                  </div>
                  {analysis.recommended_capa.map((c, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: 9, padding: '7px 0',
                      borderBottom: i < analysis.recommended_capa.length - 1 ? '1px solid #F1F5F9' : 'none',
                      animation: `fadeUp 0.18s ease ${i * 0.06}s both`,
                    }}>
                      <span style={{
                        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                        background: '#F0FDF4', border: '1.5px solid #86EFAC',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, color: '#16A34A', marginTop: 2,
                      }}>
                        ✓
                      </span>
                      <span style={{ fontSize: 12.5, color: '#334155', lineHeight: 1.55 }}>{c}</span>
                    </div>
                  ))}
                </div>
              )}

              {duplicates?.length > 0 && (
                <div style={{
                  padding: '10px 12px', background: '#FFFBEB',
                  border: '1px solid #FCD34D', borderRadius: 10,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#92400E', marginBottom: 7 }}>
                    ⚠ Potential Duplicate Complaint
                  </div>
                  {duplicates.slice(0, 2).map((d, i) => (
                    <div key={i} style={{
                      fontSize: 12, color: '#B45309', lineHeight: 1.6, marginBottom: 3,
                    }}>
                      <strong>{d.complaint_number}</strong> — {d.product_name} / {d.batch_number}
                      {' · '}<strong>{Math.round(d.similarity_score * 100)}% similar</strong>
                      {d.matched_factors?.length > 0 && (
                        <div style={{ fontSize: 11, color: '#D97706', marginTop: 1 }}>
                          Matched: {d.matched_factors.join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!analysis.possible_root_causes?.length && !analysis.recommended_capa?.length && !analysis.suggested_next_action && (
                <div style={{ fontSize: 12.5, color: '#94A3B8', textAlign: 'center', padding: '12px 0' }}>
                  No AI insights available for this complaint.
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Action buttons ── */}
        <div style={{
          padding: '12px 16px 14px',
          borderTop: '1px solid #F1F5F9',
          background: '#FAFAFA',
          display: 'flex', gap: 8,
        }}>
          <button
            onClick={onApplyToForm}
            style={{
              flex: 1, height: 40, borderRadius: 10,
              background: '#0F172A', color: '#FFFFFF',
              border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'background 0.15s',
              boxShadow: '0 1px 4px rgba(15,23,42,0.18)',
            }}
            onMouseOver={e => e.currentTarget.style.background = '#1E293B'}
            onMouseOut={e  => e.currentTarget.style.background = '#0F172A'}
          >
            <span style={{ fontSize: 11 }}>↙</span> Apply to Form
          </button>
          <button
            style={{
              flex: 1, height: 40, borderRadius: 10,
              background: '#FFFFFF', color: '#334155',
              border: '1px solid #E2E8F0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseOver={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#CBD5E1'; }}
            onMouseOut={e  => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = '#E2E8F0'; }}
          >
            Review &amp; Edit
          </button>
        </div>

        {/* Tertiary actions */}
        <div style={{
          padding: '0 16px 12px',
          display: 'flex', gap: 8,
        }}>
          <button onClick={onClear} style={{
            flex: 1, height: 28, borderRadius: 8, background: 'transparent',
            color: '#94A3B8', border: '1px solid #F1F5F9',
            fontSize: 11.5, fontWeight: 500, cursor: 'pointer', transition: 'color 0.13s',
          }}
            onMouseOver={e => e.currentTarget.style.color = '#4F46E5'}
            onMouseOut={e  => e.currentTarget.style.color = '#94A3B8'}
          >
            Analyze Again
          </button>
          <button onClick={onClear} style={{
            flex: 1, height: 28, borderRadius: 8, background: 'transparent',
            color: '#94A3B8', border: '1px solid #F1F5F9',
            fontSize: 11.5, fontWeight: 500, cursor: 'pointer', transition: 'color 0.13s',
          }}
            onMouseOver={e => e.currentTarget.style.color = '#DC2626'}
            onMouseOut={e  => e.currentTarget.style.color = '#94A3B8'}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
});

// ── ContextualActions ─────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { label: 'Review extracted data',   msg: 'Show me all the extracted fields and their values.' },
  { label: 'Show missing fields',     msg: 'What information is missing from this complaint?' },
  { label: 'Explain risk',            msg: 'Why was this complaint classified with this severity and risk level?' },
  { label: 'Regenerate CAPA',         msg: 'Can you suggest additional CAPA actions for this complaint?' },
];

const ContextualActions = memo<{ onAction: (msg: string) => void; disabled: boolean }>(({ onAction, disabled }) => (
  <div style={{ marginBottom: 16, animation: 'fadeUp 0.3s ease 0.1s both' }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: '#CBD5E1', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 8 }}>
      Quick questions
    </div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {QUICK_ACTIONS.map(a => (
        <button
          key={a.label}
          onClick={() => onAction(a.msg)}
          disabled={disabled}
          style={{
            padding: '5px 12px', borderRadius: 20,
            border: '1px solid #E2E8F0', background: '#FFFFFF',
            color: '#334155', fontSize: 11.5, fontWeight: 500,
            cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
            transition: 'all 0.13s',
          }}
          onMouseOver={e => { if (!disabled) { e.currentTarget.style.background = '#EEF2FF'; e.currentTarget.style.borderColor = '#C7D2FE'; e.currentTarget.style.color = '#4F46E5'; } }}
          onMouseOut={e  => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#334155'; }}
        >
          {a.label}
        </button>
      ))}
    </div>
  </div>
));

// ── AssistantMessage ──────────────────────────────────────────────────────────

const AssistantMessage = memo<{ content: string }>(({ content }) => (
  <div style={{ marginBottom: 18, animation: 'fadeUp 0.2s ease' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        background: 'linear-gradient(135deg, #EEF2FF, #F5F3FF)',
        border: '1.5px solid #C7D2FE', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9,
        color: '#4F46E5', fontWeight: 800,
      }}>✦</div>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: '#4F46E5' }}>AIVOA Copilot</span>
    </div>
    <div style={{
      background: '#FFFFFF', border: '1px solid #E2E8F0',
      borderRadius: '4px 16px 16px 16px',
      padding: '11px 14px', fontSize: 13, color: '#0F172A', lineHeight: 1.6,
      maxWidth: '88%', wordBreak: 'break-word',
      boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
    }}>
      {content}
    </div>
  </div>
));

// ── GeminiComposer ────────────────────────────────────────────────────────────

interface GeminiComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onFileAttach: (file: File) => void;
  attachedFile: File | null;
  onFileRemove: () => void;
  disabled: boolean;
  isAfterAnalysis: boolean;
}

const GeminiComposer = memo<GeminiComposerProps>(({
  value, onChange, onSubmit, onFileAttach, attachedFile, onFileRemove,
  disabled, isAfterAnalysis,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused]   = useState(false);
  const [dragging, setDragging] = useState(false);

  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
  }, [value]);

  const hasInput  = value.trim() || attachedFile;
  const btnActive = !disabled && !!hasInput;
  const charCount = value.length;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (btnActive) onSubmit();
    }
  };

  const handleFile = (file: File) => {
    const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
    if (!ACCEPTED_EXT.includes(ext)) return;
    if (file.size > 10 * 1024 * 1024) return;
    onFileAttach(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    if (disabled) return;
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  return (
    <div style={{ padding: '6px 12px 10px', flexShrink: 0 }}>
      <div
        onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          borderRadius: 22,
          border: `1.5px solid ${dragging ? '#6366F1' : focused ? '#A5B4FC' : '#E2E8F0'}`,
          background: dragging ? '#EEF2FF' : '#FFFFFF',
          boxShadow: focused
            ? '0 0 0 4px rgba(99,102,241,0.08), 0 2px 10px rgba(15,23,42,0.07)'
            : '0 1px 5px rgba(15,23,42,0.05)',
          transition: 'border-color 0.18s, box-shadow 0.18s',
          overflow: 'hidden',
        }}
      >
        {/* File chip inside composer */}
        {attachedFile && (
          <div style={{ padding: '9px 14px 0' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 10px 4px 8px', borderRadius: 9,
              background: '#EEF2FF', border: '1px solid #C7D2FE',
              fontSize: 12, fontWeight: 600, color: '#1E1B4B',
            }}>
              <span style={{ fontSize: 13 }}>📄</span>
              <span style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {attachedFile.name}
              </span>
              <span style={{ fontSize: 10.5, color: '#6366F1' }}>{fmtSize(attachedFile.size)}</span>
              <button
                onClick={onFileRemove}
                disabled={disabled}
                aria-label="Remove attached file"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#94A3B8', fontSize: 15, lineHeight: 1, padding: 0, marginLeft: 2,
                }}
                onMouseOver={e => e.currentTarget.style.color = '#DC2626'}
                onMouseOut={e => e.currentTarget.style.color = '#94A3B8'}
              >×</button>
            </div>
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={disabled}
          placeholder={
            isAfterAnalysis
              ? 'Ask AIVOA about this complaint…'
              : 'Paste a customer complaint, email, or incident description…'
          }
          aria-label={isAfterAnalysis ? 'Ask AIVOA a follow-up question' : 'Complaint text input'}
          rows={1}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: attachedFile ? '10px 14px 0' : '13px 14px 0',
            border: 'none', outline: 'none', resize: 'none',
            background: 'transparent',
            fontSize: 13.5, fontFamily: 'inherit', color: '#0F172A',
            lineHeight: 1.6, minHeight: 44, maxHeight: 140,
            overflow: 'auto', caretColor: '#4F46E5',
          }}
        />

        {/* Bottom toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '5px 10px 8px',
        }}>
          {/* Left: attachment */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="file"
              accept={ACCEPTED_EXT.join(',')}
              style={{ display: 'none' }}
              id="gemini-file-input"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
              aria-label="Attach complaint document"
              disabled={disabled}
            />
            <label
              htmlFor="gemini-file-input"
              title={`Attach file (${Object.values(FILE_LABEL_MAP).join(', ')})`}
              aria-label="Attach complaint document"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 30, height: 30, borderRadius: 8,
                cursor: disabled ? 'not-allowed' : 'pointer',
                color: '#CBD5E1', fontSize: 16, transition: 'all 0.13s',
                userSelect: 'none',
              }}
              onMouseOver={e => { if (!disabled) (e.currentTarget as HTMLElement).style.color = '#4F46E5'; }}
              onMouseOut={e  => { if (!disabled) (e.currentTarget as HTMLElement).style.color = '#CBD5E1'; }}
            >
              📎
            </label>
            {!isAfterAnalysis && !attachedFile && (
              <span style={{ fontSize: 10, color: '#E2E8F0', fontWeight: 500 }}>
                PDF · DOCX · TXT · EML
              </span>
            )}
          </div>

          {/* Right: char count + send button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {charCount > 50 && !isAfterAnalysis && (
              <span style={{
                fontSize: 10, color: charCount > 3000 ? '#DC2626' : '#CBD5E1',
                fontWeight: 500, transition: 'color 0.15s',
              }}>
                {charCount.toLocaleString()}
              </span>
            )}
            <button
              onClick={onSubmit}
              disabled={!btnActive}
              aria-label={isAfterAnalysis ? 'Send question' : 'Analyze complaint'}
              title={`${isAfterAnalysis ? 'Ask' : 'Analyze'} (Ctrl+Enter)`}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                height: 34,
                padding: hasInput ? '0 14px' : '0',
                width: hasInput ? 'auto' : 34,
                minWidth: 34,
                borderRadius: hasInput ? 20 : '50%',
                background: btnActive
                  ? 'linear-gradient(135deg, #4F46E5, #7C3AED)'
                  : '#F1F5F9',
                color: btnActive ? '#FFFFFF' : '#CBD5E1',
                border: 'none', cursor: btnActive ? 'pointer' : 'not-allowed',
                fontSize: 12.5, fontWeight: 700,
                transition: 'all 0.18s',
                boxShadow: btnActive ? '0 2px 8px rgba(99,102,241,0.35)' : 'none',
              }}
              onMouseOver={e => { if (btnActive) e.currentTarget.style.background = 'linear-gradient(135deg, #4338CA, #6D28D9)'; }}
              onMouseOut={e  => { if (btnActive) e.currentTarget.style.background = 'linear-gradient(135deg, #4F46E5, #7C3AED)'; }}
            >
              {disabled ? (
                <span style={{
                  width: 13, height: 13, borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#FFFFFF',
                  display: 'block', animation: 'spin 0.65s linear infinite',
                }} />
              ) : (
                <>
                  <span style={{ fontSize: hasInput ? 11 : 13 }}>✦</span>
                  {hasInput && <span>{isAfterAnalysis ? 'Ask' : 'Analyze'}</span>}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Hint */}
      <div style={{ textAlign: 'center', fontSize: 10, color: '#E2E8F0', marginTop: 5 }}>
        <kbd style={{
          padding: '1px 4px', borderRadius: 3, fontSize: 9.5,
          background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#94A3B8',
        }}>Ctrl+Enter</kbd>
        {' '}to {isAfterAnalysis ? 'send' : 'analyze'}
      </div>
    </div>
  );
});

// ── CopilotPanel (root) ───────────────────────────────────────────────────────

const CopilotPanel: React.FC = () => {
  const dispatch = useAppDispatch();
  const {
    draft, analysis, duplicates, extractionStatus, progress,
    error, aiStatus, aiPopulatedFields, chatMessages,
  } = useAppSelector(s => s.complaints);

  const [inputText,      setInputText]  = useState('');
  const [attachedFile,   setAttached]   = useState<File | null>(null);
  const [submittedText,  setSubmitted]  = useState<string>('');
  const [submittedFile,  setSubFile]    = useState<{ name: string; size: number } | null>(null);
  const [submittedTime,  setSubTime]    = useState<Date>(new Date());
  const [conflicts,      setConflicts]  = useState<ConflictItem[]>([]);
  const [pendingConflicts, setPending]  = useState<ConflictItem[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { dispatch(fetchAIStatus()); }, [dispatch]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [extractionStatus, chatMessages.length]);

  const isProcessing    = !['idle', 'ready', 'error'].includes(extractionStatus);
  const isReady         = extractionStatus === 'ready' && !!analysis;
  const isIdle          = extractionStatus === 'idle';
  const isAfterAnalysis = isReady;
  const hasConversation = !!(submittedText || submittedFile);
  const isOnline        = !!aiStatus?.groq_available;

  const handleSubmit = useCallback(() => {
    if (isProcessing) return;
    const now = new Date();
    if (attachedFile) {
      setSubFile({ name: attachedFile.name, size: attachedFile.size });
      setSubmitted(''); setSubTime(now);
      dispatch(analyzeComplaintFile(attachedFile));
    } else if (inputText.trim()) {
      setSubmitted(inputText.trim()); setSubFile(null); setSubTime(now);
      if (isAfterAnalysis) {
        dispatch(sendChatCorrection({ message: inputText.trim(), draft }));
      } else {
        dispatch(analyzeComplaintText({ text: inputText.trim(), fileName: 'user_input.txt' }));
      }
    }
    setInputText(''); setAttached(null);
  }, [dispatch, inputText, attachedFile, isProcessing, isAfterAnalysis, draft]);

  const handleQuickAction = useCallback((msg: string) => {
    if (isProcessing) return;
    setSubmitted(msg); setSubFile(null); setSubTime(new Date());
    dispatch(sendChatCorrection({ message: msg, draft }));
    setInputText('');
  }, [dispatch, draft, isProcessing]);

  const handleApplyToForm = useCallback(() => {
    if (!analysis) return;
    const ef = analysis.extracted_fields ?? {};
    const conflictsFound: ConflictItem[] = [];
    const safeApply: Record<string, string> = {};
    for (const [src, dstKey] of Object.entries(FIELD_MAP)) {
      const aiVal = ef[src];
      if (aiVal === null || aiVal === undefined || aiVal === '') continue;
      const aiStr      = String(aiVal);
      const currentVal = String((draft as any)[dstKey] ?? '');
      if (currentVal && currentVal !== aiStr) {
        conflictsFound.push({ field: dstKey, label: dstKey, currentValue: currentVal, aiValue: aiStr });
      } else {
        safeApply[dstKey] = aiStr;
      }
    }
    for (const [field, val] of Object.entries(safeApply)) dispatch(updateFieldManually({ field, value: val }));
    if (conflictsFound.length > 0) { setPending(conflictsFound); setConflicts([conflictsFound[0]]); }
  }, [analysis, draft, dispatch]);

  const handleResolveConflict = (field: string, choice: 'keep' | 'use-ai') => {
    const item = pendingConflicts.find(c => c.field === field);
    if (!item) return;
    if (choice === 'use-ai') dispatch(updateFieldManually({ field, value: item.aiValue }));
    const remaining = pendingConflicts.filter(c => c.field !== field);
    setPending(remaining);
    setConflicts(remaining.length > 0 ? [remaining[0]] : []);
  };

  const handleClear = () => {
    dispatch(resetDraft());
    setInputText(''); setAttached(null);
    setSubmitted(''); setSubFile(null);
    setConflicts([]); setPending([]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F8FAFC' }}>

      {conflicts.length > 0 && (
        <ConflictDialog
          conflicts={conflicts}
          onResolve={handleResolveConflict}
          onDone={() => setConflicts([])}
        />
      )}

      {/* ── Sticky Header ─────────────────────────────────────────────── */}
      <div style={{
        padding: '11px 16px', background: '#FFFFFF',
        borderBottom: '1px solid #E2E8F0', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 16, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.4px',
          }}>
            <span style={{
              background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontSize: 14,
            }}>✦</span>
            AIVOA Copilot
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
            AI-powered complaint intelligence
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: isOnline ? '#34D399' : '#FCD34D',
              display: 'block',
              animation: isOnline ? 'pulse-dot 2.5s ease-in-out infinite' : 'none',
            }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: isOnline ? '#059669' : '#B45309' }}>
              {isOnline ? 'Online' : 'Demo'}
            </span>
          </div>
          <div style={{
            padding: '2px 8px', borderRadius: 5,
            fontSize: 10, fontWeight: 600,
            background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0',
          }}>
            Groq · Llama 3.3 70B
          </div>
        </div>
      </div>

      {/* ── Scrollable conversation ────────────────────────────────────── */}
      <div
        style={{ flex: 1, overflowY: 'auto', padding: '16px 14px 8px' }}
        aria-live="polite"
        aria-label="AIVOA Copilot conversation"
      >
        {!hasConversation && isIdle && <EmptyState />}

        {(submittedText || submittedFile) && (
          <UserMessage
            text={submittedText}
            file={submittedFile}
            time={submittedTime}
          />
        )}

        {isProcessing && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #EEF2FF, #F5F3FF)',
                border: '1.5px solid #C7D2FE',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#4F46E5', fontWeight: 800,
              }}>✦</div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#4F46E5' }}>AIVOA Copilot</span>
              <LoadingDots />
            </div>
            <AnalysisProgress status={extractionStatus} progress={progress} error={null} />
          </>
        )}

        {extractionStatus === 'error' && (
          <AnalysisProgress status="error" progress={0} error={error} />
        )}

        {isReady && analysis && (
          <AIResultCard
            analysis={analysis}
            duplicates={duplicates}
            aiPopulatedFields={aiPopulatedFields}
            onApplyToForm={handleApplyToForm}
            onClear={handleClear}
          />
        )}

        {isReady && (
          <ContextualActions onAction={handleQuickAction} disabled={isProcessing} />
        )}

        {chatMessages
          .filter(m => m.role === 'assistant')
          .slice(-4)
          .map(m => <AssistantMessage key={m.id} content={m.content} />)
        }

        <div ref={scrollRef} />
      </div>

      {/* ── Sticky Gemini Composer ─────────────────────────────────────── */}
      <GeminiComposer
        value={inputText}
        onChange={setInputText}
        onSubmit={handleSubmit}
        onFileAttach={setAttached}
        attachedFile={attachedFile}
        onFileRemove={() => setAttached(null)}
        disabled={isProcessing}
        isAfterAnalysis={isAfterAnalysis}
      />
    </div>
  );
};

export default CopilotPanel;
