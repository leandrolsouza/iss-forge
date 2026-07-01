import React from 'react';
import { useI18n } from '../i18n';
import { IconOpen } from './Icons';

export default function WelcomePanel({ onOpenRom, onDrop, onDragOver }) {
  const { t } = useI18n();

  return (
    <div className="welcome-panel" onDrop={onDrop} onDragOver={onDragOver}>
      <div className="welcome-content">
        <h1 className="welcome-title">{t('welcomeTitle')}</h1>
        <p className="welcome-subtitle">{t('welcomeSubtitle')}</p>

        <div className="welcome-actions">
          <button className="welcome-btn" onClick={onOpenRom}>
            <IconOpen size={20} />
            {t('welcomeOpenBtn')}
          </button>
        </div>

        <div className="welcome-drop-zone">
          <p>{t('welcomeDrop')}</p>
        </div>

        <div className="welcome-info">
          <h3>{t('welcomeFeatures')}</h3>
          <ul>
            <li>{t('welcomePlayerNames')}</li>
            <li>{t('welcomeShirtNumbers')}</li>
            <li>{t('welcomeAttributes')}</li>
            <li>{t('welcomeHairStyle')}</li>
            <li>{t('welcomeUniformColors')}</li>
          </ul>

          <h3>{t('welcomeCompatible')}</h3>
          <p>{t('welcomeCompatibleDesc')}</p>
        </div>

        <div className="welcome-credits">
          <p>
            Based on the work of Rodrigo M. Guerra (ISS Studio),
            Esteban Fuentealba (Web ISS Studio), Equipe Puma & Equipe Falcon Brasil.
          </p>
        </div>
      </div>
    </div>
  );
}
