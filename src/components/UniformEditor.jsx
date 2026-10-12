import React, { useState } from 'react';
import { useI18n } from '../i18n';
import { IconUniform } from './Icons';
import ColorEditorCard from './ColorEditorCard';

export default function UniformEditor({ team, teamIndex, onUniformChange }) {
  const [activeKit, setActiveKit] = useState('home');
  const { t } = useI18n();

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
          <span className="editor-icon"><IconUniform size={18} /></span>
          <h2>{team.name}</h2>
          <span className="editor-subtitle">- {t('uniforms')}</span>
        </div>
      </div>

      <div className="uniform-editor-body">
        {/* Kit Selector */}
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

        {/* Kit Preview */}
        <div className="kit-preview-section">
          <div className="detail-section-title">{t('preview')}</div>
          <div className="kit-preview">
            <KitPreview kit={currentKit} kitType={activeKit} t={t} />
          </div>
        </div>
      </div>
    </div>
  );
}

function KitPreview({ kit, kitType, t }) {
  const getColor = (colors, index) => {
    if (!colors || !colors[index]) return '#333';
    const c = colors[index];
    return `rgb(${c.r},${c.g},${c.b})`;
  };

  const isKeeper = kitType === 'goalkeeper';

  const shirt1 = isKeeper ? getColor(kit.shirtAndSocks, 0) : getColor(kit.shirt, 0);
  const shirt2 = isKeeper ? getColor(kit.shirtAndSocks, 1) : getColor(kit.shirt, 1);
  const shirt3 = isKeeper ? getColor(kit.shirtAndSocks, 2) : getColor(kit.shirt, 2);
  const shorts1 = isKeeper ? getColor(kit.shorts, 0) : getColor(kit.shorts, 0);
  const socks1 = isKeeper ? getColor(kit.shirtAndSocks, 3) : getColor(kit.socks, 0);

  return (
    <div className="kit-figure">
      <svg width="120" height="180" viewBox="0 0 120 180">
        {/* Shirt body */}
        <path
          d="M35,30 L25,35 L15,55 L25,58 L30,45 L30,95 L90,95 L90,45 L95,58 L105,55 L95,35 L85,30 L75,25 L70,30 L50,30 L45,25 Z"
          fill={shirt1}
          stroke={shirt2}
          strokeWidth="3"
        />
        {/* Collar */}
        <path d="M45,25 L50,30 L70,30 L75,25" fill="none" stroke={shirt3} strokeWidth="3" />
        {/* Number */}
        <text
          x="60"
          y="72"
          textAnchor="middle"
          fontSize="20"
          fontWeight="bold"
          fill={shirt2}
          opacity="0.8"
        >
          10
        </text>
        {/* Shorts */}
        <path
          d="M30,95 L30,130 L55,130 L58,100 L62,100 L65,130 L90,130 L90,95 Z"
          fill={shorts1}
          stroke="#00000033"
          strokeWidth="1"
        />
        {/* Socks */}
        <rect x="32" y="132" width="22" height="35" rx="3" fill={socks1} />
        <rect x="66" y="132" width="22" height="35" rx="3" fill={socks1} />
      </svg>

      <div className="kit-preview-labels">
        <div className="kit-label">
          <span className="kit-color-dot" style={{ backgroundColor: shirt1 }} />
          {t('shirt')} 1
        </div>
        <div className="kit-label">
          <span className="kit-color-dot" style={{ backgroundColor: shirt2 }} />
          {t('shirt')} 2
        </div>
        <div className="kit-label">
          <span className="kit-color-dot" style={{ backgroundColor: shorts1 }} />
          {t('shorts')}
        </div>
        <div className="kit-label">
          <span className="kit-color-dot" style={{ backgroundColor: socks1 }} />
          {t('socks')}
        </div>
      </div>
    </div>
  );
}
