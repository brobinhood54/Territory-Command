import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { Account, Call, Stakeholder } from '@tc/shared';
import { api } from '../lib/api';
import type { AccountPatch } from '../lib/api';
import { showToast } from '../lib/toast';

// ---- constants ----

const STATUS_OPTIONS = [
  'Prospect', 'Discovery', 'Champion Building', 'Evaluation',
  'Active POC', 'Expansion', 'Stalled', 'Customer',
];

const HEALTH_COLOR: Record<string, string> = {
  red: '#e06050',
  yellow: '#f0a500',
  green: '#00e5a0',
  unknown: '#6b7c8f',
};

// ---- helpers ----

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return dateStr;
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

function formatAmount(amount: number | null | undefined): string | null {
  if (amount == null || amount === 0) return null;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${Math.round(amount / 1000)}k`;
  return `$${amount}`;
}

// ---- shared field card styles (Account Details grid) ----

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

// ---- section header style ----

const sectionHeader: CSSProperties = {
  fontSize: '0.625rem',
  fontWeight: 700,
  color: '#6b8599',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  marginBottom: '0.625rem',
};

// ---- VitalItem (module scope) ----

interface VitalItemProps {
  label: string;
  value: string;
  valueColor?: string;
  dot?: boolean;
  tooltip?: string;
}

function VitalItem({ label, value, valueColor, dot, tooltip }: VitalItemProps) {
  return (
    <div
      title={tooltip}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.2rem',
        minWidth: '72px',
        padding: '0.25rem 0.75rem',
        borderRight: '1px solid #1a2e44',
      }}
    >
      <div style={{
        fontSize: '0.5625rem',
        color: '#6b8599',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        userSelect: 'none',
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
        {dot && (
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: valueColor ?? '#6b7c8f',
            flexShrink: 0,
            display: 'inline-block',
          }} />
        )}
        <span style={{
          fontSize: '0.8125rem',
          fontWeight: 500,
          color: valueColor ?? '#dde6ee',
          whiteSpace: 'nowrap',
        }}>
          {value}
        </span>
      </div>
    </div>
  );
}

// ---- VitalSignsStrip (module scope) ----

interface VitalSignsStripProps {
  account: Account;
  dealHealth: string;
}

function VitalSignsStrip({ account, dealHealth }: VitalSignsStripProps) {
  const healthColor = HEALTH_COLOR[dealHealth] ?? HEALTH_COLOR.unknown;
  const lastTouchRelative = relativeTime(account.last_activity);
  const formattedAmount = formatAmount(account.amount);

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      background: '#0b1525',
      border: '1px solid #1e3048',
      borderRadius: '0.5rem',
      marginBottom: '1.25rem',
      overflow: 'hidden',
    }}>
      <VitalItem label="Status" value={account.status ?? '--'} />
      {account.fortune_500 && (
        <VitalItem label="Fortune" value="F500" valueColor="#f0a500" />
      )}
      <VitalItem
        label="Open Opps"
        value={account.open_opps != null ? String(account.open_opps) : '0'}
        valueColor={(account.open_opps ?? 0) > 0 ? '#00e5a0' : '#6b7c8f'}
      />
      <VitalItem
        label="Deal Health"
        value={dealHealth}
        valueColor={healthColor}
        dot
      />
      <VitalItem
        label="Last Touch"
        value={lastTouchRelative}
        tooltip={account.last_activity ?? undefined}
      />
      {formattedAmount && (
        <VitalItem label="Amount" value={formattedAmount} valueColor="#00e5a0" />
      )}
    </div>
  );
}

// ---- RecentCallCard (module scope) ----

interface RecentCallCardProps {
  call: Call;
  onClick: () => void;
}

function RecentCallCard({ call, onClick }: RecentCallCardProps) {
  const [hovered, setHovered] = useState(false);
  const health = call.health ?? 'unknown';
  const healthColor = HEALTH_COLOR[health] ?? HEALTH_COLOR.unknown;
  const summaryFirstLine = (call.summary ?? '').split('\n').find(l => l.trim()) ?? '';

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#0f1929',
        border: `1px solid ${hovered ? '#2e4a68' : '#1e3048'}`,
        borderRadius: '0.375rem',
        padding: '0.625rem 0.75rem',
        cursor: 'pointer',
        transition: 'border-color 0.1s',
        marginBottom: '0.5rem',
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.25rem',
        gap: '0.5rem',
      }}>
        <span style={{
          fontSize: '0.5625rem',
          fontWeight: 700,
          color: healthColor,
          border: `1px solid ${healthColor}`,
          borderRadius: '999px',
          padding: '0.1rem 0.4rem',
          letterSpacing: '0.04em',
          flexShrink: 0,
        }}>
          {health}
        </span>
        <span style={{ fontSize: '0.6875rem', color: '#6b8599', flexShrink: 0 }}>
          {call.date ?? 'No date'}
        </span>
      </div>
      <div style={{
        fontSize: '0.875rem',
        fontWeight: 600,
        color: '#dde6ee',
        marginBottom: '0.2rem',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {call.title || '(untitled)'}
      </div>
      <div style={{
        fontSize: '0.75rem',
        color: '#6b8599',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {summaryFirstLine || 'No summary'}
      </div>
    </div>
  );
}

// ---- StatItem (module scope) ----

interface StatItemProps {
  label: string;
  value: number;
  color: string;
}

function StatItem({ label, value, color }: StatItemProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', minWidth: '60px' }}>
      <span style={{ fontSize: '1.5rem', fontWeight: 700, color, lineHeight: 1 }}>{value}</span>
      <span style={{
        fontSize: '0.5625rem',
        color: '#6b8599',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
    </div>
  );
}

// ---- StakeholderSummaryCard (module scope) ----

interface StakeholderSummaryCardProps {
  stakeholders: Stakeholder[];
  onClick: () => void;
}

function StakeholderSummaryCard({ stakeholders, onClick }: StakeholderSummaryCardProps) {
  const [hovered, setHovered] = useState(false);
  const total = stakeholders.length;
  const champions = stakeholders.filter(s => s.type === 'Champion').length;
  const blockers = stakeholders.filter(s => s.type === 'Blocker/Skeptic').length;
  const goneDark = stakeholders.filter(s => s.temperature === 'gone_dark').length;

  if (total === 0) {
    return (
      <div
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: '#0f1929',
          border: `1px solid ${hovered ? '#2e4a68' : '#1e3048'}`,
          borderRadius: '0.375rem',
          padding: '0.875rem 1rem',
          cursor: 'pointer',
          transition: 'border-color 0.1s',
          textAlign: 'center',
          color: '#4a6070',
          fontSize: '0.8125rem',
        }}
      >
        No stakeholders yet. Click to add.
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#0f1929',
        border: `1px solid ${hovered ? '#2e4a68' : '#1e3048'}`,
        borderRadius: '0.375rem',
        padding: '0.875rem 1.25rem',
        cursor: 'pointer',
        display: 'flex',
        gap: '2rem',
        alignItems: 'center',
        transition: 'border-color 0.1s',
      }}
    >
      <StatItem label="Total" value={total} color="#dde6ee" />
      <StatItem label="Champions" value={champions} color="#00e5a0" />
      <StatItem label="Blockers" value={blockers} color="#e06050" />
      <StatItem label="Gone Dark" value={goneDark} color="#6b7c8f" />
    </div>
  );
}

// ---- PriorContextCallout (module scope) ----

interface PriorContextCalloutProps {
  value: string | null;
  isEditing: boolean;
  editValue: string;
  savedField: string | null;
  onStartEdit: () => void;
  onEditChange: (val: string) => void;
  onSave: () => void;
}

function PriorContextCallout({
  value, isEditing, editValue, savedField,
  onStartEdit, onEditChange, onSave,
}: PriorContextCalloutProps) {
  return (
    <div style={{
      background: '#0b1525',
      border: '1px solid #1e3048',
      borderLeft: '4px solid #00c2d4',
      borderRadius: '0.375rem',
      padding: '1rem 1.25rem',
      marginBottom: '1.5rem',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.5rem',
      }}>
        <span style={{
          fontSize: '0.625rem',
          fontWeight: 700,
          color: '#00c2d4',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          userSelect: 'none',
        }}>
          Prior Context
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {savedField === 'prior_context' && (
            <span style={{ fontSize: '0.6875rem', color: '#00e5a0' }}>saved</span>
          )}
          {!isEditing && (
            <button
              onClick={onStartEdit}
              title="Edit prior context"
              style={{
                background: 'none',
                border: 'none',
                color: '#4a6070',
                cursor: 'pointer',
                fontSize: '0.875rem',
                padding: '0 0.125rem',
                lineHeight: 1,
              }}
            >
              ✎
            </button>
          )}
        </div>
      </div>
      {isEditing ? (
        <textarea
          autoFocus
          value={editValue}
          onChange={e => onEditChange(e.target.value)}
          onBlur={onSave}
          style={{
            width: '100%',
            minHeight: '120px',
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid #1e3048',
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
        <div
          onClick={onStartEdit}
          style={{
            fontSize: '0.875rem',
            color: value ? '#9db8cc' : '#4a6070',
            lineHeight: 1.65,
            minHeight: '40px',
            whiteSpace: 'pre-wrap',
            cursor: 'pointer',
          }}
        >
          {value || 'No prior context captured yet. Click to add.'}
        </div>
      )}
    </div>
  );
}

// ---- InlineField (module scope, same as before) ----

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

// ---- AccountOverview (main export) ----

interface AccountOverviewProps {
  account: Account;
  calls: Call[];
  stakeholders: Stakeholder[];
  onUpdate: (updated: Account) => void;
  onSwitchToTab: (tab: 'calls' | 'stakeholders') => void;
  onHighlightCall: (callId: string) => void;
}

export default function AccountOverview({
  account, calls, stakeholders, onUpdate, onSwitchToTab, onHighlightCall,
}: AccountOverviewProps) {
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
    if (!editingField) return;
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
      showToast('success', 'Saved', { quiet: true });
    } catch (err) {
      console.error('Failed to save:', err);
      showToast('error', err instanceof Error ? err.message : 'Failed to save');
    }
  }

  async function handleStatusChange(value: string) {
    try {
      const updated = await api.accounts.update(account.id, { status: value || null });
      onUpdate(updated);
      flashSaved('status');
      showToast('success', 'Saved', { quiet: true });
    } catch (err) {
      console.error('Failed to save:', err);
      showToast('error', err instanceof Error ? err.message : 'Failed to save');
    }
  }

  async function handleFortuneToggle(field: 'fortune_500' | 'fortune_1000') {
    const newVal = !(account[field] ?? false);
    try {
      const updated = await api.accounts.update(account.id, { [field]: newVal });
      onUpdate(updated);
      flashSaved(field);
      showToast('success', 'Saved', { quiet: true });
    } catch (err) {
      console.error('Failed to save:', err);
      showToast('error', err instanceof Error ? err.message : 'Failed to save');
    }
  }

  // Derive deal health from most recent call, fall back to account field
  const sortedCalls = [...calls].sort((a, b) => {
    if (a.date && b.date) return b.date.localeCompare(a.date);
    if (a.date && !b.date) return -1;
    if (!a.date && b.date) return 1;
    return (b.created_at ?? 0) - (a.created_at ?? 0);
  });
  const recentCalls = sortedCalls.slice(0, 3);
  const dealHealth = sortedCalls[0]?.health ?? account.deal_health ?? 'unknown';

  const ifProps = {
    editingField,
    editValue,
    savedField,
    onStartEdit: startEdit,
    onEditChange: setEditValue,
    onSave: handleSave,
  };

  return (
    <div style={{ padding: '1.75rem 2rem', maxWidth: '820px' }}>

      {/* Account name (page title) */}
      <div style={{ marginBottom: '1.25rem' }}>
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
              fontSize: '1.375rem',
              fontWeight: 700,
              background: 'transparent',
              border: 'none',
              borderBottom: '2px solid #00e5a0',
              color: '#dde6ee',
              outline: 'none',
              fontFamily: 'inherit',
              width: '100%',
            }}
          />
        ) : (
          <h2
            onClick={() => startEdit('name', account.name)}
            style={{
              margin: 0,
              fontSize: '1.375rem',
              fontWeight: 700,
              color: '#dde6ee',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            {account.name}
            {savedField === 'name' && (
              <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#00e5a0' }}>saved</span>
            )}
          </h2>
        )}
      </div>

      {/* 1. Vital signs strip */}
      <VitalSignsStrip account={account} dealHealth={dealHealth} />

      {/* 2. Recent Calls */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ ...sectionHeader, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Recent Calls</span>
          {calls.length > 3 && (
            <span
              onClick={() => onSwitchToTab('calls')}
              style={{ fontSize: '0.625rem', color: '#6b8599', cursor: 'pointer', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}
            >
              See all {calls.length}
            </span>
          )}
        </div>
        {recentCalls.length === 0 ? (
          <div style={{
            background: '#0f1929',
            border: '1px solid #1e3048',
            borderRadius: '0.375rem',
            padding: '1rem',
            color: '#4a6070',
            fontSize: '0.8125rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span>No calls logged yet.</span>
            <span
              onClick={() => onSwitchToTab('calls')}
              style={{ color: '#00c2d4', cursor: 'pointer', fontSize: '0.75rem' }}
            >
              Drop a transcript
            </span>
          </div>
        ) : (
          recentCalls.map(call => (
            <RecentCallCard
              key={call.id}
              call={call}
              onClick={() => {
                onHighlightCall(call.id);
                onSwitchToTab('calls');
              }}
            />
          ))
        )}
      </div>

      {/* 3. Stakeholder Summary */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={sectionHeader}>Stakeholders</div>
        <StakeholderSummaryCard
          stakeholders={stakeholders}
          onClick={() => onSwitchToTab('stakeholders')}
        />
      </div>

      {/* 4. Prior Context featured callout */}
      <PriorContextCallout
        value={account.prior_context}
        isEditing={editingField === 'prior_context'}
        editValue={editValue}
        savedField={savedField}
        onStartEdit={() => startEdit('prior_context', account.prior_context ?? '')}
        onEditChange={setEditValue}
        onSave={handleSave}
      />

      {/* 5. Account Details */}
      <div>
        <div style={sectionHeader}>Account Details</div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))',
          gap: '0.75rem',
          marginBottom: '1.25rem',
        }}>

          {/* Status */}
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
                <option value="" style={{ background: '#0f1929' }}>--</option>
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

          {/* Fortune 500 */}
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

          {/* Fortune 1000 */}
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
      </div>

    </div>
  );
}
