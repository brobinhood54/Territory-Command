import { useState, useEffect, useRef, useCallback } from 'react';
import type { CSSProperties } from 'react';
import type { Call, CallAttendee, Stakeholder, PreCallPlan, PreCallPlanContent } from '@tc/shared';
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

const MEETING_TYPE_LABELS: Record<string, string> = {
  discovery: 'Discovery',
  demo: 'Demo',
  poc_kickoff: 'POC Kickoff',
  poc_update: 'POC Update',
  exec_alignment: 'Exec Alignment',
  negotiation: 'Negotiation',
  other: 'Other',
};

const STATUS_COLOR: Record<string, string> = {
  draft: '#6b8599',
  generated: '#00c2d4',
  completed: '#00e5a0',
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

const sectionCard: CSSProperties = {
  background: '#0a1220',
  border: '1px solid #1e3048',
  borderRadius: '0.375rem',
  padding: '0.75rem 0.875rem',
  marginBottom: '0.625rem',
};

const sectionHeader: CSSProperties = {
  fontSize: '0.6rem',
  fontWeight: 700,
  color: '#6b8599',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  marginBottom: '0.5rem',
};

// ---- helpers ----

function parseAttendees(raw: string | null): CallAttendee[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as CallAttendee[]; } catch { return []; }
}

function parsePlanContent(raw: string | null): PreCallPlanContent | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as PreCallPlanContent; } catch { return null; }
}

function parsePlanAttendeeIds(raw: string | null): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

function filterValidFiles(files: File[]): File[] {
  return files.filter(f => ACCEPTED_EXTS.some(ext => f.name.toLowerCase().endsWith(ext)));
}

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
              <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#6b8599', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>
                {first}
              </div>
              {lines.slice(1).length > 0 && (
                <div style={{ fontSize: '0.8125rem', color: '#9db8cc', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                  {lines.slice(1).join('\n')}
                </div>
              )}
            </div>
          );
        }
        return (
          <div key={i} style={{ fontSize: '0.8125rem', color: '#9db8cc', lineHeight: 1.65, whiteSpace: 'pre-wrap', marginBottom: '0.875rem' }}>
            {para.trim()}
          </div>
        );
      })}
    </div>
  );
}

// ---- plan content renderer ----

