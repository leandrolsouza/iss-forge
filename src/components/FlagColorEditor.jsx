import React from 'react';
import { useI18n } from '../i18n';

export default function FlagColorEditor({ team, teamIndex, onFlagColorChange }) {
  const { t } = useI18n();

  if (!team || !team.flagColors || team.flagColors.length === 0) {
    return <div className="editor-panel empty">{t('selectTeamToEdit')}</div>;
  }

  const colors = team.flagColors;

  const rgbToHex = (r, g, b) => {
    return '#' + [r, g, b].map((c) => Math.min(255, c).toString(16).padStart(2, '0')).join('');
  };

  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
      : { r: 0, g: 0, b: 0 };
  };

  const handleColorChange = (colorIndex, hexColor) => {
    const rgb = hexToRgb(hexColor);
    onFlagColorChange(teamIndex, colorIndex, rgb);
  };

  return (
    <div className="editor-panel uniform-editor">
      <div className="editor-header">
        <div className="editor-header-title">
          <span className="editor-icon">&#127988;</span>
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
            {colors.map((color, idx) => {
              const hexValue = rgbToHex(color.r, color.g, color.b);
              return (
                <div key={idx} className="color-editor-card">
                  <div className="color-card-header">
                    <span className="color-card-label">{t('flagColorLabel')} {idx + 1}</span>
                    <span className="color-card-5bit">
                      ({color.r5 !== undefined ? `${color.r5}, ${color.g5}, ${color.b5}` : ''})
                    </span>
                  </div>
                  <div className="color-card-body">
                    <div className="color-preview-large" style={{ backgroundColor: hexValue }} />
                    <div className="color-controls">
                      <div className="color-input-row">
                        <input
                          type="color"
                          value={hexValue}
                          onChange={(e) => handleColorChange(idx, e.target.value)}
                          className="color-picker"
                        />
                        <input
                          type="text"
                          value={hexValue.toUpperCase()}
                          onChange={(e) => {
                            if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                              handleColorChange(idx, e.target.value);
                            }
                          }}
                          className="color-hex-input"
                          maxLength={7}
                        />
                      </div>
                      <div className="color-rgb-row">
                        <div className="rgb-field">
                          <label>R:</label>
                          <input
                            type="number"
                            min={0}
                            max={248}
                            step={8}
                            value={color.r}
                            onChange={(e) => {
                              const r = Math.max(0, Math.min(248, parseInt(e.target.value) || 0));
                              onFlagColorChange(teamIndex, idx, { ...color, r });
                            }}
                            className="input-rgb"
                          />
                        </div>
                        <div className="rgb-field">
                          <label>G:</label>
                          <input
                            type="number"
                            min={0}
                            max={248}
                            step={8}
                            value={color.g}
                            onChange={(e) => {
                              const g = Math.max(0, Math.min(248, parseInt(e.target.value) || 0));
                              onFlagColorChange(teamIndex, idx, { ...color, g });
                            }}
                            className="input-rgb"
                          />
                        </div>
                        <div className="rgb-field">
                          <label>B:</label>
                          <input
                            type="number"
                            min={0}
                            max={248}
                            step={8}
                            value={color.b}
                            onChange={(e) => {
                              const b = Math.max(0, Math.min(248, parseInt(e.target.value) || 0));
                              onFlagColorChange(teamIndex, idx, { ...color, b });
                            }}
                            className="input-rgb"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
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
