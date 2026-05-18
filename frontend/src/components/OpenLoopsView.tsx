import { useState, useEffect, useCallback } from 'react';
import type { QuestionWithContext } from '@tc/shared';
import { api } from '../lib/api';
import { showToast } from '../lib/toast';

// ---- helpers ----

function formatAge(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return 'asked today';
  if (days === 1) return 'asked 1 day ago';
  return `asked ${days} days ago`;
}

// ---- sub-components ----

interface OpenLoopRowProps {
  question: QuestionWithContext;
  onUpdate: (updated: QuestionWithContext) => void;
  onOpenSourceCall: (question: QuestionWithContext) => void;
}

type ActiveAction = 'resolve' | 'defer' | null;

function OpenLoopRow({ question, onUpdate, onOpenSourceCall }: OpenLoopRowProps) {
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [resolutionText, setResolutionText] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave(status: 'answered' | 'deferred') {
    setSaving(true);
    try {
      const updated = await api.questions.update(question.id, {
        status,
        resolution_text: resolutionText.trim() || null,
      });
      showToast('success', status === 'answered' ? 'Marked answered.' : 'Deferred.', { quiet: true });
      onUpdate({ ...question, ...updated });
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      border: '1px solid #1e3048',
      borderRadius: '0.375rem',
      padding: '0.875rem 1rem',
      background: '#0d1929',
      marginBottom: '0.625rem',
    }}>
      {/* Question text */}
      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#dde6ee', lineHeight: 1.45, marginBottom: '0.375rem' }}>
        {question.question_text}
      </div>

      {/* Context line */}
      <div style={{ fontSize: '0.75rem', color: '#6b8599', marginBottom: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.25rem', alignItems: 'center' }}>
        <span style={{ color: '#00c2d4', fontWeight: 500 }}>{question.asker_name}</span>
        <span>at</span>
        <span style={{ color: '#9db8cc' }}>{question.account_name}</span>
        {question.call_title && (
          <>
            <span>from</span>
            <button
              onClick={() => onOpenSourceCall(question)}
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
              {question.call_title}
            </button>
          </>
        )}
        {question.asked_at && (
          <span style={{ marginLeft: 'auto', color: '#f0a500' }}>{formatAge(question.asked_at)}</span>
        )}
      </div>

      {/* Action buttons */}
      {activeAction === null && (
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
          <RowBtn label="Mark Answered" color="#00e5a0" onClick={() => { setResolutionText(''); setActiveAction('resolve'); }} />
          <RowBtn label="Defer" color="#6b8599" onClick={() => { setResolutionText(''); setActiveAction('defer'); }} />
          <RowBtn label="Open Source Call" color="#00c2d4" onClick={() => onOpenSourceCall(question)} />
        </div>
      )}

      {/* Inline resolution panel */}
      {activeAction !== null && (
        <div style={{ marginTop: '0.5rem' }}>
          <textarea
            value={resolutionText}
            onChange={e => setResolutionText(e.target.value)}
            placeholder={activeAction === 'resolve' ? 'How was this answered? (optional)' : 'Deferral note (optional)'}
            style={{
              width: '100%',
              minHeight: '52px',
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
              marginBottom: '0.375rem',
            }}
            autoFocus
          />
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <RowBtn label="Cancel" color="#6b8599" onClick={() => setActiveAction(null)} />
            <RowBtn
              label={saving ? 'Saving...' : (activeAction === 'resolve' ? 'Save' : 'Defer')}
              color={activeAction === 'resolve' ? '#00e5a0' : '#9db8cc'}
              onClick={() => handleSave(activeAction === 'resolve' ? 'answered' : 'deferred')}
              disabled={saving}
              filled={activeAction === 'resolve'}
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface RowBtnProps {
  label: string;
  color: string;
  onClick: () => void;
  disabled?: boolean;
  filled?: boolean;
}

function RowBtn({ label, color, onClick, disabled, filled }: RowBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: filled ? color : 'none',
        border: `1px solid ${disabled ? '#1e3048' : color}`,
        borderRadius: '0.25rem',
        color: filled ? '#080e1a' : (disabled ? '#3a5068' : color),
        fontSize: '0.7rem',
        fontWeight: filled ? 700 : 500,
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

interface OpenLoopsViewProps {
  onNavigateToCall: (accountId: string, callId: string) => void;
  refreshTrigger?: number;
  onCountChange?: (count: number) => void;
}

export default function OpenLoopsView({ onNavigateToCall, refreshTrigger, onCountChange }: OpenLoopsViewProps) {
  const [openQuestions, setOpenQuestions] = useState<QuestionWithContext[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOpenQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api.questions.listOpen();
      setOpenQuestions(rows);
      onCountChange?.(rows.length);
    } catch (err) {
      console.error('Failed to load open questions:', err);
      showToast('error', 'Failed to load open questions');
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => {
    void loadOpenQuestions();
  }, [loadOpenQuestions, refreshTrigger]);

  function handleUpdate(updated: QuestionWithContext) {
    // Remove the question from the open list when it moves away from open status
    if (updated.status !== 'open') {
      const newList = openQuestions.filter(q => q.id !== updated.id);
      setOpenQuestions(newList);
      onCountChange?.(newList.length);
    } else {
      setOpenQuestions(prev => prev.map(q => q.id === updated.id ? updated : q));
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', color: '#6b8599', fontSize: '0.875rem' }}>
        Loading open questions...
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '760px' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.125rem', fontWeight: 600, color: '#dde6ee' }}>
          Open Loops ({openQuestions.length})
        </h2>
        <div style={{ fontSize: '0.8125rem', color: '#6b8599' }}>
          Questions you owe an answer to, across all accounts.
        </div>
      </div>

      {openQuestions.length === 0 ? (
        <div style={{ color: '#6b8599', fontSize: '0.875rem', lineHeight: 1.6 }}>
          No open loops. You're caught up.
        </div>
      ) : (
        openQuestions.map(q => (
          <OpenLoopRow
            key={q.id}
            question={q}
            onUpdate={handleUpdate}
            onOpenSourceCall={(question) => onNavigateToCall(question.account_id, question.call_id)}
          />
        ))
      )}
    </div>
  );
}
