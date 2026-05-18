import { useState } from 'react';
import type { PainEnriched, PainWithSources, PainSource, Stakeholder, PainCategory } from '@tc/shared';
import { api } from '../lib/api';
import { showToast } from '../lib/toast';
import { showConfirm } from './ConfirmModal';

// ---- constants ----

const CATEGORY_ORDER: PainCategory[] = ['nhi', 'agentic', 'compliance', 'operational', 'strategic'];

const CATEGORY_LABEL: Record<PainCategory, string> = {
  nhi: 'NHI',
  agentic: 'Agentic',
  compliance: 'Compliance',
  operational: 'Operational',
  strategic: 'Strategic',
};

const CATEGORY_COLOR: Record<PainCategory, string> = {
  nhi: '#00c2d4',
  agentic: '#a78bfa',
  compliance: '#f0a500',
  operational: '#6b8599',
  strategic: '#00e5a0',
};

const CONFIDENCE_COLOR: Record<string, string> = {
  high: '#00e5a0',
  medium: '#f0a500',
  low: '#6b8599',
};

// ---- helper ----

function callCount(sources: PainSource[]): number {
  return new Set(sources.map(s => s.call_id)).size;
}

// ---- EvidencePanel ----

interface EvidencePanelProps {
  sources: PainSource[];
  onOpenSourceCall: (callId: string) => void;
}

