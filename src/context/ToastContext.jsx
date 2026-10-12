/**
 * ToastContext — short, non-blocking notifications (bottom-right).
 *
 *   const toast = useToast();
 *   toast.success(t('toastSaved', { file }));
 *   toast.error(message, { detail, duration: 0 });            // 0 = stays until closed
 *   toast.info(msg, { action: { label: t('undo'), onClick } });
 *
 * Errors stay longer than successes; hovering a toast pauses its timer.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useI18n } from '../i18n';
import '../styles/toast.css';

const ToastContext = createContext(null);

const DEFAULT_DURATION = { success: 3500, info: 4000, warning: 6000, error: 8000 };
const MAX_TOASTS = 4;

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((x) => x.id !== id)), []);

  const show = useCallback((message, options = {}) => {
    if (!message) return null;
    const type = options.type || 'info';
    const toast = {
      id: nextId++,
      type,
      message,
      detail: options.detail,
      action: options.action,
      duration: options.duration ?? DEFAULT_DURATION[type],
    };
    setToasts((list) => [...list, toast].slice(-MAX_TOASTS));
    return toast.id;
  }, []);

  const api = useMemo(
    () => ({
      show,
      dismiss,
      success: (m, o) => show(m, { ...o, type: 'success' }),
      info: (m, o) => show(m, { ...o, type: 'info' }),
      warning: (m, o) => show(m, { ...o, type: 'warning' }),
      error: (m, o) => show(m, { ...o, type: 'error' }),
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" role="region" aria-live="polite" aria-label="Notifications">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const ICONS = { success: '✓', info: 'i', warning: '!', error: '✕' };

function Toast({ toast, onDismiss }) {
  const { t } = useI18n();
  const timer = useRef(null);

  const start = useCallback(() => {
    if (!toast.duration) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(onDismiss, toast.duration);
  }, [toast.duration, onDismiss]);

  useEffect(() => {
    start();
    return () => clearTimeout(timer.current);
  }, [start]);

  return (
    <div
      className={`toast toast--${toast.type}`}
      role={toast.type === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => clearTimeout(timer.current)}
      onMouseLeave={start}
    >
      <span className="toast-icon" aria-hidden="true">
        {ICONS[toast.type]}
      </span>
      <div className="toast-body">
        <div className="toast-message">{toast.message}</div>
        {toast.detail && <div className="toast-detail">{toast.detail}</div>}
      </div>
      {toast.action && (
        <button
          className="toast-action"
          onClick={() => {
            toast.action.onClick();
            onDismiss();
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button className="toast-close" onClick={onDismiss} aria-label={t('toastClose')}>
        &times;
      </button>
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
