import { useState, useEffect, useCallback } from 'react';
import type { Account, Call, Stakeholder } from '@tc/shared';
import { api } from '../lib/api';
import { showToast } from '../lib/toast';
import TabBar from './TabBar';
import AccountOverview from './AccountOverview';
import AccountStakeholders from './AccountStakeholders';
import AccountCalls from './AccountCalls';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'stakeholders', label: 'Stakeholders' },
  { key: 'calls', label: 'Calls' },
];

interface AccountDetailProps {
  account: Account | null;
  onUpdate: (updated: Account) => void;
}

export default function AccountDetail({ account, onUpdate }: AccountDetailProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [calls, setCalls] = useState<Call[]>([]);
  const [loadingCalls, setLoadingCalls] = useState(false);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [loadingStakeholders, setLoadingStakeholders] = useState(false);
  const [highlightCallId, setHighlightCallId] = useState<string | null>(null);

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

  const accountId = account?.id ?? null;

  useEffect(() => {
    if (!accountId) {
      setCalls([]);
      setStakeholders([]);
      setHighlightCallId(null);
      return;
    }
    setCalls([]);
    setStakeholders([]);
    setHighlightCallId(null);
    void loadCalls(accountId);
    void loadStakeholders(accountId);
  }, [accountId, loadCalls, loadStakeholders]);

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
            onCallsRefresh={() => loadCalls(account.id)}
            onAttendeesSeeded={() => void loadStakeholders(account.id)}
            highlightCallId={highlightCallId}
            onHighlightConsumed={() => setHighlightCallId(null)}
          />
        )}
      </div>
    </div>
  );
}