function EvidencePanel({ sources, onOpenSourceCall }: EvidencePanelProps) {
  if (sources.length === 0) {
    return (
      <div style={{ padding: '0.625rem 0', color: '#6b8599', fontSize: '0.8rem' }}>
        No evidence sources available.
      </div>
    );
  }

  return (
    <div style={{ marginTop: '0.5rem' }}>
      {sources.map(src => (
        <div
          key={src.id}
          style={{
            marginBottom: '0.625rem',
            padding: '0.625rem',
            background: '#0a1220',
            border: '1px solid #1e3048',
            borderRadius: '0.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#dde6ee' }}>
              {src.voicer_name}
            </span>
            <button
              onClick={() => onOpenSourceCall(src.call_id)}
              style={{
                background: 'none',
                border: 'none',
                color: '#00c2d4',
                fontSize: '0.7rem',
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline',
                fontFamily: 'inherit',
                marginLeft: 'auto',
              }}
            >
              {src.call_title ?? 'View call'}{src.call_date ? ` (${src.call_date})` : ''}
            </button>
          </div>
          <div style={{
            fontSize: '0.8rem',
            color: '#9db8cc',
            fontStyle: 'italic',
            lineHeight: 1.5,
          }}>
            "{src.quote}"
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- MergePanel ----

interface MergePanelProps {
  pain: PainEnriched;
  allPains: PainEnriched[];
  onMerged: () => void;
  onCancel: () => void;
}

function MergePanel({ pain, allPains, onMerged, onCancel }: MergePanelProps) {
  const candidates = allPains.filter(p => p.id !== pain.id);
  const [targetId, setTargetId] = useState(candidates[0]?.id ?? '');
  const [merging, setMerging] = useState(false);

  async function handleMerge() {
    if (!targetId) return;
    const ok = await showConfirm({
      title: 'Merge pain points?',
      body: 'The selected pain will absorb this one. All evidence sources will be combined. This cannot be undone.',
      confirmLabel: 'Merge',
      destructive: true,
    });
    if (!ok) return;
    setMerging(true);
    try {
      await api.pains.merge(pain.id, targetId);
      showToast('success', 'Pain points merged.', { quiet: true });
      onMerged();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Merge failed');
      setMerging(false);
    }
  }

  if (candidates.length === 0) {
    return (
      <div style={{
        marginTop: '0.5rem',
        padding: '0.625rem',
        background: '#0a1220',
        border: '1px solid #1e3048',
        borderRadius: '0.375rem',
        fontSize: '0.8rem',
        color: '#6b8599',
      }}>
        No other pain points on this account to merge with.
        <div style={{ marginTop: '0.5rem' }}>
          <SmallBtn label="Cancel" color="#6b8599" onClick={onCancel} />
        </div>
      </div>
    );
  }

  return (
    <div style={{
      marginTop: '0.5rem',
      padding: '0.75rem',
      background: '#0a1220',
      border: '1px solid #1e3048',
      borderRadius: '0.375rem',
    }}>
      <div style={{ fontSize: '0.75rem', color: '#9db8cc', marginBottom: '0.375rem' }}>
        Merge this pain into:
      </div>
      <select
        value={targetId}
        onChange={e => setTargetId(e.target.value)}
        style={{
          width: '100%',
          background: '#162032',
          border: '1px solid #1e3048',
          borderRadius: '0.25rem',
          color: '#dde6ee',
          fontSize: '0.8125rem',
          padding: '0.3rem 0.5rem',
          outline: 'none',
          fontFamily: 'inherit',
          marginBottom: '0.5rem',
        }}
      >
        {candidates.map(p => (
          <option key={p.id} value={p.id}>
            [{CATEGORY_LABEL[p.category as PainCategory] ?? p.category}] {p.summary}
          </option>
        ))}
      </select>
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <SmallBtn label="Cancel" color="#6b8599" onClick={onCancel} />
        <SmallBtn label={merging ? 'Merging...' : 'Confirm merge'} color="#e06050" onClick={handleMerge} disabled={merging} />
      </div>
    </div>
  );
}

// ---- EditPanel ----

interface EditPanelProps {
  pain: PainEnriched;
  onSaved: (updated: PainEnriched) => void;
  onCancel: () => void;
}

function EditPanel({ pain, onSaved, onCancel }: EditPanelProps) {
  const [summary, setSummary] = useState(pain.summary);
  const [category, setCategory] = useState<PainCategory>(pain.category as PainCategory);
  const [confidence, setConfidence] = useState(pain.confidence);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!summary.trim()) return;
    setSaving(true);
    try {
      const updated = await api.pains.update(pain.id, {
        summary: summary.trim(),
        category,
        confidence,
      });
      showToast('success', 'Pain updated.', { quiet: true });
      onSaved({ ...pain, ...updated });
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      marginTop: '0.5rem',
      padding: '0.75rem',
      background: '#0a1220',
      border: '1px solid #1e3048',
      borderRadius: '0.375rem',
    }}>
      <div style={{ marginBottom: '0.5rem' }}>
        <div style={{ fontSize: '0.75rem', color: '#9db8cc', marginBottom: '0.25rem' }}>Summary</div>
        <textarea
          value={summary}
          onChange={e => setSummary(e.target.value)}
          style={{
            width: '100%',
            minHeight: '56px',
            background: '#162032',
            border: '1px solid #1e3048',
            borderRadius: '0.25rem',
            color: '#dde6ee',
            fontSize: '0.8125rem',
            padding: '0.375rem 0.5rem',
            outline: 'none',
            resize: 'vertical',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
          autoFocus
        />
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '120px' }}>
          <div style={{ fontSize: '0.75rem', color: '#9db8cc', marginBottom: '0.25rem' }}>Category</div>
          <select
            value={category}
            onChange={e => setCategory(e.target.value as PainCategory)}
            style={{
              width: '100%',
              background: '#162032',
              border: '1px solid #1e3048',
              borderRadius: '0.25rem',
              color: '#dde6ee',
              fontSize: '0.8125rem',
              padding: '0.3rem 0.5rem',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          >
            {CATEGORY_ORDER.map(cat => (
              <option key={cat} value={cat}>{CATEGORY_LABEL[cat]}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: '100px' }}>
          <div style={{ fontSize: '0.75rem', color: '#9db8cc', marginBottom: '0.25rem' }}>Confidence</div>
          <select
            value={confidence}
            onChange={e => setConfidence(e.target.value as 'high' | 'medium' | 'low')}
            style={{
              width: '100%',
              background: '#162032',
              border: '1px solid #1e3048',
              borderRadius: '0.25rem',
              color: '#dde6ee',
              fontSize: '0.8125rem',
              padding: '0.3rem 0.5rem',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <SmallBtn label="Cancel" color="#6b8599" onClick={onCancel} />
        <SmallBtn label={saving ? 'Saving...' : 'Save'} color="#00e5a0" onClick={handleSave} disabled={saving} />
      </div>
    </div>
  );
}

// ---- SmallBtn ----

interface SmallBtnProps {
  label: string;
  color: string;
  onClick: () => void;
  disabled?: boolean;
}

function SmallBtn({ label, color, onClick, disabled }: SmallBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'none',
        border: `1px solid ${disabled ? '#1e3048' : color}`,
        borderRadius: '0.25rem',
        color: disabled ? '#3a5068' : color,
        fontSize: '0.7rem',
        fontWeight: 500,
        padding: '0.2rem 0.5rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        letterSpacing: '0.03em',
      }}
    >
      {label}
    </button>
  );
}

// ---- VoicerChip ----

interface VoicerChipProps {
  name: string;
  stakeholderId: string | null;
  onSwitchToStakeholders: () => void;
}

function VoicerChip({ name, stakeholderId, onSwitchToStakeholders }: VoicerChipProps) {
  const linked = stakeholderId !== null;
  return (
    <button
      onClick={linked ? onSwitchToStakeholders : undefined}
      title={linked ? 'View in Stakeholders' : 'Not linked to a stakeholder'}
      style={{
        background: linked ? '#0d1929' : '#090f1a',
        border: `1px solid ${linked ? '#00c2d4' : '#2a3f55'}`,
        borderRadius: '999px',
        color: linked ? '#00c2d4' : '#4a6680',
        fontSize: '0.7rem',
        padding: '0.15rem 0.5rem',
        cursor: linked ? 'pointer' : 'default',
        fontFamily: 'inherit',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
      }}
    >
      {name}
      {!linked && <span style={{ fontSize: '0.6rem', color: '#6b8599' }}>?</span>}
    </button>
  );
}

// ---- PainCard ----

interface PainCardProps {
  pain: PainEnriched;
  allPains: PainEnriched[];
  onUpdate: (updated: PainEnriched) => void;
  onDelete: (id: string) => void;
  onPainsReload: () => void;
  onOpenSourceCall: (callId: string) => void;
  onSwitchToStakeholders: () => void;
}

type ActivePanel = 'edit' | 'merge' | null;

function PainCard({
  pain,
  allPains,
  onUpdate,
  onDelete,
  onPainsReload,
  onOpenSourceCall,
  onSwitchToStakeholders,
}: PainCardProps) {
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [showEvidence, setShowEvidence] = useState(false);
  const [evidenceSources, setEvidenceSources] = useState<PainSource[] | null>(null);
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const catColor = CATEGORY_COLOR[pain.category as PainCategory] ?? '#6b8599';
  const catLabel = CATEGORY_LABEL[pain.category as PainCategory] ?? pain.category;

  async function toggleEvidence() {
    if (showEvidence) {
      setShowEvidence(false);
      return;
    }
    setShowEvidence(true);
    if (evidenceSources !== null) return;
    setLoadingEvidence(true);
    try {
      const full = await api.pains.get(pain.id);
      setEvidenceSources(full.sources);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to load evidence');
    } finally {
      setLoadingEvidence(false);
    }
  }

  async function handleDelete() {
    const ok = await showConfirm({
      title: 'Delete this pain point?',
      body: 'All evidence sources will also be deleted. This cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await api.pains.delete(pain.id);
      showToast('success', 'Pain point deleted.', { quiet: true });
      onDelete(pain.id);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Delete failed');
      setDeleting(false);
    }
  }

  const numCalls = evidenceSources !== null ? callCount(evidenceSources) : null;

  return (
    <div style={{
      border: '1px solid #1e3048',
      borderRadius: '0.375rem',
      padding: '0.75rem',
      background: '#0d1929',
      marginBottom: '0.625rem',
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
        <span style={{
          fontSize: '0.65rem',
          fontWeight: 700,
          color: catColor,
          border: `1px solid ${catColor}`,
          borderRadius: '999px',
          padding: '0.1rem 0.45rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          {catLabel}
        </span>
        <span style={{
          fontSize: '0.65rem',
          fontWeight: 600,
          color: '#00c2d4',
          border: '1px solid #00c2d4',
          borderRadius: '999px',
          padding: '0.1rem 0.45rem',
        }}>
          {pain.mention_count} mention{pain.mention_count !== 1 ? 's' : ''}{numCalls !== null ? ` across ${numCalls} call${numCalls !== 1 ? 's' : ''}` : ''}
        </span>
        <span style={{
          fontSize: '0.65rem',
          fontWeight: 600,
          color: CONFIDENCE_COLOR[pain.confidence] ?? '#6b8599',
          border: `1px solid ${CONFIDENCE_COLOR[pain.confidence] ?? '#6b8599'}`,
          borderRadius: '999px',
          padding: '0.1rem 0.45rem',
          marginLeft: 'auto',
          textTransform: 'capitalize',
        }}>
          {pain.confidence}
        </span>
      </div>

      {/* Summary */}
      <div style={{ fontSize: '0.875rem', color: '#dde6ee', lineHeight: 1.5, marginBottom: '0.4rem' }}>
        {pain.summary}
      </div>

      {/* Voicers */}
      {pain.voicers.length > 0 && (
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          {pain.voicers.map((v, i) => (
            <VoicerChip
              key={`${v.voicer_name}-${i}`}
              name={v.voicer_name}
              stakeholderId={v.voicer_stakeholder_id}
              onSwitchToStakeholders={onSwitchToStakeholders}
            />
          ))}
        </div>
      )}

      {/* Evidence toggle + actions */}
      {activePanel === null && (
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <SmallBtn
            label={showEvidence ? 'Hide evidence' : `Show evidence (${pain.mention_count})`}
            color="#9db8cc"
            onClick={toggleEvidence}
          />
          <SmallBtn label="Edit" color="#6b8599" onClick={() => setActivePanel('edit')} />
          <SmallBtn label="Merge" color="#a78bfa" onClick={() => setActivePanel('merge')} />
          <SmallBtn
            label={deleting ? 'Deleting...' : 'Delete'}
            color="#e06050"
            onClick={handleDelete}
            disabled={deleting}
          />
        </div>
      )}

      {/* Inline panels */}
      {activePanel === 'edit' && (
        <EditPanel
          pain={pain}
          onSaved={updated => { onUpdate(updated); setActivePanel(null); }}
          onCancel={() => setActivePanel(null)}
        />
      )}
      {activePanel === 'merge' && (
        <MergePanel
          pain={pain}
          allPains={allPains}
          onMerged={() => { setActivePanel(null); onPainsReload(); }}
          onCancel={() => setActivePanel(null)}
        />
      )}

      {/* Evidence panel */}
      {showEvidence && activePanel === null && (
        <div style={{ marginTop: '0.5rem' }}>
          {loadingEvidence ? (
            <div style={{ fontSize: '0.8rem', color: '#6b8599', padding: '0.375rem 0' }}>Loading evidence...</div>
          ) : (
            <EvidencePanel
              sources={evidenceSources ?? []}
              onOpenSourceCall={onOpenSourceCall}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ---- CategorySection ----

interface CategorySectionProps {
  category: PainCategory;
  pains: PainEnriched[];
  allPains: PainEnriched[];
  onUpdate: (updated: PainEnriched) => void;
  onDelete: (id: string) => void;
  onPainsReload: () => void;
  onOpenSourceCall: (callId: string) => void;
  onSwitchToStakeholders: () => void;
}

function CategorySection({
  category,
  pains: categoryPains,
  allPains,
  onUpdate,
  onDelete,
  onPainsReload,
  onOpenSourceCall,
  onSwitchToStakeholders,
}: CategorySectionProps) {
  const [collapsed, setCollapsed] = useState(categoryPains.length === 0);
  const label = CATEGORY_LABEL[category];
  const color = CATEGORY_COLOR[category];
  const empty = categoryPains.length === 0;

  return (
    <div style={{ marginBottom: '1rem' }}>
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0.375rem 0',
          width: '100%',
          textAlign: 'left',
          fontFamily: 'inherit',
          marginBottom: '0.375rem',
        }}
      >
        <span style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          color: empty ? '#3a5068' : color,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          {label} ({categoryPains.length})
        </span>
        <span style={{
          fontSize: '0.65rem',
          color: empty ? '#2a3f55' : '#6b8599',
          marginLeft: 'auto',
        }}>
          {collapsed ? '+ expand' : '- collapse'}
        </span>
      </button>

      {!collapsed && (
        <div>
          {empty ? (
            <div style={{ fontSize: '0.8rem', color: '#3a5068', padding: '0.375rem 0 0.5rem 0' }}>
              No {label} pains captured yet.
            </div>
          ) : (
            categoryPains.map(pain => (
              <PainCard
                key={pain.id}
                pain={pain}
                allPains={allPains}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onPainsReload={onPainsReload}
                onOpenSourceCall={onOpenSourceCall}
                onSwitchToStakeholders={onSwitchToStakeholders}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ---- main component ----

interface AccountPainFitProps {
  pains: PainEnriched[];
  stakeholders: Stakeholder[];
  loading: boolean;
  onPainUpdate: (updated: PainEnriched) => void;
  onPainDelete: (id: string) => void;
  onPainsReload: () => void;
  onOpenSourceCall: (callId: string) => void;
  onSwitchToStakeholders: () => void;
}

export default function AccountPainFit({
  pains,
  loading,
  onPainUpdate,
  onPainDelete,
  onPainsReload,
  onOpenSourceCall,
  onSwitchToStakeholders,
}: AccountPainFitProps) {
  if (loading) {
    return (
      <div style={{ padding: '1.5rem', color: '#6b8599', fontSize: '0.875rem' }}>
        Loading pain points...
      </div>
    );
  }

  const byCategory: Record<PainCategory, PainEnriched[]> = {
    nhi: [],
    agentic: [],
    compliance: [],
    operational: [],
    strategic: [],
  };
  for (const pain of pains) {
    const cat = pain.category as PainCategory;
    if (byCategory[cat]) {
      byCategory[cat].push(pain);
    } else {
      byCategory.operational.push(pain);
    }
  }

  return (
    <div style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.25rem', gap: '0.75rem' }}>
        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#dde6ee' }}>
          Pain & Fit ({pains.length})
        </h2>
      </div>

      {pains.length === 0 ? (
        <div style={{ color: '#6b8599', fontSize: '0.875rem', lineHeight: 1.6 }}>
          No pain points extracted yet. Drop a transcript with customer pain to start tracking, or re-parse an existing call.
        </div>
      ) : (
        CATEGORY_ORDER.map(cat => (
          <CategorySection
            key={cat}
            category={cat}
            pains={byCategory[cat]}
            allPains={pains}
            onUpdate={onPainUpdate}
            onDelete={onPainDelete}
            onPainsReload={onPainsReload}
            onOpenSourceCall={onOpenSourceCall}
            onSwitchToStakeholders={onSwitchToStakeholders}
          />
        ))
      )}
    </div>
  );
}
