import React, { useState } from 'react';
import { Provider } from 'react-redux';
import { store } from './app/store';
import Header from './components/Header';
import WorkspacePage from './pages/WorkspacePage';
import ComplaintsPage from './pages/ComplaintsPage';
import ComplaintDetailPage from './pages/ComplaintDetailPage';
import Dashboard from './pages/Dashboard';
import './index.css';

type Tab = 'workspace' | 'complaints' | 'dashboard' | 'complaint-detail';

function AppInner() {
  const [activeTab, setActiveTab] = useState<Tab>('workspace');
  const [detailId, setDetailId] = useState<number | null>(null);

  const navigate = (tab: string, id?: number) => {
    if (tab === 'complaint-detail' && id) {
      setDetailId(id);
      setActiveTab('complaint-detail');
    } else {
      setActiveTab(tab as Tab);
    }
  };

  const headerTab = activeTab === 'complaint-detail' ? 'complaints' : activeTab;

  return (
    <div className="app-shell">
      <Header
        activeTab={headerTab as any}
        onTabChange={(tab) => navigate(tab)}
      />
      <main className="page-content">
        {activeTab === 'workspace' && (
          <WorkspacePage onNavigate={navigate} />
        )}
        {activeTab === 'complaints' && (
          <ComplaintsPage onViewComplaint={(id) => navigate('complaint-detail', id)} />
        )}
        {activeTab === 'complaint-detail' && detailId !== null && (
          <ComplaintDetailPage
            complaintId={detailId}
            onBack={() => navigate('complaints')}
          />
        )}
        {activeTab === 'dashboard' && (
          <Dashboard onNavigate={navigate} />
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <Provider store={store}>
      <AppInner />
    </Provider>
  );
}

export default App;
