import { useState, useEffect, useRef, useCallback } from 'react';
import type { CSSProperties } from 'react';
import type { Call, CallAttendee } from '@tc/shared';
import { api } from '../lib/api';
import { showToast } from '../lib/toast';
import { useConfirm } from './ConfirmModal';

// ---- types ----

type ParseStatus = 'parsing' | 'done' | 'failed';

interface ParseItem {
  filename: string;
  status: ParseStatus;
  attendeesSeeded?: number;
  error?: string;
}

// ---- constants / styles ----

const ACCEPTED_EXTS = ['.txt', '.pdf', '.docx', '.vtt', '.srt', '.json'];
const ACCEPTED_MIME = '.txt,.pdf,.docx,.vtt,.srt,.json';

const HEALTH_COLOR: Record<string, string> = {
  green: '#00e5a0',
  yellow: '#f0a500',
  red: '#e06050',
  unknown: '#6b7c8f',
};

const HEALTH_CYCLE: Record<string, string> = {
  green: 'yellow',
  yellow: 'red',
  red: 'green',
  unknown: 'green',
};

const cardBase: CSSProperties = {
  background: '#0f1929',
  border: '1px solid #1e3048',
  borderRadius: '0.5rem',
  marginBottom: '0.75rem',
};

const labelStyle: CSSProperties = {
  fontSize: '0.6375rem',
  color: '#6b8599',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  userSelect: 'none',
};

const inputBase: CSSProperties = {
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid #1e3048',
  outline: 'none',
  color: '#dde6ee',
  fontSize: '0.875rem',
  fontFamily: 'inherit',
  width: '100%',
  padding: '0.1rem 0',
};

// ---- helper: parse attendees JSON from a call row ----

function parseAttendees(raw: string | null): CallAttendee[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as CallAttendee[];
  } catch {
    return [];
  }
}

// ---- helper: validate file extensions on drop ----

function filterValidFiles(files: File[]): File[] {
  return files.filter(f =>
    ACCEPTED_EXTS.some(ext => f.name.toLowerCase().endsWith(ext))
  );
}

// ---- helper: render summary with section headers styled ----

function renderSummary(text: string): React.ReactNode {
  const HEADERS = [
    'CALL SUMMARY', 'ATTENDEES', 'WHAT WE COVERED',
    'WHAT WE HEARD', 'ACTION ITEMS', 'DEAL HEALTH', 'NEXT STEP',
  ];

  const paragraphs = text.split(/\n{2,}/);

  return (
    <div>
      {paragraphs.map((para, i) => {
        const lines = para.trim().split('\n');
        const first = lines[0].trim();
        const isHeader = HEADERS.some(h => first.startsWith(h));

        if (isHeader) {
          return (
            <div key={i} style={{ marginBottom: '0.875rem' }}>
              <div style={{
                fontSize: '0.6rem',
                fontWeight: 700,
                color: '#6b8599',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: '0.25rem',
              }}>
                {first}
              </div>
              {lines.slice(1).length > 0 && (
                <div style={{
                  fontSize: '0.8125rem',
                  color: '#9db8cc',
                  lineHeight: 1.65,
                  whiteSpace: 'pre-wrap',
                }}>
                  {lines.slice(1).join('\n')}
                </div>
              )}
            </div>
          );
        }

        return (
          <div key={i} style={{
            fontSize: '0.8125rem',
            color: '#9db8cc',
            lineHeight: 1.65,
            whiteSpace: 'pre-wrap',
            marginBottom: '0.875rem',
          }}>
            {para.trim()}
          </div>
        );
      })}
    </div>
  );
}

// ---- FileDropZone (module scope) ----

interface FileDropZoneProps {
  disabled: boolean;
  onFiles: (files: File[]) => void;
}

