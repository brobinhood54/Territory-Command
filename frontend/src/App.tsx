import { useState, useEffect, useCallback } from 'react';
import type { Account } from '@tc/shared';
import Sidebar from './components/Sidebar';
import AccountDetail from './components/AccountDetail';
import OpenLoopsView from './components/OpenLoopsView';
import Toast from './components/Toast';
import { useToast, showToast } from './lib/toast';
import ErrorBoundary from './components/ErrorBoundary';
import { ConfirmModalRoot } from './components/ConfirmModal';

type ActiveView = 'account' | 'openLoops';

export default function App() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>('account');
  const [openLoopsCount, setOpenLoopsCount] = useState(0);
  const [openLoopsRefreshTrigger, setOpenLoopsRefreshTrigger] = useState(0);
  // State lifted for cross-view navigation (Open Loops -> account Calls tab)
  const [pendingActiveTab, setPendingActiveTab] = useState<string | undefined>(undefined);
  const [pendingHighlightCallId, setPendingHighlightCallId] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    fetch('/api/accounts')
      .then(r => r.json())
      .then((data: Account[]) => {
        setAccounts(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load accounts:', err);
        showToast('error', 'Failed to load accounts. Try reloading the page.');
        setLoading(false);
      });
  }, []);

  // Load initial open loops count on startup
  useEffect(() => {
    fetch('/api/questions/open')
      .then(r => r.json())
      .then((data: unknown[]) => setOpenLoopsCount(data.length))
      .catch(err => console.error('Failed to load open questions count:', err));
  }, [openLoopsRefreshTrigger]);

  function handleAccountUpdate(updated: Account) {
    setAccounts(prev => prev.map(a => a.id === updated.id ? { ...a, ...updated } : a));
  }

  function handleSelectAccount(id: string) {
    setSelectedId(id);
    setActiveView('account');
    setPendingActiveTab(undefined);
    setPendingHighlightCallId(null);
  }

  // Called from OpenLoopsView when "Open Source Call" is clicked
  const handleNavigateToCall = useCallback((accountId: string, callId: string) => {
    setSelectedId(accountId);
    setActiveView('account');
    setPendingActiveTab('calls');
    setPendingHighlightCallId(callId);
  }, []);

  const selectedAccount = accounts.find(a => a.id === selectedId) ?? null;

  return (
    <div style={{
      background: '#080e1a',
      color: '#dde6ee',
      height: '100vh',
      overflow: 'hidden',
      display: 'flex',
    }}>
      <Sidebar
        accounts={accounts}
        loading={loading}
        selectedId={activeView === 'account' ? selectedId : null}
        collapsed={sidebarCollapsed}
        activeView={activeView}
        openLoopsCount={openLoopsCount}
        onSelect={handleSelectAccount}
        onSelectOpenLoops={() => {
          setActiveView('openLoops');
          setSelectedId(null);
        }}
        onToggleCollapse={() => setSidebarCollapsed(c => !c)}
      />
      <main style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
        <ErrorBoundary>
          {activeView === 'openLoops' ? (
            <OpenLoopsView
              onNavigateToCall={handleNavigateToCall}
              refreshTrigger={openLoopsRefreshTrigger}
              onCountChange={setOpenLoopsCount}
            />
          ) : (
            <AccountDetail
              account={selectedAccount}
              onUpdate={handleAccountUpdate}
              activeTab={pendingActiveTab}
              onActiveTabChange={() => {
                // Once AccountDetail picks up the pending tab, clear it so it owns tab state
                setPendingActiveTab(undefined);
              }}
              highlightCallIdExternal={pendingHighlightCallId}
              onHighlightCallIdExternalConsumed={() => setPendingHighlightCallId(null)}
              onQuestionStatusChange={() => setOpenLoopsRefreshTrigger(t => t + 1)}
            />
          )}
        </ErrorBoundary>
      </main>
      <Toast toasts={toast.toasts} onDismiss={toast.dismiss} />
      <ConfirmModalRoot />
    </div>
  );
}
