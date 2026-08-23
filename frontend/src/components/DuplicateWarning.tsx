import React from 'react';
import { DuplicateMatch } from '../features/complaints/types';
import { AlertTriangle, ExternalLink, Layers } from 'lucide-react';

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
