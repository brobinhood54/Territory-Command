import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { Account } from '@tc/shared';
import { api } from '../lib/api';
import type { AccountPatch } from '../lib/api';

const STATUS_OPTIONS = [
  'Prospect', 'Discovery', 'Champion Building', 'Evaluation',
  'Active POC', 'Expansion', 'Stalled', 'Customer',
];

const HEALTH_COLOR: Record<string, string> = {
  red: '#ef4444',
  yellow: '#f0a500',
  green: '#00e5a0',
  unknown: '#6b8599',
};

const fieldCard: CSSProperties = {
  background: '#0f1929',
  border: '1px solid #1e3048',
  borderRadius: '0.375rem',
  padding: '0.625rem 0.75rem',
  cursor: 'pointer',
};

const labelCss: CSSProperties = {
  fontSize: '0.6875rem',
  color: '#6b8599',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '0.25rem',
  userSelect: 'none',
};

const inputCss: CSSProperties = {
  background: 'transparent',
  border: 'none',
  outline: 'none',
  color: '#dde6ee',
  fontSize: '0.875rem',
  width: '100%',
  padding: 0,
  fontFamily: 'inherit',
};

interface InlineFieldProps {
  field: string;
  label: string;
  rawValue: string;
  inputType?: 'text' | 'number' | 'date';
  editingField: string | null;
  editValue: string;
  savedField: string | null;
  onStartEdit: (field: string, currentVal: string) => void;
  onEditChange: (val: string) => void;
  onSave: () => void;
  link?: boolean;
}

