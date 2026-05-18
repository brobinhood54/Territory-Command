import { useState, useEffect, useCallback, useRef } from 'react';
import type { Call, Question, PainEnriched, Gameplan, GameplanListEntry, GameplanContent } from '@tc/shared';
import { api } from '../lib/api';
import { showToast } from '../lib/toast';
import { showConfirm } from './ConfirmModal';

// ---- color constants ----

const TRAJECTORY_COLOR: Record<string, string> = {
  advancing: '#00e5a0',
  stalled: '#f0a500',
  at_risk: '#e06050',
  regressing: '#e06050',
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#e06050',
  high: '#f0a500',
  medium: '#00c2d4',
};

const STANCE_COLOR: Record<string, string> = {
  advocate: '#00e5a0',
  supportive: '#00c2d4',
  neutral: '#6b8599',
  skeptical: '#f0a500',
  blocking: '#e06050',
  unknown: '#3a5068',
};

// ---- markdown generator ----

function gameplanToMarkdown(content: GameplanContent, generatedAt: number | null): string {
  const lines: string[] = [];
  const dateStr = generatedAt ? new Date(generatedAt).toLocaleString() : 'unknown';
  lines.push(`# Gameplan (generated ${dateStr})`);
  lines.push('');
  lines.push(`**${content.headline}**`);
  lines.push('');
  lines.push(`Trajectory: **${content.trajectory.replace('_', ' ')}** — ${content.trajectoryReason}`);
  lines.push('');
  lines.push('## Story');
  lines.push(content.story);
  lines.push('');
  lines.push('## Current State');
  lines.push(`- Stage: ${content.currentState.stage}`);
  lines.push(`- Decision Makers: ${content.currentState.decisionMakers}`);
  lines.push(`- Open Questions: ${content.currentState.openQuestions}`);
  lines.push(`- Top Pains: ${content.currentState.topPains}`);
  lines.push('');
  lines.push('## Risks');
  for (const r of content.risks) {
    lines.push(`### [${r.severity.toUpperCase()}] ${r.title}`);
    lines.push(r.description);
    lines.push(`> ${r.evidence}`);
    lines.push(`Action: ${r.action}`);
    lines.push('');
  }
  lines.push('## Path to Close');
  const addItems = (label: string, items: Array<{ action: string; owner: string; date: string }>) => {
    if (items.length === 0) return;
    lines.push(`### ${label}`);
    for (const item of items) {
      lines.push(`- [${item.owner}] ${item.action} — ${item.date}`);
    }
    lines.push('');
  };
  addItems('P0 (this week)', content.pathToClose.p0);
  addItems('P1 (next 2 weeks)', content.pathToClose.p1);
  addItems('P2 (this month)', content.pathToClose.p2);
  lines.push('## Stakeholder Posture');
  for (const sp of content.stakeholderPosture) {
    lines.push(`### ${sp.name} (${sp.type})`);
    lines.push(`Stance: **${sp.stance}** — ${sp.stanceReason}`);
    lines.push(`Watch for: ${sp.watchFor}`);
    lines.push('');
  }
  return lines.join('\n');
}

// ---- current data signature helper ----

function buildCurrentSignature(
  calls: Call[],
  questions: Question[],
  pains: PainEnriched[]
): string {
  const openQCount = questions.filter(q => q.status === 'open').length;
  return `calls:${calls.length}|questions:${openQCount}open|pains:${pains.length}|stakeholders:0`;
}

function parseSignatureCounts(sig: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of sig.split('|')) {
    const colonIdx = part.indexOf(':');
    if (colonIdx === -1) continue;
    const key = part.slice(0, colonIdx);
    const valStr = part.slice(colonIdx + 1).replace(/[^0-9]/g, '');
    out[key] = parseInt(valStr, 10) || 0;
  }
  return out;
}

function buildStalenessText(oldSig: string, newSig: string): string | null {
  const oldCounts = parseSignatureCounts(oldSig);
  const newCounts = parseSignatureCounts(newSig);
  const parts: string[] = [];
  const callDiff = (newCounts['calls'] ?? 0) - (oldCounts['calls'] ?? 0);
  const qDiff = (newCounts['questions'] ?? 0) - (oldCounts['questions'] ?? 0);
  const painDiff = (newCounts['pains'] ?? 0) - (oldCounts['pains'] ?? 0);
  if (callDiff > 0) parts.push(`${callDiff} new call${callDiff !== 1 ? 's' : ''}`);
  if (qDiff > 0) parts.push(`${qDiff} new open question${qDiff !== 1 ? 's' : ''}`);
  if (painDiff > 0) parts.push(`${painDiff} new pain${painDiff !== 1 ? 's' : ''}`);
  if (parts.length === 0) return null;
  return parts.join(' / ') + ' since this gameplan was generated.';
}

