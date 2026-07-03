import React, { useState, useCallback, useRef } from 'react';
import FlagTemplateSelector from './FlagTemplateSelector';

const GRID_WIDTH = 24;
const GRID_HEIGHT = 16;
const PIXEL_SIZE = 22;

// Color 0 is transparent (background), 1-4 are the flag palette colors
const COLOR_LABELS = ['Transparente', 'Cor 1', 'Cor 2', 'Cor 3', 'Cor 4'];

export default function FlagDesignEditor({
  team,
  teamIndex,
  onFlagDesignChange,
  onFlagDesignBulkChange,
}) {
  const [selectedColor, setSelectedColor] = useState(1);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef(null);

  if (!team || !team.flagDesign) {
    return (
      <div className="editor-panel empty">Selecione um time para editar (design da bandeira)</div>
    );
  }

  const { grid, flagColors } = team.flagDesign;

  // Get display color for a palette index
  const getDisplayColor = (paletteIdx) => {
    if (paletteIdx === 0) return '#1a1a2e'; // transparent/background
    const color = flagColors[paletteIdx - 1];
    if (!color) return '#333';
    return `rgb(${color.r},${color.g},${color.b})`;
  };

  const handlePixelClick = (row, col) => {
    if (grid[row][col] !== selectedColor) {
      onFlagDesignChange(teamIndex, row, col, selectedColor);
    }
  };

  const handleMouseDown = (row, col) => {
    setIsDrawing(true);
    handlePixelClick(row, col);
  };

  const handleMouseEnter = (row, col) => {
    if (isDrawing) {
      handlePixelClick(row, col);
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const handleFill = () => {
    // Fill entire grid with selected color
    for (let r = 0; r < GRID_HEIGHT; r++) {
      for (let c = 0; c < GRID_WIDTH; c++) {
        onFlagDesignChange(teamIndex, r, c, selectedColor);
      }
    }
  };

  const handleClear = () => {
    for (let r = 0; r < GRID_HEIGHT; r++) {
      for (let c = 0; c < GRID_WIDTH; c++) {
        onFlagDesignChange(teamIndex, r, c, 0);
      }
    }
  };

  return (
    <div
      className="editor-panel uniform-editor"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="editor-header">
        <div className="editor-header-title">
          <span className="editor-icon">&#127988;</span>
          <h2>{team.name}</h2>
          <span className="editor-subtitle">- Design da Bandeira</span>
        </div>
      </div>

      <div className="uniform-editor-body">
        {/* Palette Selector */}
        <div className="flag-design-toolbar">
          <div className="detail-section-title">Paleta de Cores</div>
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
            <button className="kit-btn" onClick={handleFill} title="Preencher tudo">
              Preencher
            </button>
            <button className="kit-btn" onClick={handleClear} title="Limpar">
              Limpar
            </button>
          </div>
        </div>

        {/* Flag Templates */}
        <FlagTemplateSelector
          flagColors={flagColors}
          onApplyTemplate={(newGrid) => onFlagDesignBulkChange(teamIndex, newGrid)}
        />

        {/* Pixel Grid */}
        <div className="flag-design-grid-container">
          <div className="detail-section-title">Design (24×16 pixels)</div>
          <div
            className="flag-design-grid"
            ref={canvasRef}
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${GRID_WIDTH}, ${PIXEL_SIZE}px)`,
              gridTemplateRows: `repeat(${GRID_HEIGHT}, ${PIXEL_SIZE}px)`,
              gap: '1px',
              backgroundColor: '#333',
              border: '2px solid #555',
              width: 'fit-content',
              userSelect: 'none',
            }}
          >
            {grid.map((row, r) =>
              row.map((pixel, c) => (
                <div
                  key={`${r}-${c}`}
                  className="flag-pixel"
                  style={{
                    backgroundColor: getDisplayColor(pixel),
                    width: PIXEL_SIZE,
                    height: PIXEL_SIZE,
                    cursor: 'crosshair',
                  }}
                  onMouseDown={() => handleMouseDown(r, c)}
                  onMouseEnter={() => handleMouseEnter(r, c)}
                />
              )),
            )}
          </div>
        </div>

        {/* Mini Preview */}
        <div className="kit-preview-section" style={{ marginTop: 16 }}>
          <div className="detail-section-title">Pre-visualizacao (tamanho real)</div>
          <div className="kit-preview">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${GRID_WIDTH}, 4px)`,
                  gridTemplateRows: `repeat(${GRID_HEIGHT}, 4px)`,
                  gap: 0,
                  border: '1px solid #555',
                }}
              >
                {grid.map((row, r) =>
                  row.map((pixel, c) => (
                    <div
                      key={`mini-${r}-${c}`}
                      style={{
                        backgroundColor: getDisplayColor(pixel),
                        width: 4,
                        height: 4,
                      }}
                    />
                  )),
                )}
              </div>
              <span style={{ fontSize: 11, color: '#999' }}>96×64 no jogo (escala ~4x)</span>
            </div>
          </div>
        </div>

        <div className="kit-preview-section">
          <div className="detail-section-title">Informacao</div>
          <div className="welcome-info" style={{ marginTop: 8 }}>
            <p>
              Clique ou arraste para pintar. Cada pixel usa uma das 4 cores da paleta da bandeira ou
              transparente.
            </p>
            <p style={{ marginTop: 4 }}>
              As cores da paleta podem ser editadas na aba "Cores da Bandeira".
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
