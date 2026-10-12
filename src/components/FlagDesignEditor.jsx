import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useI18n } from '../i18n';
import { useConfirm } from '../context/ConfirmContext';
import FlagTemplateSelector from './FlagTemplateSelector';
import FlagImageImport from './FlagImageImport';
import FlagCanvas from './FlagCanvas';
import RestoreOriginalButton from './RestoreOriginalButton';
import { useRom } from '../context/RomContext';
import { IconFlagDesign } from './Icons';

const GRID_WIDTH = 24;
const GRID_HEIGHT = 16;
const PIXEL_SIZE = 22;

export default function FlagDesignEditor({
  team,
  teamIndex,
  onFlagDesignBulkChange,
  onFlagColorChange,
  onFlagColorBulkChange,
}) {
  const [selectedColor, setSelectedColor] = useState(1);
  const [isDrawing, setIsDrawing] = useState(false);
  // A brush stroke is painted here and written to the ROM (one undo step) on mouse up
  const [strokeGrid, setStrokeGrid] = useState(null);
  const strokeRef = useRef(null);
  const canvasRef = useRef(null);
  const confirm = useConfirm();
  const { t } = useI18n();
  const { romParser, teams } = useRom();
  // The original ROM draws some flags from the same blocks (e.g. GER, HOL, AUT, RUS):
  // editing one gives this team its own copy
  const sharedWith = useMemo(
    () => (romParser ? romParser.flagSharedWith(teamIndex).map((i) => teams[i]?.name) : []),
    // re-check after every edit of any flag
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [romParser, teamIndex, team?.flagDesign],
  );

  // A stroke never carries over to another team
  useEffect(() => {
    strokeRef.current = null;
    setStrokeGrid(null);
    setIsDrawing(false);
  }, [teamIndex]);

  const COLOR_LABELS = [
    t('transparent'),
    t('flagColor1'),
    t('flagColor2'),
    t('flagColor3'),
    t('flagColor4'),
  ];

  if (!team || !team.flagDesign) {
    return <div className="editor-panel empty">{t('flagDesignSelectTeam')}</div>;
  }

  const { flagColors } = team.flagDesign;
  const grid = strokeGrid || team.flagDesign.grid;

  // Get display color for a palette index
  const getDisplayColor = (paletteIdx) => {
    if (paletteIdx === 0) return '#1a1a2e'; // transparent/background
    const color = flagColors[paletteIdx - 1];
    if (!color) return '#333';
    return `rgb(${color.r},${color.g},${color.b})`;
  };

  const paint = (row, col) => {
    const base = strokeRef.current || team.flagDesign.grid;
    if (base[row][col] === selectedColor) return;
    const next = base.map((r, y) =>
      y === row ? r.map((p, x) => (x === col ? selectedColor : p)) : r,
    );
    strokeRef.current = next;
    setStrokeGrid(next);
  };

  const handleMouseDown = (e, row, col) => {
    if (e.button !== 0) return;
    e.preventDefault();
    strokeRef.current = null;
    setIsDrawing(true);
    paint(row, col);
  };

  const handleMouseEnter = (row, col) => {
    if (isDrawing) paint(row, col);
  };

  // End of the stroke: compress it into the ROM (the handler warns when it does not fit)
  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const painted = strokeRef.current;
    strokeRef.current = null;
    setStrokeGrid(null);
    if (painted) onFlagDesignBulkChange(teamIndex, painted);
  };

  const isUniform = (value) => grid.every((row) => row.every((p) => p === value));
  const solidGrid = (value) =>
    Array.from({ length: GRID_HEIGHT }, () => new Array(GRID_WIDTH).fill(value));

  // Fill / Clear replace the whole design: one bulk write (one undo step), after confirming
  const handleFill = async () => {
    if (isUniform(selectedColor)) return;
    const ok = await confirm({
      message: t('confirmFlagFill', { color: COLOR_LABELS[selectedColor] }),
      confirmLabel: t('fill'),
      danger: true,
    });
    if (ok) onFlagDesignBulkChange(teamIndex, solidGrid(selectedColor));
  };

  const handleClear = async () => {
    if (isUniform(0)) return;
    const ok = await confirm({
      message: t('confirmFlagClear'),
      confirmLabel: t('clear'),
      danger: true,
    });
    if (ok) onFlagDesignBulkChange(teamIndex, solidGrid(0));
  };

  return (
    <div
      className="editor-panel uniform-editor"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="editor-header">
        <div className="editor-header-title">
          <span className="editor-icon">
            <IconFlagDesign size={18} />
          </span>
          <h2>{team.name}</h2>
          <span className="editor-subtitle">- {t('editorFlagDesign')}</span>
        </div>
      </div>

      <div className="uniform-editor-body">
        {/* Palette Selector */}
        <div className="flag-design-toolbar">
          <div className="detail-section-title">{t('palette')}</div>
          <div className="flag-palette-selector">
            {[0, 1, 2, 3, 4].map((idx) => (
              <button
                key={idx}
                className={`flag-palette-btn ${selectedColor === idx ? 'active' : ''}`}
                onClick={() => setSelectedColor(idx)}
                style={{ backgroundColor: getDisplayColor(idx) }}
                title={COLOR_LABELS[idx]}
              >
                {idx === 0 ? '✕' : idx}
              </button>
            ))}
            <div className="flag-toolbar-spacer" />
            <button className="kit-btn" onClick={handleFill} title={t('fillAll')}>
              {t('fill')}
            </button>
            <button className="kit-btn danger" onClick={handleClear} title={t('clear')}>
              {t('clear')}
            </button>
            <RestoreOriginalButton teamIndex={teamIndex} part="flagDesign" />
          </div>
        </div>

        {sharedWith.length > 0 && (
          <p className="shared-data-warning">{t('flagShared', { teams: sharedWith.join(', ') })}</p>
        )}

        {/* Flag Templates */}
        <FlagTemplateSelector
          flagColors={flagColors}
          onApplyTemplate={(newGrid) => onFlagDesignBulkChange(teamIndex, newGrid)}
        />

        {/* Image Import */}
        <FlagImageImport
          flagColors={flagColors}
          onApplyGrid={(newGrid) => onFlagDesignBulkChange(teamIndex, newGrid)}
          onApplyPalette={(palette) => onFlagColorBulkChange(teamIndex, palette)}
        />

        {/* Pixel Grid */}
        <div className="flag-design-grid-container">
          <div className="detail-section-title">{t('flagDesignGrid')}</div>
          <div
            className="flag-design-grid"
            ref={canvasRef}
            style={{
              gridTemplateColumns: `repeat(${GRID_WIDTH}, ${PIXEL_SIZE}px)`,
              gridTemplateRows: `repeat(${GRID_HEIGHT}, ${PIXEL_SIZE}px)`,
            }}
          >
            {grid.map((row, r) =>
              row.map((pixel, c) => (
                <div
                  key={`${r}-${c}`}
                  className="flag-pixel"
                  style={{ backgroundColor: getDisplayColor(pixel) }}
                  onMouseDown={(e) => handleMouseDown(e, r, c)}
                  onMouseEnter={() => handleMouseEnter(r, c)}
                />
              )),
            )}
          </div>
        </div>

        {/* Mini Preview */}
        <div className="kit-preview-section">
          <div className="detail-section-title">{t('flagPreviewRealSize')}</div>
          <div className="kit-preview">
            <div className="flag-mini-wrap">
              <FlagCanvas
                grid={grid}
                colors={flagColors}
                scale={4}
                label={t('flagPreviewRealSize')}
              />
              <span className="flag-mini-caption">{t('flagPreviewScale')}</span>
            </div>
          </div>
        </div>

        <div className="kit-preview-section">
          <div className="detail-section-title">{t('information')}</div>
          <div className="editor-info-box">
            <p>{t('flagDesignInfo')}</p>
            <p>{t('flagDesignColorHint')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
