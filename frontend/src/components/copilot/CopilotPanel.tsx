/**
 * AIVOA Copilot — Gemini-style conversational AI interface
 *
 * Layout:
 *   ┌─ Sticky Header (AIVOA Copilot · status · model badge)
 *   ├─ Scrollable Conversation
 *   │    ├── EmptyState   (when idle, vertically centered)
 *   │    ├── UserMessage  (after submission)
 *   │    ├── AnalysisProgress (while running)
 *   │    ├── AIResult     (after analysis)
 *   │    └── ContextualActions (post-analysis quick actions)
 *   └─ Sticky Composer (Gemini-style rounded input box)
 *
 * Backend integration:
 *   POST /api/ai/intake/text  → analyzeComplaintText thunk
 *   POST /api/ai/intake/file  → analyzeComplaintFile thunk
 *   POST /api/ai/chat         → sendChatCorrection thunk
 *   Redux: extractionStatus, analysis, aiPopulatedFields, draft, duplicates
 *
 * Removed: WorkflowIndicator chips, QuickExamples, AICapabilities accordion,
 *          large separate Analyze button, big upload card
 */

import React, {
  useRef, useState, useEffect, useCallback, useLayoutEffect,
} from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  analyzeComplaintText,
  analyzeComplaintFile,
  sendChatCorrection,
  updateFieldManually,
  resetDraft,
  fetchAIStatus,
  setExtractionStatus,
} from '../../features/complaints/complaintsSlice';
import type { AIAnalysis, ComplaintDraft, DuplicateMatch } from '../../features/complaints/types';
import AnalysisProgress from './AnalysisProgress';
import ConflictDialog   from './ConflictDialog';
import type { ConflictItem } from './ConflictDialog';

// ── Constants ────────────────────────────────────────────────────────────────

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

// ── Severity / risk style helpers ─────────────────────────────────────────────

function sevColor(s: string) {
  if (s === 'Critical') return { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' };
  if (s === 'Major')    return { color: '#D97706', bg: '#FFFBEB', border: '#FCD34D' };
  if (s === 'Minor')    return { color: '#0284C7', bg: '#F0F9FF', border: '#BAE6FD' };
  return                       { color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' };
}
function riskColor(r: string) {
  if (r === 'High')   return { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' };
  if (r === 'Medium') return { color: '#D97706', bg: '#FFFBEB', border: '#FCD34D' };
  return                     { color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' };
}

function Pill({ label, c }: { label: string; c: { color: string; bg: string; border: string } }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 9px', borderRadius: 4, fontSize: 11.5, fontWeight: 700,
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
    }}>
      {label}
    </span>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

const EmptyState: React.FC = () => (
  <div style={{
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '40px 24px', textAlign: 'center',
    minHeight: 220,
  }}>
    <div style={{
      fontSize: 28, marginBottom: 14,
      background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
      filter: 'drop-shadow(0 1px 2px rgba(79,70,229,0.15))',
    }}>
      ✦
    </div>
    <div style={{
      fontSize: 17, fontWeight: 700, color: '#0F172A',
      letterSpacing: '-0.3px', marginBottom: 8,
    }}>
      How can I help with this complaint?
    </div>
    <div style={{
      fontSize: 13, color: '#64748B', lineHeight: 1.6, maxWidth: 280,
    }}>
      Paste a customer complaint, email, message, or upload a document.
      AIVOA will extract the relevant QMS information and analyze the complaint.
    </div>
  </div>
);

// ── UserMessage ───────────────────────────────────────────────────────────────

interface UserMessageProps {
  text: string;
  file: { name: string; size: number } | null;
}

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

const UserMessage: React.FC<UserMessageProps> = ({ text, file }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginBottom: 16 }}>
    <div style={{
      fontSize: 10.5, fontWeight: 700, color: '#94A3B8',
      textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 5,
    }}>
      You
    </div>
    <div style={{
      maxWidth: '85%', background: '#0F172A', color: '#FFFFFF',
      borderRadius: '16px 16px 4px 16px',
      padding: '10px 14px', fontSize: 13, lineHeight: 1.55,
      wordBreak: 'break-word',
    }}>
      {file && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 8px', borderRadius: 6,
          background: 'rgba(255,255,255,0.12)', marginBottom: text ? 6 : 0,
          fontSize: 12, fontWeight: 600,
        }}>
          <span>📄</span>{file.name}
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10.5 }}>
            {fmtSize(file.size)}
          </span>
        </div>
      )}
      {text && (
        <div style={{ fontSize: 13, lineHeight: 1.55 }}>
          {text.length > 280 ? text.slice(0, 280) + '…' : text}
        </div>
      )}
    </div>
  </div>
);

