import React, { useState, useRef } from 'react';
import { useI18n } from '../i18n';

export default function TeamNameEditor({
  team,
  teamIndex,
  onTeamNameMenuSave,
  onTeamNameInGameGenerate,
}) {
  const [menuText, setMenuText] = useState('');
  const [inGameText, setInGameText] = useState('');
  const [inGameGenerated, setInGameGenerated] = useState(false);
  const [menuSaved, setMenuSaved] = useState(false);
  const menuInitRef = useRef(false);
  const inGameInitRef = useRef(false);
  const { t } = useI18n();

  if (!team) {
    return <div className="editor-panel empty">{t('openRomToSee')}</div>;
  }

  const teamNameText = team.teamNameText || team.name.toUpperCase();

  // Initialize inputs on first render or team change
  if (!menuInitRef.current && teamNameText) {
    setMenuText(teamNameText);
    menuInitRef.current = true;
  }
  if (!inGameInitRef.current && teamNameText) {
    setInGameText(teamNameText.substring(0, 3));
    inGameInitRef.current = true;
  }

  const handleInGameGenerate = () => {
    const sanitized = inGameText
      .toUpperCase()
      .replace(/[^A-Z0-9.]/g, '')
      .trim();
    if (!sanitized) return;

    onTeamNameInGameGenerate(teamIndex, sanitized);
    setInGameGenerated(true);
    setTimeout(() => setInGameGenerated(false), 2000);
  };

  const handleMenuSave = () => {
    const sanitized = menuText
      .toUpperCase()
      .replace(/[^A-Z0-9. ]/g, ' ')
      .trim();
    if (!sanitized) return;

    onTeamNameMenuSave(teamIndex, sanitized);
    setMenuSaved(true);
    setTimeout(() => setMenuSaved(false), 2000);
  };

  const handleMenuChange = (e) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9. ]/g, '');
    setMenuText(value);
    setMenuSaved(false);
  };

  const handleInGameChange = (e) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9.]/g, '');
    setInGameText(value);
    setInGameGenerated(false);
  };

  return (
    <div className="editor-panel uniform-editor">
      <div className="editor-header">
        <div className="editor-header-title">
          <span className="editor-icon">&#127383;</span>
          <h2>{team.name}</h2>
          <span className="editor-subtitle">- {t('teamName')}</span>
        </div>
      </div>

      <div className="uniform-editor-body">
        {/* Current Name Display */}
        <div className="uniform-part-section">
          <div className="detail-section-title">{t('currentName')}</div>
          <div className="teamname-display">
            <div className="teamname-current">{teamNameText}</div>
          </div>
        </div>

        {/* In-Game Name (3 chars - scoreboard) */}
        <div className="uniform-part-section">
          <div className="detail-section-title">{t('nameInGame')}</div>
          <div className="teamname-editor-row">
            <input
              type="text"
              value={inGameText}
              onChange={handleInGameChange}
              maxLength={3}
              placeholder={t('nameInGamePlaceholder')}
              className="teamname-input teamname-input-short"
            />
            <button
              className="kit-btn active teamname-generate-btn"
              onClick={handleInGameGenerate}
              disabled={!inGameText.trim()}
            >
              {inGameGenerated ? `✓ ${t('generated')}` : t('generate')}
            </button>
          </div>
          <div className="teamname-hint">{t('nameInGameHint')}</div>
        </div>

        {/* Text in Menu (full name - selection screen) */}
        <div className="uniform-part-section">
          <div className="detail-section-title">{t('nameInMenu')}</div>
          <div className="teamname-editor-row">
            <input
              type="text"
              value={menuText}
              onChange={handleMenuChange}
              onBlur={handleMenuSave}
              maxLength={10}
              placeholder={t('nameInMenuPlaceholder')}
              className="teamname-input"
            />
            <span className="teamname-autosave-hint">{menuSaved ? `✓ ${t('saved')}` : ''}</span>
          </div>
          <div className="teamname-hint">{t('nameInMenuHint')}</div>
        </div>

        {/* Info */}
        <div className="kit-preview-section" style={{ marginTop: 24 }}>
          <div className="detail-section-title">{t('teamNameHowTitle')}</div>
          <div className="welcome-info" style={{ marginTop: 8 }}>
            <p>{t('teamNameHowTwo1')}</p>
            <p style={{ marginTop: 8 }}>{t('teamNameHowTwo2')}</p>
            <p style={{ marginTop: 8 }}>
              <strong>{t('teamNameHowTwo3')}</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
