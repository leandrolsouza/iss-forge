import React from 'react';
import { useI18n } from '../i18n';
import { IconFlag } from './Icons';
import ColorEditorCard from './ColorEditorCard';
import FlagCanvas from './FlagCanvas';
import PlayerKitPreview from './PlayerKitPreview';
import RestoreOriginalButton from './RestoreOriginalButton';

export default function FlagColorEditor({ team, teamIndex, onFlagColorChange }) {
  const { t } = useI18n();

  if (!team || !team.flagColors || team.flagColors.length === 0) {
    return <div className="editor-panel empty">{t('selectTeamToEdit')}</div>;
  }

  const colors = team.flagColors;

  return (
    <div className="editor-panel uniform-editor">
      <div className="editor-header">
        <div className="editor-header-title">
          <span className="editor-icon">
            <IconFlag size={18} />
          </span>
          <h2>{team.name}</h2>
          <span className="editor-subtitle">- {t('flagColors')}</span>
        </div>
      </div>

      <div className="uniform-editor-body">
        {/* Flag Preview */}
        <div className="kit-preview-section flag-color-preview">
          <div className="detail-section-title">{t('flagPreview')}</div>
          <div className="kit-preview">
            <FlagCanvas grid={team.flagDesign?.grid} colors={colors} label={t('flagPreview')} />
            <PlayerKitPreview
              team={team}
              teamIndex={teamIndex}
              kits={['home', 'away']}
              views={['front']}
              scale={2}
            />
          </div>
          <div className="teamname-hint">{t('flagPreviewHint')}</div>
        </div>

        {/* Color Editors */}
        <div className="uniform-part-section">
          <div className="detail-section-title section-title-row">
            {t('flagPalette')}
            <RestoreOriginalButton teamIndex={teamIndex} part="flagColors" />
          </div>
          <div className="uniform-colors-grid">
            {colors.map((color, idx) => (
              <ColorEditorCard
                key={idx}
                label={`${t('flagColorLabel')} ${idx + 1}`}
                color={color}
                onCommit={(rgb) => onFlagColorChange(teamIndex, idx, rgb)}
              />
            ))}
          </div>
        </div>

        <div className="kit-preview-section">
          <div className="detail-section-title">{t('information')}</div>
          <div className="editor-info-box">
            <p>{t('flagInfoDetail')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