// ── AIResultCard ──────────────────────────────────────────────────────────────
// Maps ONLY real backend fields. No invented values.

interface AIResultCardProps {
  analysis: AIAnalysis;
  duplicates: DuplicateMatch[];
  aiPopulatedFields: string[];
  onApplyToForm: () => void;
  onClear: () => void;
}

const AIResultCard: React.FC<AIResultCardProps> = ({
  analysis, duplicates, aiPopulatedFields, onApplyToForm, onClear,
}) => {
  const [rcaOpen,  setRcaOpen]  = useState(true);
  const [capaOpen, setCapaOpen] = useState(true);
  const ef = analysis.extracted_fields ?? {};
  const fc = analysis.field_confidence  ?? {};
  const completeness = Math.round((analysis.completeness_score ?? 0) * 100);
  const reviewFields  = Object.entries(fc).filter(([, v]) => v.confidence < 0.75);

  return (
    <div style={{ marginBottom: 16, animation: 'fadeUp 0.22s ease' }}>
      {/* AI header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
      }}>
        <span style={{
          fontSize: 14,
          background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>✦</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#4F46E5' }}>AIVOA Copilot</span>
      </div>

      {/* Card */}
      <div style={{
        background: '#FFFFFF', borderRadius: 16,
        border: '1px solid #E2E8F0',
        overflow: 'hidden',
      }}>
        {/* Complete header */}
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid #F1F5F9',
          background: 'linear-gradient(135deg, #F8FAFC, #FFFFFF)',
        }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', marginBottom: 2 }}>
            Analysis complete
          </div>
          <div style={{ fontSize: 12, color: '#64748B' }}>
            I extracted the following information from the complaint.
          </div>
        </div>

        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── Product & Complaint Info ──── */}
          {(ef.product_name || ef.batch_number || ef.customer_name || ef.complaint_category) && (
            <div>
              <div style={{
                fontSize: 9.5, fontWeight: 800, color: '#94A3B8',
                textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10,
              }}>
                Extracted Information
              </div>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr',
                gap: '8px 12px',
              }}>
                {ef.product_name && (
                  <div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>Product</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{ef.product_name}</div>
                    {ef.strength_or_grade && <div style={{ fontSize: 11.5, color: '#64748B' }}>{ef.strength_or_grade}</div>}
                  </div>
                )}
                {ef.batch_number && (
                  <div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>Batch</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', fontFamily: 'JetBrains Mono, monospace' }}>{ef.batch_number}</div>
                  </div>
                )}
                {ef.customer_name && (
                  <div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>Customer</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{ef.customer_name}</div>
                  </div>
                )}
                {ef.complaint_category && (
                  <div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>Complaint</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{ef.complaint_category}</div>
                  </div>
                )}
                {ef.affected_quantity && (
                  <div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>Quantity</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{ef.affected_quantity}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Divider */}
          <div style={{ height: 1, background: '#F1F5F9' }} />

          {/* ── Risk Assessment ──── */}
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10 }}>
              Risk Assessment
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {analysis.suggested_severity && (
                <div>
                  <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, marginBottom: 4 }}>Severity</div>
                  <Pill label={analysis.suggested_severity} c={sevColor(analysis.suggested_severity)} />
                </div>
              )}
              {analysis.suggested_risk && (
                <div>
                  <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, marginBottom: 4 }}>Risk Level</div>
                  <Pill label={analysis.suggested_risk} c={riskColor(analysis.suggested_risk)} />
                </div>
              )}
              {analysis.completeness_score !== undefined && (
                <div>
                  <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, marginBottom: 4 }}>Completeness</div>
                  <div style={{
                    fontSize: 14, fontWeight: 800,
                    color: completeness >= 80 ? '#16A34A' : completeness >= 55 ? '#D97706' : '#DC2626',
                  }}>
                    {completeness}%
                  </div>
                </div>
              )}
              <div>
                <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, marginBottom: 4 }}>Fields</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#4F46E5' }}>
                  {aiPopulatedFields.length}
                </div>
              </div>
            </div>
          </div>

          {/* ── AI Insights ──── */}
          {(analysis.possible_root_causes?.length > 0 || analysis.recommended_capa?.length > 0 || analysis.suggested_next_action) && (
            <>
              <div style={{ height: 1, background: '#F1F5F9' }} />
              <div>
                <div style={{ fontSize: 9.5, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10 }}>
                  AI Insight
                </div>

                {analysis.suggested_next_action && (
                  <div style={{
                    padding: '8px 10px', background: '#EEF2FF',
                    borderLeft: '2.5px solid #6366F1', borderRadius: '0 8px 8px 0',
                    fontSize: 12.5, color: '#1E1B4B', lineHeight: 1.55, marginBottom: 10,
                  }}>
                    {analysis.suggested_next_action}
                  </div>
                )}

                {analysis.possible_root_causes?.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <button onClick={() => setRcaOpen(v => !v)} style={{
                      background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                      fontSize: 12, fontWeight: 700, color: '#334155',
                      display: 'flex', alignItems: 'center', gap: 5, marginBottom: rcaOpen ? 7 : 0,
                    }}>
                      <span style={{ fontSize: 9 }}>{rcaOpen ? '▾' : '▸'}</span>
                      Possible Root Cause ({analysis.possible_root_causes.length})
                    </button>
                    {rcaOpen && analysis.possible_root_causes.map((c, i) => (
                      <div key={i} style={{
                        fontSize: 12, color: '#334155', padding: '5px 9px 5px 14px',
                        borderLeft: '2px solid #E2E8F0', lineHeight: 1.5, marginBottom: 3,
                      }}>
                        {c}
                      </div>
                    ))}
                  </div>
                )}

                {analysis.recommended_capa?.length > 0 && (
                  <div>
                    <button onClick={() => setCapaOpen(v => !v)} style={{
                      background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                      fontSize: 12, fontWeight: 700, color: '#334155',
                      display: 'flex', alignItems: 'center', gap: 5, marginBottom: capaOpen ? 7 : 0,
                    }}>
                      <span style={{ fontSize: 9 }}>{capaOpen ? '▾' : '▸'}</span>
                      Suggested CAPA ({analysis.recommended_capa.length})
                    </button>
                    {capaOpen && analysis.recommended_capa.map((c, i) => (
                      <div key={i} style={{
                        fontSize: 12, color: '#15803D', padding: '5px 9px 5px 14px',
                        borderLeft: '2px solid #BBF7D0', lineHeight: 1.5, marginBottom: 3,
                      }}>
                        {c}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Potential Duplicates ──── */}
          {duplicates?.length > 0 && (
            <>
              <div style={{ height: 1, background: '#F1F5F9' }} />
              <div style={{
                padding: '8px 10px', background: '#FFFBEB',
                border: '1px solid #FCD34D', borderRadius: 8,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E', marginBottom: 6 }}>
                  ⚠ Potential Duplicate Complaint
                </div>
                {duplicates.slice(0, 2).map((d, i) => (
                  <div key={i} style={{ fontSize: 11.5, color: '#B45309', lineHeight: 1.6 }}>
                    <strong>{d.complaint_number}</strong> — {d.product_name} / {d.batch_number}
                    {' · '}<strong>{Math.round(d.similarity_score * 100)}% similar</strong>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Low-confidence fields ──── */}
          {reviewFields.length > 0 && (
            <>
              <div style={{ height: 1, background: '#F1F5F9' }} />
              <div style={{
                padding: '8px 10px', background: '#FFFBEB',
                border: '1px solid #FCD34D', borderRadius: 8,
              }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#92400E', marginBottom: 6 }}>
                  ⚠ Review Required — AI is less confident on {reviewFields.length} field{reviewFields.length > 1 ? 's' : ''}
                </div>
                {reviewFields.slice(0, 3).map(([field, fc]) => (
                  <div key={field} style={{ fontSize: 11.5, color: '#B45309', marginBottom: 3 }}>
                    <span style={{ fontWeight: 600 }}>
                      {field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}:
                    </span>{' '}
                    <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{String(fc.value ?? '—')}</span>
                    {' · '}
                    <span style={{ fontSize: 10.5 }}>
                      {fc.confidence < 0.55 ? 'Low' : 'Medium'} confidence
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Primary actions ──── */}
          <div style={{ display: 'flex', gap: 8, paddingTop: 2 }}>
            <button
              onClick={onApplyToForm}
              style={{
                flex: 1, height: 38, borderRadius: 10,
                background: '#0F172A', color: '#FFFFFF',
                border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Apply to Form
            </button>
            <button
              style={{
                flex: 1, height: 38, borderRadius: 10,
                background: '#FFFFFF', color: '#334155',
                border: '1px solid #E2E8F0', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Review &amp; Edit
            </button>
          </div>

          {/* Secondary actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClear} style={{
              flex: 1, height: 30, borderRadius: 8, background: 'transparent',
              color: '#94A3B8', border: '1px solid #E2E8F0',
              fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
            }}>
              Analyze Again
            </button>
            <button onClick={onClear} style={{
              flex: 1, height: 30, borderRadius: 8, background: 'transparent',
              color: '#94A3B8', border: '1px solid #E2E8F0',
              fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
            }}>
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── ContextualActions — shown after analysis ──────────────────────────────────

interface ContextualActionsProps {
  onAction: (msg: string) => void;
  disabled: boolean;
}

const QUICK_ACTIONS = [
  { label: 'Review extracted data',    msg: 'Show me all the extracted fields and their values.' },
  { label: 'Show missing fields',      msg: 'What information is missing from this complaint?' },
  { label: 'Explain risk assessment',  msg: 'Why was this complaint classified with this severity and risk level?' },
  { label: 'Regenerate CAPA',          msg: 'Can you suggest additional CAPA actions for this complaint?' },
];

const ContextualActions: React.FC<ContextualActionsProps> = ({ onAction, disabled }) => (
  <div style={{ marginBottom: 16 }}>
    <div style={{
      fontSize: 10.5, fontWeight: 600, color: '#94A3B8',
      textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8,
    }}>
      Quick questions
    </div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {QUICK_ACTIONS.map(a => (
        <button
          key={a.label}
          onClick={() => onAction(a.msg)}
          disabled={disabled}
          style={{
            padding: '5px 11px', borderRadius: 20,
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
);

// ── ChatMessage (assistant/system follow-ups) ─────────────────────────────────

const AssistantMessage: React.FC<{ content: string }> = ({ content }) => (
  <div style={{ marginBottom: 16 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
      <span style={{
        fontSize: 11,
        background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
      }}>✦</span>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: '#4F46E5' }}>AIVOA Copilot</span>
    </div>
    <div style={{
      background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '4px 16px 16px 16px',
      padding: '10px 14px', fontSize: 13, color: '#0F172A', lineHeight: 1.55,
      maxWidth: '88%', wordBreak: 'break-word',
    }}>
      {content}
    </div>
  </div>
);

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

const GeminiComposer: React.FC<GeminiComposerProps> = ({
  value, onChange, onSubmit, onFileAttach, attachedFile, onFileRemove,
  disabled, isAfterAnalysis,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Auto-grow textarea
  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
  }, [value]);

  const hasInput = value.trim() || attachedFile;
  const btnActive = !disabled && !!hasInput;

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
    <div style={{ padding: '8px 14px 12px', flexShrink: 0 }}>
      <div
        onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          borderRadius: 20,
          border: `1.5px solid ${dragging ? '#6366F1' : focused ? '#CBD5E1' : '#E2E8F0'}`,
          background: dragging ? '#EEF2FF' : '#FFFFFF',
          boxShadow: focused
            ? '0 0 0 3px rgba(99,102,241,0.08), 0 2px 8px rgba(15,23,42,0.06)'
            : '0 1px 4px rgba(15,23,42,0.05)',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          overflow: 'hidden',
        }}
      >
        {/* Attached file chip */}
        {attachedFile && (
          <div style={{ padding: '8px 14px 0' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 10px 4px 8px', borderRadius: 8,
              background: '#EEF2FF', border: '1px solid #C7D2FE',
              fontSize: 12, fontWeight: 600, color: '#1E1B4B',
            }}>
              <span style={{ fontSize: 14 }}>📄</span>
              <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {attachedFile.name}
              </span>
              <span style={{ fontSize: 10.5, color: '#6366F1' }}>{fmtSize(attachedFile.size)}</span>
              <button
                onClick={onFileRemove}
                disabled={disabled}
                aria-label="Remove attached file"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#94A3B8', fontSize: 14, lineHeight: 1, padding: 0, marginLeft: 2,
                }}
                onMouseOver={e => e.currentTarget.style.color = '#DC2626'}
                onMouseOut={e => e.currentTarget.style.color = '#94A3B8'}
              >
                ×
              </button>
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
              ? 'Ask AIVOA about this complaint...'
              : 'Paste a customer complaint, email, message, or incident description...'
          }
          aria-label={isAfterAnalysis ? 'Ask AIVOA a follow-up question' : 'Complaint text input'}
          rows={1}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '12px 14px 0',
            border: 'none', outline: 'none', resize: 'none',
            background: 'transparent',
            fontSize: 13.5, fontFamily: 'inherit', color: '#0F172A',
            lineHeight: 1.55, minHeight: 44, maxHeight: 140,
            overflow: 'auto',
          }}
        />

        {/* Bottom bar: attachment + send */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 10px 8px',
        }}>
          {/* Attachment */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              ref={fileInputRef}
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
              title={`Attach complaint document (${ACCEPTED_EXT.map(e => FILE_LABEL_MAP[e] ?? e).join(', ')})`}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, borderRadius: 8,
                cursor: disabled ? 'not-allowed' : 'pointer',
                color: disabled ? '#CBD5E1' : '#94A3B8',
                transition: 'all 0.13s',
                fontSize: 17,
              }}
              aria-label="Attach file"
              onMouseOver={e => { if (!disabled) (e.target as HTMLElement).style.color = '#4F46E5'; }}
              onMouseOut={e  => { if (!disabled) (e.target as HTMLElement).style.color = '#94A3B8'; }}
            >
              📎
            </label>
            {!isAfterAnalysis && (
              <span style={{ fontSize: 10.5, color: '#CBD5E1', fontWeight: 500 }}>
                PDF · DOCX · TXT · EML
              </span>
            )}
          </div>

          {/* Analyze / Send button */}
          <button
            onClick={onSubmit}
            disabled={!btnActive}
            aria-label={isAfterAnalysis ? 'Send message' : 'Analyze complaint'}
            title="Analyze (Ctrl+Enter)"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              height: 34,
              padding: hasInput ? '0 14px' : '0',
              width: hasInput ? 'auto' : 34,
              borderRadius: hasInput ? 20 : '50%',
              background: btnActive ? '#0F172A' : '#F1F5F9',
              color: btnActive ? '#FFFFFF' : '#CBD5E1',
              border: 'none', cursor: btnActive ? 'pointer' : 'not-allowed',
              fontSize: 13, fontWeight: 700,
              transition: 'all 0.15s',
            }}
            onMouseOver={e => { if (btnActive) e.currentTarget.style.background = '#1E293B'; }}
            onMouseOut={e  => { if (btnActive) e.currentTarget.style.background = '#0F172A'; }}
          >
            {disabled ? (
              <span style={{
                width: 14, height: 14, borderRadius: '50%',
                border: '2px solid rgba(15,23,42,0.2)', borderTopColor: '#0F172A',
                display: 'block', animation: 'spin 0.65s linear infinite',
              }} />
            ) : (
              <>
                <span style={{
                  fontSize: hasInput ? 11 : 14,
                  background: btnActive ? 'none' : 'linear-gradient(135deg, #94A3B8, #CBD5E1)',
                  WebkitBackgroundClip: btnActive ? undefined : 'text',
                  WebkitTextFillColor: btnActive ? '#FFFFFF' : undefined,
                }}>✦</span>
                {hasInput && <span style={{ fontSize: 12.5 }}>
                  {isAfterAnalysis ? 'Ask' : 'Analyze'}
                </span>}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Keyboard hint */}
      <div style={{
        textAlign: 'center', fontSize: 10.5, color: '#CBD5E1', marginTop: 5,
      }}>
        <kbd style={{
          padding: '1px 4px', fontSize: 10, borderRadius: 3,
          background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#94A3B8',
        }}>Ctrl+Enter</kbd>
        {' '}to {isAfterAnalysis ? 'send' : 'analyze'}
      </div>
    </div>
  );
};

// ── LoadingDots ───────────────────────────────────────────────────────────────

const LoadingDots: React.FC = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
    {[0, 1, 2].map(i => (
      <span key={i} style={{
        width: 6, height: 6, borderRadius: '50%', background: '#6366F1',
        display: 'block',
        animation: `pulse-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
      }} />
    ))}
  </div>
);

// ── CopilotPanel (root) ───────────────────────────────────────────────────────

const CopilotPanel: React.FC = () => {
  const dispatch = useAppDispatch();
  const {
    draft, analysis, duplicates, extractionStatus, progress,
    error, aiStatus, aiPopulatedFields, chatMessages,
  } = useAppSelector(s => s.complaints);

  const [inputText, setInputText]       = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [submittedText, setSubmitted]   = useState<string>('');
  const [submittedFile, setSubFile]     = useState<{ name: string; size: number } | null>(null);
  const [conflicts, setConflicts]       = useState<ConflictItem[]>([]);
  const [pendingConflicts, setPending]  = useState<ConflictItem[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { dispatch(fetchAIStatus()); }, [dispatch]);

  // Scroll to bottom on state changes
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [extractionStatus, chatMessages.length]);

  const isProcessing  = !['idle', 'ready', 'error'].includes(extractionStatus);
  const isReady       = extractionStatus === 'ready' && !!analysis;
  const isIdle        = extractionStatus === 'idle';
  const isAfterAnalysis = isReady;
  const hasConversation = !!(submittedText || submittedFile);
  const isOnline      = !!aiStatus?.groq_available;

  // ── Analyze ────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    if (isProcessing) return;
    // Capture what was submitted for UserMessage display
    if (attachedFile) {
      setSubFile({ name: attachedFile.name, size: attachedFile.size });
      setSubmitted('');
      dispatch(analyzeComplaintFile(attachedFile));
    } else if (inputText.trim()) {
      setSubmitted(inputText.trim());
      setSubFile(null);
      if (isAfterAnalysis) {
        dispatch(sendChatCorrection({ message: inputText.trim(), draft }));
      } else {
        dispatch(analyzeComplaintText({ text: inputText.trim(), fileName: 'user_input.txt' }));
      }
    }
    setInputText('');
    setAttachedFile(null);
  }, [dispatch, inputText, attachedFile, isProcessing, isAfterAnalysis, draft]);

  // ── Contextual quick action ───────────────────────────────────────────────
  const handleQuickAction = (msg: string) => {
    if (isProcessing) return;
    setSubmitted(msg);
    setSubFile(null);
    dispatch(sendChatCorrection({ message: msg, draft }));
    setInputText('');
  };

  // ── Apply to Form — conflict-aware ───────────────────────────────────────
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
    for (const [field, val] of Object.entries(safeApply)) {
      dispatch(updateFieldManually({ field, value: val }));
    }
    if (conflictsFound.length > 0) {
      setPending(conflictsFound);
      setConflicts([conflictsFound[0]]);
    }
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
    setInputText(''); setAttachedFile(null);
    setSubmitted(''); setSubFile(null);
    setConflicts([]); setPending([]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F8FAFC' }}>

      {/* Conflict dialog */}
      {conflicts.length > 0 && (
        <ConflictDialog
          conflicts={conflicts}
          onResolve={handleResolveConflict}
          onDone={() => setConflicts([])}
        />
      )}

      {/* ── Sticky Header ──────────────────────────────────────────────── */}
      <div style={{
        padding: '10px 16px', background: '#FFFFFF',
        borderBottom: '1px solid #E2E8F0', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 16, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.3px',
          }}>
            <span style={{
              background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              fontSize: 14,
            }}>✦</span>
            AIVOA Copilot
          </div>
          <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>
            AI-powered complaint intelligence
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: isOnline ? '#34D399' : '#FCD34D',
              display: 'block',
            }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: isOnline ? '#059669' : '#B45309' }}>
              {isOnline ? 'Online' : 'Demo'}
            </span>
          </div>
          <div style={{
            padding: '2px 8px', borderRadius: 4,
            fontSize: 10, fontWeight: 600,
            background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0',
          }}>
            Groq · Llama 3.3 70B
          </div>
        </div>
      </div>

      {/* ── Scrollable conversation ────────────────────────────────────── */}
      <div
        style={{ flex: 1, overflowY: 'auto', padding: '16px 14px 4px' }}
        aria-live="polite"
        aria-label="AIVOA Copilot conversation"
      >
        {/* Empty state — centered when nothing submitted */}
        {!hasConversation && isIdle && (
          <EmptyState />
        )}

        {/* User message — text submission */}
        {submittedText && <UserMessage text={submittedText} file={null} />}
        {submittedFile && !submittedText && <UserMessage text="" file={submittedFile} />}

        {/* Analysis progress */}
        {isProcessing && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
              <span style={{
                fontSize: 11,
                background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>✦</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#4F46E5' }}>AIVOA Copilot</span>
              <LoadingDots />
            </div>
            <AnalysisProgress status={extractionStatus} progress={progress} error={null} />
          </>
        )}

        {/* Error state */}
        {extractionStatus === 'error' && (
          <AnalysisProgress status="error" progress={0} error={error} />
        )}

        {/* AI result */}
        {isReady && analysis && (
          <AIResultCard
            analysis={analysis}
            duplicates={duplicates}
            aiPopulatedFields={aiPopulatedFields}
            onApplyToForm={handleApplyToForm}
            onClear={handleClear}
          />
        )}

        {/* Contextual quick actions after analysis */}
        {isReady && (
          <ContextualActions onAction={handleQuickAction} disabled={isProcessing} />
        )}

        {/* Follow-up chat messages (assistant replies to quick actions) */}
        {chatMessages
          .filter(m => m.role === 'assistant')
          .slice(isReady ? -3 : -5)
          .map(m => <AssistantMessage key={m.id} content={m.content} />)
        }

        <div ref={scrollRef} />
      </div>

      {/* ── Sticky Gemini Composer ─────────────────────────────────────── */}
      <GeminiComposer
        value={inputText}
        onChange={setInputText}
        onSubmit={handleSubmit}
        onFileAttach={setAttachedFile}
        attachedFile={attachedFile}
        onFileRemove={() => setAttachedFile(null)}
        disabled={isProcessing}
        isAfterAnalysis={isAfterAnalysis}
      />
    </div>
  );
};

export default CopilotPanel;
