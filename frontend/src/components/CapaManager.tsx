import React, { useState } from 'react';
import { CapaTask } from '../features/complaints/types';
import { Wrench, Plus, CheckCircle, Clock } from 'lucide-react';

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
