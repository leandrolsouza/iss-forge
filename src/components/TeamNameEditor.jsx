import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useI18n } from '../i18n';
import { useRom } from '../context/RomContext';
import {
  decode2bppTiles,
  renderTextToPixels,
  textPixelWidth,
  IN_GAME_NAME_WIDTH,
} from '../rom/TeamNameTileFont';
import { IconTeamName } from './Icons';
import RestoreOriginalButton from './RestoreOriginalButton';

const sanitizeMenu = (s) =>
  s
    .toUpperCase()
    .replace(/[^A-Z0-9. ]/g, ' ')
    .trim();

const sanitizeInGame = (s) =>
  s
    .toUpperCase()
    .replace(/[^A-Z0-9. ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// 2bpp colours of the name graphic: 0 transparent, 1 letter, 2 shading, 3 outline
const PIXEL_COLORS = [null, '#ffffff', '#a8a8a8', '#101010'];
const SCALE = 4;

/** The 32 x 8 in-game name graphic, drawn pixel by pixel */
function InGameNameCanvas({ pixels, label }) {
  const ref = useRef(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, ref.current.width, ref.current.height);
    pixels.forEach((row, y) =>
      row.forEach((p, x) => {
        if (!PIXEL_COLORS[p]) return;
        ctx.fillStyle = PIXEL_COLORS[p];
        ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
      }),
    );
  }, [pixels]);
  return (
    <canvas
      ref={ref}
      className="teamname-ingame-canvas"
      width={IN_GAME_NAME_WIDTH * SCALE}
      height={8 * SCALE}
      role="img"
      aria-label={label}
    />
  );
}

