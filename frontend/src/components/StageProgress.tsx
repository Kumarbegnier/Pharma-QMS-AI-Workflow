import React from 'react';
import type { ExtractionStatus } from '../features/complaints/types';

interface StageProgressProps {
  status: ExtractionStatus;
  progress: number;
}

const STAGES: { key: ExtractionStatus; label: string }[] = [
  { key: 'parsing', label: 'Parsing' },
  { key: 'extracting', label: 'Extracting' },
  { key: 'validating', label: 'Validating' },
  { key: 'assessing', label: 'Risk Assessment' },
  { key: 'generating', label: 'CAPA' },
  { key: 'checking_duplicates', label: 'Duplicates' },
];

const STAGE_ORDER = STAGES.map(s => s.key);

const StageProgress: React.FC<StageProgressProps> = ({ status, progress }) => {
  if (status === 'idle' || status === 'ready' || status === 'error') return null;

  const currentIdx = STAGE_ORDER.indexOf(status);

  return (
    <div className="stage-progress">
      <div className="stage-progress-label">
        <span className="spinner" />
        AI Processing — {Math.round(progress)}%
      </div>
      <div className="stage-steps">
        {STAGES.map((stage, idx) => {
          const isDone = idx < currentIdx;
          const isActive = idx === currentIdx;
          return (
            <span
              key={stage.key}
              className={`stage-step ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
            >
              {isDone ? '✓ ' : ''}{stage.label}
            </span>
          );
        })}
      </div>
      <div className="progress-bar-wrap">
        <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
};

export default StageProgress;
