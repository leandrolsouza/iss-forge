import { useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { useRom } from '../context/RomContext';
import {
  SCREEN_VIEWS,
  renderScreenView,
  renderTileSheet,
  inspectScreenPixel,
  overlayLabel,
} from '../rom/screenView';
import { renderTitleScreen } from '../rom/titleScreen';
import PixelCanvas from './PixelCanvas';
import { IconTitleScreen } from './Icons';
import '../styles/scenario.css';
import '../styles/screen-viewer.css';

const SCALE = 2;
const SHEET_SCALE = 3;
const LAYERS = ['bg1', 'bg2', 'bg3', 'texts', 'obj', 'math'];
const hex = (v, n = 4) => v.toString(16).toUpperCase().padStart(n, '0');
const snes = (list) => `$${hex(list >> 16, 2)}:${hex(list & 0xffff)}`;

/**
 * Screen viewer: game screens drawn from the ROM (recipes in SCREEN_VIEWS), with layer
 * toggles, a click inspector (which tile, which ROM block) and the tiles of that block.
 */
export default function ScreenViewer() {
  const { t } = useI18n();
  const {
    romParser,
    teams,
    menuScreens,
    screenTexts,
    titleScreen,
    matchPalettes,
    gameTexts,
    scenarios,
  } = useRom();
  const [viewId, setViewId] = useState('prematch');
  const [layers, setLayers] = useState({
    bg1: true,
    bg2: true,
    bg3: true,
    texts: true,
    obj: true,
    math: true,
  });
  const [picked, setPicked] = useState(null);
  const [sheet, setSheet] = useState(null);
  const canvasWrap = useRef(null);

  const view = SCREEN_VIEWS.find((v) => v.id === viewId) || SCREEN_VIEWS[0];
  const isTitle = view.kind === 'title';

  // Redrawn when any part of the ROM state changes (edits in other tabs, undo)
  const rendered = useMemo(() => {
    if (!romParser) return null;
    return isTitle ? renderTitleScreen(romParser) : renderScreenView(romParser, view, { layers });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    romParser,
    view,
    isTitle,
    layers,
    teams,
    menuScreens,
    screenTexts,
    titleScreen,
    matchPalettes,
    gameTexts,
    scenarios,
  ]);

  const info = useMemo(
    () =>
      rendered && picked && !isTitle ? inspectScreenPixel(rendered, picked.x, picked.y) : null,
    [rendered, picked, isTitle],
  );

  const sheetImage = useMemo(() => {
    if (!sheet || !rendered?.vram) return null;
    return renderTileSheet(rendered.vram, rendered.cgram, sheet);
  }, [sheet, rendered]);

  if (!romParser) return <div className="editor-panel empty">{t('openRomToSee')}</div>;

  const selectView = (id) => {
    setViewId(id);
    setPicked(null);
    setSheet(null);
  };

  const onCanvasClick = (e) => {
    if (isTitle) return;
    const box = canvasWrap.current.getBoundingClientRect();
    const x = Math.floor((e.clientX - box.left) / SCALE);
    const y = Math.floor((e.clientY - box.top) / SCALE);
    if (x < 0 || y < 0 || x >= 256 || y >= 224) return;
    setPicked({ x, y });
    setSheet(null);
  };

  const openSheet = (l) => {
    const src = l.tileSource;
    const tileBytes = l.bpp * 8;
    const start = src ? src.start : (l.chars * 2) & 0xffff;
    const count = src ? Math.max(1, Math.ceil((src.end - src.start) / tileBytes)) : 256;
    setSheet({
      chars: start >> 1,
      bpp: l.bpp,
      palette: l.palette,
      count: Math.min(count, 1024),
      columns: 16,
      highlight: Math.floor((l.vramTile * 2 - start) / tileBytes),
      file: src?.file,
    });
  };

  const layerName = (id) => t(`svLayer_${id}`);
  const source = (s) =>
    !s
      ? t('svNoSource')
      : s.overlay
        ? t('svOverlaySource', { path: overlayLabel(s.overlay) })
        : t('svSource', { file: `0x${hex(s.file, 5)}`, list: snes(s.list) });

  return (
    <div className="editor-panel scenario-editor screen-viewer">
      <div className="editor-header">
        <div className="editor-header-title">
          <span className="editor-icon">
            <IconTitleScreen size={18} />
          </span>
          <h2>{t('editorScreenViewer')}</h2>
          <span className="editor-subtitle">- {t('svSubtitle')}</span>
        </div>
      </div>

      <div className="scenario-body">
        <div className="scenario-list sv-list">
          {SCREEN_VIEWS.map((v) => (
            <button
              key={v.id}
              className={`scenario-card sv-card ${v.id === view.id ? 'active' : ''}`}
              onClick={() => selectView(v.id)}
            >
              {t(`svScreen_${v.id}`)}
            </button>
          ))}
        </div>

        <div className="sv-main">
          <div className="sv-toolbar" role="group" aria-label={t('svLayers')}>
            <span>{t('svLayers')}:</span>
            {LAYERS.map((id) => (
              <label key={id} className="mp-check sv-layer">
                <input
                  type="checkbox"
                  checked={layers[id]}
                  disabled={isTitle}
                  onChange={(e) => setLayers((l) => ({ ...l, [id]: e.target.checked }))}
                />
                {layerName(id)}
              </label>
            ))}
          </div>

          <div className="sv-screen-row">
            <div
              ref={canvasWrap}
              className={`sv-canvas-wrap ${isTitle ? '' : 'clickable'}`}
              onClick={onCanvasClick}
            >
              <PixelCanvas image={rendered} scale={SCALE} label={t(`svScreen_${view.id}`)} />
              {picked && !isTitle && (
                <div
                  className="sv-marker"
                  style={{
                    left: (picked.x & ~7) * SCALE,
                    top: (picked.y & ~7) * SCALE,
                    width: 8 * SCALE,
                    height: 8 * SCALE,
                  }}
                />
              )}
            </div>

            <div className="sv-side">
              <p className="mp-hint">{isTitle ? t('svTitleHint') : t('svHint')}</p>
              {info && (
                <div className="detail-section sv-inspect">
                  <div className="detail-section-title">
                    {t('svInspect', { x: picked.x, y: picked.y })}
                  </div>
                  <div className="sv-top">
                    {t('svTop', {
                      layer:
                        info.top === 'back'
                          ? t('svBackdrop')
                          : info.top === 'obj'
                            ? t('svObj')
                            : layerName(info.top),
                    })}
                  </div>
                  {info.layers.map((l) => (
                    <div
                      key={l.layer}
                      className={`sv-layer-info ${l.layer === info.top ? 'visible' : ''}`}
                    >
                      <strong>{layerName(l.layer)}</strong>
                      <span className="sv-mono">
                        {t('svTileLine', {
                          tile: hex(l.tile, 3),
                          palette: l.palette,
                          vram: hex(l.vramTile),
                          flags: `${l.word & 0x4000 ? 'H' : ''}${l.word & 0x8000 ? 'V' : ''}${l.priority ? 'P' : ''}`,
                        })}
                      </span>
                      <span>
                        {t('svTileFrom')}: {source(l.tileSource)}
                      </span>
                      <span>
                        {t('svMapFrom', { vram: hex(l.vramMap) })}: {source(l.mapSource)}
                      </span>
                      <button className="kit-btn" onClick={() => openSheet(l)}>
                        {t('svShowTiles')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {sheet && sheetImage && (
            <div className="detail-section sv-sheet">
              <div className="detail-section-title">
                {t('svSheetTitle', {
                  file: sheet.file !== undefined ? `0x${hex(sheet.file, 5)}` : '-',
                  vram: hex(sheet.chars),
                  count: sheet.count,
                  bpp: sheet.bpp,
                })}
              </div>
              <div className="sv-toolbar">
                <span>{t('svPaletteRow')}:</span>
                {Array.from({ length: 8 }, (_, p) => (
                  <button
                    key={p}
                    className={`kit-btn ${sheet.palette === p ? 'active' : ''}`}
                    onClick={() => setSheet((s) => ({ ...s, palette: p }))}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <div className="sv-sheet-wrap">
                <PixelCanvas image={sheetImage} scale={SHEET_SCALE} label={t('svShowTiles')} />
                {sheet.highlight >= 0 && sheet.highlight < sheet.count && (
                  <div
                    className="sv-marker"
                    style={{
                      left: (sheet.highlight % sheet.columns) * 8 * SHEET_SCALE,
                      top: Math.floor(sheet.highlight / sheet.columns) * 8 * SHEET_SCALE,
                      width: 8 * SHEET_SCALE,
                      height: 8 * SHEET_SCALE,
                    }}
                  />
                )}
              </div>
            </div>
          )}

          {!isTitle && (
            <details className="sv-recipe">
              <summary>{t('svRecipe')}</summary>
              <div className="sv-mono">
                {t('svRecipeLoads')}: {view.loads.map(snes).join(' ')}
              </div>
              <div className="sv-mono">
                {t('svRecipePalettes')}: {view.palettes.map((y) => `$81:${hex(y)}`).join(' ')}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
