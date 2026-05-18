import { useSyncExternalStore } from 'react';

export type ToastType = 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  quiet?: boolean;
}

const DISMISS_DELAY: Record<ToastType, number> = {
  success: 4000,
  warning: 12000,
  error: 8000,
};
const QUIET_DISMISS_DELAY = 1500;

// Module-level singleton so all useToast() calls share the same state
let toasts: Toast[] = [];
const listeners: Set<() => void> = new Set();
const timers: Map<string, ReturnType<typeof setTimeout>> = new Map();

function notify() {
  listeners.forEach(fn => fn());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getSnapshot(): Toast[] {
  return toasts;
}

export function showToast(type: ToastType, message: string, opts?: { quiet?: boolean }): void {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const quiet = opts?.quiet ?? false;
  toasts = [...toasts, { id, type, message, quiet }];
  notify();

  const delay = quiet ? QUIET_DISMISS_DELAY : DISMISS_DELAY[type];
  const timer = setTimeout(() => dismissToast(id), delay);
  timers.set(id, timer);
}

export function dismissToast(id: string): void {
  const timer = timers.get(id);
  if (timer !== undefined) {
    clearTimeout(timer);
    timers.delete(id);
  }
  toasts = toasts.filter(t => t.id !== id);
  notify();
}

export function useToast() {
  const currentToasts = useSyncExternalStore(subscribe, getSnapshot);
  return {
    toasts: currentToasts,
    show: showToast,
    dismiss: dismissToast,
  };
}
