import type { Account } from '@tc/shared';

interface AccountDetailProps {
  account: Account | null;
}

interface FieldProps {
  label: string;
  value: string;
  accent?: boolean;
}

function Field({ label, value, accent }: FieldProps) {
  return (
    <div style={{
      background: '#0f1929',
      border: '1px solid #1e3048',
      borderRadius: '0.375rem',
      padding: '0.75rem',
    }}>
      <div style={{
        fontSize: '0.6875rem',
        color: '#6b8599',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: '0.3rem',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: '0.9rem',
        color: accent ? '#00e5a0' : '#dde6ee',
        fontWeight: accent ? 600 : 400,
      }}>
        {value}
      </div>
    </div>
  );
}

export default function AccountDetail({ account }: AccountDetailProps) {
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

  const fortuneLabel = account.fortune_500
    ? 'F500'
    : account.fortune_1000
    ? 'F1000'
    : null;

  return (
    <div style={{ padding: '2rem', maxWidth: '820px' }}>
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h2 style={{
            margin: 0,
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#dde6ee',
          }}>
            {account.name}
          </h2>
          {fortuneLabel && (
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#00e5a0',
              border: '1px solid #00e5a0',
              borderRadius: '0.25rem',
              padding: '0.125rem 0.375rem',
              letterSpacing: '0.04em',
            }}>
              {fortuneLabel}
            </span>
          )}
        </div>
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
          marginTop: '0.375rem',
          flexWrap: 'wrap',
        }}>
          {account.industry && (
            <span style={{ color: '#6b8599', fontSize: '0.875rem' }}>{account.industry}</span>
          )}
          {account.industry && account.state && (
            <span style={{ color: '#1e3048' }}>|</span>
          )}
          {account.state && (
            <span style={{ color: '#6b8599', fontSize: '0.875rem' }}>{account.state}</span>
          )}
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: '0.75rem',
        marginBottom: '1.75rem',
      }}>
        <Field label="Status" value={account.status ?? 'Unknown'} />
        <Field label="Open Opps" value={String(account.open_opps ?? 0)} />
        <Field label="Last Activity" value={account.last_activity ?? 'None'} />
        {account.amount != null && (
          <Field label="Amount" value={`$${account.amount.toLocaleString()}`} />
        )}
      </div>

      {account.prior_context && (
        <div>
          <div style={{
            fontSize: '0.6875rem',
            color: '#6b8599',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: '0.5rem',
          }}>
            Prior Context
          </div>
          <div style={{
            background: '#0f1929',
            border: '1px solid #1e3048',
            borderRadius: '0.375rem',
            padding: '1rem',
            fontSize: '0.875rem',
            color: '#9db8cc',
            lineHeight: 1.65,
          }}>
            {account.prior_context}
          </div>
        </div>
      )}
    </div>
  );
}
