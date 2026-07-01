import React, { useState } from 'react';
import { useI18n } from '../i18n';

export default function HairSkinEditor({ team, teamIndex, onHairSkinChange }) {
  const [activeKit, setActiveKit] = useState('first');
  const { t } = useI18n();

  if (!team || !team.hairSkin) {
    return <div className="editor-panel empty">{t('openRomToSee')}</div>;
  }

  const hairSkin = team.hairSkin;
  const kits = [
    { id: 'first', label: t('home') },
    { id: 'second', label: t('away') },
    { id: 'goalkeeper', label: t('keeper') },
  ];

  const currentData = hairSkin[activeKit];
  if (!currentData) {
    return <div className="editor-panel empty">{t('openRomToSee')}</div>;
  }

  const rgbToHex = (r, g, b) => {
    return '#' + [r, g, b].map((c) => Math.min(255, c).toString(16).padStart(2, '0')).join('');
  };

  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
      : { r: 0, g: 0, b: 0 };
  };

  const handleColorChange = (part, colorIndex, hexColor) => {
    const rgb = hexToRgb(hexColor);
    onHairSkinChange(teamIndex, activeKit, part, colorIndex, rgb);
  };

  const renderColorRow = (label, part, colors) => (
    <div className="uniform-part-section" key={part}>
      <div className="detail-section-title">{label} ({colors.length} {t('colors')})</div>
      <div className="uniform-colors-grid">
        {colors.map((color, idx) => {
          const hexValue = rgbToHex(color.r, color.g, color.b);
          return (
            <div key={idx} className="color-editor-card">
              <div className="color-card-header">
                <span className="color-card-label">{label} {colors.length > 1 ? idx + 1 : ''}</span>
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
                      onChange={(e) => handleColorChange(part, idx, e.target.value)}
                      className="color-picker"
                    />
                    <input
                      type="text"
                      value={hexValue.toUpperCase()}
                      onChange={(e) => {
                        if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                          handleColorChange(part, idx, e.target.value);
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
                        type="number" min={0} max={248} step={8}
                        value={color.r}
                        onChange={(e) => {
                          const r = Math.max(0, Math.min(248, parseInt(e.target.value) || 0));
                          onHairSkinChange(teamIndex, activeKit, part, idx, { ...color, r });
                        }}
                        className="input-rgb"
                      />
                    </div>
                    <div className="rgb-field">
                      <label>G:</label>
                      <input
                        type="number" min={0} max={248} step={8}
                        value={color.g}
                        onChange={(e) => {
                          const g = Math.max(0, Math.min(248, parseInt(e.target.value) || 0));
                          onHairSkinChange(teamIndex, activeKit, part, idx, { ...color, g });
                        }}
                        className="input-rgb"
                      />
                    </div>
                    <div className="rgb-field">
                      <label>B:</label>
                      <input
                        type="number" min={0} max={248} step={8}
                        value={color.b}
                        onChange={(e) => {
                          const b = Math.max(0, Math.min(248, parseInt(e.target.value) || 0));
                          onHairSkinChange(teamIndex, activeKit, part, idx, { ...color, b });
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
  );

  return (
    <div className="editor-panel uniform-editor">
      <div className="editor-header">
        <div className="editor-header-title">
          <span className="editor-icon">&#128135;</span>
          <h2>{team.name}</h2>
          <span className="editor-subtitle">- {t('hairAndSkin')}</span>
        </div>
      </div>

      <div className="uniform-editor-body">
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

        {renderColorRow(t('hairColor'), 'hair', currentData.hair)}
        {renderColorRow(t('skinColor'), 'skin', currentData.skin)}

        <div className="kit-preview-section">
          <div className="detail-section-title">{t('hairSkinInfo')}</div>
        </div>
      </div>
    </div>
  );
}
