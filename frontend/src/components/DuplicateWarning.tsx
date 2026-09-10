import React from 'react';
import { DuplicateMatch } from '../features/complaints/types';

// Inline SVG icons — no lucide-react dependency
const AlertTriangle = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const ExternalLink = ({ size = 12, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
);
const Layers = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2"/>
    <polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
  </svg>
);

interface DuplicateWarningProps {
  duplicates: DuplicateMatch[];
  onSelectDuplicate?: (id: number) => void;
}

export const DuplicateWarning: React.FC<DuplicateWarningProps> = ({ duplicates, onSelectDuplicate }) => {
  if (!duplicates || duplicates.length === 0) return null;

  const topMatch = duplicates[0];

  return (
    <div style={{
      marginBottom: '24px',
      padding: '16px 20px',
      background: 'rgba(245, 158, 11, 0.1)',
      border: '1px solid rgba(245, 158, 11, 0.3)',
      borderRadius: 'var(--radius-md)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <AlertTriangle size={20} color="#F59E0B" />
        <span style={{ fontSize: '15px', fontWeight: 700, color: '#FCD34D' }}>
          Potential Duplicate Complaint Flagged ({intScore(topMatch.similarity_score)}% Weighted Match)
        </span>
      </div>

      <p style={{ fontSize: '13px', color: '#CBD5E1', marginBottom: '12px' }}>
        The Weighted Duplicate Detection Engine identified a historical complaint matching this batch/defect criteria:
      </p>

      {duplicates.map((dup) => (
        <div key={dup.complaint_id} style={{
          padding: '10px 14px',
          background: '#0F172A',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-color)',
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#F1F5F9', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={14} color="var(--primary)" />
              {dup.complaint_number} - {dup.product_name} (Batch: {dup.batch_number})
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Matched Signals: {dup.matched_factors.join(' • ')}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="badge badge-major">
              {intScore(dup.similarity_score)}% Match
            </span>
            {onSelectDuplicate && (
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => onSelectDuplicate(dup.complaint_id)}
              >
                View Complaint <ExternalLink size={12} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

function intScore(score: number): number {
  return Math.round(score * 100);
}
