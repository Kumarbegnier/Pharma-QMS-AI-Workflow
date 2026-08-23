import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { fetchAIStatus } from '../features/complaints/complaintsSlice';

type Tab = 'workspace' | 'complaints' | 'dashboard';

interface HeaderProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange }) => {
  const dispatch = useAppDispatch();
  const aiStatus = useAppSelector(s => s.complaints.aiStatus);

  useEffect(() => {
    dispatch(fetchAIStatus());
  }, [dispatch]);

  const isOnline = aiStatus?.groq_available;

  return (
    <header className="header">
      <div className="header-brand">
        <div className="header-logo">QMS</div>
        <div className="header-title">
          AIVOA <span>Pharma QMS</span>
        </div>
      </div>

      <nav className="header-nav">
        {(['workspace', 'complaints', 'dashboard'] as Tab[]).map(tab => (
          <button
            key={tab}
            className={`nav-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => onTabChange(tab)}
            aria-current={activeTab === tab ? 'page' : undefined}
          >
            {tab === 'workspace' && 'Complaint Workspace'}
            {tab === 'complaints' && 'Complaints'}
            {tab === 'dashboard' && 'Dashboard'}
          </button>
        ))}
      </nav>

      <div className={`ai-status-badge ${isOnline ? 'online' : 'demo'}`}>
        <span className="ai-status-dot" />
        {isOnline
          ? `Groq · ${aiStatus?.model || 'gemma2-9b-it'}`
          : `Demo Mode · Local Rules`}
      </div>
    </header>
  );
};

export default Header;
