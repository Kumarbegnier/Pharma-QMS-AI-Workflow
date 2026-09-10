import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  analyzeComplaintText, analyzeComplaintFile,
  updateFieldManually, resetDraft, fetchAIStatus,
} from '../../features/complaints/complaintsSlice';
import type { ComplaintDraft } from '../../features/complaints/types';

import WorkflowIndicator from './WorkflowIndicator';
import FileAttachment    from './FileAttachment';
import QuickExamples     from './QuickExamples';
import AnalysisProgress  from './AnalysisProgress';
import AnalysisResult    from './AnalysisResult';
import ConflictDialog    from './ConflictDialog';
import type { ConflictItem } from './ConflictDialog';

// ── AI Capabilities collapsible ───────────────────────────────────────────────

const CAPABILITIES = [
  'Product name and strength',
  'Batch / Lot information',
  'Complaint category',
  'Missing information detection',
  'ICH Q9 risk and severity',
  'Possible root causes',
  'CAPA recommendations',
  'Potential duplicate complaints',
];

const AICapabilities: React.FC = () => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 2 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 11.5, fontWeight: 600, color: '#64748B',
        }}
        aria-expanded={open}
      >
        <span style={{ fontSize: 10, color: '#4F46E5' }}>{open ? '▾' : '▸'}</span>
        What will AIVOA analyze?
      </button>
      {open && (
        <div style={{
          marginTop: 8, padding: '10px 12px',
          background: '#EEF2FF', border: '1px solid #C7D2FE',
          borderRadius: 8,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {CAPABILITIES.map(c => (
              <div key={c} style={{
                display: 'flex', alignItems: 'flex-start', gap: 7,
                fontSize: 12, color: '#312E81',
              }}>
                <span style={{ color: '#4F46E5', flexShrink: 0, marginTop: 1 }}>✓</span>
                {c}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── FIELD MAP: extracted_fields keys → draft keys ────────────────────────────
// This is the same map used in the Redux slice fulfilled handler.
const FIELD_MAP: Record<string, keyof ComplaintDraft> = {
  source:                      'source',
  customer_name:               'customer_name',
  customer_type:               'customer_type',
  reporter_contact:            'reporter_contact',
  product_type:                'product_type',
  product_name:                'product_name',
  strength_or_grade:           'strength_or_grade',
  batch_number:                'batch_number',
  affected_quantity:           'affected_quantity',
  manufacturing_date:          'manufacturing_date',
  expiry_date:                 'expiry_date',
  complaint_category:          'complaint_category',
  complaint_date:              'complaint_date',
  complaint_description:       'complaint_description',
  originating_site_block:      'originating_site_block',
  impacted_non_product_material: 'impacted_non_product_material',
};

// ── CopilotPanel ─────────────────────────────────────────────────────────────

const CopilotPanel: React.FC = () => {
  const dispatch = useAppDispatch();
  const {
    draft, analysis, duplicates, extractionStatus, progress,
    error, aiStatus, aiPopulatedFields,
  } = useAppSelector(s => s.complaints);

  const [inputText, setInputText]     = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);

  // Conflict dialog state
  const [conflicts, setConflicts]         = useState<ConflictItem[]>([]);
  const [pendingConflicts, setPending]    = useState<ConflictItem[]>([]);
  const [resolvedValues, setResolved]     = useState<Record<string, string>>({});

  const welcomeFired = useRef(false);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);

  // Fetch AI status on mount
  useEffect(() => { dispatch(fetchAIStatus()); }, [dispatch]);

  const isProcessing    = !['idle', 'ready', 'error'].includes(extractionStatus);
  const isReady         = extractionStatus === 'ready' && !!analysis;
  const isIdle          = extractionStatus === 'idle';

  // ── Analyze handler ───────────────────────────────────────────────────────
  const handleAnalyze = useCallback(() => {
    if (isProcessing) return;
    if (attachedFile) {
      dispatch(analyzeComplaintFile(attachedFile));
    } else if (inputText.trim()) {
      dispatch(analyzeComplaintText({ text: inputText.trim(), fileName: 'user_input.txt' }));
    }
  }, [dispatch, inputText, attachedFile, isProcessing]);

  const btnDisabled = isProcessing || (!inputText.trim() && !attachedFile);

  // Ctrl+Enter shortcut
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!btnDisabled) handleAnalyze();
    }
  };

  // ── Apply to Form — conflict-aware ────────────────────────────────────────
  const handleApplyToForm = useCallback(() => {
    if (!analysis) return;
    const ef = analysis.extracted_fields ?? {};

    const conflictsFound: ConflictItem[] = [];
    const safeApply: Record<string, string> = {};

    for (const [src, dstKey] of Object.entries(FIELD_MAP)) {
      const aiVal = ef[src];
      if (aiVal === null || aiVal === undefined || aiVal === '') continue;
      const aiStr     = String(aiVal);
      const currentVal = String((draft as any)[dstKey] ?? '');

      if (currentVal && currentVal !== aiStr) {
        // User has a value that differs — ask before overwriting
        conflictsFound.push({
          field:        dstKey,
          label:        dstKey,
          currentValue: currentVal,
          aiValue:      aiStr,
        });
      } else {
        safeApply[dstKey] = aiStr;
      }
    }

    // Apply non-conflicting fields immediately
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
    if (choice === 'use-ai') {
      dispatch(updateFieldManually({ field, value: item.aiValue }));
    }
    const remaining = pendingConflicts.filter(c => c.field !== field);
    setPending(remaining);
    setConflicts(remaining.length > 0 ? [remaining[0]] : []);
  };

  // ── Clear ─────────────────────────────────────────────────────────────────
  const handleClear = () => {
    dispatch(resetDraft());
    setInputText('');
    setAttachedFile(null);
    setConflicts([]);
    setPending([]);
  };

  const isOnline = !!aiStatus?.groq_available;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: '#F8FAFC', overflow: 'hidden',
    }}>
      {/* Conflict dialog — rendered outside scroll area */}
      {conflicts.length > 0 && (
        <ConflictDialog
          conflicts={conflicts}
          onResolve={handleResolveConflict}
          onDone={() => setConflicts([])}
        />
      )}

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div style={{
        padding: '11px 16px', background: '#FFFFFF',
        borderBottom: '1px solid #E2E8F0', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{
            fontSize: 16, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.4px',
          }}>
            AIVOA Copilot
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7, marginTop: 3,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: isOnline ? '#34D399' : '#FCD34D',
            }} />
            <span style={{ fontSize: 12, color: isOnline ? '#059669' : '#B45309', fontWeight: 600 }}>
              {isOnline ? 'Online' : 'Demo Mode'}
            </span>
            <span style={{ color: '#E2E8F0', fontSize: 12 }}>·</span>
            <span style={{ fontSize: 11.5, color: '#94A3B8' }}>
              AI-powered complaint intelligence
            </span>
          </div>
        </div>
        {/* Model badge */}
        <div style={{
          padding: '3px 9px', borderRadius: 5,
          fontSize: 10.5, fontWeight: 600,
          background: isOnline ? '#EFF6FF' : '#FFFBEB',
          color: isOnline ? '#1D4ED8' : '#B45309',
          border: `1px solid ${isOnline ? '#BFDBFE' : '#FCD34D'}`,
          whiteSpace: 'nowrap',
        }}>
          {isOnline ? 'Groq · Llama 3.3 70B' : '⚡ Demo Fallback'}
        </div>
      </div>

      {/* ── WORKFLOW INDICATOR ──────────────────────────────────────────── */}
      <WorkflowIndicator />

      {/* ── SCROLLABLE BODY ────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}
        aria-live="polite"
      >

        {/* ── ANALYSIS PROGRESS (while running) ─────────────────────────── */}
        {isProcessing && (
          <AnalysisProgress
            status={extractionStatus}
            progress={progress}
            error={null}
          />
        )}

        {/* ── ERROR ─────────────────────────────────────────────────────── */}
        {extractionStatus === 'error' && (
          <AnalysisProgress
            status="error"
            progress={0}
            error={error}
          />
        )}

        {/* ── ANALYSIS RESULT (after completion) ─────────────────────────── */}
        {isReady && analysis && (
          <AnalysisResult
            analysis={analysis}
            duplicates={duplicates}
            aiPopulatedFields={aiPopulatedFields}
            onApplyToForm={handleApplyToForm}
            onAnalyzeAgain={handleClear}
            onClear={handleClear}
          />
        )}

        {/* ── COMPOSER (shown when idle or after reset) ───────────────────── */}
        {(isIdle || extractionStatus === 'error') && (
          <div style={{
            background: '#FFFFFF', border: '1px solid #E2E8F0',
            borderRadius: 12, padding: '16px', display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            {/* Section title */}
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>
                Analyze a customer complaint
              </div>
              <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 3 }}>
                Paste a customer email, message, complaint, or attach a document.
              </div>
            </div>

            {/* Textarea */}
            <div>
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isProcessing}
                placeholder="Paste a customer complaint, email, customer message, or incident description..."
                aria-label="Complaint text input"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  minHeight: 140, maxHeight: 220,
                  padding: '10px 12px', resize: 'vertical',
                  border: '1px solid #E2E8F0', borderRadius: 8,
                  fontSize: 13, fontFamily: 'inherit', color: '#0F172A',
                  background: '#F8FAFC', outline: 'none', lineHeight: 1.55,
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onFocus={e => { e.target.style.borderColor = '#D97706'; e.target.style.boxShadow = '0 0 0 2.5px rgba(217,119,6,0.14)'; }}
                onBlur={e  => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            {/* File attachment row */}
            <FileAttachment
              attached={attachedFile}
              onAttach={setAttachedFile}
              onRemove={() => setAttachedFile(null)}
              disabled={isProcessing}
            />

            {/* Quick examples */}
            <QuickExamples
              onSelect={text => { setInputText(text); textareaRef.current?.focus(); }}
              disabled={isProcessing}
            />

            {/* AI Capabilities collapsible */}
            <AICapabilities />

            {/* Analyze button */}
            <button
              onClick={handleAnalyze}
              disabled={btnDisabled}
              aria-label="Analyze complaint with AIVOA AI"
              style={{
                width: '100%', height: 42, borderRadius: 8,
                background: btnDisabled ? '#E2E8F0' : '#D97706',
                color: btnDisabled ? '#94A3B8' : '#FFFFFF',
                border: 'none',
                fontSize: 14, fontWeight: 800, cursor: btnDisabled ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'background 0.15s',
                boxShadow: btnDisabled ? 'none' : '0 2px 8px rgba(180,83,9,0.22)',
              }}
              onMouseOver={e => { if (!btnDisabled) e.currentTarget.style.background = '#B45309'; }}
              onMouseOut={e  => { if (!btnDisabled) e.currentTarget.style.background = '#D97706'; }}
            >
              {isProcessing
                ? <><span style={{
                    display: 'block', width: 14, height: 14, borderRadius: '50%',
                    border: '2.5px solid rgba(255,255,255,0.35)', borderTopColor: 'white',
                    animation: 'spin 0.65s linear infinite',
                  }} /> Analyzing…</>
                : '✦ Analyze Complaint'}
            </button>

            {/* Keyboard hint */}
            <div style={{
              textAlign: 'center', fontSize: 11, color: '#94A3B8',
              marginTop: -8,
            }}>
              or press <kbd style={{
                padding: '1px 5px', borderRadius: 3, fontSize: 10.5,
                background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#64748B',
              }}>Ctrl+Enter</kbd> to analyze
            </div>
          </div>
        )}

        {/* After analysis — show small re-analyze prompt */}
        {isReady && (
          <div style={{
            marginTop: 12, padding: '12px 14px',
            background: '#FFFFFF', border: '1px solid #E2E8F0',
            borderRadius: 10,
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 8 }}>
              Need to correct something?
            </div>
            <textarea
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isProcessing}
              placeholder='e.g. "Actually the batch number is BMX240602 and 48 capsules were affected"'
              style={{
                width: '100%', boxSizing: 'border-box',
                minHeight: 64, maxHeight: 120,
                padding: '8px 11px', resize: 'vertical',
                border: '1px solid #E2E8F0', borderRadius: 7,
                fontSize: 12.5, fontFamily: 'inherit', color: '#0F172A',
                background: '#F8FAFC', outline: 'none', lineHeight: 1.5,
              }}
              onFocus={e => { e.target.style.borderColor = '#D97706'; }}
              onBlur={e  => { e.target.style.borderColor = '#E2E8F0'; }}
            />
            <button
              onClick={handleAnalyze}
              disabled={!inputText.trim() || isProcessing}
              style={{
                marginTop: 8, width: '100%', height: 36, borderRadius: 7,
                background: !inputText.trim() ? '#F1F5F9' : '#0F172A',
                color: !inputText.trim() ? '#94A3B8' : '#FFFFFF',
                border: 'none', fontSize: 12.5, fontWeight: 700, cursor: !inputText.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              Re-analyze with correction
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CopilotPanel;
