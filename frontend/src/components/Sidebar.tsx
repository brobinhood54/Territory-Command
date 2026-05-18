import { useState, useMemo } from 'react';
import type { Account } from '@tc/shared';

interface SidebarProps {
  accounts: Account[];
  loading: boolean;
  selectedId: string | null;
  collapsed: boolean;
  onSelect: (id: string) => void;
  onToggleCollapse: () => void;
}

// --- module-scope helpers ---

const HEALTH_ORDER: Record<string, number> = { red: 0, yellow: 1, green: 2, unknown: 3 };

function fuzzyMatch(query: string, name: string): boolean {
  const q = query.toLowerCase();
  const n = name.toLowerCase();
  let qi = 0;
  for (let i = 0; i < n.length && qi < q.length; i++) {
    if (n[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

function sortAccounts(list: Account[]): Account[] {
  return [...list].sort((a, b) => {
    const aOpp = (a.open_opps ?? 0) > 0 ? 0 : 1;
    const bOpp = (b.open_opps ?? 0) > 0 ? 0 : 1;
    if (aOpp !== bOpp) return aOpp - bOpp;

    const aH = HEALTH_ORDER[a.deal_health ?? 'unknown'] ?? 3;
    const bH = HEALTH_ORDER[b.deal_health ?? 'unknown'] ?? 3;
    if (aH !== bH) return aH - bH;

    const aDate = a.last_activity ?? '';
    const bDate = b.last_activity ?? '';
    return bDate > aDate ? 1 : bDate < aDate ? -1 : 0;
  });
}

function formatAmount(amount: number): string {
  if (amount >= 1000000) return `$${Math.round(amount / 1000000)}M`;
  return `$${Math.round(amount / 1000)}k`;
}

// ---

export default function Sidebar({
  accounts, loading, selectedId, collapsed, onSelect, onToggleCollapse,
}: SidebarProps) {
  const [search, setSearch] = useState('');
  const [industryFilter, setIndustryFilter] = useState('All');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const industries = useMemo(() => {
    const set = new Set<string>();
    for (const a of accounts) {
      if (a.industry) set.add(a.industry);
    }
    return Array.from(set).sort();
  }, [accounts]);

  const visible = useMemo(() => {
    let list = accounts;
    if (search.trim()) {
      list = list.filter(a => fuzzyMatch(search.trim(), a.name));
    }
    if (industryFilter !== 'All') {
      list = list.filter(a => a.industry === industryFilter);
    }
    return sortAccounts(list);
  }, [accounts, search, industryFilter]);

  return (
    <aside style={{
      width: collapsed ? '28px' : '272px',
      minWidth: collapsed ? '28px' : '272px',
      transition: 'width 0.18s ease, min-width 0.18s ease',
      background: '#0f1929',
      borderRight: '1px solid #1e3048',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
      flexShrink: 0,
    }}>

      {/* Header row: title + collapse toggle */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        height: '48px',
        borderBottom: '1px solid #1e3048',
        flexShrink: 0,
      }}>
        {!collapsed && (
          <h1 style={{
            flex: 1,
            margin: 0,
            paddingLeft: '0.75rem',
            fontSize: '0.8125rem',
            fontWeight: 700,
            color: '#00e5a0',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}>
            Territory Command
          </h1>
        )}
        <button
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#6b8599',
            fontSize: '0.65rem',
            width: '28px',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      {/* Content: only shown when expanded */}
      {!collapsed && (
        <>
          {/* Search */}
          <div style={{ padding: '0.625rem 0.625rem 0', flexShrink: 0 }}>
            <input
              type="text"
              placeholder="Search accounts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                background: '#162032',
                border: '1px solid #1e3048',
                borderRadius: '0.25rem',
                color: '#dde6ee',
                fontSize: '0.8125rem',
                padding: '0.375rem 0.5rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Industry filter pills */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.3rem',
            padding: '0.5rem 0.625rem',
            flexShrink: 0,
            borderBottom: '1px solid #1e3048',
          }}>
            {['All', ...industries].map(ind => (
              <button
                key={ind}
                onClick={() => setIndustryFilter(ind)}
                style={{
                  background: industryFilter === ind ? '#00e5a0' : '#162032',
                  color: industryFilter === ind ? '#080e1a' : '#9db8cc',
                  border: `1px solid ${industryFilter === ind ? '#00e5a0' : '#1e3048'}`,
                  borderRadius: '999px',
                  fontSize: '0.675rem',
                  fontWeight: industryFilter === ind ? 700 : 400,
                  padding: '0.15rem 0.5rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {ind}
              </button>
            ))}
          </div>

          {/* Account list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.25rem 0' }}>
            {loading ? (
              <div style={{ padding: '1rem', color: '#6b8599', fontSize: '0.8125rem' }}>
                Loading accounts...
              </div>
            ) : visible.length === 0 ? (
              <div style={{ padding: '1rem', color: '#6b8599', fontSize: '0.8125rem' }}>
                No accounts match.
              </div>
            ) : (
              visible.map(account => {
                const isSelected = selectedId === account.id;
                const isHovered = hoveredId === account.id && !isSelected;
                const hasAmount = (account.amount ?? 0) > 0;
                return (
                  <button
                    key={account.id}
                    onClick={() => onSelect(account.id)}
                    onMouseEnter={() => setHoveredId(account.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.5rem 0.75rem 0.5rem 0.625rem',
                      background: isSelected ? '#162032' : isHovered ? '#0d1a29' : 'transparent',
                      border: 'none',
                      borderLeft: `3px solid ${isSelected ? '#00e5a0' : 'transparent'}`,
                      cursor: 'pointer',
                      color: isSelected ? '#dde6ee' : '#9db8cc',
                      lineHeight: 1.35,
                    }}
                  >
                    <div style={{
                      fontSize: '0.8375rem',
                      fontWeight: isSelected ? 600 : 500,
                      marginBottom: '0.15rem',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                    }}>
                      {account.name}
                    </div>

                    {(account.industry || account.state) && (
                      <div style={{
                        fontSize: '0.7rem',
                        color: '#6b8599',
                        marginBottom: '0.3rem',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                      }}>
                        {[account.industry, account.state].filter(Boolean).join(' · ')}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      {account.fortune_500 && (
                        <span style={{
                          fontSize: '0.6rem', fontWeight: 700,
                          color: '#f0a500', border: '1px solid #f0a500',
                          borderRadius: '3px', padding: '0 0.3rem', letterSpacing: '0.04em',
                        }}>F500</span>
                      )}
                      {(account.open_opps ?? 0) > 0 && (
                        <span style={{
                          fontSize: '0.6rem', fontWeight: 700,
                          color: '#00e5a0', border: '1px solid #00e5a0',
                          borderRadius: '3px', padding: '0 0.3rem',
                        }}>OPP</span>
                      )}
                      {hasAmount && (
                        <span style={{
                          fontSize: '0.6rem', fontWeight: 700,
                          color: '#b48ef7', border: '1px solid #b48ef7',
                          borderRadius: '3px', padding: '0 0.3rem',
                        }}>
                          {formatAmount(account.amount!)}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </aside>
  );
}
