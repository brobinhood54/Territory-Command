import { useState, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { Stakeholder } from '@tc/shared';
import { api } from '../lib/api';
import { showToast } from '../lib/toast';
import { useConfirm } from './ConfirmModal';

// ---- constants ----

const TYPE_ORDER = [
  'Economic Buyer',
  'Champion',
  'Technical Evaluator',
  'Influencer',
  'Blocker/Skeptic',
  'Unclassified',
];

const TYPE_COLOR: Record<string, string> = {
  'Economic Buyer': '#f0a500',
  'Champion': '#00e5a0',
  'Technical Evaluator': '#00c2d4',
  'Influencer': '#a78bfa',
  'Blocker/Skeptic': '#e06050',
  'Unclassified': '#6b7c8f',
};

const TEMP_COLOR: Record<string, string> = {
  hot: '#e06050',
  warm: '#f0a500',
  cold: '#00c2d4',
  gone_dark: '#6b7c8f',
};

const TEMP_OPTIONS = ['hot', 'warm', 'cold', 'gone_dark'];
const TYPE_OPTIONS = TYPE_ORDER;

// ---- shared styles ----

const cardStyle: CSSProperties = {
  background: '#0f1929',
  border: '1px solid #1e3048',
  borderRadius: '0.5rem',
  padding: '1rem',
  marginBottom: '0.625rem',
};

const labelCss: CSSProperties = {
  fontSize: '0.6375rem',
  color: '#6b8599',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '0.2rem',
  userSelect: 'none',
};

const fieldRowStyle: CSSProperties = {
  marginBottom: '0.5rem',
};

const inputCss: CSSProperties = {
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid #1e3048',
  outline: 'none',
  color: '#dde6ee',
  fontSize: '0.875rem',
  width: '100%',
  padding: '0.125rem 0',
  fontFamily: 'inherit',
};

const textareaCss: CSSProperties = {
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid #1e3048',
  outline: 'none',
  color: '#dde6ee',
  fontSize: '0.8125rem',
  width: '100%',
  padding: '0.125rem 0',
  fontFamily: 'inherit',
  resize: 'vertical',
  minHeight: '60px',
  lineHeight: 1.55,
};

function pill(color: string): CSSProperties {
  return {
    display: 'inline-block',
    fontSize: '0.6rem',
    fontWeight: 700,
    color,
    border: `1px solid ${color}`,
    borderRadius: '999px',
    padding: '0.1rem 0.45rem',
    letterSpacing: '0.04em',
    cursor: 'pointer',
    userSelect: 'none',
  };
}

// ---- module-scope sub-components ----

interface InlineTextProps {
  value: string;
  placeholder?: string;
  isEditing: boolean;
  isSaved: boolean;
  onStartEdit: () => void;
  onChange: (v: string) => void;
  onBlur: () => void;
  bold?: boolean;
  fontSize?: string;
  multiline?: boolean;
  inputType?: string;
}

function InlineText({
  value, placeholder, isEditing, isSaved,
  onStartEdit, onChange, onBlur, bold, fontSize, multiline, inputType,
}: InlineTextProps) {
  const displayStyle: CSSProperties = {
    fontSize: fontSize ?? '0.875rem',
    fontWeight: bold ? 600 : 400,
    color: value ? '#dde6ee' : '#4a6070',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    minHeight: '1.25rem',
  };

  if (isEditing) {
    if (multiline) {
      return (
        <textarea
          autoFocus
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={onBlur}
          style={textareaCss}
        />
      );
    }
    return (
      <input
        autoFocus
        type={inputType ?? 'text'}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        style={inputCss}
      />
    );
  }

  return (
    <span style={displayStyle} onClick={onStartEdit}>
      {value || placeholder || '—'}
      {isSaved && (
        <span style={{ fontSize: '0.625rem', color: '#00e5a0', fontWeight: 400 }}>saved</span>
      )}
    </span>
  );
}

interface TempPillProps {
  value: string | null;
  showDropdown: boolean;
  onToggleDropdown: () => void;
  onSelect: (v: string) => void;
}

function TempPill({ value, showDropdown, onToggleDropdown, onSelect }: TempPillProps) {
  const display = value ?? 'warm';
  const color = TEMP_COLOR[display] ?? TEMP_COLOR.warm;
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <span style={pill(color)} onClick={onToggleDropdown}>
        {display.replace('_', ' ')}
      </span>
      {showDropdown && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          zIndex: 10,
          background: '#162032',
          border: '1px solid #1e3048',
          borderRadius: '0.375rem',
          padding: '0.25rem 0',
          minWidth: '100px',
          marginTop: '0.25rem',
        }}>
          {TEMP_OPTIONS.map(t => (
            <div
              key={t}
              onClick={() => onSelect(t)}
              style={{
                padding: '0.375rem 0.75rem',
                fontSize: '0.8125rem',
                color: TEMP_COLOR[t],
                cursor: 'pointer',
              }}
            >
              {t.replace('_', ' ')}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface TypePillProps {
  value: string | null;
  showDropdown: boolean;
  onToggleDropdown: () => void;
  onSelect: (v: string) => void;
}

function TypePill({ value, showDropdown, onToggleDropdown, onSelect }: TypePillProps) {
  const display = value ?? 'Unclassified';
  const color = TYPE_COLOR[display] ?? TYPE_COLOR.Unclassified;
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <span style={pill(color)} onClick={onToggleDropdown}>
        {display}
      </span>
      {showDropdown && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          zIndex: 10,
          background: '#162032',
          border: '1px solid #1e3048',
          borderRadius: '0.375rem',
          padding: '0.25rem 0',
          minWidth: '160px',
          marginTop: '0.25rem',
        }}>
          {TYPE_OPTIONS.map(t => (
            <div
              key={t}
              onClick={() => onSelect(t)}
              style={{
                padding: '0.375rem 0.75rem',
                fontSize: '0.8125rem',
                color: TYPE_COLOR[t],
                cursor: 'pointer',
              }}
            >
              {t}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface CollapsibleTextProps {
  label: string;
  value: string;
  isEditing: boolean;
  isSaved: boolean;
  onStartEdit: () => void;
  onChange: (v: string) => void;
  onBlur: () => void;
}

function CollapsibleText({
  label, value, isEditing, isSaved, onStartEdit, onChange, onBlur,
}: CollapsibleTextProps) {
  const [open, setOpen] = useState(false);
  const hasContent = !!value.trim();
  const show = open || isEditing || hasContent;

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <div
        style={{
          ...labelCss,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
        }}
        onClick={() => !isEditing && setOpen(v => !v)}
      >
        <span style={{
          fontSize: '0.6rem',
          color: '#4a6070',
          transform: show ? 'rotate(90deg)' : 'none',
          display: 'inline-block',
          transition: 'transform 0.1s',
        }}>
          &#9658;
        </span>
        {label}
        {isSaved && (
          <span style={{ fontSize: '0.625rem', color: '#00e5a0', textTransform: 'none', letterSpacing: 0, marginLeft: '0.25rem' }}>
            saved
          </span>
        )}
      </div>
      {show && (
        isEditing ? (
          <textarea
            autoFocus
            value={value}
            onChange={e => onChange(e.target.value)}
            onBlur={onBlur}
            style={textareaCss}
          />
        ) : (
          <div
            onClick={onStartEdit}
            style={{
              fontSize: '0.8125rem',
              color: hasContent ? '#9db8cc' : '#4a6070',
              cursor: 'pointer',
              lineHeight: 1.55,
              whiteSpace: 'pre-wrap',
              minHeight: '1.2rem',
            }}
          >
            {value || 'Click to add...'}
          </div>
        )
      )}
    </div>
  );
}

interface MergePanelProps {
  stakeholderId: string;
  others: Stakeholder[];
  onMerge: (sourceId: string, targetId: string) => Promise<void>;
  onClose: () => void;
}

function MergePanel({ stakeholderId, others, onMerge, onClose }: MergePanelProps) {
  const [targetId, setTargetId] = useState('');
  const [merging, setMerging] = useState(false);

  async function confirm() {
    if (!targetId) return;
    setMerging(true);
    await onMerge(stakeholderId, targetId);
    setMerging(false);
  }

  return (
    <div style={{
      marginTop: '0.75rem',
      background: '#0a1220',
      border: '1px solid #1e3048',
      borderRadius: '0.375rem',
      padding: '0.75rem',
    }}>
      <div style={{ fontSize: '0.75rem', color: '#9db8cc', marginBottom: '0.5rem' }}>
        Merge this entry INTO:
      </div>
      <select
        value={targetId}
        onChange={e => setTargetId(e.target.value)}
        style={{
          background: '#162032',
          border: '1px solid #1e3048',
          borderRadius: '0.25rem',
          color: '#dde6ee',
          fontSize: '0.8125rem',
          padding: '0.3rem 0.5rem',
          width: '100%',
          marginBottom: '0.5rem',
          fontFamily: 'inherit',
        }}
      >
        <option value="">Select stakeholder...</option>
        {others.map(s => (
          <option key={s.id} value={s.id}>{s.name} ({s.type ?? 'Unclassified'})</option>
        ))}
      </select>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={confirm}
          disabled={!targetId || merging}
          style={{
            background: targetId ? '#00e5a0' : '#1e3048',
            color: targetId ? '#080e1a' : '#6b8599',
            border: 'none',
            borderRadius: '0.25rem',
            padding: '0.3rem 0.75rem',
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: targetId ? 'pointer' : 'default',
          }}
        >
          {merging ? 'Merging...' : 'Confirm'}
        </button>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: '1px solid #1e3048',
            borderRadius: '0.25rem',
            color: '#6b8599',
            padding: '0.3rem 0.75rem',
            fontSize: '0.8125rem',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---- StakeholderCard ----

interface StakeholderCardProps {
  stakeholder: Stakeholder;
  allStakeholders: Stakeholder[];
  focusName: boolean;
  onUpdate: (updated: Stakeholder) => void;
  onDelete: (id: string) => void;
  onMerge: (sourceId: string, targetId: string) => Promise<void>;
}

function StakeholderCard({
  stakeholder, allStakeholders, focusName, onUpdate, onDelete, onMerge,
}: StakeholderCardProps) {
  const confirm = useConfirm();
  const [editingField, setEditingField] = useState<string | null>(focusName ? 'name' : null);
  const [editValues, setEditValues] = useState<Record<string, string>>({
    name: stakeholder.name,
    title: stakeholder.title ?? '',
    email: stakeholder.email ?? '',
    linkedin_url: stakeholder.linkedin_url ?? '',
    priorities: stakeholder.priorities ?? '',
    messaging: stakeholder.messaging ?? '',
    notes: stakeholder.notes ?? '',
  });
  const [savedField, setSavedField] = useState<string | null>(null);
  const [showTempDropdown, setShowTempDropdown] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showMerge, setShowMerge] = useState(false);

  // Sync editValues when stakeholder prop changes (after save)
  const prevId = useRef(stakeholder.id);
  if (prevId.current !== stakeholder.id) {
    prevId.current = stakeholder.id;
  }

  function flashSaved(field: string) {
    setSavedField(field);
    setTimeout(() => setSavedField(prev => (prev === field ? null : prev)), 1500);
  }

  function startEdit(field: string) {
    setEditingField(field);
  }

  function setFieldValue(field: string, value: string) {
    setEditValues(prev => ({ ...prev, [field]: value }));
  }

  async function saveField(field: string) {
    setEditingField(null);
    const raw = editValues[field]?.trim() ?? '';

    const patch: Record<string, unknown> = {};
    if (field === 'name') {
      if (!raw) {
        setEditValues(prev => ({ ...prev, name: stakeholder.name }));
        return;
      }
      patch.name = raw;
    } else if (field === 'email') {
      patch.email = raw || null;
    } else if (field === 'linkedin_url') {
      patch.linkedinUrl = raw || null;
    } else {
      patch[field] = raw || null;
    }

    try {
      const updated = await api.stakeholders.update(stakeholder.id, patch);
      onUpdate(updated);
      flashSaved(field);
      showToast('success', 'Saved', { quiet: true });
    } catch (err) {
      console.error('Failed to save:', err);
      showToast('error', err instanceof Error ? err.message : 'Failed to save');
    }
  }

  async function handleTempSelect(value: string) {
    setShowTempDropdown(false);
    try {
      const updated = await api.stakeholders.update(stakeholder.id, { temperature: value });
      onUpdate(updated);
      flashSaved('temperature');
      showToast('success', 'Saved', { quiet: true });
    } catch (err) {
      console.error('Failed to save:', err);
      showToast('error', err instanceof Error ? err.message : 'Failed to save');
    }
  }

  async function handleTypeSelect(value: string) {
    setShowTypeDropdown(false);
    try {
      const updated = await api.stakeholders.update(stakeholder.id, { type: value });
      onUpdate(updated);
      flashSaved('type');
      showToast('success', 'Saved', { quiet: true });
    } catch (err) {
      console.error('Failed to save:', err);
      showToast('error', err instanceof Error ? err.message : 'Failed to save');
    }
  }

  async function handleChampionToggle() {
    const newVal = !(stakeholder.champion_confirmed ?? false);
    try {
      const updated = await api.stakeholders.update(stakeholder.id, { championConfirmed: newVal });
      onUpdate(updated);
      flashSaved('champion_confirmed');
      showToast('success', 'Saved', { quiet: true });
    } catch (err) {
      console.error('Failed to save:', err);
      showToast('error', err instanceof Error ? err.message : 'Failed to save');
    }
  }

  async function handleDeleteClick() {
    const ok = await confirm({
      title: `Delete ${stakeholder.name}?`,
      body: 'This cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) onDelete(stakeholder.id);
  }

  const typeColor = TYPE_COLOR[stakeholder.type ?? 'Unclassified'] ?? TYPE_COLOR.Unclassified;
  const others = allStakeholders.filter(s => s.id !== stakeholder.id);

  return (
    <div style={{ ...cardStyle, borderLeft: `3px solid ${typeColor}` }}>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <InlineText
            value={editValues.name}
            isEditing={editingField === 'name'}
            isSaved={savedField === 'name'}
            onStartEdit={() => startEdit('name')}
            onChange={v => setFieldValue('name', v)}
            onBlur={() => saveField('name')}
            bold
            fontSize="0.9375rem"
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
          <TypePill
            value={stakeholder.type}
            showDropdown={showTypeDropdown}
            onToggleDropdown={() => { setShowTypeDropdown(v => !v); setShowTempDropdown(false); }}
            onSelect={handleTypeSelect}
          />
          {stakeholder.type === 'Champion' && stakeholder.champion_confirmed && (
            <span
              title="Champion confirmed"
              style={{ fontSize: '0.85rem', cursor: 'pointer', color: '#f0a500' }}
              onClick={handleChampionToggle}
            >
              &#9733;
            </span>
          )}
          {stakeholder.type === 'Champion' && !stakeholder.champion_confirmed && (
            <span
              title="Confirm champion"
              style={{ fontSize: '0.85rem', cursor: 'pointer', color: '#4a6070' }}
              onClick={handleChampionToggle}
            >
              &#9734;
            </span>
          )}
          <TempPill
            value={stakeholder.temperature}
            showDropdown={showTempDropdown}
            onToggleDropdown={() => { setShowTempDropdown(v => !v); setShowTypeDropdown(false); }}
            onSelect={handleTempSelect}
          />
          <button
            onClick={handleDeleteClick}
            title="Delete"
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
            &#x2715;
          </button>
        </div>
      </div>

      {/* Title */}
      <div style={fieldRowStyle}>
        <div style={labelCss}>Title</div>
        <InlineText
          value={editValues.title}
          placeholder="Click to add title..."
          isEditing={editingField === 'title'}
          isSaved={savedField === 'title'}
          onStartEdit={() => startEdit('title')}
          onChange={v => setFieldValue('title', v)}
          onBlur={() => saveField('title')}
          fontSize="0.8125rem"
        />
      </div>

      {/* Email */}
      <div style={fieldRowStyle}>
        <div style={labelCss}>Email</div>
        {editingField === 'email' ? (
          <input
            autoFocus
            type="email"
            value={editValues.email}
            onChange={e => setFieldValue('email', e.target.value)}
            onBlur={() => saveField('email')}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            style={inputCss}
          />
        ) : (
          <div
            style={{ fontSize: '0.8125rem', color: editValues.email ? '#dde6ee' : '#4a6070', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            onClick={() => startEdit('email')}
          >
            {editValues.email ? (
              <a
                href={`mailto:${editValues.email}`}
                style={{ color: '#00e5a0', textDecoration: 'none' }}
                onClick={e => e.stopPropagation()}
              >
                {editValues.email}
              </a>
            ) : (
              <span>Click to add email...</span>
            )}
            {savedField === 'email' && <span style={{ fontSize: '0.625rem', color: '#00e5a0' }}>saved</span>}
          </div>
        )}
      </div>

      {/* LinkedIn */}
      <div style={fieldRowStyle}>
        <div style={labelCss}>LinkedIn</div>
        {editingField === 'linkedin_url' ? (
          <input
            autoFocus
            type="url"
            value={editValues.linkedin_url}
            onChange={e => setFieldValue('linkedin_url', e.target.value)}
            onBlur={() => saveField('linkedin_url')}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            style={inputCss}
          />
        ) : (
          <div
            style={{ fontSize: '0.8125rem', color: editValues.linkedin_url ? '#dde6ee' : '#4a6070', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            onClick={() => startEdit('linkedin_url')}
          >
            {editValues.linkedin_url ? (
              <a
                href={editValues.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#00e5a0', textDecoration: 'none' }}
                onClick={e => e.stopPropagation()}
              >
                LinkedIn
              </a>
            ) : (
              <span>Click to add LinkedIn...</span>
            )}
            {savedField === 'linkedin_url' && <span style={{ fontSize: '0.625rem', color: '#00e5a0' }}>saved</span>}
          </div>
        )}
      </div>

      {/* Collapsible long-text sections */}
      <CollapsibleText
        label="Priorities"
        value={editValues.priorities}
        isEditing={editingField === 'priorities'}
        isSaved={savedField === 'priorities'}
        onStartEdit={() => startEdit('priorities')}
        onChange={v => setFieldValue('priorities', v)}
        onBlur={() => saveField('priorities')}
      />
      <CollapsibleText
        label="Messaging"
        value={editValues.messaging}
        isEditing={editingField === 'messaging'}
        isSaved={savedField === 'messaging'}
        onStartEdit={() => startEdit('messaging')}
        onChange={v => setFieldValue('messaging', v)}
        onBlur={() => saveField('messaging')}
      />
      <CollapsibleText
        label="Notes"
        value={editValues.notes}
        isEditing={editingField === 'notes'}
        isSaved={savedField === 'notes'}
        onStartEdit={() => startEdit('notes')}
        onChange={v => setFieldValue('notes', v)}
        onBlur={() => saveField('notes')}
      />

      {/* Merge + delete actions */}
      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button
          onClick={() => setShowMerge(v => !v)}
          style={{
            background: 'none',
            border: '1px solid #1e3048',
            borderRadius: '0.25rem',
            color: '#6b8599',
            fontSize: '0.75rem',
            padding: '0.2rem 0.6rem',
            cursor: 'pointer',
          }}
        >
          Merge
        </button>
      </div>

      {showMerge && others.length > 0 && (
        <MergePanel
          stakeholderId={stakeholder.id}
          others={others}
          onMerge={onMerge}
          onClose={() => setShowMerge(false)}
        />
      )}
      {showMerge && others.length === 0 && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: '#4a6070' }}>
          No other stakeholders to merge with.
        </div>
      )}
    </div>
  );
}

// ---- AccountStakeholders (main export) ----

interface AccountStakeholdersProps {
  accountId: string;
  accountName: string;
}

export default function AccountStakeholders({ accountId }: AccountStakeholdersProps) {
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [newId, setNewId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api.stakeholders.list(accountId)
      .then(rows => { setStakeholders(rows); setLoading(false); })
      .catch(err => { console.error('Failed to load stakeholders:', err); setLoading(false); showToast('error', 'Failed to load stakeholders'); });
  }, [accountId]);

  async function handleAdd() {
    try {
      const created = await api.stakeholders.create(accountId, { name: '(new stakeholder)' });
      setStakeholders(prev => [...prev, created]);
      setNewId(created.id);
      showToast('success', 'Stakeholder added');
    } catch (err) {
      console.error('Failed to create stakeholder:', err);
      showToast('error', err instanceof Error ? err.message : 'Failed to add stakeholder');
    }
  }

  function handleUpdate(updated: Stakeholder) {
    setStakeholders(prev => prev.map(s => s.id === updated.id ? updated : s));
    setNewId(null);
  }

  async function handleDelete(id: string) {
    try {
      await api.stakeholders.delete(id);
      setStakeholders(prev => prev.filter(s => s.id !== id));
      showToast('success', 'Stakeholder deleted');
    } catch (err) {
      console.error('Failed to delete:', err);
      showToast('error', err instanceof Error ? err.message : 'Failed to delete stakeholder');
    }
  }

  async function handleMerge(sourceId: string, targetId: string) {
    try {
      const updated = await api.stakeholders.merge(sourceId, targetId);
      setStakeholders(prev =>
        prev.filter(s => s.id !== sourceId).map(s => s.id === targetId ? updated : s)
      );
      showToast('success', 'Stakeholders merged');
    } catch (err) {
      console.error('Failed to merge:', err);
      showToast('error', err instanceof Error ? err.message : 'Failed to merge stakeholders');
    }
  }

  // Sort by type rank then name (same as backend, but client re-sorts after updates)
  const TYPE_RANK: Record<string, number> = {
    'Economic Buyer': 1, 'Champion': 2, 'Technical Evaluator': 3,
    'Influencer': 4, 'Blocker/Skeptic': 5, 'Unclassified': 6,
  };

  const sorted = [...stakeholders].sort((a, b) => {
    const ra = TYPE_RANK[a.type ?? 'Unclassified'] ?? 6;
    const rb = TYPE_RANK[b.type ?? 'Unclassified'] ?? 6;
    if (ra !== rb) return ra - rb;
    return (a.name ?? '').localeCompare(b.name ?? '');
  });

  // Group by type
  const groups: Record<string, Stakeholder[]> = {};
  for (const s of sorted) {
    const t = s.type ?? 'Unclassified';
    if (!groups[t]) groups[t] = [];
    groups[t].push(s);
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', color: '#6b8599', fontSize: '0.875rem' }}>
        Loading stakeholders...
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: '820px' }}>

      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <span style={{ fontSize: '0.8125rem', color: '#6b8599' }}>
          {stakeholders.length === 0 ? 'No stakeholders yet' : `${stakeholders.length} stakeholder${stakeholders.length !== 1 ? 's' : ''}`}
        </span>
        <button
          onClick={handleAdd}
          style={{
            background: '#00e5a0',
            color: '#080e1a',
            border: 'none',
            borderRadius: '0.375rem',
            padding: '0.4rem 0.875rem',
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + Add Stakeholder
        </button>
      </div>

      {/* Empty state */}
      {stakeholders.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '3rem 1.5rem',
          background: '#0f1929',
          border: '1px solid #1e3048',
          borderRadius: '0.5rem',
          color: '#6b8599',
          fontSize: '0.875rem',
          lineHeight: 1.65,
        }}>
          No stakeholders yet. Click + Add Stakeholder to start mapping the buying committee.
        </div>
      )}

      {/* Grouped cards */}
      {TYPE_ORDER.filter(t => groups[t]?.length > 0).map(type => (
        <div key={type} style={{ marginBottom: '1.25rem' }}>
          <div style={{
            fontSize: '0.6875rem',
            fontWeight: 700,
            color: TYPE_COLOR[type],
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            {type}
            <span style={{ fontWeight: 400, color: '#4a6070' }}>({groups[type].length})</span>
          </div>
          {groups[type].map(s => (
            <StakeholderCard
              key={s.id}
              stakeholder={s}
              allStakeholders={stakeholders}
              focusName={s.id === newId}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onMerge={handleMerge}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
