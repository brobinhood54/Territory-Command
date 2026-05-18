import { useState, useEffect } from 'react';
import type { Account } from '@tc/shared';
import Sidebar from './components/Sidebar';
import AccountDetail from './components/AccountDetail';
import Toast from './components/Toast';
import { useToast } from './lib/toast';

export default function App() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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
        setLoading(false);
      });
  }, []);

  const selectedAccount = accounts.find(a => a.id === selectedId) ?? null;

  return (
    <div style={{
      background: '#080e1a',
      color: '#dde6ee',
      minHeight: '100vh',
      display: 'flex',
    }}>
      <Sidebar
        accounts={accounts}
        loading={loading}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
      <main style={{ flex: 1, overflow: 'auto' }}>
        <AccountDetail account={selectedAccount} />
      </main>
      <Toast toasts={toast.toasts} onDismiss={toast.dismiss} />
    </div>
  );
}
