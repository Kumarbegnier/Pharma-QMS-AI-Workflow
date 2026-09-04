import React from 'react';
import type { ExtractionStatus } from '../features/complaints/types';

interface StageProgressProps {
  status: ExtractionStatus;
  progress: number;
}

const STAGES: { key: ExtractionStatus; label: string }[] = [
  { key: 'parsing',             label: 'Reading document' },
  { key: 'extracting',          label: 'Extracting complaint fields' },
  { key: 'validating',          label: 'Validating & normalizing' },
  { key: 'assessing',           label: 'Assessing quality risk' },
  { key: 'generating',          label: 'Generating CAPA suggestions' },
  { key: 'checking_duplicates', label: 'Checking similar complaints' },
];

const STAGE_ORDER = STAGES.map(s => s.key);

const StageProgress: React.FC<StageProgressProps> = ({ status, progress }) => {
  if (status === 'idle' || status === 'ready' || status === 'error') return null;

  const currentIdx = STAGE_ORDER.indexOf(status);

  return (
    <div className="stage-progress">
      <div className="stage-progress-label">
        <span className="spinner spinner-dark" style={{ borderTopColor: '#2563EB' }} />
        Analyzing — {Math.round(progress)}%
      </div>

      <div className="stage-steps">
        {STAGES.map((stage, idx) => {
          const isDone   = idx < currentIdx;
          const isActive = idx === currentIdx;
          return (
            <div
              key={stage.key}
              className={`stage-step ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
            >
              <span className="step-icon">
                {isDone   ? '✓' : isActive ? '●' : '○'}
              </span>
              {stage.label}
            </div>
          );
        })}
      </div>

      <div className="progress-bar-wrap" style={{ marginTop: 10 }}>
        <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
};

export default StageProgress;
