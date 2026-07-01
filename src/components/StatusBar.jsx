import React from 'react';
import { useI18n } from '../i18n';

export default function StatusBar({ message, modified, teamCount, selectedTeam }) {
  const { t } = useI18n();

  return (
    <div className="status-bar">
      <div className="status-bar-left">
        {modified && <span className="status-modified">&#9679; {t('modified')}</span>}
        <span className="status-message">{message}</span>
      </div>
      <div className="status-bar-right">
        {selectedTeam && <span className="status-item">{t('team')}: {selectedTeam}</span>}
        {teamCount > 0 && <span className="status-item">{t('teams')}: {teamCount}</span>}
        <span className="status-item">ISS Forge v1.0</span>
      </div>
    </div>
  );
}