function FileDropZone({ disabled, onFiles }: FileDropZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const dropped = filterValidFiles(Array.from(e.dataTransfer.files));
    if (dropped.length > 0) onFiles(dropped.slice(0, 10));
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = filterValidFiles(Array.from(e.target.files ?? []));
    if (picked.length > 0) onFiles(picked.slice(0, 10));
    // Reset input so the same file can be re-selected
    e.target.value = '';
  }

  const borderColor = dragOver ? '#00e5a0' : '#1e3048';
  const bgColor = dragOver ? 'rgba(0,229,160,0.04)' : '#0a1220';

  return (
    <div
      onDrop={handleDrop}
      onDragOver={e => { e.preventDefault(); if (!disabled) setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      style={{
        border: `2px dashed ${borderColor}`,
        borderRadius: '0.5rem',
        background: bgColor,
        padding: '2rem 1.5rem',
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'default',
        transition: 'border-color 0.15s, background 0.15s',
        opacity: disabled ? 0.6 : 1,
        marginBottom: '1.5rem',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_MIME}
        multiple
        onChange={handleInputChange}
        style={{ display: 'none' }}
        disabled={disabled}
      />
      <div style={{ fontSize: '0.875rem', color: '#9db8cc', marginBottom: '0.5rem' }}>
        Drop transcript files here
      </div>
      <div style={{ fontSize: '0.75rem', color: '#6b8599', marginBottom: '0.875rem' }}>
        .txt, .pdf, .docx, .vtt, .srt, .json (Gong export) - up to 10 files
      </div>
      <button
        onClick={() => !disabled && inputRef.current?.click()}
        disabled={disabled}
        style={{
          background: disabled ? '#1e3048' : '#00e5a0',
          color: disabled ? '#6b8599' : '#080e1a',
          border: 'none',
          borderRadius: '0.375rem',
          padding: '0.4rem 1rem',
          fontSize: '0.8125rem',
          fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        Browse files
      </button>
    </div>
  );
}

// ---- ParseProgressPanel (module scope) ----

interface ParseProgressPanelProps {
  items: ParseItem[];
  elapsed: number;
}

function ParseProgressPanel({ items, elapsed }: ParseProgressPanelProps) {
  return (
    <div style={{
      background: '#0a1220',
      border: '1px solid #1e3048',
      borderRadius: '0.5rem',
      padding: '1rem 1.25rem',
      marginBottom: '1.5rem',
    }}>
      <div style={{ fontSize: '0.75rem', color: '#6b8599', marginBottom: '0.75rem' }}>
        Parsing {items.length} {items.length === 1 ? 'file' : 'files'}
        {items.some(i => i.status === 'parsing') && ` (${elapsed}s elapsed)`}
      </div>
      {items.map(item => (
        <div key={item.filename} style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.625rem',
          marginBottom: '0.5rem',
        }}>
          <span style={{
            fontSize: '0.875rem',
            lineHeight: 1,
            marginTop: '0.1rem',
            color: item.status === 'done'
              ? '#00e5a0'
              : item.status === 'failed'
              ? '#e06050'
              : '#f0a500',
          }}>
            {item.status === 'done' ? '✓' : item.status === 'failed' ? '✗' : '⋯'}
          </span>
          <div>
            <div style={{ fontSize: '0.8125rem', color: '#dde6ee' }}>{item.filename}</div>
            {item.status === 'done' && item.attendeesSeeded !== undefined && item.attendeesSeeded > 0 && (
              <div style={{ fontSize: '0.6875rem', color: '#6b8599', marginTop: '0.125rem' }}>
                Seeded {item.attendeesSeeded} new {item.attendeesSeeded === 1 ? 'stakeholder' : 'stakeholders'}
              </div>
            )}
            {item.status === 'done' && (!item.attendeesSeeded || item.attendeesSeeded === 0) && (
              <div style={{ fontSize: '0.6875rem', color: '#6b8599', marginTop: '0.125rem' }}>
                Done
              </div>
            )}
            {item.status === 'failed' && (
              <div style={{ fontSize: '0.6875rem', color: '#e06050', marginTop: '0.125rem' }}>
                {item.error}
              </div>
            )}
            {item.status === 'parsing' && (
              <div style={{ fontSize: '0.6875rem', color: '#6b8599', marginTop: '0.125rem' }}>
                Parsing with AI...
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- CallCard (module scope) ----

interface CallCardProps {
  call: Call;
  onUpdate: (updated: Call) => void;
  onDelete: (id: string) => void;
  onReparse: (id: string) => Promise<void>;
}

function CallCard({ call, onUpdate, onDelete, onReparse }: CallCardProps) {
  const confirm = useConfirm();
  const [expanded, setExpanded] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDate, setEditingDate] = useState(false);
  const [editingSummary, setEditingSummary] = useState(false);
  const [reparsing, setReparsing] = useState(false);

  const [titleVal, setTitleVal] = useState(call.title ?? '');
  const [dateVal, setDateVal] = useState(call.date ?? '');
  const [summaryVal, setSummaryVal] = useState(call.summary ?? '');

  // Keep local values in sync when the call prop changes (e.g., after reparse)
  const callIdRef = useRef(call.id);
  if (callIdRef.current !== call.id) {
    callIdRef.current = call.id;
    setTitleVal(call.title ?? '');
    setDateVal(call.date ?? '');
    setSummaryVal(call.summary ?? '');
  }

  const attendees = parseAttendees(call.customer_attendees);
  const health = call.health ?? 'unknown';
  const healthColor = HEALTH_COLOR[health] ?? HEALTH_COLOR.unknown;

  async function saveTitle() {
    setEditingTitle(false);
    const trimmed = titleVal.trim();
    if (trimmed === (call.title ?? '')) return;
    try {
      const updated = await api.calls.update(call.id, { title: trimmed || (call.title ?? '') });
      onUpdate(updated);
      showToast('success', 'Saved', { quiet: true });
    } catch (err) {
      console.error('Failed to save title:', err);
      setTitleVal(call.title ?? '');
      showToast('error', err instanceof Error ? err.message : 'Failed to save title');
    }
  }

  async function saveDate() {
    setEditingDate(false);
    const trimmed = dateVal.trim();
    if (trimmed === (call.date ?? '')) return;
    try {
      const updated = await api.calls.update(call.id, { date: trimmed || null });
      onUpdate(updated);
      showToast('success', 'Saved', { quiet: true });
    } catch (err) {
      console.error('Failed to save date:', err);
      setDateVal(call.date ?? '');
      showToast('error', err instanceof Error ? err.message : 'Failed to save date');
    }
  }

  async function saveSummary() {
    setEditingSummary(false);
    const trimmed = summaryVal.trim();
    if (trimmed === (call.summary ?? '')) return;
    try {
      const updated = await api.calls.update(call.id, { summary: trimmed });
      onUpdate(updated);
      setSummaryVal(updated.summary ?? '');
      showToast('success', 'Saved', { quiet: true });
    } catch (err) {
      console.error('Failed to save summary:', err);
      setSummaryVal(call.summary ?? '');
      showToast('error', err instanceof Error ? err.message : 'Failed to save summary');
    }
  }

  async function cycleHealth() {
    const next = HEALTH_CYCLE[health] ?? 'green';
    try {
      const updated = await api.calls.update(call.id, { health: next });
      onUpdate(updated);
      showToast('success', 'Saved', { quiet: true });
    } catch (err) {
      console.error('Failed to update health:', err);
      showToast('error', err instanceof Error ? err.message : 'Failed to update health');
    }
  }

  async function handleReparseClick() {
    const ok = await confirm({
      title: 'Re-parse this call with AI?',
      body: 'The current summary will be replaced.',
      confirmLabel: 'Re-parse',
    });
    if (!ok) return;
    setReparsing(true);
    try {
      await onReparse(call.id);
    } finally {
      setReparsing(false);
    }
  }

  async function handleDeleteClick() {
    const ok = await confirm({
      title: 'Delete this call?',
      body: 'Stakeholders seeded from it remain on the account.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) onDelete(call.id);
  }

  // First line of summary for collapsed preview
  const summaryPreview = (call.summary ?? '').split('\n').find(l => l.trim()) ?? '';

  return (
    <div style={cardBase}>
      {/* Header */}
      <div style={{ padding: '0.875rem 1rem 0.625rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', flexWrap: 'wrap' }}>

          {/* Title */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {editingTitle ? (
              <input
                autoFocus
                value={titleVal}
                onChange={e => setTitleVal(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                style={{ ...inputBase, fontSize: '0.9375rem', fontWeight: 600 }}
              />
            ) : (
              <span
                onClick={() => setEditingTitle(true)}
                style={{
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  color: '#dde6ee',
                  cursor: 'pointer',
                  display: 'block',
                }}
              >
                {call.title || '(untitled)'}
              </span>
            )}
          </div>

          {/* Health pill */}
          <span
            onClick={cycleHealth}
            title="Click to cycle health"
            style={{
              display: 'inline-block',
              fontSize: '0.6rem',
              fontWeight: 700,
              color: healthColor,
              border: `1px solid ${healthColor}`,
              borderRadius: '999px',
              padding: '0.1rem 0.5rem',
              cursor: 'pointer',
              userSelect: 'none',
              flexShrink: 0,
            }}
          >
            {health}
          </span>

          {/* Attendee count */}
          {attendees.length > 0 && (
            <span style={{
              fontSize: '0.6875rem',
              color: '#6b8599',
              flexShrink: 0,
              paddingTop: '0.1rem',
            }}>
              {attendees.length} {attendees.length === 1 ? 'attendee' : 'attendees'}
            </span>
          )}
        </div>

        {/* Date */}
        <div style={{ marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {editingDate ? (
            <input
              autoFocus
              type="date"
              value={dateVal}
              onChange={e => setDateVal(e.target.value)}
              onBlur={saveDate}
              style={{ ...inputBase, fontSize: '0.75rem', color: '#6b8599', width: 'auto' }}
            />
          ) : (
            <span
              onClick={() => setEditingDate(true)}
              style={{ fontSize: '0.75rem', color: '#6b8599', cursor: 'pointer' }}
            >
              {call.date ?? 'No date, click to set'}
            </span>
          )}
        </div>
      </div>

      {/* Collapsed preview or expand toggle */}
      {!expanded && (
        <div
          onClick={() => setExpanded(true)}
          style={{
            padding: '0 1rem 0.75rem',
            fontSize: '0.8125rem',
            color: '#4a6070',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {summaryPreview || 'Click to expand summary'}
        </div>
      )}

      {/* Expanded summary */}
      {expanded && (
        <div style={{ padding: '0 1rem 0.75rem' }}>
          {editingSummary ? (
            <div>
              <textarea
                autoFocus
                value={summaryVal}
                onChange={e => setSummaryVal(e.target.value)}
                style={{
                  background: '#0a1220',
                  border: '1px solid #1e3048',
                  borderRadius: '0.25rem',
                  color: '#dde6ee',
                  fontSize: '0.8125rem',
                  fontFamily: 'inherit',
                  width: '100%',
                  minHeight: '280px',
                  padding: '0.625rem',
                  resize: 'vertical',
                  outline: 'none',
                  lineHeight: 1.6,
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  onClick={saveSummary}
                  style={{
                    background: '#00e5a0',
                    color: '#080e1a',
                    border: 'none',
                    borderRadius: '0.25rem',
                    padding: '0.3rem 0.75rem',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => { setSummaryVal(call.summary ?? ''); setEditingSummary(false); }}
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
          ) : (
            renderSummary(call.summary ?? '')
          )}

          <button
            onClick={() => setExpanded(false)}
            style={{
              background: 'none',
              border: 'none',
              color: '#4a6070',
              fontSize: '0.75rem',
              cursor: 'pointer',
              padding: 0,
              marginTop: '0.25rem',
            }}
          >
            Collapse
          </button>
        </div>
      )}

      {/* Source label + action buttons */}
      <div style={{
        borderTop: '1px solid #1e3048',
        padding: '0.5rem 1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.625rem',
        flexWrap: 'wrap',
      }}>
        {call.source_file && (
          <span style={{ fontSize: '0.6875rem', color: '#4a6070', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Source: {call.source_file}
          </span>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>

          {/* Expand / collapse toggle */}
          <button
            onClick={() => setExpanded(v => !v)}
            style={{
              background: 'none',
              border: '1px solid #1e3048',
              borderRadius: '0.25rem',
              color: '#6b8599',
              fontSize: '0.75rem',
              padding: '0.2rem 0.5rem',
              cursor: 'pointer',
            }}
          >
            {expanded ? 'Collapse' : 'Expand'}
          </button>

          {/* Edit summary */}
          {!editingSummary && (
            <button
              onClick={() => { setExpanded(true); setEditingSummary(true); }}
              style={{
                background: 'none',
                border: '1px solid #1e3048',
                borderRadius: '0.25rem',
                color: '#6b8599',
                fontSize: '0.75rem',
                padding: '0.2rem 0.5rem',
                cursor: 'pointer',
              }}
            >
              Edit summary
            </button>
          )}

          {/* Re-parse */}
          <button
            onClick={handleReparseClick}
            disabled={reparsing}
            style={{
              background: 'none',
              border: '1px solid #1e3048',
              borderRadius: '0.25rem',
              color: '#6b8599',
              fontSize: '0.75rem',
              padding: '0.2rem 0.5rem',
              cursor: reparsing ? 'default' : 'pointer',
            }}
          >
            {reparsing ? 'Parsing...' : 'Re-parse with AI'}
          </button>

          {/* Delete */}
          <button
            onClick={handleDeleteClick}
            style={{
              background: 'none',
              border: 'none',
              color: '#4a6070',
              fontSize: '0.875rem',
              cursor: 'pointer',
              padding: '0 0.125rem',
              lineHeight: 1,
            }}
            title="Delete call"
          >
            &#x2715;
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- AccountCalls (main export) ----

interface AccountCallsProps {
  accountId: string;
  onAttendeesSeeded: () => void;
}

export default function AccountCalls({ accountId, onAttendeesSeeded }: AccountCallsProps) {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loadingCalls, setLoadingCalls] = useState(true);
  const [parseItems, setParseItems] = useState<ParseItem[] | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadCalls = useCallback(async () => {
    try {
      const rows = await api.calls.list(accountId);
      setCalls(rows);
    } catch (err) {
      console.error('Failed to load calls:', err);
      showToast('error', 'Failed to load calls');
    }
  }, [accountId]);

  useEffect(() => {
    setLoadingCalls(true);
    loadCalls().finally(() => setLoadingCalls(false));
  }, [loadCalls]);

  function startElapsedTimer() {
    setElapsed(0);
    elapsedRef.current = setInterval(() => {
      setElapsed(s => s + 1);
    }, 1000);
  }

  function stopElapsedTimer() {
    if (elapsedRef.current !== null) {
      clearInterval(elapsedRef.current);
      elapsedRef.current = null;
    }
  }

  async function handleFilesSelected(files: File[]) {
    if (files.length === 0) return;

    const initial: ParseItem[] = files.map(f => ({
      filename: f.name,
      status: 'parsing',
    }));
    setParseItems(initial);
    startElapsedTimer();

    let response;
    try {
      response = await api.calls.upload(accountId, files);
    } catch (err) {
      stopElapsedTimer();
      const message = err instanceof Error ? err.message : String(err);
      setParseItems(files.map(f => ({ filename: f.name, status: 'failed', error: message })));
      showToast('error', `Upload failed: ${message}`);
      return;
    }

    stopElapsedTimer();

    // Map results back to parse items
    const finalItems: ParseItem[] = response.results.map(r => {
      if (r.ok) {
        return { filename: r.filename, status: 'done' as const, attendeesSeeded: r.attendeesSeeded };
      } else {
        console.error(`[calls] parse failed for "${r.filename}":`, r.error);
        return { filename: r.filename, status: 'failed' as const, error: r.error };
      }
    });
    setParseItems(finalItems);

    const { succeeded, failed } = response.summary;
    const totalSeeded = response.results
      .filter(r => r.ok)
      .reduce((sum, r) => sum + (r.ok ? r.attendeesSeeded : 0), 0);

    if (failed === 0) {
      const who = totalSeeded > 0
        ? `, seeded ${totalSeeded} new ${totalSeeded === 1 ? 'stakeholder' : 'stakeholders'}`
        : '';
      showToast('success', `Parsed ${succeeded} ${succeeded === 1 ? 'transcript' : 'transcripts'}${who}`);
    } else if (succeeded > 0) {
      showToast('warning', `Parsed ${succeeded}/${succeeded + failed} transcripts, ${failed} failed`);
    } else {
      showToast('error', `All ${failed} ${failed === 1 ? 'transcript' : 'transcripts'} failed to parse`);
    }

    if (totalSeeded > 0) onAttendeesSeeded();
    if (succeeded > 0) await loadCalls();
  }

  function handleCallUpdate(updated: Call) {
    setCalls(prev => prev.map(c => c.id === updated.id ? updated : c));
  }

  async function handleCallDelete(id: string) {
    try {
      await api.calls.delete(id);
      setCalls(prev => prev.filter(c => c.id !== id));
      showToast('success', 'Call deleted. Stakeholders seeded from it remain on the account.');
    } catch (err) {
      console.error('Failed to delete call:', err);
      showToast('error', 'Failed to delete call');
    }
  }

  async function handleCallReparse(id: string) {
    try {
      const result = await api.calls.reparse(id);
      setCalls(prev => prev.map(c => c.id === id ? result.call : c));
      const msg = result.attendeesSeeded > 0
        ? `Re-parsed. Seeded ${result.attendeesSeeded} new ${result.attendeesSeeded === 1 ? 'stakeholder' : 'stakeholders'}.`
        : 'Re-parsed successfully.';
      showToast('success', msg);
      if (result.attendeesSeeded > 0) onAttendeesSeeded();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showToast('error', `Re-parse failed: ${message}`);
      throw err;
    }
  }

  const isParsing = parseItems !== null && parseItems.some(i => i.status === 'parsing');
  const allDone = parseItems !== null && parseItems.every(i => i.status !== 'parsing');

  // Sort calls: dated first (desc), then undated by created_at desc
  const sorted = [...calls].sort((a, b) => {
    if (a.date && b.date) return b.date.localeCompare(a.date);
    if (a.date && !b.date) return -1;
    if (!a.date && b.date) return 1;
    return (b.created_at ?? 0) - (a.created_at ?? 0);
  });

  if (loadingCalls) {
    return (
      <div style={{ padding: '2rem', color: '#6b8599', fontSize: '0.875rem' }}>
        Loading calls...
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: '820px' }}>

      <FileDropZone disabled={isParsing} onFiles={handleFilesSelected} />

      {parseItems !== null && (
        <ParseProgressPanel
          items={parseItems}
          elapsed={elapsed}
        />
      )}

      {/* Dismiss progress panel once all are done */}
      {allDone && parseItems !== null && (
        <div style={{ marginBottom: '1rem', textAlign: 'right' }}>
          <button
            onClick={() => setParseItems(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#6b8599',
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          >
            Dismiss results
          </button>
        </div>
      )}

      {sorted.length === 0 && parseItems === null && (
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
          No calls logged yet. Drop a transcript above to add one.
        </div>
      )}

      {sorted.map(call => (
        <CallCard
          key={call.id}
          call={call}
          onUpdate={handleCallUpdate}
          onDelete={handleCallDelete}
          onReparse={handleCallReparse}
        />
      ))}
    </div>
  );
}