function PlanContentView({ content }: { content: PreCallPlanContent }) {
  return (
    <div style={{ marginTop: '0.75rem' }}>
      <div style={sectionCard}>
        <div style={sectionHeader}>Goal</div>
        <div style={{ fontSize: '0.8125rem', color: '#dde6ee', lineHeight: 1.6 }}>{content.goal}</div>
      </div>

      <div style={sectionCard}>
        <div style={sectionHeader}>Presenter</div>
        <div style={{ fontSize: '0.8125rem', color: '#dde6ee' }}>
          {content.presenter.primary}
          {content.presenter.supporting.length > 0 && (
            <span style={{ color: '#6b8599' }}> + {content.presenter.supporting.join(', ')}</span>
          )}
        </div>
      </div>

      <div style={sectionCard}>
        <div style={sectionHeader}>Talking Points ({content.talkingPoints.length})</div>
        {content.talkingPoints.map((tp, i) => (
          <div key={i} style={{
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'flex-start',
            marginBottom: i < content.talkingPoints.length - 1 ? '0.5rem' : 0,
          }}>
            <span style={{ fontSize: '0.7rem', color: '#00c2d4', fontWeight: 700, minWidth: '1rem', paddingTop: '0.15rem' }}>
              {tp.order}
            </span>
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#dde6ee', lineHeight: 1.4 }}>{tp.topic}</div>
              <div style={{ fontSize: '0.775rem', color: '#9db8cc', lineHeight: 1.5, marginTop: '0.125rem' }}>{tp.supportingDetail}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={sectionCard}>
        <div style={sectionHeader}>Customer Context</div>
        <div style={{ fontSize: '0.8125rem', color: '#9db8cc', lineHeight: 1.6, marginBottom: '0.625rem' }}>
          {content.customerContext.whatTheyCareAbout}
        </div>
        {content.customerContext.perAttendee.length > 0 && (
          <>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#6b8599', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.375rem' }}>
              Per Attendee
            </div>
            {content.customerContext.perAttendee.map((att, i) => (
              <div key={i} style={{
                background: '#0d1826',
                border: '1px solid #1e3048',
                borderRadius: '0.25rem',
                padding: '0.5rem 0.625rem',
                marginBottom: i < content.customerContext.perAttendee.length - 1 ? '0.375rem' : 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#dde6ee' }}>{att.name}</span>
                  <span style={{ fontSize: '0.65rem', color: '#6b8599', border: '1px solid #1e3048', borderRadius: '999px', padding: '0.05rem 0.4rem' }}>{att.role}</span>
                </div>
                <div style={{ fontSize: '0.775rem', color: '#9db8cc', lineHeight: 1.5, marginBottom: '0.25rem' }}>
                  {att.talkingTo}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b8599', lineHeight: 1.5 }}>
                  Watch: {att.watchFor}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {content.anticipatedObjections.length > 0 && (
        <div style={sectionCard}>
          <div style={sectionHeader}>Anticipated Objections ({content.anticipatedObjections.length})</div>
          {content.anticipatedObjections.map((obj, i) => (
            <div key={i} style={{
              background: '#0d1826',
              border: '1px solid #1e3048',
              borderLeft: '3px solid #f0a500',
              borderRadius: '0.25rem',
              padding: '0.5rem 0.625rem',
              marginBottom: i < content.anticipatedObjections.length - 1 ? '0.375rem' : 0,
            }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#dde6ee', marginBottom: '0.25rem' }}>{obj.objection}</div>
              <div style={{ fontSize: '0.775rem', color: '#00e5a0', lineHeight: 1.5 }}>{obj.response}</div>
            </div>
          ))}
        </div>
      )}

      <div style={sectionCard}>
        <div style={sectionHeader}>Desired Outcome</div>
        <div style={{ fontSize: '0.8125rem', color: '#dde6ee', lineHeight: 1.6 }}>{content.desiredOutcome}</div>
      </div>
    </div>
  );
}

// ---- Pill ----

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: '0.6rem',
      fontWeight: 700,
      color,
      border: `1px solid ${color}`,
      borderRadius: '999px',
      padding: '0.1rem 0.45rem',
      whiteSpace: 'nowrap',
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
    }}>
      {label}
    </span>
  );
}

// ---- NewPlanForm (module scope, per CLAUDE.md gotcha #5) ----

interface NewPlanFormProps {
  stakeholders: Stakeholder[];
  onSave: (data: {
    title: string;
    meeting_type: string;
    planned_date: string | null;
    goal: string | null;
    attendee_stakeholder_ids: string[];
    additional_attendees: string | null;
  }) => void;
  onCancel: () => void;
  saving: boolean;
}

function NewPlanForm({ stakeholders, onSave, onCancel, saving }: NewPlanFormProps) {
  const [title, setTitle] = useState('');
  const [meetingType, setMeetingType] = useState('discovery');
  const [plannedDate, setPlannedDate] = useState('');
  const [goal, setGoal] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [additionalAttendees, setAdditionalAttendees] = useState('');

  function toggleStakeholder(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      meeting_type: meetingType,
      planned_date: plannedDate.trim() || null,
      goal: goal.trim() || null,
      attendee_stakeholder_ids: selectedIds,
      additional_attendees: additionalAttendees.trim() || null,
    });
  }

  const inputStyle: CSSProperties = {
    background: '#0a1220',
    border: '1px solid #1e3048',
    borderRadius: '0.25rem',
    color: '#dde6ee',
    fontSize: '0.8125rem',
    fontFamily: 'inherit',
    padding: '0.4rem 0.625rem',
    width: '100%',
    boxSizing: 'border-box',
    outline: 'none',
  };

  const labelSt: CSSProperties = {
    fontSize: '0.6875rem',
    color: '#6b8599',
    display: 'block',
    marginBottom: '0.25rem',
  };

  const fieldGap: CSSProperties = { marginBottom: '0.875rem' };

  return (
    <form onSubmit={handleSubmit} style={{
      background: '#0a1220',
      border: '1px solid #1e3048',
      borderRadius: '0.5rem',
      padding: '1rem 1.25rem',
      marginBottom: '1rem',
    }}>
      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#dde6ee', marginBottom: '0.875rem' }}>
        New Pre-Call Plan
      </div>

      <div style={fieldGap}>
        <label style={labelSt}>Title *</label>
        <input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g., Lennar SOX Discovery"
          style={inputStyle}
          required
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.875rem' }}>
        <div>
          <label style={labelSt}>Meeting Type</label>
          <select
            value={meetingType}
            onChange={e => setMeetingType(e.target.value)}
            style={{ ...inputStyle }}
          >
            {Object.entries(MEETING_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelSt}>Planned Date (YYYY-MM-DD)</label>
          <input
            type="date"
            value={plannedDate}
            onChange={e => setPlannedDate(e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>

      <div style={fieldGap}>
        <label style={labelSt}>Goal (1 line)</label>
        <input
          value={goal}
          onChange={e => setGoal(e.target.value)}
          placeholder="e.g., confirm SOX timeline and identify EB"
          style={inputStyle}
        />
      </div>

      {stakeholders.length > 0 && (
        <div style={fieldGap}>
          <label style={labelSt}>Attendees (from stakeholder map)</label>
          <div style={{
            border: '1px solid #1e3048',
            borderRadius: '0.25rem',
            maxHeight: '140px',
            overflowY: 'auto',
            background: '#0d1929',
          }}>
            {stakeholders.map((s, i) => (
              <label
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.375rem 0.625rem',
                  cursor: 'pointer',
                  borderBottom: i < stakeholders.length - 1 ? '1px solid #131f30' : 'none',
                  background: selectedIds.includes(s.id) ? '#132030' : 'transparent',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(s.id)}
                  onChange={() => toggleStakeholder(s.id)}
                  style={{ accentColor: '#00e5a0', width: '14px', height: '14px', flexShrink: 0 }}
                />
                <span style={{ fontSize: '0.8125rem', color: '#dde6ee' }}>{s.name}</span>
                {s.title && <span style={{ fontSize: '0.7rem', color: '#6b8599' }}>{s.title}</span>}
              </label>
            ))}
          </div>
        </div>
      )}

      <div style={fieldGap}>
        <label style={labelSt}>Additional attendees (not in stakeholder map, comma-separated)</label>
        <input
          value={additionalAttendees}
          onChange={e => setAdditionalAttendees(e.target.value)}
          placeholder="e.g., John Smith, Jane Doe"
          style={inputStyle}
        />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          type="submit"
          disabled={saving || !title.trim()}
          style={{
            background: saving || !title.trim() ? '#1e3048' : '#00e5a0',
            color: saving || !title.trim() ? '#6b8599' : '#080e1a',
            border: 'none',
            borderRadius: '0.25rem',
            padding: '0.4rem 1rem',
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: saving || !title.trim() ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          style={{
            background: 'none',
            border: '1px solid #1e3048',
            borderRadius: '0.25rem',
            color: '#6b8599',
            padding: '0.4rem 0.875rem',
            fontSize: '0.8125rem',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---- EditPlanForm (module scope) ----

interface EditPlanFormProps {
  plan: PreCallPlan;
  stakeholders: Stakeholder[];
  onSave: (patch: {
    title: string;
    meeting_type: string;
    planned_date: string | null;
    goal: string | null;
    attendee_stakeholder_ids: string[];
    additional_attendees: string | null;
  }) => void;
  onCancel: () => void;
  saving: boolean;
}

function EditPlanForm({ plan, stakeholders, onSave, onCancel, saving }: EditPlanFormProps) {
  const [title, setTitle] = useState(plan.title);
  const [meetingType, setMeetingType] = useState(plan.meeting_type);
  const [plannedDate, setPlannedDate] = useState(plan.planned_date ?? '');
  const [goal, setGoal] = useState(plan.goal ?? '');
  const [selectedIds, setSelectedIds] = useState<string[]>(parsePlanAttendeeIds(plan.attendee_stakeholder_ids));
  const [additionalAttendees, setAdditionalAttendees] = useState(plan.additional_attendees ?? '');

  function toggleStakeholder(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      meeting_type: meetingType,
      planned_date: plannedDate.trim() || null,
      goal: goal.trim() || null,
      attendee_stakeholder_ids: selectedIds,
      additional_attendees: additionalAttendees.trim() || null,
    });
  }

  const inputStyle: CSSProperties = {
    background: '#0a1220',
    border: '1px solid #1e3048',
    borderRadius: '0.25rem',
    color: '#dde6ee',
    fontSize: '0.8125rem',
    fontFamily: 'inherit',
    padding: '0.4rem 0.625rem',
    width: '100%',
    boxSizing: 'border-box',
    outline: 'none',
  };

  const labelSt: CSSProperties = { fontSize: '0.6875rem', color: '#6b8599', display: 'block', marginBottom: '0.25rem' };
  const fieldGap: CSSProperties = { marginBottom: '0.875rem' };

  return (
    <form onSubmit={handleSubmit} style={{
      background: '#0a1220',
      border: '1px solid #1e3048',
      borderRadius: '0.375rem',
      padding: '0.875rem 1rem',
      marginTop: '0.625rem',
    }}>
      <div style={fieldGap}>
        <label style={labelSt}>Title *</label>
        <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} required />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.875rem' }}>
        <div>
          <label style={labelSt}>Meeting Type</label>
          <select value={meetingType} onChange={e => setMeetingType(e.target.value)} style={{ ...inputStyle }}>
            {Object.entries(MEETING_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label style={labelSt}>Planned Date</label>
          <input type="date" value={plannedDate} onChange={e => setPlannedDate(e.target.value)} style={inputStyle} />
        </div>
      </div>

      <div style={fieldGap}>
        <label style={labelSt}>Goal</label>
        <input value={goal} onChange={e => setGoal(e.target.value)} style={inputStyle} />
      </div>

      {stakeholders.length > 0 && (
        <div style={fieldGap}>
          <label style={labelSt}>Attendees</label>
          <div style={{ border: '1px solid #1e3048', borderRadius: '0.25rem', maxHeight: '140px', overflowY: 'auto', background: '#0d1929' }}>
            {stakeholders.map((s, i) => (
              <label key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.625rem', cursor: 'pointer',
                borderBottom: i < stakeholders.length - 1 ? '1px solid #131f30' : 'none',
                background: selectedIds.includes(s.id) ? '#132030' : 'transparent',
              }}>
                <input type="checkbox" checked={selectedIds.includes(s.id)} onChange={() => toggleStakeholder(s.id)}
                  style={{ accentColor: '#00e5a0', width: '14px', height: '14px', flexShrink: 0 }} />
                <span style={{ fontSize: '0.8125rem', color: '#dde6ee' }}>{s.name}</span>
                {s.title && <span style={{ fontSize: '0.7rem', color: '#6b8599' }}>{s.title}</span>}
              </label>
            ))}
          </div>
        </div>
      )}

      <div style={fieldGap}>
        <label style={labelSt}>Additional attendees</label>
        <input value={additionalAttendees} onChange={e => setAdditionalAttendees(e.target.value)} style={inputStyle} />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="submit" disabled={saving || !title.trim()} style={{
          background: saving || !title.trim() ? '#1e3048' : '#00e5a0',
          color: saving || !title.trim() ? '#6b8599' : '#080e1a',
          border: 'none', borderRadius: '0.25rem', padding: '0.4rem 0.875rem',
          fontSize: '0.8125rem', fontWeight: 600, cursor: saving || !title.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
        }}>
          {saving ? 'Saving...' : 'Save changes'}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} style={{
          background: 'none', border: '1px solid #1e3048', borderRadius: '0.25rem', color: '#6b8599',
          padding: '0.4rem 0.875rem', fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---- PlanCard (module scope) ----

interface PlanCardProps {
  plan: PreCallPlan;
  stakeholders: Stakeholder[];
  calls: Call[];
  defaultExpanded?: boolean;
  planCardRef?: React.RefObject<HTMLDivElement | null>;
  onUpdate: (updated: PreCallPlan) => void;
  onDelete: (id: string) => void;
  onScrollToCall: (callId: string) => void;
}

function PlanCard({
  plan,
  stakeholders,
  calls,
  defaultExpanded,
  planCardRef,
  onUpdate,
  onDelete,
  onScrollToCall,
}: PlanCardProps) {
  const confirm = useConfirm();
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);
  const [editing, setEditing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [genElapsed, setGenElapsed] = useState(0);
  const genTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // The list endpoint omits content; fetch full plan on first expand
  const [fullPlan, setFullPlan] = useState<PreCallPlan | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const contentFetchedRef = useRef(false);

  const activePlan = fullPlan ?? plan;
  const content = parsePlanContent(activePlan.content);
  const statusColor = STATUS_COLOR[plan.status] ?? '#6b8599';
  const meetingLabel = MEETING_TYPE_LABELS[plan.meeting_type] ?? plan.meeting_type;
  const linkedCall = plan.linked_call_id ? calls.find(c => c.id === plan.linked_call_id) ?? null : null;

  // Lazy-load content on first expand when plan has content but list didn't return it
  useEffect(() => {
    if (!expanded || contentFetchedRef.current) return;
    if (plan.content != null) { contentFetchedRef.current = true; return; }
    if (plan.status === 'draft') { contentFetchedRef.current = true; return; }
    contentFetchedRef.current = true;
    setLoadingContent(true);
    api.preCallPlans.get(plan.id)
      .then(full => { setFullPlan(full); })
      .catch(err => showToast('error', err instanceof Error ? err.message : 'Failed to load plan'))
      .finally(() => setLoadingContent(false));
  }, [expanded, plan.id, plan.content, plan.status]);

  function startGenTimer() {
    setGenElapsed(0);
    genTimerRef.current = setInterval(() => setGenElapsed(e => e + 1), 1000);
  }
  function stopGenTimer() {
    if (genTimerRef.current) { clearInterval(genTimerRef.current); genTimerRef.current = null; }
  }

  async function handleGenerate() {
    setGenerating(true);
    startGenTimer();
    try {
      const updated = await api.preCallPlans.generate(plan.id);
      setFullPlan(updated);
      onUpdate(updated);
      const latS = updated.latency_ms ? (updated.latency_ms / 1000).toFixed(1) : '?';
      showToast('success', `Plan generated in ${latS}s (Sonnet 4.6)`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Generate failed');
    } finally {
      stopGenTimer();
      setGenerating(false);
    }
  }

  async function handleEditSave(patch: Parameters<EditPlanFormProps['onSave']>[0]) {
    setEditSaving(true);
    try {
      const updated = await api.preCallPlans.update(plan.id, patch);
      setFullPlan(updated);
      onUpdate(updated);
      setEditing(false);
      showToast('success', 'Plan updated.', { quiet: true });
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Update failed');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete() {
    const ok = await confirm({
      title: 'Delete this pre-call plan?',
      body: 'This cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) onDelete(plan.id);
  }

  async function handleUnlink() {
    const ok = await confirm({
      title: 'Unlink this plan from the call?',
      body: 'The plan will return to the Upcoming/Unmatched group.',
      confirmLabel: 'Unlink',
      destructive: true,
    });
    if (!ok) return;
    try {
      const updated = await api.preCallPlans.unlinkCall(plan.id);
      onUpdate(updated);
      showToast('success', 'Plan unlinked.', { quiet: true });
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Unlink failed');
    }
  }

  async function handleCopyMarkdown() {
    if (!content) return;
    const lines: string[] = [];
    lines.push(`# Pre-Call Plan: ${activePlan.title}`);
    lines.push(`Type: ${meetingLabel} | Date: ${plan.planned_date ?? 'TBD'}`);
    lines.push('');
    lines.push(`## Goal`);
    lines.push(content.goal);
    lines.push('');
    lines.push(`## Presenter`);
    lines.push(`${content.presenter.primary}${content.presenter.supporting.length > 0 ? ' + ' + content.presenter.supporting.join(', ') : ''}`);
    lines.push('');
    lines.push(`## Talking Points`);
    for (const tp of content.talkingPoints) {
      lines.push(`${tp.order}. **${tp.topic}**`);
      lines.push(`   ${tp.supportingDetail}`);
    }
    lines.push('');
    lines.push(`## Customer Context`);
    lines.push(content.customerContext.whatTheyCareAbout);
    lines.push('');
    for (const att of content.customerContext.perAttendee) {
      lines.push(`### ${att.name} (${att.role})`);
      lines.push(`Approach: ${att.talkingTo}`);
      lines.push(`Watch for: ${att.watchFor}`);
    }
    lines.push('');
    if (content.anticipatedObjections.length > 0) {
      lines.push(`## Anticipated Objections`);
      for (const obj of content.anticipatedObjections) {
        lines.push(`**${obj.objection}**`);
        lines.push(obj.response);
      }
      lines.push('');
    }
    lines.push(`## Desired Outcome`);
    lines.push(content.desiredOutcome);
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      showToast('success', 'Plan copied to clipboard.');
    } catch {
      showToast('error', 'Clipboard write failed. Try a different browser.');
    }
  }

  return (
    <div ref={planCardRef as React.RefObject<HTMLDivElement>} style={{ ...cardBase, marginBottom: '0.5rem' }}>
      {/* Card header */}
      <div
        style={{ padding: '0.75rem 1rem 0.5rem', cursor: 'pointer' }}
        onClick={() => { if (!editing) setExpanded(v => !v); }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: '0.875rem', fontWeight: 600, color: '#dde6ee', lineHeight: 1.4 }}>
            {plan.title}
          </span>
          {plan.planned_date && (
            <span style={{ fontSize: '0.6rem', color: '#00c2d4', border: '1px solid #00c2d4', borderRadius: '999px', padding: '0.1rem 0.45rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {plan.planned_date}
            </span>
          )}
          <Pill label={meetingLabel} color="#6b8599" />
          <Pill label={plan.status} color={statusColor} />
        </div>
        {plan.goal && (
          <div style={{ fontSize: '0.775rem', color: '#6b8599', fontStyle: 'italic', marginTop: '0.25rem', lineHeight: 1.4 }}>
            {plan.goal}
          </div>
        )}
      </div>

      {/* Expanded body */}
      {expanded && (
        <div style={{ padding: '0 1rem 0.875rem' }}>
          {editing ? (
            <EditPlanForm
              plan={plan}
              stakeholders={stakeholders}
              onSave={handleEditSave}
              onCancel={() => setEditing(false)}
              saving={editSaving}
            />
          ) : (
            <>
              {/* Linked call banner */}
              {plan.status === 'completed' && linkedCall && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#0a1f10',
                  border: '1px solid #00e5a0',
                  borderRadius: '0.375rem',
                  padding: '0.375rem 0.75rem',
                  marginBottom: '0.625rem',
                  flexWrap: 'wrap',
                  gap: '0.375rem',
                }}>
                  <button
                    onClick={() => { onScrollToCall(linkedCall.id); }}
                    style={{
                      background: 'none', border: 'none', color: '#00e5a0',
                      fontSize: '0.775rem', cursor: 'pointer', fontFamily: 'inherit',
                      textDecoration: 'underline', padding: 0,
                    }}
                  >
                    Linked call: {linkedCall.title ?? 'Untitled'} ({linkedCall.date ?? 'no date'})
                  </button>
                  <button
                    onClick={handleUnlink}
                    style={{
                      background: 'none', border: '1px solid #3a5068', borderRadius: '0.25rem',
                      color: '#6b8599', fontSize: '0.7rem', cursor: 'pointer', fontFamily: 'inherit',
                      padding: '0.1rem 0.5rem',
                    }}
                  >
                    Unlink
                  </button>
                </div>
              )}

              {/* Content loading */}
              {loadingContent && !generating && (
                <div style={{ fontSize: '0.775rem', color: '#6b8599', padding: '0.375rem 0' }}>
                  Loading plan content...
                </div>
              )}

              {/* Generating progress */}
              {generating && (
                <div style={{
                  background: '#0d1929', border: '1px solid #1e3048', borderRadius: '0.375rem',
                  padding: '0.625rem 0.875rem', marginBottom: '0.625rem', color: '#9db8cc', fontSize: '0.8125rem',
                }}>
                  Generating with Sonnet 4.6... ({genElapsed}s elapsed, typically 15-45s)
                </div>
              )}

              {/* Plan content */}
              {content && !generating && <PlanContentView content={content} />}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: content ? '0.625rem' : '0.25rem' }}>
                {plan.status === 'draft' && !generating && (
                  <button
                    onClick={handleGenerate}
                    style={{
                      background: '#00e5a0', color: '#080e1a', border: 'none', borderRadius: '0.25rem',
                      padding: '0.35rem 0.875rem', fontSize: '0.8125rem', fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    Generate
                  </button>
                )}
                {plan.status === 'generated' && !generating && (
                  <button
                    onClick={handleGenerate}
                    style={{
                      background: 'none', border: '1px solid #00c2d4', borderRadius: '0.25rem',
                      color: '#00c2d4', padding: '0.3rem 0.75rem', fontSize: '0.75rem',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    Regenerate
                  </button>
                )}
                {content && (
                  <button
                    onClick={handleCopyMarkdown}
                    style={{
                      background: 'none', border: '1px solid #1e3048', borderRadius: '0.25rem',
                      color: '#9db8cc', padding: '0.3rem 0.75rem', fontSize: '0.75rem',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    Copy as markdown
                  </button>
                )}
                {!editing && (
                  <button
                    onClick={() => setEditing(true)}
                    style={{
                      background: 'none', border: '1px solid #1e3048', borderRadius: '0.25rem',
                      color: '#6b8599', padding: '0.3rem 0.75rem', fontSize: '0.75rem',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={handleDelete}
                  style={{
                    background: 'none', border: 'none', color: '#4a6070',
                    fontSize: '0.875rem', cursor: 'pointer', padding: '0 0.125rem', lineHeight: 1,
                  }}
                  title="Delete plan"
                >
                  &#x2715;
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---- PreCallPlansSection (module scope) ----

interface PreCallPlansSectionProps {
  accountId: string;
  stakeholders: Stakeholder[];
  calls: Call[];
  onScrollToCall: (callId: string) => void;
  refreshToken: number;
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
        <div key={item.filename} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', marginBottom: '0.5rem' }}>
          <span style={{
            fontSize: '0.875rem', lineHeight: 1, marginTop: '0.1rem',
            color: item.status === 'done' ? '#00e5a0' : item.status === 'failed' ? '#e06050' : '#f0a500',
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
              <div style={{ fontSize: '0.6875rem', color: '#6b8599', marginTop: '0.125rem' }}>Done</div>
            )}
            {item.status === 'failed' && (
              <div style={{ fontSize: '0.6875rem', color: '#e06050', marginTop: '0.125rem' }}>{item.error}</div>
            )}
            {item.status === 'parsing' && (
              <div style={{ fontSize: '0.6875rem', color: '#6b8599', marginTop: '0.125rem' }}>Parsing with AI...</div>
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
  linkedPlanId?: string | null;
  highlighted?: boolean;
  onHighlightConsumed?: () => void;
  onUpdate: (updated: Call) => void;
  onDelete: (id: string) => void;
  onReparse: (id: string) => Promise<void>;
  onScrollToPlan: (planId: string) => void;
}

function CallCard({ call, linkedPlanId, highlighted, onHighlightConsumed, onUpdate, onDelete, onReparse, onScrollToPlan }: CallCardProps) {
  const confirm = useConfirm();
  const cardRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDate, setEditingDate] = useState(false);
  const [editingSummary, setEditingSummary] = useState(false);
  const [reparsing, setReparsing] = useState(false);

  const [titleVal, setTitleVal] = useState(call.title ?? '');
  const [dateVal, setDateVal] = useState(call.date ?? '');
  const [summaryVal, setSummaryVal] = useState(call.summary ?? '');

  const callIdRef = useRef(call.id);
  if (callIdRef.current !== call.id) {
    callIdRef.current = call.id;
    setTitleVal(call.title ?? '');
    setDateVal(call.date ?? '');
    setSummaryVal(call.summary ?? '');
  }

  useEffect(() => {
    if (!highlighted) return;
    setExpanded(true);
    setTimeout(() => {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 80);
    onHighlightConsumed?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlighted]);

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

  const summaryPreview = (call.summary ?? '').split('\n').find(l => l.trim()) ?? '';

  return (
    <div ref={cardRef} style={cardBase}>
      {/* Header */}
      <div style={{ padding: '0.875rem 1rem 0.625rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', flexWrap: 'wrap' }}>
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
                style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#dde6ee', cursor: 'pointer', display: 'block' }}
              >
                {call.title || '(untitled)'}
              </span>
            )}
          </div>

          {/* Pre-call plan link */}
          {linkedPlanId && (
            <button
              onClick={() => onScrollToPlan(linkedPlanId)}
              style={{
                background: 'none', border: 'none', color: '#00c2d4',
                fontSize: '0.7rem', cursor: 'pointer', fontFamily: 'inherit',
                textDecoration: 'underline', padding: 0, flexShrink: 0,
              }}
            >
              Pre-call plan
            </button>
          )}

          <span
            onClick={cycleHealth}
            title="Click to cycle health"
            style={{
              display: 'inline-block', fontSize: '0.6rem', fontWeight: 700,
              color: healthColor, border: `1px solid ${healthColor}`,
              borderRadius: '999px', padding: '0.1rem 0.5rem', cursor: 'pointer',
              userSelect: 'none', flexShrink: 0,
            }}
          >
            {health}
          </span>

          {attendees.length > 0 && (
            <span style={{ fontSize: '0.6875rem', color: '#6b8599', flexShrink: 0, paddingTop: '0.1rem' }}>
              {attendees.length} {attendees.length === 1 ? 'attendee' : 'attendees'}
            </span>
          )}
        </div>

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

      {!expanded && (
        <div
          onClick={() => setExpanded(true)}
          style={{
            padding: '0 1rem 0.75rem', fontSize: '0.8125rem', color: '#4a6070',
            cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}
        >
          {summaryPreview || 'Click to expand summary'}
        </div>
      )}

      {expanded && (
        <div style={{ padding: '0 1rem 0.75rem' }}>
          {editingSummary ? (
            <div>
              <textarea
                autoFocus
                value={summaryVal}
                onChange={e => setSummaryVal(e.target.value)}
                style={{
                  background: '#0a1220', border: '1px solid #1e3048', borderRadius: '0.25rem',
                  color: '#dde6ee', fontSize: '0.8125rem', fontFamily: 'inherit',
                  width: '100%', minHeight: '280px', padding: '0.625rem',
                  resize: 'vertical', outline: 'none', lineHeight: 1.6, boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  onClick={saveSummary}
                  style={{
                    background: '#00e5a0', color: '#080e1a', border: 'none', borderRadius: '0.25rem',
                    padding: '0.3rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => { setSummaryVal(call.summary ?? ''); setEditingSummary(false); }}
                  style={{
                    background: 'none', border: '1px solid #1e3048', borderRadius: '0.25rem',
                    color: '#6b8599', padding: '0.3rem 0.75rem', fontSize: '0.8125rem', cursor: 'pointer',
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
            style={{ background: 'none', border: 'none', color: '#4a6070', fontSize: '0.75rem', cursor: 'pointer', padding: 0, marginTop: '0.25rem' }}
          >
            Collapse
          </button>
        </div>
      )}

      <div style={{
        borderTop: '1px solid #1e3048', padding: '0.5rem 1rem',
        display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap',
      }}>
        {call.source_file && (
          <span style={{ fontSize: '0.6875rem', color: '#4a6070', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Source: {call.source_file}
          </span>
        )}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
          <button
            onClick={() => setExpanded(v => !v)}
            style={{ background: 'none', border: '1px solid #1e3048', borderRadius: '0.25rem', color: '#6b8599', fontSize: '0.75rem', padding: '0.2rem 0.5rem', cursor: 'pointer' }}
          >
            {expanded ? 'Collapse' : 'Expand'}
          </button>
          {!editingSummary && (
            <button
              onClick={() => { setExpanded(true); setEditingSummary(true); }}
              style={{ background: 'none', border: '1px solid #1e3048', borderRadius: '0.25rem', color: '#6b8599', fontSize: '0.75rem', padding: '0.2rem 0.5rem', cursor: 'pointer' }}
            >
              Edit summary
            </button>
          )}
          <button
            onClick={handleReparseClick}
            disabled={reparsing}
            style={{ background: 'none', border: '1px solid #1e3048', borderRadius: '0.25rem', color: '#6b8599', fontSize: '0.75rem', padding: '0.2rem 0.5rem', cursor: reparsing ? 'default' : 'pointer' }}
          >
            {reparsing ? 'Parsing...' : 'Re-parse with AI'}
          </button>
          <button
            onClick={handleDeleteClick}
            style={{ background: 'none', border: 'none', color: '#4a6070', fontSize: '0.875rem', cursor: 'pointer', padding: '0 0.125rem', lineHeight: 1 }}
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
  stakeholders: Stakeholder[];
  calls: Call[];
  loadingCalls: boolean;
  onCallUpdate: (updated: Call) => void;
  onCallDelete: (id: string) => void;
  onCallsRefresh: () => Promise<void>;
  onAttendeesSeeded: () => void;
  highlightCallId?: string | null;
  onHighlightConsumed?: () => void;
}

export default function AccountCalls({
  accountId,
  stakeholders,
  calls,
  loadingCalls,
  onCallUpdate,
  onCallDelete,
  onCallsRefresh,
  onAttendeesSeeded,
  highlightCallId,
  onHighlightConsumed,
}: AccountCallsProps) {
  const [parseItems, setParseItems] = useState<ParseItem[] | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Used to tell PreCallPlansSection to refresh after auto-link
  const [plansRefreshToken, setPlansRefreshToken] = useState(0);

  // Map from call id to the plan id that links it (built from call list + plans via plan refresh)
  const [callToPlanMap, setCallToPlanMap] = useState<Map<string, string>>(new Map());

  // Ref to the scroll-to-plan function inside PreCallPlansSection
  const scrollToPlanFnRef = useRef<((planId: string) => void) | null>(null);

  function startElapsedTimer() {
    setElapsed(0);
    elapsedRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
  }

  function stopElapsedTimer() {
    if (elapsedRef.current !== null) {
      clearInterval(elapsedRef.current);
      elapsedRef.current = null;
    }
  }

  async function handleFilesSelected(files: File[]) {
    if (files.length === 0) return;

    const initial: ParseItem[] = files.map(f => ({ filename: f.name, status: 'parsing' }));
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

    // Check for any auto-linked plans in the response
    const anyAutoLinked = response.results.some(r => r.ok && Array.isArray((r as Record<string, unknown>).autoLinkedPlans) && ((r as Record<string, unknown>).autoLinkedPlans as unknown[]).length > 0);

    if (failed === 0) {
      const who = totalSeeded > 0
        ? `, seeded ${totalSeeded} new ${totalSeeded === 1 ? 'stakeholder' : 'stakeholders'}`
        : '';
      const planMsg = anyAutoLinked ? ' Pre-call plan auto-linked.' : '';
      showToast('success', `Parsed ${succeeded} ${succeeded === 1 ? 'transcript' : 'transcripts'}${who}.${planMsg}`);
    } else if (succeeded > 0) {
      showToast('warning', `Parsed ${succeeded}/${succeeded + failed} transcripts, ${failed} failed`);
    } else {
      showToast('error', `All ${failed} ${failed === 1 ? 'transcript' : 'transcripts'} failed to parse`);
    }

    if (totalSeeded > 0) onAttendeesSeeded();
    if (succeeded > 0) {
      await onCallsRefresh();
      if (anyAutoLinked) setPlansRefreshToken(t => t + 1);
    }
  }

  async function handleCallDelete(id: string) {
    try {
      await api.calls.delete(id);
      onCallDelete(id);
      showToast('success', 'Call deleted. Stakeholders seeded from it remain on the account.');
    } catch (err) {
      console.error('Failed to delete call:', err);
      showToast('error', 'Failed to delete call');
    }
  }

  async function handleCallReparse(id: string) {
    try {
      const result = await api.calls.reparse(id);
      onCallUpdate(result.call);
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

  // Build a call-id -> plan-id map from calls and a snapshot that PreCallPlansSection updates
  // We derive this lazily when PreCallPlansSection tells us it updated plans
  function handleScrollToCall(callId: string) {
    // highlight the call by setting it -- we don't have direct state here, but
    // we signal the parent to do so by manually scrolling the call card
    // The call cards are keyed by id so we find the DOM element
    const el = document.querySelector(`[data-call-id="${callId}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function handleScrollToPlan(planId: string) {
    if (scrollToPlanFnRef.current) scrollToPlanFnRef.current(planId);
  }

  const isParsing = parseItems !== null && parseItems.some(i => i.status === 'parsing');
  const allDone = parseItems !== null && parseItems.every(i => i.status !== 'parsing');

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

  // Build call-to-plan lookup from plans (accessed via a callback that PreCallPlansSection exposes)
  // Since we can't easily get plan state from the section, we'll manage this at this level
  // by tracking a separate plans state copy just for the linkage map.
  // Simpler approach: store a "plansByCallId" map that we update via a callback from PreCallPlansSection.
  // We do this by keeping a ref updated from a prop on PreCallPlansSection.

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: '820px' }}>
      <PreCallPlansSectionWithRef
        accountId={accountId}
        stakeholders={stakeholders}
        calls={calls}
        refreshToken={plansRefreshToken}
        onScrollToCall={handleScrollToCall}
        onScrollToPlanReady={(fn) => { scrollToPlanFnRef.current = fn; }}
        onCallToPlanMapUpdate={setCallToPlanMap}
      />

      <FileDropZone disabled={isParsing} onFiles={handleFilesSelected} />

      {parseItems !== null && (
        <ParseProgressPanel items={parseItems} elapsed={elapsed} />
      )}

      {allDone && parseItems !== null && (
        <div style={{ marginBottom: '1rem', textAlign: 'right' }}>
          <button
            onClick={() => setParseItems(null)}
            style={{ background: 'none', border: 'none', color: '#6b8599', fontSize: '0.75rem', cursor: 'pointer' }}
          >
            Dismiss results
          </button>
        </div>
      )}

      {sorted.length === 0 && parseItems === null && (
        <div style={{
          textAlign: 'center', padding: '3rem 1.5rem', background: '#0f1929',
          border: '1px solid #1e3048', borderRadius: '0.5rem',
          color: '#6b8599', fontSize: '0.875rem', lineHeight: 1.65,
        }}>
          No calls logged yet. Drop a transcript above to add one.
        </div>
      )}

      {sorted.map(call => (
        <div key={call.id} data-call-id={call.id}>
          <CallCard
            call={call}
            linkedPlanId={callToPlanMap.get(call.id) ?? null}
            highlighted={call.id === highlightCallId}
            onHighlightConsumed={onHighlightConsumed}
            onUpdate={onCallUpdate}
            onDelete={handleCallDelete}
            onReparse={handleCallReparse}
            onScrollToPlan={handleScrollToPlan}
          />
        </div>
      ))}
    </div>
  );
}

// ---- PreCallPlansSectionWithRef: wraps PreCallPlansSection with callbacks for linkage map ----
// This gives AccountCalls access to the plan-to-call map without lifting all plan state up.

interface PreCallPlansSectionWithRefProps extends PreCallPlansSectionProps {
  onScrollToPlanReady: (fn: (planId: string) => void) => void;
  onCallToPlanMapUpdate: (map: Map<string, string>) => void;
}

function PreCallPlansSectionWithRef({
  accountId,
  stakeholders,
  calls,
  refreshToken,
  onScrollToCall,
  onScrollToPlanReady,
  onCallToPlanMapUpdate,
}: PreCallPlansSectionWithRefProps) {
  const [plans, setPlans] = useState<PreCallPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [newlyCreatedId, setNewlyCreatedId] = useState<string | null>(null);

  const planRefs = useRef<Map<string, React.RefObject<HTMLDivElement | null>>>(new Map());

  function getPlanRef(id: string): React.RefObject<HTMLDivElement | null> {
    if (!planRefs.current.has(id)) {
      planRefs.current.set(id, { current: null });
    }
    return planRefs.current.get(id)!;
  }

  const loadPlans = useCallback(async () => {
    try {
      const rows = await api.preCallPlans.listForAccount(accountId);
      setPlans(rows);
      // Update the call-to-plan linkage map
      const map = new Map<string, string>();
      for (const p of rows) {
        if (p.linked_call_id) map.set(p.linked_call_id, p.id);
      }
      onCallToPlanMapUpdate(map);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to load pre-call plans');
    } finally {
      setLoading(false);
    }
  }, [accountId, onCallToPlanMapUpdate]);

  useEffect(() => {
    setPlans([]);
    setLoading(true);
    setShowNewForm(false);
    setNewlyCreatedId(null);
    void loadPlans();
  }, [accountId, loadPlans]);

  useEffect(() => {
    if (refreshToken > 0) void loadPlans();
  }, [refreshToken, loadPlans]);

  // Expose scroll-to-plan callback
  useEffect(() => {
    onScrollToPlanReady((planId: string) => {
      const ref = planRefs.current.get(planId);
      if (ref?.current) {
        ref.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  // onScrollToPlanReady is stable (from useRef.current assignment in parent)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleNewPlanSave(data: Parameters<NewPlanFormProps['onSave']>[0]) {
    setSaving(true);
    try {
      const created = await api.preCallPlans.create(accountId, data);
      const newPlans = [created, ...plans];
      setPlans(newPlans);
      const map = new Map<string, string>();
      for (const p of newPlans) { if (p.linked_call_id) map.set(p.linked_call_id, p.id); }
      onCallToPlanMapUpdate(map);
      setShowNewForm(false);
      setNewlyCreatedId(created.id);
      showToast('success', 'Pre-call plan created.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.preCallPlans.delete(id);
      const newPlans = plans.filter(p => p.id !== id);
      setPlans(newPlans);
      planRefs.current.delete(id);
      const map = new Map<string, string>();
      for (const p of newPlans) { if (p.linked_call_id) map.set(p.linked_call_id, p.id); }
      onCallToPlanMapUpdate(map);
      showToast('success', 'Pre-call plan deleted.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Delete failed');
    }
  }

  function handleUpdate(updated: PreCallPlan) {
    const newPlans = plans.map(p => p.id === updated.id ? updated : p);
    setPlans(newPlans);
    const map = new Map<string, string>();
    for (const p of newPlans) { if (p.linked_call_id) map.set(p.linked_call_id, p.id); }
    onCallToPlanMapUpdate(map);
  }

  const upcoming = plans.filter(p => p.status !== 'completed' || !p.linked_call_id);
  const completed = plans.filter(p => p.status === 'completed' && !!p.linked_call_id);

  const sortedUpcoming = [...upcoming].sort((a, b) => {
    if (a.planned_date && b.planned_date) return a.planned_date.localeCompare(b.planned_date);
    if (a.planned_date && !b.planned_date) return -1;
    if (!a.planned_date && b.planned_date) return 1;
    return (b.created_at ?? 0) - (a.created_at ?? 0);
  });

  const sortedCompleted = [...completed].sort((a, b) => {
    if (a.planned_date && b.planned_date) return b.planned_date.localeCompare(a.planned_date);
    return (b.created_at ?? 0) - (a.created_at ?? 0);
  });

  if (loading) {
    return (
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.75rem', color: '#6b8599', padding: '0.5rem 0' }}>Loading pre-call plans...</div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#dde6ee' }}>
          Pre-Call Plans ({plans.length})
        </h3>
        {!showNewForm && (
          <button
            onClick={() => setShowNewForm(true)}
            style={{
              background: 'none', border: '1px solid #00e5a0', borderRadius: '0.25rem',
              color: '#00e5a0', fontSize: '0.75rem', padding: '0.25rem 0.625rem',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            + New Plan
          </button>
        )}
      </div>

      {showNewForm && (
        <NewPlanForm
          stakeholders={stakeholders}
          onSave={handleNewPlanSave}
          onCancel={() => setShowNewForm(false)}
          saving={saving}
        />
      )}

      {sortedUpcoming.length > 0 && (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ ...labelStyle, marginBottom: '0.5rem' }}>Upcoming / Unmatched</div>
          {sortedUpcoming.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              stakeholders={stakeholders}
              calls={calls}
              defaultExpanded={plan.id === newlyCreatedId}
              planCardRef={getPlanRef(plan.id)}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onScrollToCall={onScrollToCall}
            />
          ))}
        </div>
      )}

      {sortedCompleted.length > 0 && (
        <div>
          <button
            onClick={() => setShowCompleted(v => !v)}
            style={{
              background: 'none', border: 'none', color: '#6b8599',
              fontSize: '0.6875rem', cursor: 'pointer', fontFamily: 'inherit',
              padding: '0.25rem 0', marginBottom: '0.375rem',
            }}
          >
            {showCompleted ? `Hide completed (${sortedCompleted.length})` : `Show completed (${sortedCompleted.length})`}
          </button>
          {showCompleted && sortedCompleted.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              stakeholders={stakeholders}
              calls={calls}
              planCardRef={getPlanRef(plan.id)}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onScrollToCall={onScrollToCall}
            />
          ))}
        </div>
      )}

      {plans.length === 0 && !showNewForm && (
        <div style={{
          background: '#0f1929', border: '1px solid #1e3048', borderRadius: '0.5rem',
          padding: '1.5rem', color: '#6b8599', fontSize: '0.8125rem', lineHeight: 1.6,
        }}>
          No pre-call plans yet. Click "+ New Plan" to create one before your next meeting.
        </div>
      )}

      <div style={{ borderBottom: '1px solid #1e3048', marginBottom: '1.5rem', marginTop: '0.5rem' }} />
    </div>
  );
}
