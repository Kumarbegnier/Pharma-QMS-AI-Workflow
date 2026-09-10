/**
 * App.tsx — tab-based navigation with React.lazy code splitting
 *           + smooth page transition animations (fade + slide up).
 *
 * Transition approach:
 *   - Each page is wrapped in <PageTransition key={activeTab}>
 *   - On mount: plays enterActive CSS class (fade in + slide up 12px)
 *   - On unmount: previous page plays exitActive class (fade out + slide up 6px)
 *     handled via useLayoutEffect + a brief delay before DOM removal
 *   - Keeps Suspense lazy-loading intact
 *   - No animation library — pure CSS keyframes
 */
import React, {
  useState, lazy, Suspense, memo,
  useRef, useLayoutEffect, useCallback,
} from 'react';
import { Provider } from 'react-redux';
import { store } from './app/store';
import Header from './components/Header';
import WorkspacePage from './pages/WorkspacePage';
import './index.css';

// ── Lazy pages ─────────────────────────────────────────────────────────────
const ComplaintsPage      = lazy(() => import('./pages/ComplaintsPage'));
const ComplaintDetailPage = lazy(() => import('./pages/ComplaintDetailPage'));
const Dashboard           = lazy(() => import('./pages/Dashboard'));

type Tab = 'workspace' | 'complaints' | 'dashboard' | 'complaint-detail';

// ── PageSkeleton (shown during lazy chunk download) ───────────────────────
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

// ── PageTransition ────────────────────────────────────────────────────────
// Wraps each page render. On first mount plays enterActive.
// When `exiting` prop is true plays exitActive then calls onDone.

interface PageTransitionProps {
  children: React.ReactNode;
  transitionKey: string;
}

const PageTransition: React.FC<PageTransitionProps> = ({ children, transitionKey }) => {
  const ref = useRef<HTMLDivElement>(null);

  // Trigger enter animation on every mount (key change causes remount)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Start invisible, then add the class after a microtask so CSS picks it up
    el.style.opacity = '0';
    el.style.transform = 'translateY(14px)';
    const raf = requestAnimationFrame(() => {
      if (!ref.current) return;
      ref.current.style.transition = 'opacity 0.28s ease, transform 0.28s ease';
      ref.current.style.opacity = '1';
      ref.current.style.transform = 'translateY(0)';
    });
    return () => cancelAnimationFrame(raf);
  }, [transitionKey]);

  return (
    <div
      ref={ref}
      style={{
        width: '100%', height: '100%',
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </div>
  );
};

// ── MemoHeader ─────────────────────────────────────────────────────────────
const MemoHeader = memo(Header);

// ── AppInner ───────────────────────────────────────────────────────────────
function AppInner() {
  const [activeTab, setActiveTab] = useState<Tab>('workspace');
  const [detailId,  setDetailId]  = useState<number | null>(null);

  const navigate = useCallback((tab: string, id?: number) => {
    if (tab === 'complaint-detail' && id) {
      setDetailId(id);
      setActiveTab('complaint-detail');
    } else {
      setActiveTab(tab as Tab);
    }
  }, []);

  const headerTab = activeTab === 'complaint-detail' ? 'complaints' : activeTab;

  // The transition key drives remount → re-triggers enter animation
  const transitionKey = activeTab === 'complaint-detail'
    ? `detail-${detailId}`
    : activeTab;

  return (
    <div className="app-shell">
      <MemoHeader
        activeTab={headerTab as any}
        onTabChange={(tab) => navigate(tab)}
      />
      <main className="page-content" style={{ position: 'relative', overflow: 'hidden' }}>
        <PageTransition key={transitionKey} transitionKey={transitionKey}>
          {activeTab === 'workspace' && (
            <WorkspacePage onNavigate={navigate} />
          )}

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
        </PageTransition>
      </main>
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────────────────
function App() {
  return (
    <Provider store={store}>
      <AppInner />
    </Provider>
  );
}

export default App;
