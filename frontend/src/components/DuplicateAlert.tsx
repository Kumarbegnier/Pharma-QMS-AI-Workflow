import React from 'react';
import type { DuplicateMatch } from '../features/complaints/types';

interface DuplicateAlertProps {
  duplicates: DuplicateMatch[];
  onViewComplaint?: (id: number) => void;
}

const DuplicateAlert: React.FC<DuplicateAlertProps> = ({ duplicates, onViewComplaint }) => {
  if (!duplicates || duplicates.length === 0) return null;

  return (
    <div className="duplicate-alert">
      <div className="duplicate-alert-header">
        ⚠️ Possible Duplicate Complaint{duplicates.length > 1 ? 's' : ''} Detected
        <span style={{ fontWeight: 400, color: '#92400E' }}>
          — {duplicates.length} existing record{duplicates.length > 1 ? 's' : ''} match this complaint
        </span>
      </div>
      {duplicates.slice(0, 3).map(d => (
        <div key={d.complaint_id} className="duplicate-item">
          <span style={{ fontWeight: 600, color: '#1E293B' }}>{d.complaint_number}</span>
          <span style={{ color: '#475569' }}>{d.product_name}</span>
          <span style={{ color: '#94A3B8' }}>Batch: {d.batch_number}</span>
          <span className="dup-score">{Math.round(d.similarity_score * 100)}% match</span>
          <span style={{ color: '#94A3B8', fontSize: '10px' }}>
            {d.matched_factors.join(', ')}
          </span>
          {onViewComplaint && (
            <button
              className="btn btn-sm btn-secondary"
              style={{ marginLeft: 'auto', fontSize: '10px', padding: '2px 8px' }}
              onClick={() => onViewComplaint(d.complaint_id)}
            >
              View
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

export default DuplicateAlert;
