import { useState, useRef, useEffect } from 'react';
import { useI18n } from '../i18n';
import { HAIR_SKIN_TEMPLATES } from '../rom/hairSkinTemplates';
import { SPECIAL_HAIR, SPECIAL_SKIN } from '../rom/constants';
import { IconHairSkin } from './Icons';
import ColorEditorCard from './ColorEditorCard';

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

  // Normal players share the colours of both outfield kits: write them as one undo step
  const handleNormalChange = (part, colorIndex, rgb) =>
    onHairSkinChange(teamIndex, ['first', 'second'], part, colorIndex, rgb);

  const handleKeeperChange = (part, colorIndex, rgb) =>
    onHairSkinChange(teamIndex, 'goalkeeper', part, colorIndex, rgb);

  const handleTemplateSelect = (template) => {
    onHairSkinTemplateApply(teamIndex, template);
    setTemplateOpen(false);
  };

  const renderColorRow = (label, part, colors, onChange) => (
    <div className="uniform-part-section" key={part}>
      <div className="detail-section-title">
        {label} ({colors.length} {t('colors')})
      </div>
      <div className="uniform-colors-grid">
        {colors.map((color, idx) => (
          <ColorEditorCard
            key={idx}
            label={colors.length > 1 ? `${label} ${idx + 1}` : label}
            color={color}
            onCommit={(rgb) => onChange(part, idx, rgb)}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className="editor-panel uniform-editor">
      <div className="editor-header">
        <div className="editor-header-title">
          <span className="editor-icon"><IconHairSkin size={18} /></span>
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
            {renderColorRow(t('hairColor'), 'hair', normalData.hair, handleNormalChange)}
            {renderColorRow(t('skinColor'), 'skin', normalData.skin, handleNormalChange)}
          </div>

          {keeperData && (
            <div className="hair-skin-column">
              <h3 className="hair-skin-section-title">{t('hairSkinGoalkeeper')}</h3>
              {renderColorRow(t('hairColor'), 'hair', keeperData.hair, handleKeeperChange)}
              {renderColorRow(t('skinColor'), 'skin', keeperData.skin, handleKeeperChange)}
            </div>
          )}
        </div>

        <p className="special-info-text">{t('hairSkinInfo')}</p>
      </div>
    </div>
  );
}
