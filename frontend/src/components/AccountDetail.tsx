import { useState } from 'react';
import type { Account } from '@tc/shared';
import TabBar from './TabBar';
import AccountOverview from './AccountOverview';
import AccountStakeholders from './AccountStakeholders';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'stakeholders', label: 'Stakeholders' },
];

interface AccountDetailProps {
  account: Account | null;
  onUpdate: (updated: Account) => void;
}

export default function AccountDetail({ account, onUpdate }: AccountDetailProps) {
  const [activeTab, setActiveTab] = useState('overview');

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
          <AccountOverview account={account} onUpdate={onUpdate} />
        )}
        {activeTab === 'stakeholders' && (
          <AccountStakeholders accountId={account.id} accountName={account.name} />
        )}
      </div>
    </div>
  );
}
