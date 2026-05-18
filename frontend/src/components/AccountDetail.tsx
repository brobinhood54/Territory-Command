import { useState, useEffect, useCallback } from 'react';
import type { Account, Call, Stakeholder, Question, PainEnriched } from '@tc/shared';
import { api } from '../lib/api';
import { showToast } from '../lib/toast';
import TabBar from './TabBar';
import AccountOverview from './AccountOverview';
import AccountStakeholders from './AccountStakeholders';
import AccountCalls from './AccountCalls';
import AccountQuestions from './AccountQuestions';
import AccountPainFit from './AccountPainFit';
import AccountGameplan from './AccountGameplan';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'stakeholders', label: 'Stakeholders' },
  { key: 'calls', label: 'Calls' },
  { key: 'questions', label: 'Questions' },
  { key: 'painfit', label: 'Pain & Fit' },
  { key: 'gameplan', label: 'Gameplan' },
];

interface AccountDetailProps {
  account: Account | null;
  onUpdate: (updated: Account) => void;
  activeTab?: string;
  onActiveTabChange?: (tab: string) => void;
  highlightCallIdExternal?: string | null;
  onHighlightCallIdExternalConsumed?: () => void;
  onQuestionStatusChange?: () => void;
}

export default function AccountDetail({
  account,
  onUpdate,
  activeTab: externalActiveTab,
  onActiveTabChange,
  highlightCallIdExternal,
  onHighlightCallIdExternalConsumed,
  onQuestionStatusChange,
}: AccountDetailProps) {
  const [internalActiveTab, setInternalActiveTab] = useState('overview');
  const activeTab = externalActiveTab ?? internalActiveTab;
  function setActiveTab(tab: string) {
    setInternalActiveTab(tab);
    onActiveTabChange?.(tab);
  }

  const [calls, setCalls] = useState<Call[]>([]);
  const [loadingCalls, setLoadingCalls] = useState(false);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [loadingStakeholders, setLoadingStakeholders] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [pains, setPains] = useState<PainEnriched[]>([]);
  const [loadingPains, setLoadingPains] = useState(false);
  const [highlightCallId, setHighlightCallId] = useState<string | null>(null);

  // Sync external highlight (from Open Loops navigation)
  useEffect(() => {
    if (highlightCallIdExternal) {
      setHighlightCallId(highlightCallIdExternal);
      onHighlightCallIdExternalConsumed?.();
    }
  }, [highlightCallIdExternal, onHighlightCallIdExternalConsumed]);

  const loadCalls = useCallback(async (accountId: string) => {
    setLoadingCalls(true);
    try {
      const rows = await api.calls.list(accountId);
      setCalls(rows);
    } catch (err) {
      console.error('Failed to load calls:', err);
      showToast('error', 'Failed to load calls');
    } finally {
      setLoadingCalls(false);
    }
  }, []);

  const loadStakeholders = useCallback(async (accountId: string) => {
    setLoadingStakeholders(true);
    try {
      const rows = await api.stakeholders.list(accountId);
      setStakeholders(rows);
    } catch (err) {
      console.error('Failed to load stakeholders:', err);
      showToast('error', 'Failed to load stakeholders');
    } finally {
      setLoadingStakeholders(false);
    }
  }, []);

  const loadQuestions = useCallback(async (accountId: string) => {
    setLoadingQuestions(true);
    try {
      const rows = await api.questions.listForAccount(accountId);
      setQuestions(rows);
    } catch (err) {
      console.error('Failed to load questions:', err);
      showToast('error', 'Failed to load questions');
    } finally {
      setLoadingQuestions(false);
    }
  }, []);

  const loadPains = useCallback(async (accountId: string) => {
    setLoadingPains(true);
    try {
      const rows = await api.pains.listForAccount(accountId);
      setPains(rows);
    } catch (err) {
      console.error('Failed to load pains:', err);
      showToast('error', 'Failed to load pain points');
    } finally {
      setLoadingPains(false);
    }
  }, []);

  const accountId = account?.id ?? null;

  useEffect(() => {
    if (!accountId) {
      setCalls([]);
      setStakeholders([]);
      setQuestions([]);
      setPains([]);
      setHighlightCallId(null);
      return;
    }
    setCalls([]);
    setStakeholders([]);
    setQuestions([]);
    setPains([]);
    setHighlightCallId(null);
    void loadCalls(accountId);
    void loadStakeholders(accountId);
    void loadQuestions(accountId);
    void loadPains(accountId);
  }, [accountId, loadCalls, loadStakeholders, loadQuestions, loadPains]);

  if (!account) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: '#6b8599',
        fontSize: '0.875rem',
      }}>
        Select an account to view details.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TabBar tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'overview' && (
          <AccountOverview
            account={account}
            calls={calls}
            stakeholders={stakeholders}
            onUpdate={onUpdate}
            onSwitchToTab={(tab) => setActiveTab(tab)}
            onHighlightCall={(callId) => setHighlightCallId(callId)}
          />
        )}
        {activeTab === 'stakeholders' && (
          <AccountStakeholders
            accountId={account.id}
            accountName={account.name}
            stakeholders={stakeholders}
            loadingStakeholders={loadingStakeholders}
            onStakeholdersChange={setStakeholders}
          />
        )}
        {activeTab === 'calls' && (
          <AccountCalls
            accountId={account.id}
            calls={calls}
            loadingCalls={loadingCalls}
            onCallUpdate={(updated) => setCalls(prev => prev.map(c => c.id === updated.id ? updated : c))}
            onCallDelete={(id) => setCalls(prev => prev.filter(c => c.id !== id))}
            onCallsRefresh={async () => {
              await loadCalls(account.id);
              void loadQuestions(account.id);
            }}
            onAttendeesSeeded={() => void loadStakeholders(account.id)}
            highlightCallId={highlightCallId}
            onHighlightConsumed={() => setHighlightCallId(null)}
          />
        )}
        {activeTab === 'questions' && (
          <AccountQuestions
            questions={questions}
            stakeholders={stakeholders}
            callsMap={Object.fromEntries(calls.map(c => [c.id, { title: c.title, date: c.date }]))}
            loading={loadingQuestions}
            onQuestionUpdate={(updated) => {
              setQuestions(prev => prev.map(q => q.id === updated.id ? updated : q));
              onQuestionStatusChange?.();
            }}
            onQuestionDelete={(id) => {
              setQuestions(prev => prev.filter(q => q.id !== id));
              onQuestionStatusChange?.();
            }}
            onOpenSourceCall={(callId) => {
              setActiveTab('calls');
              setHighlightCallId(callId);
            }}
          />
        )}
        {activeTab === 'painfit' && (
          <AccountPainFit
            pains={pains}
            stakeholders={stakeholders}
            loading={loadingPains}
            onPainUpdate={(updated) => setPains(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p))}
            onPainDelete={(id) => setPains(prev => prev.filter(p => p.id !== id))}
            onPainsReload={() => void loadPains(account.id)}
            onOpenSourceCall={(callId) => {
              setActiveTab('calls');
              setHighlightCallId(callId);
            }}
            onSwitchToStakeholders={() => setActiveTab('stakeholders')}
          />
        )}
        {activeTab === 'gameplan' && (
          <AccountGameplan
            accountId={account.id}
            calls={calls}
            questions={questions}
            pains={pains}
          />
        )}
      </div>
    </div>
  );
}
