/**
 * App.tsx — tab-based navigation with React.lazy code splitting.
 *
 * Performance changes:
 *  - WorkspacePage eager-loaded (primary page, always needed immediately)
 *  - ComplaintsPage, ComplaintDetailPage, Dashboard → React.lazy
 *    → each becomes a separate JS chunk fetched only when the user navigates there
 *  - Suspense boundary shows a lightweight skeleton while chunk loads
 */
import React, { useState, lazy, Suspense, memo } from 'react';
import { Provider } from 'react-redux';
import { store } from './app/store';
import Header from './components/Header';
import WorkspacePage from './pages/WorkspacePage'; // eager — primary view
import './index.css';

// Lazily loaded pages — each will be a separate JS chunk
const ComplaintsPage     = lazy(() => import('./pages/ComplaintsPage'));
const ComplaintDetailPage = lazy(() => import('./pages/ComplaintDetailPage'));
const Dashboard           = lazy(() => import('./pages/Dashboard'));

type Tab = 'workspace' | 'complaints' | 'dashboard' | 'complaint-detail';

// Lightweight page-level skeleton shown during lazy chunk download
const PageSkeleton: React.FC = () => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '60vh', flexDirection: 'column', gap: 12,
  }}>
    <div style={{
      width: 32, height: 32, borderRadius: '50%',
      border: '3px solid #E2E8F0', borderTopColor: '#D97706',
      animation: 'spin 0.7s linear infinite',
    }} />
    <span style={{ fontSize: 13, color: '#94A3B8', fontWeight: 500 }}>Loading…</span>
  </div>
);

// Memoised so Header only re-renders when activeTab/onTabChange identity changes
const MemoHeader = memo(Header);

function AppInner() {
  const [activeTab, setActiveTab] = useState<Tab>('workspace');
  const [detailId, setDetailId]   = useState<number | null>(null);

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
      <MemoHeader
        activeTab={headerTab as any}
        onTabChange={(tab) => navigate(tab)}
      />
      <main className="page-content">
        {/* Workspace is eager — no Suspense wrapper needed */}
        {activeTab === 'workspace' && (
          <WorkspacePage onNavigate={navigate} />
        )}

        {/* Lazy pages share one Suspense boundary */}
        <Suspense fallback={<PageSkeleton />}>
          {activeTab === 'complaints' && (
            <ComplaintsPage
              onViewComplaint={(id) => navigate('complaint-detail', id)}
            />
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
        </Suspense>
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