// ---- Pill ----

interface PillProps {
  label: string;
  color: string;
  upper?: boolean;
}

function Pill({ label, color, upper }: PillProps) {
  return (
    <span style={{
      fontSize: '0.65rem',
      fontWeight: 700,
      color,
      border: `1px solid ${color}`,
      borderRadius: '999px',
      padding: '0.1rem 0.5rem',
      textTransform: upper ? 'uppercase' : 'none',
      letterSpacing: upper ? '0.05em' : 'normal',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

// ---- GameplanHeadline ----

interface GameplanHeadlineProps {
  content: GameplanContent;
}

function GameplanHeadline({ content }: GameplanHeadlineProps) {
  const trajectoryColor = TRAJECTORY_COLOR[content.trajectory] ?? '#6b8599';
  const trajectoryLabel = content.trajectory.replace('_', ' ');
  return (
    <div style={{
      background: '#0d1929',
      border: '1px solid #1e3048',
      borderRadius: '0.5rem',
      padding: '1rem 1.25rem',
      marginBottom: '0.875rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.625rem', flexWrap: 'wrap' }}>
        <Pill label={trajectoryLabel} color={trajectoryColor} upper />
      </div>
      <div style={{ fontSize: '1rem', fontWeight: 600, color: '#dde6ee', lineHeight: 1.5, marginBottom: '0.5rem' }}>
        {content.headline}
      </div>
      <div style={{ fontSize: '0.8125rem', color: '#9db8cc', lineHeight: 1.5 }}>
        {content.trajectoryReason}
      </div>
    </div>
  );
}

// ---- GameplanStory ----

interface GameplanStoryProps {
  story: string;
}

function GameplanStory({ story }: GameplanStoryProps) {
  return (
    <div style={{
      background: '#0d1929',
      border: '1px solid #1e3048',
      borderRadius: '0.5rem',
      padding: '0.875rem 1.25rem',
      marginBottom: '0.875rem',
    }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b8599', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>
        Story
      </div>
      <div style={{ fontSize: '0.875rem', color: '#dde6ee', lineHeight: 1.65 }}>
        {story}
      </div>
    </div>
  );
}

// ---- GameplanCurrentState ----

interface GameplanCurrentStateProps {
  currentState: GameplanContent['currentState'];
}

function GameplanCurrentState({ currentState }: GameplanCurrentStateProps) {
  const rows = [
    { label: 'Stage', value: currentState.stage },
    { label: 'Decision Makers', value: currentState.decisionMakers },
    { label: 'Open Questions', value: currentState.openQuestions },
    { label: 'Top Pains', value: currentState.topPains },
  ];
  return (
    <div style={{
      background: '#0d1929',
      border: '1px solid #1e3048',
      borderRadius: '0.5rem',
      padding: '0.875rem 1.25rem',
      marginBottom: '0.875rem',
    }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b8599', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.625rem' }}>
        Current State
      </div>
      {rows.map(row => (
        <div key={row.label} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.375rem', fontSize: '0.8125rem' }}>
          <span style={{ color: '#6b8599', minWidth: '120px', flexShrink: 0 }}>{row.label}</span>
          <span style={{ color: '#dde6ee', lineHeight: 1.5 }}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}

// ---- GameplanRisks ----

interface GameplanRisksProps {
  risks: GameplanContent['risks'];
}

function GameplanRisks({ risks }: GameplanRisksProps) {
  return (
    <div style={{
      background: '#0d1929',
      border: '1px solid #1e3048',
      borderRadius: '0.5rem',
      padding: '0.875rem 1.25rem',
      marginBottom: '0.875rem',
    }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b8599', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.625rem' }}>
        Risks ({risks.length})
      </div>
      {risks.length === 0 ? (
        <div style={{ fontSize: '0.8rem', color: '#3a5068' }}>No risks identified.</div>
      ) : (
        risks.map((risk, i) => {
          const sev = risk.severity as keyof typeof SEVERITY_COLOR;
          const sevColor = SEVERITY_COLOR[sev] ?? '#6b8599';
          return (
            <div
              key={i}
              style={{
                background: '#0a1220',
                border: `1px solid ${sevColor}44`,
                borderLeft: `3px solid ${sevColor}`,
                borderRadius: '0.375rem',
                padding: '0.75rem',
                marginBottom: i < risks.length - 1 ? '0.625rem' : 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                <Pill label={risk.severity.toUpperCase()} color={sevColor} upper />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#dde6ee' }}>{risk.title}</span>
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#9db8cc', lineHeight: 1.5, marginBottom: '0.375rem' }}>
                {risk.description}
              </div>
              <div style={{
                fontSize: '0.775rem',
                color: '#6b8599',
                fontStyle: 'italic',
                borderLeft: '2px solid #1e3048',
                paddingLeft: '0.5rem',
                marginBottom: '0.375rem',
                lineHeight: 1.5,
              }}>
                {risk.evidence}
              </div>
              <div style={{ fontSize: '0.775rem', color: '#00e5a0' }}>
                Action: {risk.action}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ---- GameplanPathToClose ----

interface GameplanPathToCloseProps {
  pathToClose: GameplanContent['pathToClose'];
}

function GameplanPathToClose({ pathToClose }: GameplanPathToCloseProps) {
  const buckets: Array<{ label: string; sub: string; items: GameplanContent['pathToClose']['p0'] }> = [
    { label: 'P0', sub: 'this week', items: pathToClose.p0 },
    { label: 'P1', sub: 'next 2 weeks', items: pathToClose.p1 },
    { label: 'P2', sub: 'this month', items: pathToClose.p2 },
  ];
  const bucketColor: Record<string, string> = { P0: '#e06050', P1: '#f0a500', P2: '#6b8599' };
  return (
    <div style={{
      background: '#0d1929',
      border: '1px solid #1e3048',
      borderRadius: '0.5rem',
      padding: '0.875rem 1.25rem',
      marginBottom: '0.875rem',
    }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b8599', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.75rem' }}>
        Path to Close
      </div>
      {buckets.map(bucket => (
        <div key={bucket.label} style={{ marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.375rem', marginBottom: '0.375rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: bucketColor[bucket.label] ?? '#6b8599' }}>
              {bucket.label}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#6b8599' }}>{bucket.sub}</span>
          </div>
          {bucket.items.length === 0 ? (
            <div style={{ fontSize: '0.775rem', color: '#3a5068', paddingLeft: '0.5rem' }}>Nothing in this bucket.</div>
          ) : (
            bucket.items.map((item, i) => (
              <div key={i} style={{
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'flex-start',
                padding: '0.375rem 0.5rem',
                background: '#0a1220',
                border: '1px solid #1e3048',
                borderRadius: '0.25rem',
                marginBottom: i < bucket.items.length - 1 ? '0.25rem' : 0,
                fontSize: '0.8125rem',
              }}>
                <span style={{ color: '#dde6ee', flex: 1, lineHeight: 1.5 }}>{item.action}</span>
                <span style={{ color: '#6b8599', whiteSpace: 'nowrap', fontSize: '0.75rem' }}>{item.owner}</span>
                <span style={{
                  fontSize: '0.65rem',
                  color: '#00c2d4',
                  border: '1px solid #00c2d4',
                  borderRadius: '999px',
                  padding: '0.05rem 0.4rem',
                  whiteSpace: 'nowrap',
                }}>
                  {item.date}
                </span>
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  );
}

// ---- GameplanStakeholderPosture ----

interface GameplanStakeholderPostureProps {
  stakeholderPosture: GameplanContent['stakeholderPosture'];
}

function GameplanStakeholderPosture({ stakeholderPosture }: GameplanStakeholderPostureProps) {
  return (
    <div style={{
      background: '#0d1929',
      border: '1px solid #1e3048',
      borderRadius: '0.5rem',
      padding: '0.875rem 1.25rem',
      marginBottom: '0.875rem',
    }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b8599', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.625rem' }}>
        Stakeholder Posture ({stakeholderPosture.length})
      </div>
      {stakeholderPosture.length === 0 ? (
        <div style={{ fontSize: '0.8rem', color: '#3a5068' }}>No stakeholders mapped yet.</div>
      ) : (
        stakeholderPosture.map((sp, i) => {
          const stanceColor = STANCE_COLOR[sp.stance] ?? '#6b8599';
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                padding: '0.625rem 0.75rem',
                background: '#0a1220',
                border: '1px solid #1e3048',
                borderRadius: '0.375rem',
                marginBottom: i < stakeholderPosture.length - 1 ? '0.5rem' : 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#dde6ee' }}>{sp.name}</span>
                <Pill label={sp.type} color="#6b8599" />
                <Pill label={sp.stance} color={stanceColor} />
              </div>
              <div style={{ fontSize: '0.775rem', color: '#9db8cc', lineHeight: 1.5 }}>
                {sp.stanceReason}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6b8599', lineHeight: 1.5 }}>
                Watch: {sp.watchFor}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ---- GameplanStaleBanner ----

interface GameplanStaleBannerProps {
  stalenessText: string;
  onRegenerate: () => void;
  generating: boolean;
}

function GameplanStaleBanner({ stalenessText, onRegenerate, generating }: GameplanStaleBannerProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '0.75rem',
      background: '#1a1200',
      border: '1px solid #f0a500',
      borderRadius: '0.375rem',
      padding: '0.5rem 0.875rem',
      marginBottom: '0.875rem',
      flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: '0.8rem', color: '#f0a500' }}>
        Stale: {stalenessText}
      </span>
      <button
        onClick={onRegenerate}
        disabled={generating}
        style={{
          background: 'none',
          border: '1px solid #f0a500',
          borderRadius: '0.25rem',
          color: generating ? '#6b8599' : '#f0a500',
          fontSize: '0.75rem',
          fontWeight: 500,
          padding: '0.2rem 0.6rem',
          cursor: generating ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          whiteSpace: 'nowrap',
        }}
      >
        {generating ? 'Generating...' : 'Regenerate'}
      </button>
    </div>
  );
}

// ---- GameplanHistoryDropdown ----

interface GameplanHistoryDropdownProps {
  history: GameplanListEntry[];
  viewingId: string | null;
  latestId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onViewLatest: () => void;
}

function GameplanHistoryDropdown({
  history,
  viewingId,
  latestId,
  onSelect,
  onDelete,
  onViewLatest,
}: GameplanHistoryDropdownProps) {
  const [open, setOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function formatDate(ts: number | null): string {
    if (!ts) return 'unknown';
    const d = new Date(ts);
    const ymd = d.toLocaleDateString('en-CA'); // YYYY-MM-DD
    const hm = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${ymd} ${hm}`;
  }

  return (
    <div ref={dropRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'none',
          border: '1px solid #1e3048',
          borderRadius: '0.25rem',
          color: '#9db8cc',
          fontSize: '0.75rem',
          padding: '0.25rem 0.625rem',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        History ({history.length})
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          zIndex: 100,
          background: '#0d1929',
          border: '1px solid #1e3048',
          borderRadius: '0.375rem',
          minWidth: '220px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}>
          {history.map((entry, i) => {
            const isViewing = entry.id === viewingId;
            return (
              <div
                key={entry.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0.5rem 0.75rem',
                  borderBottom: i < history.length - 1 ? '1px solid #1e3048' : 'none',
                  background: isViewing ? '#162032' : 'transparent',
                }}
              >
                <button
                  onClick={() => { onSelect(entry.id); setOpen(false); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: isViewing ? '#00e5a0' : '#9db8cc',
                    fontSize: '0.775rem',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                    flex: 1,
                    padding: 0,
                  }}
                >
                  {formatDate(entry.generated_at)}
                  {entry.id === latestId ? ' (latest)' : ''}
                </button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    const ok = await showConfirm({
                      title: 'Delete this gameplan?',
                      body: 'This version will be permanently removed.',
                      confirmLabel: 'Delete',
                      destructive: true,
                    });
                    if (!ok) return;
                    onDelete(entry.id);
                    setOpen(false);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#3a5068',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    padding: '0 0.125rem',
                    lineHeight: 1,
                  }}
                  title="Delete this version"
                >
                  x
                </button>
              </div>
            );
          })}
        </div>
      )}
      {viewingId !== null && viewingId !== latestId && (
        <button
          onClick={onViewLatest}
          style={{
            background: 'none',
            border: 'none',
            color: '#00c2d4',
            fontSize: '0.75rem',
            cursor: 'pointer',
            fontFamily: 'inherit',
            padding: '0 0 0 0.5rem',
            textDecoration: 'underline',
          }}
        >
          View latest
        </button>
      )}
    </div>
  );
}

// ---- main component ----

interface AccountGameplanProps {
  accountId: string;
  calls: Call[];
  questions: Question[];
  pains: PainEnriched[];
}

export default function AccountGameplan({
  accountId,
  calls,
  questions,
  pains,
}: AccountGameplanProps) {
  const [history, setHistory] = useState<GameplanListEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewingGameplan, setViewingGameplan] = useState<Gameplan | null>(null);
  const [loadingViewing, setLoadingViewing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const latestEntry = history.length > 0 ? history[0] : null;
  const latestId = latestEntry?.id ?? null;

  const loadHistory = useCallback(async (autoSelectLatest = false) => {
    try {
      const rows = await api.gameplans.listForAccount(accountId);
      setHistory(rows);
      if (autoSelectLatest && rows.length > 0) {
        setViewingId(rows[0].id);
      }
      return rows;
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to load gameplan history');
      return [];
    } finally {
      setLoadingHistory(false);
    }
  }, [accountId]);

  useEffect(() => {
    setHistory([]);
    setViewingId(null);
    setViewingGameplan(null);
    setLoadingHistory(true);
    void loadHistory(true);
  }, [accountId, loadHistory]);

  // When viewingId changes, load that gameplan's full content
  useEffect(() => {
    if (viewingId === null) {
      setViewingGameplan(null);
      return;
    }
    setLoadingViewing(true);
    api.gameplans.get(viewingId)
      .then(gp => setViewingGameplan(gp))
      .catch(err => showToast('error', err instanceof Error ? err.message : 'Failed to load gameplan'))
      .finally(() => setLoadingViewing(false));
  }, [viewingId]);

  function startElapsedCounter() {
    setElapsed(0);
    if (elapsedRef.current) clearInterval(elapsedRef.current);
    elapsedRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
  }

  function stopElapsedCounter() {
    if (elapsedRef.current) {
      clearInterval(elapsedRef.current);
      elapsedRef.current = null;
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    startElapsedCounter();
    try {
      const gp = await api.gameplans.generate(accountId);
      await loadHistory();
      setViewingId(gp.id);
      const latencyS = gp.latency_ms ? (gp.latency_ms / 1000).toFixed(1) : '?';
      showToast('success', `Gameplan generated in ${latencyS}s (Opus 4.7)`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to generate gameplan');
    } finally {
      stopElapsedCounter();
      setGenerating(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.gameplans.delete(id);
      showToast('success', 'Gameplan version deleted.', { quiet: true });
      const rows = await loadHistory();
      if (viewingId === id) {
        const remaining = rows.filter(r => r.id !== id);
        setViewingId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Delete failed');
    }
  }

  function handleViewLatest() {
    if (latestId) setViewingId(latestId);
  }

  async function handleCopyMarkdown() {
    if (!viewingGameplan) return;
    let content: GameplanContent;
    try {
      content = JSON.parse(viewingGameplan.content) as GameplanContent;
    } catch {
      showToast('error', 'Failed to parse gameplan content for copy.');
      return;
    }
    const md = gameplanToMarkdown(content, viewingGameplan.generated_at);
    try {
      await navigator.clipboard.writeText(md);
      showToast('success', 'Gameplan copied to clipboard.');
    } catch {
      showToast('error', 'Clipboard write failed. Try a different browser.');
    }
  }

  // Staleness check: compare last generated signature vs current data
  const isViewingLatest = viewingId === latestId;
  const stalenessText = ((): string | null => {
    if (!viewingGameplan || !latestEntry || !isViewingLatest) return null;
    const oldSig = latestEntry.generated_with_data_signature ?? '';
    if (!oldSig) return null;
    const currentSig = buildCurrentSignature(calls, questions, pains);
    return buildStalenessText(oldSig, currentSig);
  })();

  // Parse displayed content
  let displayedContent: GameplanContent | null = null;
  if (viewingGameplan) {
    try {
      displayedContent = JSON.parse(viewingGameplan.content) as GameplanContent;
    } catch {
      // Content is unparseable; show error below
    }
  }

  if (loadingHistory) {
    return (
      <div style={{ padding: '1.5rem', color: '#6b8599', fontSize: '0.875rem' }}>
        Loading gameplan history...
      </div>
    );
  }

  return (
    <div style={{ padding: '1.25rem' }}>
      {/* Header row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        marginBottom: '1rem',
        flexWrap: 'wrap',
      }}>
        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#dde6ee', flex: 1 }}>
          Gameplan
        </h2>

        {history.length > 0 && (
          <GameplanHistoryDropdown
            history={history}
            viewingId={viewingId}
            latestId={latestId}
            onSelect={(id) => setViewingId(id)}
            onDelete={handleDelete}
            onViewLatest={handleViewLatest}
          />
        )}

        {viewingGameplan && !generating && (
          <button
            onClick={handleCopyMarkdown}
            style={{
              background: 'none',
              border: '1px solid #1e3048',
              borderRadius: '0.25rem',
              color: '#9db8cc',
              fontSize: '0.75rem',
              padding: '0.25rem 0.625rem',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Copy as markdown
          </button>
        )}

        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{
            background: generating ? 'transparent' : '#00e5a0',
            border: generating ? '1px solid #3a5068' : 'none',
            borderRadius: '0.25rem',
            color: generating ? '#6b8599' : '#080e1a',
            fontSize: '0.8125rem',
            fontWeight: 600,
            padding: '0.375rem 0.875rem',
            cursor: generating ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {generating
            ? `Generating... ${elapsed}s`
            : latestId
              ? 'Regenerate'
              : 'Generate'}
        </button>
      </div>

      {/* Generating state hint */}
      {generating && (
        <div style={{
          background: '#0d1929',
          border: '1px solid #1e3048',
          borderRadius: '0.5rem',
          padding: '1rem 1.25rem',
          marginBottom: '0.875rem',
          color: '#9db8cc',
          fontSize: '0.875rem',
        }}>
          Generating gameplan with Opus 4.7... ({elapsed}s elapsed, typically 30-90s)
        </div>
      )}

      {/* Previous version banner */}
      {viewingId !== null && viewingId !== latestId && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#0d1220',
          border: '1px solid #1e3048',
          borderRadius: '0.375rem',
          padding: '0.5rem 0.875rem',
          marginBottom: '0.875rem',
          fontSize: '0.8rem',
          color: '#6b8599',
        }}>
          <span>Viewing previous version</span>
          <button
            onClick={handleViewLatest}
            style={{
              background: 'none',
              border: 'none',
              color: '#00c2d4',
              fontSize: '0.775rem',
              cursor: 'pointer',
              fontFamily: 'inherit',
              textDecoration: 'underline',
            }}
          >
            View latest
          </button>
        </div>
      )}

      {/* Stale banner */}
      {stalenessText && !generating && (
        <GameplanStaleBanner
          stalenessText={stalenessText}
          onRegenerate={handleGenerate}
          generating={generating}
        />
      )}

      {/* Empty state */}
      {!generating && history.length === 0 && (
        <div style={{ color: '#6b8599', fontSize: '0.875rem', lineHeight: 1.7 }}>
          No gameplan yet. Click Generate to produce one. (This uses Opus 4.7 and takes 30-90s; results are saved and cached.)
        </div>
      )}

      {/* Loading a selected version */}
      {loadingViewing && (
        <div style={{ color: '#6b8599', fontSize: '0.875rem', padding: '0.5rem 0' }}>
          Loading gameplan...
        </div>
      )}

      {/* Gameplan content */}
      {displayedContent && !loadingViewing && (
        <>
          <GameplanHeadline content={displayedContent} />
          <GameplanStory story={displayedContent.story} />
          <GameplanCurrentState currentState={displayedContent.currentState} />
          <GameplanRisks risks={displayedContent.risks} />
          <GameplanPathToClose pathToClose={displayedContent.pathToClose} />
          <GameplanStakeholderPosture stakeholderPosture={displayedContent.stakeholderPosture} />
        </>
      )}

      {/* Unparseable content error */}
      {viewingGameplan && !displayedContent && !loadingViewing && (
        <div style={{ color: '#e06050', fontSize: '0.8rem' }}>
          Could not parse the stored gameplan content. The raw JSON may be malformed.
        </div>
      )}
    </div>
  );
}
