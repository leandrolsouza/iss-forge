import React, { useState, useMemo } from 'react';
import { useI18n } from '../i18n';
import { FLAG_TEMPLATES } from '../rom/flagTemplates';
import '../styles/FlagTemplateSelector.css';

const PREVIEW_PIXEL = 4;
const GRID_WIDTH = 24;
const GRID_HEIGHT = 16;

/**
 * Renders a mini canvas preview of a template using the current flag colors.
 */
function TemplatePreview({ template, flagColors }) {
  const grid = useMemo(() => template.generate(), [template]);

  const getColor = (paletteIdx) => {
    if (paletteIdx === 0) return '#1a1a2e';
    const color = flagColors[paletteIdx - 1];
    if (!color) return '#333';
    return `rgb(${color.r},${color.g},${color.b})`;
  };

  return (
    <div
      className="flag-template-preview"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${GRID_WIDTH}, ${PREVIEW_PIXEL}px)`,
        gridTemplateRows: `repeat(${GRID_HEIGHT}, ${PREVIEW_PIXEL}px)`,
        gap: 0,
        width: GRID_WIDTH * PREVIEW_PIXEL,
        height: GRID_HEIGHT * PREVIEW_PIXEL,
      }}
    >
      {grid.map((row, r) =>
        row.map((pixel, c) => (
          <div
            key={`${r}-${c}`}
            style={{
              backgroundColor: getColor(pixel),
              width: PREVIEW_PIXEL,
              height: PREVIEW_PIXEL,
            }}
          />
        )),
      )}
    </div>
  );
}

export default function FlagTemplateSelector({ flagColors, onApplyTemplate }) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  const handleApply = (template) => {
    const grid = template.generate();
    onApplyTemplate(grid);
  };

  return (
    <div className="flag-template-section">
      <button
        className="flag-template-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title={t('flagTemplateToggle')}
      >
        <span className={`toggle-icon ${isOpen ? 'open' : ''}`}>&#9654;</span>
        {t('flagTemplates')}
      </button>

      {isOpen && (
        <div className="flag-template-gallery">
          {FLAG_TEMPLATES.map((template) => (
            <button
              key={template.id}
              className="flag-template-item"
              onClick={() => handleApply(template)}
              title={t(template.nameKey)}
            >
              <TemplatePreview template={template} flagColors={flagColors} />
              <span className="flag-template-name">{t(template.nameKey)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
