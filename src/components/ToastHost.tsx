import React, { useEffect, useState } from 'react';

type Toast = { id: number; message: string; variant: 'success' | 'error' | 'info' };

export default function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    let idSeq = 1;
    function onToast(e: Event) {
      const detail = (e as CustomEvent).detail as { message: string; variant?: 'success' | 'error' | 'info' };
      const toast: Toast = { id: idSeq++, message: detail.message, variant: detail.variant || 'info' };
      setToasts(prev => [...prev, toast]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== toast.id)), 3500);
    }
    window.addEventListener('sc-toast', onToast as any);
    return () => window.removeEventListener('sc-toast', onToast as any);
  }, []);

  const colorMap: Record<Toast['variant'], string> = {
    success: '#16a34a',
    error: '#dc2626',
    info: '#333333'
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9999] space-y-2">
      {toasts.map(t => (
        <div key={t.id} className="sc-card px-4 py-3 text-sm" style={{ borderLeft: `4px solid ${colorMap[t.variant]}` }}>
          {t.message}
        </div>
      ))}
    </div>
  );
}


