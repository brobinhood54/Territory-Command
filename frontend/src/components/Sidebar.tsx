import type { Account } from '@tc/shared';

interface SidebarProps {
  accounts: Account[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function Sidebar({ accounts, loading, selectedId, onSelect }: SidebarProps) {
  return (
    <aside style={{
      width: '272px',
      minWidth: '272px',
      background: '#0f1929',
      borderRight: '1px solid #1e3048',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '1.25rem 1rem 1rem',
        borderBottom: '1px solid #1e3048',
      }}>
        <h1 style={{
          margin: 0,
          fontSize: '0.8125rem',
          fontWeight: 700,
          color: '#00e5a0',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}>
          Territory Command
        </h1>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0.375rem 0' }}>
        {loading ? (
          <div style={{ padding: '1rem', color: '#6b8599', fontSize: '0.8125rem' }}>
            Loading accounts...
          </div>
        ) : accounts.length === 0 ? (
          <div style={{ padding: '1rem', color: '#6b8599', fontSize: '0.8125rem' }}>
            No accounts. Run db:seed.
          </div>
        ) : (
          accounts.map(account => {
            const isSelected = selectedId === account.id;
            return (
              <button
                key={account.id}
                onClick={() => onSelect(account.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.625rem 1rem',
                  background: isSelected ? '#162032' : 'transparent',
                  border: 'none',
                  borderLeft: `3px solid ${isSelected ? '#00e5a0' : 'transparent'}`,
                  cursor: 'pointer',
                  color: isSelected ? '#dde6ee' : '#9db8cc',
                  fontSize: '0.875rem',
                  lineHeight: 1.4,
                }}
              >
                <div style={{ fontWeight: isSelected ? 600 : 400 }}>
                  {account.name}
                </div>
                {account.industry && (
                  <div style={{ fontSize: '0.75rem', color: '#6b8599', marginTop: '2px' }}>
                    {account.industry}
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
