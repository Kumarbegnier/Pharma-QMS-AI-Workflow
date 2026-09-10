import React from 'react';
import type { ExtractionStatus } from '../../features/complaints/types';

/* ── Step status mapping ────────────────────────────────────────────────── */
// Each pipeline step maps from one or more ExtractionStatus values
type StepState = 'pending' | 'active' | 'done';

function getStepState(
  stepStatuses: ExtractionStatus[],
  doneStatuses: ExtractionStatus[],
  current: ExtractionStatus,
): StepState {
  if (doneStatuses.includes(current)) return 'done';
  if (stepStatuses.includes(current)) return 'active';
  // Check if current is beyond this step in the pipeline order
  const ORDER: ExtractionStatus[] = [
    'parsing', 'extracting', 'validating', 'assessing', 'generating', 'checking_duplicates', 'ready',
  ];
  const stepIdx = Math.max(...stepStatuses.map(s => ORDER.indexOf(s)));
  const currentIdx = ORDER.indexOf(current);
  if (currentIdx > stepIdx) return 'done';
  return 'pending';
}

/* ── Individual Step ────────────────────────────────────────────────────── */
interface StepProps {
  label: string;
  sublabel: string;
  state: StepState;
  color: string;
}

const Step: React.FC<StepProps> = ({ label, sublabel, state, color }) => {
  const isDone   = state === 'done';
  const isActive = state === 'active';

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      opacity: state === 'pending' ? 0.45 : 1,
      transition: 'opacity 0.3s',
    }}>
      {/* Icon */}
      <div style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 800,
        background: isDone ? '#F0FDF4' : isActive ? color + '18' : '#F1F5F9',
        border: `1.5px solid ${isDone ? '#BBF7D0' : isActive ? color : '#CBD5E1'}`,
        color: isDone ? '#16A34A' : isActive ? color : '#94A3B8',
        transition: 'all 0.25s',
      }}>
        {isDone ? '✓' : isActive ? <span className="spinner spinner-dark"
          style={{ width: 9, height: 9, border: `1.5px solid ${color}33`, borderTopColor: color }} /> : '○'}
      </div>

      {/* Labels */}
      <div style={{ flex: 1, paddingTop: 1 }}>
        <div style={{
          fontSize: 12, fontWeight: isActive ? 700 : 600,
          color: isDone ? '#059669' : isActive ? '#0F172A' : '#64748B',
          transition: 'color 0.25s',
        }}>
          {label}
        </div>
        <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 1 }}>
          {sublabel}
        </div>
      </div>
    </div>
  );
};

/* ── ExtractionStep ─────────────────────────────────────────────────────── */
export const ExtractionStep: React.FC<{ status: ExtractionStatus }> = ({ status }) => (
  <Step
    label="Extracting complaint fields"
    sublabel="Product, batch, customer, dates, category"
    state={getStepState(
      ['parsing', 'extracting', 'validating'],
      ['assessing', 'generating', 'checking_duplicates', 'ready'],
      status,
    )}
    color="#2563EB"
  />
);

/* ── RiskStep ───────────────────────────────────────────────────────────── */
export const RiskStep: React.FC<{ status: ExtractionStatus }> = ({ status }) => (
  <Step
    label="Assessing quality risk"
    sublabel="Severity, risk level, patient safety impact"
    state={getStepState(
      ['assessing'],
      ['generating', 'checking_duplicates', 'ready'],
      status,
    )}
    color="#D97706"
  />
);

/* ── RCAStep ────────────────────────────────────────────────────────────── */
export const RCAStep: React.FC<{ status: ExtractionStatus }> = ({ status }) => (
  <Step
    label="Root cause analysis"
    sublabel="Possible causes, recommended CAPA actions"
    state={getStepState(
      ['generating'],
      ['checking_duplicates', 'ready'],
      status,
    )}
    color="#7C3AED"
  />
);

/* ── DuplicateStep ──────────────────────────────────────────────────────── */
export const DuplicateStep: React.FC<{ status: ExtractionStatus }> = ({ status }) => (
  <Step
    label="Identifying similar complaints"
    sublabel="Batch, product, category similarity check"
    state={getStepState(
      ['checking_duplicates'],
      ['ready'],
      status,
    )}
    color="#0284C7"
  />
);

/* ── AIAnalysisProgress (container) ────────────────────────────────────── */
interface AIAnalysisProgressProps {
  status: ExtractionStatus;
  progress: number;
}

const AIAnalysisProgress: React.FC<AIAnalysisProgressProps> = ({ status, progress }) => {
  if (status === 'idle' || status === 'ready' || status === 'error') return null;

  return (
    <div style={{
      padding: '12px 14px',
      background: '#F0F7FF',
      borderTop: '1px solid #DBEAFE',
      borderBottom: '1px solid #DBEAFE',
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: '#1D4ED8',
          textTransform: 'uppercase', letterSpacing: '0.5px',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span className="spinner spinner-dark"
            style={{ width: 11, height: 11, border: '1.5px solid #BFDBFE', borderTopColor: '#2563EB' }} />
          Analyzing complaint
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#2563EB' }}>
          {Math.round(progress)}%
        </span>
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <ExtractionStep status={status} />
        <RiskStep       status={status} />
        <RCAStep        status={status} />
        <DuplicateStep  status={status} />
      </div>

      {/* Progress bar */}
      <div style={{
        height: 3, background: 'rgba(59,130,246,0.15)',
        borderRadius: 2, marginTop: 12, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', background: '#2563EB', borderRadius: 2,
          width: `${progress}%`, transition: 'width 0.4s ease',
        }} />
      </div>
    </div>
  );
};

export default AIAnalysisProgress;
