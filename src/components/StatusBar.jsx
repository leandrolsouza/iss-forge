import React from 'react';
import { useI18n } from '../i18n';

/**
 * `message`: an i18n key (or plain text such as a file path), or `{ key, params }` so
 * the text follows a language change (a param may itself be `{ key, params }`).
 */
export default function StatusBar({ message, modified, teamCount, selectedTeam }) {
  const { t } = useI18n();
  const tr = (m) => {
    if (!m) return '';
    if (typeof m !== 'object') return t(String(m));
    const params = Object.fromEntries(
      Object.entries(m.params || {}).map(([k, v]) => [k, v && typeof v === 'object' ? tr(v) : v]),
    );
    return t(m.key, params);
  };
  const text = tr(message);

  return (
    <div className="status-bar">
      <div className="status-bar-left">
        {modified && <span className="status-modified">&#9679; {t('modified')}</span>}
        <span className="status-message">{text}</span>
      </div>
      <div className="status-bar-right">
        {selectedTeam && (
          <span className="status-item">
            {t('team')}: {selectedTeam}
          </span>
        )}
        {teamCount > 0 && (
          <span className="status-item">
            {t('teams')}: {teamCount}
          </span>
        )}
        <span className="status-item">ISS Forge v{__APP_VERSION__}</span>
      </div>
    </div>
  );
}
