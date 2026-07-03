import { useState, useRef, useEffect } from 'react';
import { useI18n } from '../i18n';
import { HAIR_SKIN_TEMPLATES } from '../rom/hairSkinTemplates';
import { SPECIAL_HAIR, SPECIAL_SKIN } from '../rom/constants';

const TEMPLATE_I18N_KEYS = {
  european_light: 'templateEuropeanLight',
  european_dark: 'templateEuropeanDark',
  nordic: 'templateNordic',
  latino: 'templateLatino',
  african: 'templateAfrican',
  asian: 'templateAsian',
};

const SPECIAL_HAIR_I18N_KEYS = {
  regular: 'specialHairRegular',
  blond: 'specialHairBlond',
  lightBrown: 'specialHairLightBrown',
  darkBrown: 'specialHairDarkBrown',
  black: 'specialHairBlack',
};

const SPECIAL_SKIN_I18N_KEYS = {
  regular: 'specialSkinRegular',
  white: 'specialSkinWhite',
  brown: 'specialSkinBrown',
  black: 'specialSkinBlack',
};

export default function HairSkinEditor({
  team,
  teamIndex,
  onHairSkinChange,
  onHairSkinTemplateApply,
  onSpecialHairSkinChange,
}) {
  const { t } = useI18n();
  const [templateOpen, setTemplateOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setTemplateOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!team || !team.hairSkin) {
    return <div className="editor-panel empty">{t('openRomToSee')}</div>;
  }

  const hairSkin = team.hairSkin;
  const normalData = hairSkin.first;
  const keeperData = hairSkin.goalkeeper;

  if (!normalData) {
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

  // For normal players, write to both first and second kits
  const handleNormalColorChange = (part, colorIndex, hexColor) => {
    const rgb = hexToRgb(hexColor);
    onHairSkinChange(teamIndex, 'first', part, colorIndex, rgb);
    onHairSkinChange(teamIndex, 'second', part, colorIndex, rgb);
  };

  const handleNormalRgbChange = (part, colorIndex, color) => {
    onHairSkinChange(teamIndex, 'first', part, colorIndex, color);
    onHairSkinChange(teamIndex, 'second', part, colorIndex, color);
  };

  const handleKeeperColorChange = (part, colorIndex, hexColor) => {
    const rgb = hexToRgb(hexColor);
    onHairSkinChange(teamIndex, 'goalkeeper', part, colorIndex, rgb);
  };

  const handleKeeperRgbChange = (part, colorIndex, color) => {
    onHairSkinChange(teamIndex, 'goalkeeper', part, colorIndex, color);
  };

  const handleTemplateSelect = (template) => {
    onHairSkinTemplateApply(teamIndex, template);
    setTemplateOpen(false);
  };

  const renderColorRow = (label, part, colors, onHexChange, onRgbChange) => (
    <div className="uniform-part-section" key={part}>
      <div className="detail-section-title">
        {label} ({colors.length} {t('colors')})
      </div>
      <div className="uniform-colors-grid">
        {colors.map((color, idx) => {
          const hexValue = rgbToHex(color.r, color.g, color.b);
          return (
            <div key={idx} className="color-editor-card">
              <div className="color-card-header">
                <span className="color-card-label">
                  {label} {colors.length > 1 ? idx + 1 : ''}
                </span>
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
                      onChange={(e) => onHexChange(part, idx, e.target.value)}
                      className="color-picker"
                    />
                    <input
                      type="text"
                      value={hexValue.toUpperCase()}
                      onChange={(e) => {
                        if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                          onHexChange(part, idx, e.target.value);
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
                          onRgbChange(part, idx, { ...color, r });
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
                          onRgbChange(part, idx, { ...color, g });
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
                          onRgbChange(part, idx, { ...color, b });
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
        <div className="template-dropdown-container" ref={dropdownRef}>
          <button
            className="template-btn"
            onClick={() => setTemplateOpen(!templateOpen)}
            title={t('hairSkinApplyTemplate')}
          >
            &#127912; {t('hairSkinTemplates')}
          </button>
          {templateOpen && (
            <div className="template-dropdown">
              {HAIR_SKIN_TEMPLATES.map((tmpl) => {
                const hairHex = rgbToHex(
                  tmpl.outfield.hair[0].r,
                  tmpl.outfield.hair[0].g,
                  tmpl.outfield.hair[0].b,
                );
                return (
                  <button
                    key={tmpl.id}
                    className="template-option"
                    onClick={() => handleTemplateSelect(tmpl)}
                  >
                    <span className="template-swatches">
                      <span className="template-swatch" style={{ backgroundColor: hairHex }} />
                      {tmpl.outfield.skin.map((s, i) => (
                        <span
                          key={i}
                          className="template-swatch"
                          style={{ backgroundColor: rgbToHex(s.r, s.g, s.b) }}
                        />
                      ))}
                    </span>
                    <span className="template-label">{t(TEMPLATE_I18N_KEYS[tmpl.id])}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="uniform-editor-body">
        <div className="hair-skin-special-bar">
          <h3 className="hair-skin-section-title">{t('hairSkinSpecialPlayers')}</h3>
          <div className="special-bar-content">
            <div className="special-dropdowns">
              <div className="special-dropdown-group">
                <label className="special-dropdown-label">{t('specialHairLabel')}</label>
                <select
                  className="special-dropdown-select"
                  value={team.specialHair ?? 0}
                  onChange={(e) =>
                    onSpecialHairSkinChange(teamIndex, 'specialHair', parseInt(e.target.value))
                  }
                >
                  {SPECIAL_HAIR.TYPES.map((type) => (
                    <option key={type.id} value={type.id}>
                      {t(SPECIAL_HAIR_I18N_KEYS[type.key])}
                    </option>
                  ))}
                </select>
              </div>
              <div className="special-dropdown-group">
                <label className="special-dropdown-label">{t('specialSkinLabel')}</label>
                <select
                  className="special-dropdown-select"
                  value={team.specialSkin ?? 0}
                  onChange={(e) =>
                    onSpecialHairSkinChange(teamIndex, 'specialSkin', parseInt(e.target.value))
                  }
                >
                  {SPECIAL_SKIN.TYPES.map((type) => (
                    <option key={type.id} value={type.id}>
                      {t(SPECIAL_SKIN_I18N_KEYS[type.key])}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="special-info-text">{t('hairSkinSpecialInfo')}</p>
          </div>
        </div>

        <div className="hair-skin-columns">
          <div className="hair-skin-column">
            <h3 className="hair-skin-section-title">{t('hairSkinNormalPlayers')}</h3>
            {renderColorRow(
              t('hairColor'),
              'hair',
              normalData.hair,
              handleNormalColorChange,
              handleNormalRgbChange,
            )}
            {renderColorRow(
              t('skinColor'),
              'skin',
              normalData.skin,
              handleNormalColorChange,
              handleNormalRgbChange,
            )}
          </div>

          {keeperData && (
            <div className="hair-skin-column">
              <h3 className="hair-skin-section-title">{t('hairSkinGoalkeeper')}</h3>
              {renderColorRow(
                t('hairColor'),
                'hair',
                keeperData.hair,
                handleKeeperColorChange,
                handleKeeperRgbChange,
              )}
              {renderColorRow(
                t('skinColor'),
                'skin',
                keeperData.skin,
                handleKeeperColorChange,
                handleKeeperRgbChange,
              )}
            </div>
          )}
        </div>

        <div className="kit-preview-section">
          <div className="detail-section-title">{t('hairSkinInfo')}</div>
        </div>
      </div>
    </div>
  );
}
