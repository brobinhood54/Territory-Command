import type { Toast as ToastItem } from '../lib/toast';

interface ToastProps {
  toasts?: ToastItem[];
  onDismiss?: (id: string) => void;
}

const COLORS: Record<string, string> = {
  success: '#00e5a0',
  warning: '#f0a500',
  error: '#e06050',
};

export default function Toast({ toasts = [], onDismiss }: ToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '1.5rem',
      right: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      zIndex: 1000,
    }}>
      {toasts.map(toast => (
        <div key={toast.id} style={{
          background: COLORS[toast.type] ?? COLORS.error,
          color: '#080e1a',
          padding: '0.75rem 1rem',
          borderRadius: '0.375rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          minWidth: '260px',
          maxWidth: '420px',
          fontSize: '0.875rem',
          fontWeight: 500,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          <span style={{ flex: 1 }}>{toast.message}</span>
          {onDismiss && (
            <button
              onClick={() => onDismiss(toast.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'inherit',
                fontSize: '1rem',
                lineHeight: 1,
                padding: '0 0.25rem',
                opacity: 0.7,
              }}
            >
              x
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
