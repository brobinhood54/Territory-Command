export type ToastType = 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

// Phase 1.4 implements the full toast stack with auto-dismiss and context provider.
// This stub satisfies all imports and renders nothing until then.
export function useToast() {
  return {
    toasts: [] as Toast[],
    show: (_type: ToastType, _message: string) => {},
    dismiss: (_id: string) => {},
  };
}
