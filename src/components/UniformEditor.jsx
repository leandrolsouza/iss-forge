import React, { useState } from 'react';
import { useI18n } from '../i18n';
import { IconUniform } from './Icons';
import ColorEditorCard from './ColorEditorCard';
import PlayerKitPreview from './PlayerKitPreview';
import RestoreOriginalButton from './RestoreOriginalButton';
import { useRom } from '../context/RomContext';
import { sharedKeeperTeams } from '../rom/readers/UniformReader';

/** Values of the predominant colour byte, as seen in the original kits */
const PREDOMINANT = [0, 1, 2, 3, 4];

export default function UniformEditor({ team, teamIndex, onUniformChange }) {
  const [activeKit, setActiveKit] = useState('home');
  const { t } = useI18n();
  const { teams, handlePredominantColorChange } = useRom();

  if (!team || !team.uniforms) {
    return <div className="editor-panel empty">{t('openRomToSee')}</div>;
  }

  const uniforms = team.uniforms;

  const kits = [
    { id: 'home', label: t('home') },
    { id: 'away', label: t('away') },
    { id: 'goalkeeper', label: t('keeper') },
  ];

  const currentKit = uniforms[activeKit];
  if (!currentKit) {
    return <div className="editor-panel empty">{t('openRomToSee')}</div>;
  }

  const isKeeper = activeKit === 'goalkeeper';
  // Super Star has no goalkeeper kit of its own: it uses Belgium's
  const keeperPartners = sharedKeeperTeams(teamIndex).map((i) => teams[i]?.name);

  // Get the parts to display based on kit type
  const kitParts = isKeeper
    ? [
        { id: 'shirtAndSocks', label: t('shirtAndSocks'), colors: currentKit.shirtAndSocks || [] },
        { id: 'shorts', label: t('shorts'), colors: currentKit.shorts || [] },
      ]
    : [
        { id: 'shirt', label: t('shirt'), colors: currentKit.shirt || [] },
        { id: 'shorts', label: t('shorts'), colors: currentKit.shorts || [] },
        { id: 'socks', label: t('socks'), colors: currentKit.socks || [] },
      ];

  return (
    <div className="editor-panel uniform-editor">
      {/* Header */}
      <div className="editor-header">
        <div className="editor-header-title">
          <span className="editor-icon">
            <IconUniform size={18} />
          </span>
          <h2>{team.name}</h2>
          <span className="editor-subtitle">- {t('uniforms')}</span>
        </div>
      </div>

      <div className="uniform-editor-body">
        {/* Kit Selector */}
        <div className="kit-toolbar">
          <div className="kit-selector">
            {kits.map((kit) => (
              <button
                key={kit.id}
                className={`kit-btn ${activeKit === kit.id ? 'active' : ''}`}
                onClick={() => setActiveKit(kit.id)}
              >
                {kit.label}
              </button>
            ))}
          </div>
          <RestoreOriginalButton teamIndex={teamIndex} part={`uniform:${activeKit}`} />
        </div>

        {/* Predominant colour: decides which team changes kit in a match */}
        <div className="uniform-part-section">
          <label className="formation-field predominant-field">
            <span>{t('predominantColor')}</span>
            <select
              className="input-stat"
              value={team.predominantColor ?? 0}
              onChange={(e) => handlePredominantColorChange(teamIndex, Number(e.target.value))}
            >
              {PREDOMINANT.map((v) => (
                <option key={v} value={v}>
                  {v} - {t(`predominant_${v}`)}
                </option>
              ))}
              {!PREDOMINANT.includes(team.predominantColor ?? 0) && (
                <option value={team.predominantColor}>{team.predominantColor}</option>
              )}
            </select>
          </label>
          <div className="teamname-hint">{t('predominantColorHint')}</div>
        </div>

        {/* Player drawn with the game's sprites, in the kit being edited */}
        <div className="kit-preview-section">
          <div className="detail-section-title">{t('preview')}</div>
          <PlayerKitPreview team={team} teamIndex={teamIndex} kit={activeKit} />
          <div className="teamname-hint">{t('kitPreviewHint')}</div>
          {isKeeper && keeperPartners.length > 0 && (
            <p className="shared-data-warning">
              {t('keeperShared', { teams: keeperPartners.join(', ') })}
            </p>
          )}
        </div>

        {/* Color Editors by Part */}
        {kitParts.map((part) => (
          <div key={part.id} className="uniform-part-section">
            <div className="detail-section-title">
              {part.label} ({part.colors.length} {t('colors')})
            </div>
            <div className="uniform-colors-grid">
              {part.colors.map((color, idx) => (
                <ColorEditorCard
                  key={idx}
                  label={`${t('color')} ${idx + 1}`}
                  color={color}
                  onCommit={(rgb) => onUniformChange(teamIndex, activeKit, part.id, idx, rgb)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