function InlineField({
  field, label, rawValue, inputType = 'text',
  editingField, editValue, savedField,
  onStartEdit, onEditChange, onSave, link,
}: InlineFieldProps) {
  const isEditing = editingField === field;
  const isSaved = savedField === field;

  return (
    <div
      style={fieldCard}
      onClick={!isEditing ? () => onStartEdit(field, rawValue) : undefined}
    >
      <div style={labelCss}>{label}</div>
      {isEditing ? (
        <input
          autoFocus
          type={inputType}
          style={inputCss}
          value={editValue}
          onChange={e => onEditChange(e.target.value)}
          onBlur={onSave}
          onKeyDown={e => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
      ) : (
        <div style={{
          fontSize: '0.875rem',
          color: rawValue ? '#dde6ee' : '#4a6070',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.5rem',
          minHeight: '1.25rem',
        }}>
          {link && rawValue ? (
            <a
              href={rawValue}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#00e5a0', textDecoration: 'none', wordBreak: 'break-all', minWidth: 0 }}
              onClick={e => e.stopPropagation()}
            >
              {rawValue}
            </a>
          ) : (
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {rawValue || '—'}
            </span>
          )}
          {isSaved && (
            <span style={{ fontSize: '0.6875rem', color: '#00e5a0', flexShrink: 0 }}>saved</span>
          )}
        </div>
      )}
    </div>
  );
}

interface AccountDetailProps {
  account: Account | null;
  onUpdate: (updated: Account) => void;
}

export default function AccountDetail({ account, onUpdate }: AccountDetailProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savedField, setSavedField] = useState<string | null>(null);

  function startEdit(field: string, currentVal: string) {
    setEditingField(field);
    setEditValue(currentVal);
  }

  function flashSaved(field: string) {
    setSavedField(field);
    setTimeout(() => setSavedField(prev => (prev === field ? null : prev)), 1500);
  }

  async function handleSave() {
    if (!editingField || !account) return;
    const field = editingField;
    const raw = editValue.trim();
    setEditingField(null);

    let patch: AccountPatch;
    if (field === 'name') {
      if (!raw) return;
      patch = { name: raw };
    } else if (field === 'open_opps') {
      patch = { open_opps: raw !== '' ? Number(raw) : null };
    } else if (field === 'amount') {
      patch = { amount: raw !== '' ? Number(raw) : null };
    } else {
      patch = { [field]: raw || null } as AccountPatch;
    }

    try {
      const updated = await api.accounts.update(account.id, patch);
      onUpdate(updated);
      flashSaved(field);
    } catch (err) {
      console.error('Failed to save:', err);
    }
  }

  async function handleStatusChange(value: string) {
    if (!account) return;
    try {
      const updated = await api.accounts.update(account.id, { status: value || null });
      onUpdate(updated);
      flashSaved('status');
    } catch (err) {
      console.error('Failed to save:', err);
    }
  }

  async function handleFortuneToggle(field: 'fortune_500' | 'fortune_1000') {
    if (!account) return;
    const newVal = !(account[field] ?? false);
    try {
      const updated = await api.accounts.update(account.id, { [field]: newVal });
      onUpdate(updated);
      flashSaved(field);
    } catch (err) {
      console.error('Failed to save:', err);
    }
  }

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

  const healthColor = HEALTH_COLOR[account.deal_health ?? 'unknown'] ?? HEALTH_COLOR.unknown;

  const ifProps = {
    editingField,
    editValue,
    savedField,
    onStartEdit: startEdit,
    onEditChange: setEditValue,
    onSave: handleSave,
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '820px' }}>

      {/* Header: editable name + deal health badge */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
          {editingField === 'name' ? (
            <input
              autoFocus
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={handleSave}
              onKeyDown={e => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              }}
              style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                background: 'transparent',
                border: 'none',
                borderBottom: '2px solid #00e5a0',
                color: '#dde6ee',
                outline: 'none',
                fontFamily: 'inherit',
                flexGrow: 1,
                minWidth: 0,
              }}
            />
          ) : (
            <h2
              onClick={() => startEdit('name', account.name)}
              style={{
                margin: 0,
                fontSize: '1.5rem',
                fontWeight: 700,
                color: '#dde6ee',
                cursor: 'pointer',
              }}
            >
              {account.name}
              {savedField === 'name' && (
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 400,
                  marginLeft: '0.75rem',
                  color: '#00e5a0',
                }}>saved</span>
              )}
            </h2>
          )}
          {account.deal_health && (
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              color: healthColor,
              border: `1px solid ${healthColor}`,
              borderRadius: '0.25rem',
              padding: '0.125rem 0.375rem',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              flexShrink: 0,
            }}>
              {account.deal_health}
            </span>
          )}
        </div>
      </div>

      {/* Main fields grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))',
        gap: '0.75rem',
        marginBottom: '1.25rem',
      }}>

        {/* Status — select */}
        <div style={{ ...fieldCard, cursor: 'default' }}>
          <div style={labelCss}>Status</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <select
              value={account.status ?? ''}
              onChange={e => handleStatusChange(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: account.status ? '#dde6ee' : '#4a6070',
                fontSize: '0.875rem',
                cursor: 'pointer',
                outline: 'none',
                fontFamily: 'inherit',
                padding: 0,
                flex: 1,
              }}
            >
              <option value="" style={{ background: '#0f1929' }}>—</option>
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s} style={{ background: '#0f1929' }}>{s}</option>
              ))}
            </select>
            {savedField === 'status' && (
              <span style={{ fontSize: '0.6875rem', color: '#00e5a0', flexShrink: 0 }}>saved</span>
            )}
          </div>
        </div>

        <InlineField field="industry" label="Industry" rawValue={account.industry ?? ''} {...ifProps} />
        <InlineField field="state" label="State" rawValue={account.state ?? ''} {...ifProps} />
        <InlineField field="open_opps" label="Open Opps" rawValue={account.open_opps != null ? String(account.open_opps) : ''} inputType="number" {...ifProps} />
        <InlineField field="amount" label="Amount ($)" rawValue={account.amount != null ? String(account.amount) : ''} inputType="number" {...ifProps} />
        <InlineField field="last_activity" label="Last Activity" rawValue={account.last_activity ?? ''} inputType="date" {...ifProps} />

        {/* Fortune 500 — checkbox toggle */}
        <div style={fieldCard} onClick={() => handleFortuneToggle('fortune_500')}>
          <div style={labelCss}>Fortune 500</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minHeight: '1.25rem' }}>
            <input
              type="checkbox"
              checked={account.fortune_500 ?? false}
              onChange={() => handleFortuneToggle('fortune_500')}
              onClick={e => e.stopPropagation()}
              style={{ accentColor: '#00e5a0', cursor: 'pointer', width: '14px', height: '14px', flexShrink: 0 }}
            />
            <span style={{ fontSize: '0.875rem', color: '#dde6ee' }}>
              {account.fortune_500 ? 'Yes' : 'No'}
            </span>
            {savedField === 'fortune_500' && (
              <span style={{ fontSize: '0.6875rem', color: '#00e5a0', marginLeft: 'auto' }}>saved</span>
            )}
          </div>
        </div>

        {/* Fortune 1000 — checkbox toggle */}
        <div style={fieldCard} onClick={() => handleFortuneToggle('fortune_1000')}>
          <div style={labelCss}>Fortune 1000</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minHeight: '1.25rem' }}>
            <input
              type="checkbox"
              checked={account.fortune_1000 ?? false}
              onChange={() => handleFortuneToggle('fortune_1000')}
              onClick={e => e.stopPropagation()}
              style={{ accentColor: '#00e5a0', cursor: 'pointer', width: '14px', height: '14px', flexShrink: 0 }}
            />
            <span style={{ fontSize: '0.875rem', color: '#dde6ee' }}>
              {account.fortune_1000 ? 'Yes' : 'No'}
            </span>
            {savedField === 'fortune_1000' && (
              <span style={{ fontSize: '0.6875rem', color: '#00e5a0', marginLeft: 'auto' }}>saved</span>
            )}
          </div>
        </div>

        <InlineField field="website" label="Website" rawValue={account.website ?? ''} link {...ifProps} />
        <InlineField field="linkedin_url" label="LinkedIn" rawValue={account.linkedin_url ?? ''} link {...ifProps} />
      </div>

      {/* Prior Context — full-width click-to-edit textarea */}
      <div
        style={{
          background: '#0f1929',
          border: `1px solid ${editingField === 'prior_context' ? '#00e5a0' : '#1e3048'}`,
          borderRadius: '0.375rem',
          padding: '0.75rem',
          cursor: editingField === 'prior_context' ? 'default' : 'pointer',
          transition: 'border-color 0.1s',
        }}
        onClick={editingField !== 'prior_context'
          ? () => startEdit('prior_context', account.prior_context ?? '')
          : undefined}
      >
        <div style={{ ...labelCss, display: 'flex', justifyContent: 'space-between' }}>
          <span>Prior Context</span>
          {savedField === 'prior_context' && (
            <span style={{ fontSize: '0.6875rem', color: '#00e5a0', textTransform: 'none', letterSpacing: 0 }}>
              saved
            </span>
          )}
        </div>
        {editingField === 'prior_context' ? (
          <textarea
            autoFocus
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={handleSave}
            style={{
              width: '100%',
              minHeight: '120px',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#dde6ee',
              fontSize: '0.875rem',
              lineHeight: 1.65,
              resize: 'vertical',
              fontFamily: 'inherit',
              padding: 0,
              boxSizing: 'border-box',
            }}
          />
        ) : (
          <div style={{
            fontSize: '0.875rem',
            color: account.prior_context ? '#9db8cc' : '#4a6070',
            lineHeight: 1.65,
            minHeight: '40px',
            whiteSpace: 'pre-wrap',
          }}>
            {account.prior_context || 'Click to add context...'}
          </div>
        )}
      </div>

    </div>
  );
}
