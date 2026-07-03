import { useEffect, useRef } from 'react';
import { useI18n } from '../i18n';
import '../styles/UnsavedModal.css';

export default function UnsavedModal({ visible, onSave, onDiscard, onCancel }) {
  const { t } = useI18n();
  const saveRef = useRef(null);

  useEffect(() => {
    if (visible && saveRef.current) {
      saveRef.current.focus();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, onCancel]);

  if (!visible) return null;

  return (
    <div className="unsaved-overlay" role="dialog" aria-modal="true" aria-labelledby="unsaved-title">
      <div className="unsaved-modal">
        <div className="unsaved-icon">
          <svg width="32" height="32" viewBox="0 0 16 16" fill="currentColor">
            <path d="M7.56 1h.88l6.54 12.26-.44.74H1.44l-.42-.74L7.56 1zm.44 1.7L2.68 13h10.64L8 2.7zM8 11a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5zm-.5-5h1v4h-1V6z" />
          </svg>
        </div>
        <div className="unsaved-content">
          <h3 id="unsaved-title" className="unsaved-title">{t('unsavedTitle')}</h3>
          <p className="unsaved-message">{t('unsavedMessage')}</p>
        </div>
        <div className="unsaved-actions">
          <button
            ref={saveRef}
            className="unsaved-btn unsaved-btn-primary"
            onClick={onSave}
          >
            {t('unsavedSave')}
          </button>
          <button className="unsaved-btn unsaved-btn-secondary" onClick={onDiscard}>
            {t('unsavedDontSave')}
          </button>
          <button className="unsaved-btn unsaved-btn-ghost" onClick={onCancel}>
            {t('unsavedCancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
