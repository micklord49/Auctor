import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ToastMessage {
  id: number;
  text: string;
}

let nextId = 0;

export function showErrorToast(message: string) {
  window.dispatchEvent(new CustomEvent('auctor-error-toast', { detail: message }));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const msg = (e as CustomEvent).detail as string;
      const id = nextId++;
      setToasts(prev => [...prev, { id, text: msg }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 8000);
    };
    window.addEventListener('auctor-error-toast', handler);
    return () => window.removeEventListener('auctor-error-toast', handler);
  }, []);

  if (toasts.length === 0) return null;

  return createPortal(
    <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 99999, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 420 }}>
      {toasts.map(toast => (
        <div
          key={toast.id}
          style={{
            background: '#7f1d1d',
            border: '1px solid #dc2626',
            color: '#fecaca',
            padding: '12px 16px',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            fontSize: 14,
          }}
        >
          <span style={{ color: '#f87171', flexShrink: 0 }}>&#9888;</span>
          <span style={{ wordBreak: 'break-word', flex: 1 }}>{toast.text}</span>
          <button
            style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, fontSize: 16 }}
            onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
          >
            &#10005;
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
}
