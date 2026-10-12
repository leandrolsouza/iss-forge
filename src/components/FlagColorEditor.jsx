import React from 'react';
import { useI18n } from '../i18n';
import { IconFlag } from './Icons';
import ColorEditorCard from './ColorEditorCard';

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
          <span className="editor-icon"><IconFlag size={18} /></span>
          <h2>{team.name}</h2>
          <span className="editor-subtitle">- {t('flagColors')}</span>
        </div>
      </div>

      <div className="uniform-editor-body">
        {/* Flag Preview */}
        <div className="kit-preview-section" style={{ marginBottom: 24 }}>
          <div className="detail-section-title">{t('flagPreview')}</div>
          <div className="kit-preview">
            <FlagPreview colors={colors} t={t} />
          </div>
        </div>

        {/* Color Editors */}
        <div className="uniform-part-section">
          <div className="detail-section-title">{t('flagPalette')}</div>
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
          <div className="welcome-info" style={{ marginTop: 8 }}>
            <p>{t('flagInfoDetail')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FlagPreview({ colors, t }) {
  const getColor = (idx) => {
    if (!colors[idx]) return '#333';
    const c = colors[idx];
    return `rgb(${c.r},${c.g},${c.b})`;
  };

  return (
    <div className="kit-figure">
      <svg width="160" height="110" viewBox="0 0 160 110">
        {/* Flag background divided into sections to show all 4 colors */}
        <rect
          x="5"
          y="5"
          width="150"
          height="100"
          fill={getColor(0)}
          stroke="#555"
          strokeWidth="1"
        />
        {/* Horizontal stripes to show the palette */}
        <rect x="5" y="5" width="150" height="25" fill={getColor(0)} />
        <rect x="5" y="30" width="150" height="25" fill={getColor(1)} />
        <rect x="5" y="55" width="150" height="25" fill={getColor(2)} />
        <rect x="5" y="80" width="150" height="25" fill={getColor(3)} />
        {/* Border */}
        <rect x="5" y="5" width="150" height="100" fill="none" stroke="#666" strokeWidth="2" />
      </svg>

      <div className="kit-preview-labels">
        {colors.map((c, i) => (
          <div key={i} className="kit-label">
            <span
              className="kit-color-dot"
              style={{ backgroundColor: `rgb(${c.r},${c.g},${c.b})` }}
            />
            {t('flagColorLabel')} {i + 1}
          </div>
        ))}
      </div>
    </div>
  );
}
