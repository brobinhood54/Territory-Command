import { useState } from 'react';
import type { Question, Stakeholder } from '@tc/shared';
import { api } from '../lib/api';
import { showToast } from '../lib/toast';
import { showConfirm } from './ConfirmModal';

// ---- helpers ----

function formatAge(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function statusColor(status: string): string {
  if (status === 'open') return '#f0a500';
  if (status === 'answered') return '#00e5a0';
  if (status === 'deferred') return '#6b8599';
  return '#6b8599';
}

// ---- sub-components (all at module scope) ----

interface ResolutionPanelProps {
  questionId: string;
  initialText: string;
  targetStatus: 'answered' | 'deferred';
  onSaved: (updated: Question) => void;
  onCancel: () => void;
}

function ResolutionPanel({ questionId, initialText, targetStatus, onSaved, onCancel }: ResolutionPanelProps) {
  const [text, setText] = useState(initialText);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await api.questions.update(questionId, {
        status: targetStatus,
        resolution_text: text.trim() || null,
      });
      showToast('success', targetStatus === 'answered' ? 'Marked answered.' : 'Deferred.', { quiet: true });
      onSaved(updated);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to save');
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
      <div style={{ fontSize: '0.75rem', color: '#9db8cc', marginBottom: '0.375rem' }}>
        {targetStatus === 'answered' ? 'How was this answered?' : 'Deferral note (optional)'}
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={targetStatus === 'answered' ? 'Add a resolution note...' : 'Why deferred?'}
        style={{
          width: '100%',
          minHeight: '60px',
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
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.375rem', justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel}
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
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background: targetStatus === 'answered' ? '#00e5a0' : '#1e3048',
            color: targetStatus === 'answered' ? '#080e1a' : '#9db8cc',
            border: 'none',
            borderRadius: '0.25rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            padding: '0.25rem 0.625rem',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}

interface EditPanelProps {
  question: Question;
  stakeholders: Stakeholder[];
  onSaved: (updated: Question) => void;
  onCancel: () => void;
}

function EditPanel({ question, stakeholders, onSaved, onCancel }: EditPanelProps) {
  const [text, setText] = useState(question.question_text);
  const [stakeholderId, setStakeholderId] = useState<string>(question.asker_stakeholder_id ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      let updated = await api.questions.update(question.id, {
        question_text: text.trim() || question.question_text,
      });
      const newStakeholderId = stakeholderId === '' ? null : stakeholderId;
      if (newStakeholderId !== question.asker_stakeholder_id) {
        updated = await api.questions.linkStakeholder(question.id, newStakeholderId);
      }
      showToast('success', 'Question updated.', { quiet: true });
      onSaved(updated);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to save');
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
        <div style={{ fontSize: '0.75rem', color: '#9db8cc', marginBottom: '0.25rem' }}>Question text</div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
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
      <div style={{ marginBottom: '0.5rem' }}>
        <div style={{ fontSize: '0.75rem', color: '#9db8cc', marginBottom: '0.25rem' }}>Link to stakeholder</div>
        <select
          value={stakeholderId}
          onChange={e => setStakeholderId(e.target.value)}
          style={{
            background: '#162032',
            border: '1px solid #1e3048',
            borderRadius: '0.25rem',
            color: '#dde6ee',
            fontSize: '0.8125rem',
            padding: '0.3rem 0.5rem',
            outline: 'none',
            width: '100%',
            fontFamily: 'inherit',
          }}
        >
          <option value="">Unlinked</option>
          {stakeholders.map(s => (
            <option key={s.id} value={s.id}>{s.name}{s.title ? ` (${s.title})` : ''}</option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel}
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
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background: '#00e5a0',
            color: '#080e1a',
            border: 'none',
            borderRadius: '0.25rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            padding: '0.25rem 0.625rem',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}

interface QuestionCardProps {
  question: Question;
  stakeholders: Stakeholder[];
  callTitle: string | null;
  callDate: string | null;
  onUpdate: (updated: Question) => void;
  onDelete: (id: string) => void;
  onOpenSourceCall: (callId: string) => void;
}

type ActivePanel = { type: 'resolve'; targetStatus: 'answered' | 'deferred' } | { type: 'edit' } | null;

function QuestionCard({
  question, stakeholders, callTitle, callDate, onUpdate, onDelete, onOpenSourceCall,
}: QuestionCardProps) {
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [deleting, setDeleting] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const linkedStakeholder = stakeholders.find(s => s.id === question.asker_stakeholder_id);

  async function handleDelete() {
    const ok = await showConfirm({
      title: 'Delete this question?',
      body: 'This cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await api.questions.delete(question.id);
      showToast('success', 'Question deleted.', { quiet: true });
      onDelete(question.id);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Delete failed');
      setDeleting(false);
    }
  }

  async function handleReopen() {
    setTransitioning(true);
    try {
      const updated = await api.questions.update(question.id, { status: 'open' });
      showToast('success', 'Reopened.', { quiet: true });
      onUpdate(updated);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to reopen');
    } finally {
      setTransitioning(false);
    }
  }

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
          color: statusColor(question.status),
          border: `1px solid ${statusColor(question.status)}`,
          borderRadius: '999px',
          padding: '0.1rem 0.45rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          {question.status}
        </span>
        <span style={{ fontSize: '0.8rem', color: linkedStakeholder ? '#00c2d4' : '#f0a500', fontWeight: 500 }}>
          {linkedStakeholder
            ? linkedStakeholder.name
            : question.asker_name}
          {!linkedStakeholder && (
            <span style={{ fontSize: '0.65rem', color: '#6b8599', marginLeft: '0.25rem' }}>(unlinked)</span>
          )}
        </span>
        {question.asked_at && (
          <span style={{ fontSize: '0.7rem', color: '#6b8599', marginLeft: 'auto' }}>
            {formatAge(question.asked_at)}
          </span>
        )}
      </div>

      {/* Question text */}
      <div style={{ fontSize: '0.875rem', color: '#dde6ee', lineHeight: 1.5, marginBottom: '0.4rem' }}>
        {question.question_text}
      </div>

      {/* Resolution (for answered/deferred) */}
      {question.resolution_text && (
        <div style={{
          fontSize: '0.8rem',
          color: '#9db8cc',
          background: '#0a1220',
          borderRadius: '0.25rem',
          padding: '0.375rem 0.5rem',
          marginBottom: '0.4rem',
          lineHeight: 1.45,
        }}>
          {question.resolution_text}
        </div>
      )}

      {/* Source call link */}
      {callTitle && (
        <div style={{ fontSize: '0.75rem', color: '#6b8599', marginBottom: '0.5rem' }}>
          From:{' '}
          <button
            onClick={() => onOpenSourceCall(question.call_id)}
            style={{
              background: 'none',
              border: 'none',
              color: '#00c2d4',
              fontSize: '0.75rem',
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline',
              fontFamily: 'inherit',
            }}
          >
            {callTitle}
          </button>
          {callDate && <span> ({callDate})</span>}
        </div>
      )}

      {/* Action buttons */}
      {activePanel === null && (
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
          {question.status === 'open' && (
            <>
              <ActionBtn
                label="Mark Answered"
                color="#00e5a0"
                onClick={() => setActivePanel({ type: 'resolve', targetStatus: 'answered' })}
              />
              <ActionBtn
                label="Defer"
                color="#9db8cc"
                onClick={() => setActivePanel({ type: 'resolve', targetStatus: 'deferred' })}
              />
            </>
          )}
          {question.status === 'answered' && (
            <ActionBtn
              label="Reopen"
              color="#f0a500"
              onClick={handleReopen}
              disabled={transitioning}
            />
          )}
          {question.status === 'deferred' && (
            <>
              <ActionBtn
                label="Mark Answered"
                color="#00e5a0"
                onClick={() => setActivePanel({ type: 'resolve', targetStatus: 'answered' })}
              />
              <ActionBtn
                label="Reopen"
                color="#f0a500"
                onClick={handleReopen}
                disabled={transitioning}
              />
            </>
          )}
          <ActionBtn
            label="Edit"
            color="#6b8599"
            onClick={() => setActivePanel({ type: 'edit' })}
          />
          <ActionBtn
            label={deleting ? 'Deleting...' : 'Delete'}
            color="#e06050"
            onClick={handleDelete}
            disabled={deleting}
          />
        </div>
      )}

      {/* Inline panels */}
      {activePanel?.type === 'resolve' && (
        <ResolutionPanel
          questionId={question.id}
          initialText={question.resolution_text ?? ''}
          targetStatus={activePanel.targetStatus}
          onSaved={updated => { onUpdate(updated); setActivePanel(null); }}
          onCancel={() => setActivePanel(null)}
        />
      )}
      {activePanel?.type === 'edit' && (
        <EditPanel
          question={question}
          stakeholders={stakeholders}
          onSaved={updated => { onUpdate(updated); setActivePanel(null); }}
          onCancel={() => setActivePanel(null)}
        />
      )}
    </div>
  );
}

interface ActionBtnProps {
  label: string;
  color: string;
  onClick: () => void;
  disabled?: boolean;
}

function ActionBtn({ label, color, onClick, disabled }: ActionBtnProps) {
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

// ---- main component ----

interface AccountQuestionsProps {
  questions: Question[];
  stakeholders: Stakeholder[];
  callsMap: Record<string, { title: string | null; date: string | null }>;
  loading: boolean;
  onQuestionUpdate: (updated: Question) => void;
  onQuestionDelete: (id: string) => void;
  onOpenSourceCall: (callId: string) => void;
}

type StatusFilter = 'open' | 'answered' | 'deferred';

export default function AccountQuestions({
  questions,
  stakeholders,
  callsMap,
  loading,
  onQuestionUpdate,
  onQuestionDelete,
  onOpenSourceCall,
}: AccountQuestionsProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');

  const counts = {
    open: questions.filter(q => q.status === 'open').length,
    answered: questions.filter(q => q.status === 'answered').length,
    deferred: questions.filter(q => q.status === 'deferred').length,
  };

  const visible = questions.filter(q => q.status === statusFilter);

  if (loading) {
    return (
      <div style={{ padding: '1.5rem', color: '#6b8599', fontSize: '0.875rem' }}>
        Loading questions...
      </div>
    );
  }

  return (
    <div style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem', gap: '0.75rem', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#dde6ee' }}>
          Questions ({questions.length})
        </h2>
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          {(['open', 'answered', 'deferred'] as StatusFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                background: statusFilter === s ? statusColor(s) : '#162032',
                color: statusFilter === s ? '#080e1a' : '#9db8cc',
                border: `1px solid ${statusFilter === s ? statusColor(s) : '#1e3048'}`,
                borderRadius: '999px',
                fontSize: '0.7rem',
                fontWeight: statusFilter === s ? 700 : 400,
                padding: '0.2rem 0.6rem',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)} ({counts[s]})
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div style={{ color: '#6b8599', fontSize: '0.875rem', lineHeight: 1.6 }}>
          {questions.length === 0
            ? 'No questions yet. Drop a transcript with customer questions to start tracking.'
            : `No ${statusFilter} questions.`}
        </div>
      ) : (
        visible.map(q => (
          <QuestionCard
            key={q.id}
            question={q}
            stakeholders={stakeholders}
            callTitle={callsMap[q.call_id]?.title ?? null}
            callDate={callsMap[q.call_id]?.date ?? null}
            onUpdate={onQuestionUpdate}
            onDelete={onQuestionDelete}
            onOpenSourceCall={onOpenSourceCall}
          />
        ))
      )}
    </div>
  );
}
