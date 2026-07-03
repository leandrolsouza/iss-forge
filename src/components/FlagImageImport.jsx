import React, { useState, useRef, useCallback } from 'react';
import { useI18n } from '../i18n';
import { convertImageToFlag } from '../utils/imageToFlag';
import '../styles/FlagImageImport.css';

const GRID_WIDTH = 24;
const GRID_HEIGHT = 16;
const PREVIEW_PIXEL = 4;

export default function FlagImageImport({ flagColors, onApplyGrid, onApplyPalette }) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState('palette'); // 'palette' or 'extract'
  const [preview, setPreview] = useState(null); // { grid, palette? }
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = useCallback(
    async (file) => {
      if (!file || !file.type.startsWith('image/')) return;

      try {
        const result = await convertImageToFlag(file, flagColors, {
          extractColors: mode === 'extract',
        });
        setPreview(result);
      } catch (_err) {
        setPreview(null);
      }
    },
    [flagColors, mode],
  );

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleApply = () => {
    if (!preview) return;
    if (preview.palette && onApplyPalette) {
      onApplyPalette(preview.palette);
    }
    onApplyGrid(preview.grid);
    setPreview(null);
    setIsOpen(false);
  };

  const handleCancel = () => {
    setPreview(null);
  };

  const getDisplayColor = (paletteIdx) => {
    if (paletteIdx === 0) return '#1a1a2e';
    const colors = preview?.palette || flagColors;
    const color = colors[paletteIdx - 1];
    if (!color) return '#333';
    return `rgb(${color.r},${color.g},${color.b})`;
  };

  return (
    <div className="flag-import-section">
      <button className="flag-import-btn" onClick={() => setIsOpen(!isOpen)}>
        <span className="import-icon">&#128247;</span>
        {t('flagImportBtn')}
      </button>

      {isOpen && (
        <div className="flag-import-options">
          {/* Mode selector */}
          <div className="flag-import-mode-selector">
            <button
              className={`flag-import-mode-btn ${mode === 'palette' ? 'active' : ''}`}
              onClick={() => {
                setMode('palette');
                setPreview(null);
              }}
            >
              {t('flagImportModePalette')}
            </button>
            <button
              className={`flag-import-mode-btn ${mode === 'extract' ? 'active' : ''}`}
              onClick={() => {
                setMode('extract');
                setPreview(null);
              }}
            >
              {t('flagImportModeExtract')}
            </button>
          </div>

          <div className="flag-import-mode-desc">
            {mode === 'palette' ? t('flagImportDescPalette') : t('flagImportDescExtract')}
          </div>

          {/* Drop zone / file input */}
          {!preview && (
            <div
              className={`flag-import-drop-zone ${dragOver ? 'drag-over' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <span className="drop-icon">&#128444;</span>
              <span className="drop-text">{t('flagImportDropText')}</span>
              <span className="drop-hint">{t('flagImportDropHint')}</span>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />

          {/* Preview */}
          {preview && (
            <div className="flag-import-preview">
              <div
                className="flag-import-preview-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${GRID_WIDTH}, ${PREVIEW_PIXEL}px)`,
                  gridTemplateRows: `repeat(${GRID_HEIGHT}, ${PREVIEW_PIXEL}px)`,
                  gap: 0,
                  width: GRID_WIDTH * PREVIEW_PIXEL,
                  height: GRID_HEIGHT * PREVIEW_PIXEL,
                }}
              >
                {preview.grid.map((row, r) =>
                  row.map((pixel, c) => (
                    <div
                      key={`${r}-${c}`}
                      style={{
                        backgroundColor: getDisplayColor(pixel),
                        width: PREVIEW_PIXEL,
                        height: PREVIEW_PIXEL,
                      }}
                    />
                  )),
                )}
              </div>
              <div className="flag-import-preview-actions">
                <button className="flag-import-apply-btn" onClick={handleApply}>
                  {t('flagImportApply')}
                </button>
                <button className="flag-import-cancel-btn" onClick={handleCancel}>
                  {t('flagImportRetry')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
