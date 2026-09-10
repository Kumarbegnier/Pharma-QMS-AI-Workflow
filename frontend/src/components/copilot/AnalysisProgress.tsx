import React from 'react';
import type { ExtractionStatus } from '../../features/complaints/types';

// ── IMPORTANT: The backend uses a SYNCHRONOUS LangGraph invoke (no streaming).
// The frontend animates stage progress via setTimeout loops in the Redux thunk.
// We show an honest single "Analyzing..." indicator with the cosmetic steps.
// Per-node checkmarks appear as the frontend animation advances extractionStatus.

interface StageRowProps {
  label: string;
  sublabel: string;
  state: 'pending' | 'active' | 'completed';
  color: string;
}

const StageRow: React.FC<StageRowProps> = ({ label, sublabel, state, color }) => (
  <div style={{
    display: 'flex', alignItems: 'flex-start', gap: 10,
    opacity: state === 'pending' ? 0.42 : 1,
    transition: 'opacity 0.3s',
  }}>
    {/* State icon */}
    <div style={{
      width: 22, height: 22, borderRadius: '50%', flexShrink: 0, marginTop: 1,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 800,
      background: state === 'completed' ? '#F0FDF4'
                : state === 'active'    ? color + '14'
                : '#F1F5F9',
      border: `1.5px solid ${state === 'completed' ? '#BBF7D0'
                            : state === 'active'    ? color
                            : '#CBD5E1'}`,
      color: state === 'completed' ? '#16A34A'
           : state === 'active'    ? color
           : '#94A3B8',
      transition: 'all 0.25s',
    }}>
      {state === 'completed' ? '✓'
       : state === 'active'
         ? <span style={{
             display: 'block', width: 8, height: 8, borderRadius: '50%',
             border: `2px solid ${color}44`, borderTopColor: color,
             animation: 'spin 0.65s linear infinite',
           }} />
       : '○'}
    </div>

    {/* Text */}
    <div style={{ paddingTop: 1 }}>
      <div style={{
        fontSize: 12.5, fontWeight: state === 'active' ? 700 : 500,
        color: state === 'completed' ? '#059669'
             : state === 'active'    ? '#0F172A'
             : '#94A3B8',
        transition: 'color 0.25s',
      }}>
        {label}
      </div>
      <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 1 }}>{sublabel}</div>
    </div>
  </div>
);

type StageDef = {
  label: string;
  sublabel: string;
  activeWhen: ExtractionStatus[];
  doneWhen: ExtractionStatus[];
  color: string;
};

const PIPELINE_ORDER: ExtractionStatus[] = [
  'parsing', 'extracting', 'validating', 'assessing',
  'generating', 'checking_duplicates', 'ready',
];

const STAGES: StageDef[] = [
  {
    label: 'Parsing complaint',
    sublabel: 'Reading document or text input',
    activeWhen: ['parsing'],
    doneWhen:   ['extracting', 'validating', 'assessing', 'generating', 'checking_duplicates', 'ready'],
    color: '#2563EB',
  },
  {
    label: 'Extracting structured information',
    sublabel: 'Product, batch, customer, dates, category',
    activeWhen: ['extracting'],
    doneWhen:   ['validating', 'assessing', 'generating', 'checking_duplicates', 'ready'],
    color: '#7C3AED',
  },
  {
    label: 'Checking completeness',
    sublabel: 'Missing information, field coverage',
    activeWhen: ['validating'],
    doneWhen:   ['assessing', 'generating', 'checking_duplicates', 'ready'],
    color: '#0284C7',
  },
  {
    label: 'Assessing quality risk',
    sublabel: 'ICH Q9 severity, risk level, patient safety',
    activeWhen: ['assessing'],
    doneWhen:   ['generating', 'checking_duplicates', 'ready'],
    color: '#D97706',
  },
  {
    label: 'Generating RCA suggestions',
    sublabel: 'Possible root causes for the defect',
    activeWhen: ['generating'],
    doneWhen:   ['checking_duplicates', 'ready'],
    color: '#DC2626',
  },
  {
    label: 'Generating CAPA recommendations',
    sublabel: 'Corrective and preventive actions',
    activeWhen: ['generating'],
    doneWhen:   ['checking_duplicates', 'ready'],
    color: '#16A34A',
  },
  {
    label: 'Checking duplicate complaints',
    sublabel: 'Similarity match against QMS records',
    activeWhen: ['checking_duplicates'],
    doneWhen:   ['ready'],
    color: '#0284C7',
  },
];

function getState(stage: StageDef, status: ExtractionStatus): 'pending' | 'active' | 'completed' {
  if (stage.doneWhen.includes(status)) return 'completed';
  if (stage.activeWhen.includes(status)) return 'active';
  const currentIdx = PIPELINE_ORDER.indexOf(status);
  const stageActiveIdx = Math.max(...stage.activeWhen.map(s => PIPELINE_ORDER.indexOf(s)));
  if (currentIdx > stageActiveIdx) return 'completed';
  return 'pending';
}

interface AnalysisProgressProps {
  status: ExtractionStatus;
  progress: number;
  error: string | null;
}

const AnalysisProgress: React.FC<AnalysisProgressProps> = ({ status, progress, error }) => {
  if (status === 'idle' || status === 'ready') return null;

  if (status === 'error') {
    return (
      <div style={{
        margin: '0 14px 12px',
        padding: '12px 14px', background: '#FEF2F2',
        border: '1px solid #FECACA', borderRadius: 10,
      }}
        aria-live="assertive"
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: '#DC2626', marginBottom: 4 }}>
          ! Analysis failed
        </div>
        <div style={{ fontSize: 12, color: '#991B1B', lineHeight: 1.5 }}>
          {error || 'An unexpected error occurred. Please try again.'}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        margin: '0 14px 12px',
        background: '#FFFFFF', border: '1px solid #E2E8F0',
        borderRadius: 10, overflow: 'hidden',
      }}
      aria-live="polite"
      aria-label="AIVOA AI analysis in progress"
    >
      {/* Header */}
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid #E2E8F0',
        background: 'linear-gradient(135deg, #EFF6FF, #F8FAFC)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            display: 'block', width: 10, height: 10, borderRadius: '50%',
            border: '2px solid #2563EB44', borderTopColor: '#2563EB',
            animation: 'spin 0.65s linear infinite', flexShrink: 0,
          }} />
          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1E40AF' }}>
            AIVOA is analyzing
          </span>
        </div>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: '#2563EB' }}>
          {Math.round(progress)}%
        </span>
      </div>

      {/* Pipeline steps */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 9 }}>
        {STAGES.map((stage, i) => (
          <StageRow
            key={i}
            label={stage.label}
            sublabel={stage.sublabel}
            state={getState(stage, status)}
            color={stage.color}
          />
        ))}
      </div>

      {/* Progress bar */}
      <div style={{
        height: 3, background: '#EFF6FF', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', background: 'linear-gradient(90deg, #2563EB, #7C3AED)',
          width: `${progress}%`, transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  );
};

export default AnalysisProgress;
