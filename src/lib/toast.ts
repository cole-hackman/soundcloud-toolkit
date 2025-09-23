export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastPayload {
  message: string;
  variant?: ToastVariant;
}

export function emitToast(payload: ToastPayload) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('sc-toast', { detail: payload }));
}


