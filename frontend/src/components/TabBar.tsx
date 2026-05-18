interface Tab {
  key: string;
  label: string;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (key: string) => void;
}

export default function TabBar({ tabs, activeTab, onChange }: TabBarProps) {
  return (
    <div style={{
      display: 'flex',
      borderBottom: '1px solid #1e3048',
      background: '#0a1220',
      flexShrink: 0,
    }}>
      {tabs.map(tab => {
        const isActive = tab.key === activeTab;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${isActive ? '#00e5a0' : 'transparent'}`,
              color: isActive ? '#00e5a0' : '#6b8599',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontWeight: isActive ? 600 : 400,
              padding: '0.625rem 1.25rem',
              letterSpacing: '0.03em',
              transition: 'color 0.1s, border-color 0.1s',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
