import React, { useState } from 'react';
import { CapaTask } from '../features/complaints/types';

// Inline SVG icons — no lucide-react dependency
const Wrench = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
  </svg>
);
const Plus = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const Clock = ({ size = 12, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

interface CapaManagerProps {
  complaintId: number;
  capaTasks: CapaTask[];
  onAddTask: (action: string, owner: string) => void;
}

export const CapaManager: React.FC<CapaManagerProps> = ({ capaTasks, onAddTask }) => {
  const [action, setAction] = useState('');
  const [owner, setOwner] = useState('QA Manager');
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!action.trim()) return;
    onAddTask(action, owner);
    setAction('');
    setShowForm(false);
  };

  return (
    <div className="glass-panel" style={{ padding: '20px', marginTop: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <h4 style={{ fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Wrench size={16} color="var(--primary)" /> CAPA Task Management Roadmap
        </h4>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowForm(!showForm)}>
          <Plus size={14} /> Add CAPA Task
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ marginBottom: '16px', padding: '12px', background: '#0F172A', borderRadius: 'var(--radius-sm)' }}>
          <div className="form-group">
            <label className="form-label">Action Item Description</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Inspect retain samples and recalibrate line 3 heat sealer"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              required
            />
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Owner (e.g. QA Manager)"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            />
            <button type="submit" className="btn btn-primary btn-sm">Save Task</button>
          </div>
        </form>
      )}

      {capaTasks.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No CAPA tasks logged yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {capaTasks.map((task) => (
            <div key={task.id} style={{
              padding: '10px 14px',
              background: '#0F172A',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#F1F5F9' }}>
                  {task.action}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Owner: {task.owner} • Created: {new Date(task.created_at).toLocaleDateString()}
                </div>
              </div>

              <span className="badge badge-groq">
                <Clock size={12} /> {task.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
