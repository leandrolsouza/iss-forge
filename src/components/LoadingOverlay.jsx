import React from 'react';
import { useI18n } from '../i18n';
import '../styles/LoadingOverlay.css';

export default function LoadingOverlay() {
  const { t } = useI18n();

  return (
    <div className="loading-overlay" role="status" aria-live="polite">
      <div className="loading-overlay-content">
        <div className="loading-spinner" aria-hidden="true">
          <svg viewBox="0 0 50 50" className="loading-spinner-svg">
            <circle
              className="loading-spinner-track"
              cx="25"
              cy="25"
              r="20"
              fill="none"
              strokeWidth="4"
            />
            <circle
              className="loading-spinner-head"
              cx="25"
              cy="25"
              r="20"
              fill="none"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <p className="loading-overlay-title">{t('loadingTitle')}</p>
        <p className="loading-overlay-message">{t('loadingMessage')}</p>
      </div>
    </div>
  );
}
