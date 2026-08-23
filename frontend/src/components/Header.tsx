import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { fetchAIStatus } from '../features/complaints/complaintsSlice';

type Tab = 'workspace' | 'complaints' | 'dashboard';

interface HeaderProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'workspace',   label: '✦ Complaint Workspace' },
  { id: 'complaints',  label: 'Register' },
  { id: 'dashboard',   label: 'Dashboard' },
];

const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange }) => {
  const dispatch = useAppDispatch();
  const aiStatus = useAppSelector(s => s.complaints.aiStatus);

  useEffect(() => { dispatch(fetchAIStatus()); }, [dispatch]);

  const isOnline = aiStatus?.groq_available;
  const modelLabel = isOnline
    ? `llama-3.3-70b · Groq`
    : 'Demo Mode';

  return (
    <header className="header">
      <div className="header-brand">
        <div className="header-logo" title="AIVOA Pharma QMS">✦</div>
        <div className="header-title">
          AIVOA <span>Pharma QMS</span>
        </div>
      </div>

      <nav className="header-nav" role="navigation" aria-label="Main navigation">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className={`ai-status-badge ${isOnline ? 'online' : 'demo'}`}>
        <span className="ai-status-dot" />
        {modelLabel}
      </div>
    </header>
  );
};

export default Header;
