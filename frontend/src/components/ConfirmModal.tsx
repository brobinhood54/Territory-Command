import { useRef, useEffect, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';

export interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface ConfirmRequest {
  options: ConfirmOptions;
  resolve: (result: boolean) => void;
}

// Module-level singleton so useConfirm() calls share the same modal slot
let currentRequest: ConfirmRequest | null = null;
const confirmListeners: Set<() => void> = new Set();

function notifyConfirm() {
  confirmListeners.forEach(fn => fn());
}

function subscribeConfirm(fn: () => void): () => void {
  confirmListeners.add(fn);
  return () => confirmListeners.delete(fn);
}

function getConfirmSnapshot(): ConfirmRequest | null {
  return currentRequest;
}

export function showConfirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise(resolve => {
    currentRequest = { options, resolve };
    notifyConfirm();
  });
}

function resolveConfirm(result: boolean) {
  if (currentRequest) {
    const res = currentRequest.resolve;
    currentRequest = null;
    notifyConfirm();
    res(result);
  }
}

export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  return showConfirm;
}

// ---- ConfirmModal (module scope, never defined inside a render) ----

interface ConfirmModalProps extends ConfirmOptions {
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCancel();
        return;
      }
      if (e.key === 'Tab') {
        const modal = modalRef.current;
        if (!modal) return;
        const focusable = Array.from(
          modal.querySelectorAll<HTMLElement>('button:not([disabled])')
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9000,
      }}
    >
      <div
        ref={modalRef}
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0f1929',
          border: '1px solid #1e3048',
          borderRadius: '0.5rem',
          padding: '1.5rem',
          minWidth: '320px',
          maxWidth: '480px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{
          fontSize: '1rem',
          fontWeight: 600,
          color: '#dde6ee',
          marginBottom: body ? '0.625rem' : '1.25rem',
        }}>
          {title}
        </div>

        {body && (
          <div style={{
            fontSize: '0.875rem',
            color: '#9db8cc',
            marginBottom: '1.25rem',
            lineHeight: 1.55,
          }}>
            {body}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.625rem' }}>
          <button
            onClick={onCancel}
            style={{
              background: 'none',
              border: '1px solid #1e3048',
              borderRadius: '0.375rem',
              color: '#9db8cc',
              fontSize: '0.875rem',
              padding: '0.4rem 0.875rem',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {cancelLabel}
          </button>
          <button
            autoFocus
            onClick={onConfirm}
            style={{
              background: destructive ? '#e06050' : '#00e5a0',
              color: '#080e1a',
              border: 'none',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              padding: '0.4rem 0.875rem',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// Rendered once at App root; subscribes to the singleton and shows the modal when needed
export function ConfirmModalRoot() {
  const request = useSyncExternalStore(subscribeConfirm, getConfirmSnapshot);
  if (!request) return null;
  return (
    <ConfirmModal
      {...request.options}
      onConfirm={() => resolveConfirm(true)}
      onCancel={() => resolveConfirm(false)}
    />
  );
}
