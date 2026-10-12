/**
 * ConfirmContext — promise-based confirmation dialog + unapplied-draft guard.
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ message: t('...'), confirmLabel: t('...'), danger: true }))) return;
 *
 *   <DraftGuard dirty={dirty} />            // inside an editor with Apply/Discard
 *   const guardDrafts = useGuardDrafts();   // before navigating away (tab/team switch)
 *   if (!(await guardDrafts())) return;
 *
 * One dialog at a time; Escape / click outside cancel, Tab stays inside the dialog.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useI18n } from '../i18n';
import '../styles/UnsavedModal.css';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const { t } = useI18n();
  const [request, setRequest] = useState(null);
  const resolverRef = useRef(null);
  const dirtyDraftsRef = useRef(new Set());

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        // A new request replaces a pending one (which counts as cancelled)
        resolverRef.current?.(false);
        resolverRef.current = resolve;
        setRequest(typeof options === 'string' ? { message: options } : options);
      }),
    [],
  );

  const close = useCallback((result) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setRequest(null);
  }, []);

  const setDraftDirty = useCallback((id, dirty) => {
    if (dirty) dirtyDraftsRef.current.add(id);
    else dirtyDraftsRef.current.delete(id);
  }, []);

  /** Resolves true when there is nothing unapplied, or the user agrees to discard it */
  const guardDrafts = useCallback(async () => {
    if (dirtyDraftsRef.current.size === 0) return true;
    return confirm({
      message: t('confirmDiscardDraft'),
      confirmLabel: t('scenarioDiscard'),
      danger: true,
    });
  }, [confirm, t]);

  const value = useMemo(
    () => ({ confirm, setDraftDirty, guardDrafts }),
    [confirm, setDraftDirty, guardDrafts],
  );

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {request && <ConfirmDialog {...request} onClose={close} />}
    </ConfirmContext.Provider>
  );
}

function ConfirmDialog({ title, message, confirmLabel, cancelLabel, danger = false, onClose }) {
  const { t } = useI18n();
  const confirmRef = useRef(null);
  const cancelRef = useRef(null);

  // Destructive actions start on "Cancel" so a stray Enter doesn't destroy anything
  useEffect(() => {
    (danger ? cancelRef : confirmRef).current?.focus();
  }, [danger]);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose(false);
    } else if (e.key === 'Tab') {
      // Minimal focus trap between the two buttons
      e.preventDefault();
      const next = document.activeElement === confirmRef.current ? cancelRef : confirmRef;
      next.current?.focus();
    }
  };

  return (
    <div
      className="unsaved-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
      onKeyDown={onKeyDown}
      onMouseDown={(e) => e.target === e.currentTarget && onClose(false)}
    >
      <div className="unsaved-modal">
        <div className="unsaved-content">
          <h3 id="confirm-title" className="unsaved-title">
            {title || t('confirmTitle')}
          </h3>
          <p id="confirm-message" className="unsaved-message">
            {message}
          </p>
        </div>
        <div className="unsaved-actions">
          <button
            ref={confirmRef}
            className={`unsaved-btn ${danger ? 'unsaved-btn-danger' : 'unsaved-btn-primary'}`}
            onClick={() => onClose(true)}
          >
            {confirmLabel || t('confirmOk')}
          </button>
          <button
            ref={cancelRef}
            className="unsaved-btn unsaved-btn-secondary"
            onClick={() => onClose(false)}
          >
            {cancelLabel || t('unsavedCancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

function useConfirmContext() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('Confirm hooks must be used within a ConfirmProvider');
  return ctx;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm() {
  return useConfirmContext().confirm;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGuardDrafts() {
  return useConfirmContext().guardDrafts;
}

/**
 * Render inside an editor that has an Apply/Discard draft. While `dirty`, navigating
 * away through useGuardDrafts() asks before the draft is thrown away.
 * A component (not a hook) so it can sit after the editors' early returns.
 */
export function DraftGuard({ dirty }) {
  const { setDraftDirty } = useConfirmContext();
  const id = useId();
  useEffect(() => {
    setDraftDirty(id, !!dirty);
    return () => setDraftDirty(id, false);
  }, [id, dirty, setDraftDirty]);
  return null;
}