export default function TeamNameEditor({
  team,
  teamIndex,
  onTeamNameMenuSave,
  onTeamNameInGameGenerate,
}) {
  const { t } = useI18n();
  const { romParser } = useRom();
  const teamNameText = team ? team.teamNameText || team.name.toUpperCase() : '';
  // null when the current graphic is a custom drawing (not made with the editor's font)
  const inGameName = team?.teamNameInGame ?? null;

  const [menuText, setMenuText] = useState(teamNameText);
  const [inGameText, setInGameText] = useState(inGameName || '');
  const [inGameGenerated, setInGameGenerated] = useState(false);
  const [menuSaved, setMenuSaved] = useState(false);

  // Reset each draft whenever the team (or that stored name, e.g. after undo) changes,
  // so a blur never writes the previous team's text into the current one. Separate
  // effects: saving one name must not throw away the other field's draft.
  useEffect(() => {
    setMenuText(teamNameText);
    setMenuSaved(false);
  }, [teamIndex, teamNameText]);
  useEffect(() => {
    setInGameText(inGameName || '');
    setInGameGenerated(false);
  }, [teamIndex, inGameName]);

  const currentPixels = useMemo(
    () => (team?.teamNameInGameTiles ? decode2bppTiles(team.teamNameInGameTiles) : null),
    [team?.teamNameInGameTiles],
  );
  const inGameDraft = sanitizeInGame(inGameText);
  const draftPixels = useMemo(() => renderTextToPixels(inGameDraft), [inGameDraft]);
  const inGameWidth = textPixelWidth(inGameDraft);
  const inGameTooWide = inGameWidth > IN_GAME_NAME_WIDTH;
  const inGameChanged = !!inGameDraft && inGameDraft !== inGameName;

  // What the menu name area can really take (the writer shortens names that don't fit)
  const menuDraft = sanitizeMenu(menuText);
  const menuFitted = useMemo(
    () =>
      romParser && menuDraft && menuDraft !== sanitizeMenu(teamNameText)
        ? romParser.fitTeamNameMenu(teamIndex, menuDraft)
        : menuDraft,
    [romParser, teamIndex, menuDraft, teamNameText],
  );

  if (!team) {
    return <div className="editor-panel empty">{t('openRomToSee')}</div>;
  }

  const handleInGameGenerate = () => {
    if (!inGameChanged || inGameTooWide) return;
    if (onTeamNameInGameGenerate(teamIndex, inGameDraft) === false) return;
    setInGameGenerated(true);
    setTimeout(() => setInGameGenerated(false), 2000);
  };

  const handleMenuSave = () => {
    // Empty or unchanged: nothing to write (avoids an undo step / ROM repack per blur)
    if (!menuDraft || menuDraft === sanitizeMenu(teamNameText)) {
      setMenuText(teamNameText);
      return;
    }

    if (onTeamNameMenuSave(teamIndex, menuDraft) === false) return;
    setMenuSaved(true);
    setTimeout(() => setMenuSaved(false), 2000);
  };

  const handleMenuChange = (e) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9. ]/g, '');
    setMenuText(value);
    setMenuSaved(false);
  };

  const handleInGameChange = (e) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9. ]/g, '');
    setInGameText(value);
    setInGameGenerated(false);
  };

  return (
    <div className="editor-panel uniform-editor">
      <div className="editor-header">
        <div className="editor-header-title">
          <span className="editor-icon">
            <IconTeamName size={18} />
          </span>
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
            <RestoreOriginalButton teamIndex={teamIndex} part="teamName" />
          </div>
        </div>

        {/* In-game name: 32 x 8 pixel graphic */}
        <div className="uniform-part-section">
          <div className="detail-section-title">{t('nameInGame')}</div>
          <div className="teamname-ingame-preview">
            {currentPixels && (
              <div>
                <InGameNameCanvas pixels={currentPixels} label={t('nameInGameCurrent')} />
                <div className="teamname-ingame-caption">{t('nameInGameCurrent')}</div>
              </div>
            )}
            {inGameChanged && !inGameTooWide && (
              <div>
                <InGameNameCanvas pixels={draftPixels} label={t('nameInGameNew')} />
                <div className="teamname-ingame-caption">{t('nameInGameNew')}</div>
              </div>
            )}
          </div>
          <div className="teamname-editor-row">
            <input
              type="text"
              value={inGameText}
              onChange={handleInGameChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleInGameGenerate();
              }}
              maxLength={12}
              placeholder={t('nameInGamePlaceholder')}
              className="teamname-input teamname-input-short"
              aria-invalid={inGameTooWide}
            />
            <button
              className="kit-btn active teamname-generate-btn"
              onClick={handleInGameGenerate}
              disabled={!inGameChanged || inGameTooWide}
            >
              {inGameGenerated ? `✓ ${t('generated')}` : t('generate')}
            </button>
          </div>
          {inGameTooWide && (
            <div className="teamname-warning">
              {t('nameInGameTooWide', { width: inGameWidth, max: IN_GAME_NAME_WIDTH })}
            </div>
          )}
          {!inGameName && <div className="teamname-hint">{t('nameInGameCustom')}</div>}
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
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') {
                  setMenuText(teamNameText);
                  // blur after the reset renders, so handleMenuSave sees the original text
                  const el = e.currentTarget;
                  setTimeout(() => el.blur(), 0);
                }
              }}
              maxLength={10}
              placeholder={t('nameInMenuPlaceholder')}
              className="teamname-input"
            />
            <span className="teamname-autosave-hint">{menuSaved ? `✓ ${t('saved')}` : ''}</span>
          </div>
          {menuDraft && menuFitted !== menuDraft && (
            <div className="teamname-warning">
              {menuFitted
                ? t('nameInMenuWillTruncate', { name: menuFitted })
                : t('toastTeamNameNoSpace')}
            </div>
          )}
          <div className="teamname-hint">{t('nameInMenuHint')}</div>
        </div>

        {/* Info */}
        <div className="kit-preview-section">
          <div className="detail-section-title">{t('teamNameHowTitle')}</div>
          <div className="editor-info-box">
            <p>{t('teamNameHowTwo1')}</p>
            <p>{t('teamNameHowTwo2')}</p>
            <p>
              <strong>{t('teamNameHowTwo3')}</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
