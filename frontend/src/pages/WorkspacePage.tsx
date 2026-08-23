import React, { useState, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../app/hooks';
import { clearSavedId } from '../features/complaints/complaintsSlice';
import StructuredForm from '../components/StructuredForm';
import CopilotPanel from '../components/CopilotPanel';

interface WorkspacePageProps {
  onNavigate: (tab: string, id?: number) => void;
}

const WorkspacePage: React.FC<WorkspacePageProps> = ({ onNavigate }) => {
  const dispatch = useAppDispatch();
  const [toastVisible, setToastVisible] = useState(false);
  const [lastSavedId, setLastSavedId] = useState<number | null>(null);
  const savedComplaintId = useAppSelector(s => s.complaints.savedComplaintId);

  useEffect(() => {
    if (savedComplaintId) {
      setLastSavedId(savedComplaintId);
      setToastVisible(true);
      dispatch(clearSavedId());
      // Auto-dismiss after 5s
      const t = setTimeout(() => setToastVisible(false), 5000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [savedComplaintId]);

  return (
    <div className="workspace">
      <div className="workspace-form-panel">
        <StructuredForm
          onSaved={() => {}}
          onViewComplaint={(id) => onNavigate('complaint-detail', id)}
        />
      </div>
      <div className="workspace-copilot-panel">
        <CopilotPanel />
      </div>

      {/* Save success toast */}
      {toastVisible && lastSavedId && (
        <div className="save-toast">
          <span>🔒 Committed to QMS Ledger</span>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button
              className="btn btn-sm"
              style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}
              onClick={() => { setToastVisible(false); onNavigate('complaint-detail', lastSavedId); }}
            >
              View Complaint
            </button>
            <button
              className="btn btn-sm"
              style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}
              onClick={() => { setToastVisible(false); onNavigate('complaints'); }}
            >
              View All
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspacePage;
