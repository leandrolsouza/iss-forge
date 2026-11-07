import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { useRom } from '../context/RomContext';
import { DraftGuard, useConfirm } from '../context/ConfirmContext';
import RomParser from '../rom/RomParser';
import { COIN_TOSS } from '../rom/constants';
import { adjustPalette, hexToRaw, rawToHex, tintPalette } from '../rom/palettes';
import {
  COIN_FACES,
  COIN_IMAGE,
  buildCoinFace,
  coinDrawable,
  coinShared,
  paintCoinFace,
  renderCoinFace,
  syncCoinShared,
} from '../rom/coinToss';
import { prepareImage } from '../utils/imageToLogo';
import { IconCoin } from './Icons';
import { SwatchRow } from './ColorSwatch';
import PixelCanvas from './PixelCanvas';
import ImagePicker from './ImagePicker';

const PALETTE_ID = 'coinToss';
/** Dark green of the choice boxes (grass darkened by colour math in the game); preview only */
const BOX = 0x00c3;
const PIXEL = 14;
const ALL_POINTS = Array.from({ length: COIN_TOSS.WIDTH * COIN_TOSS.HEIGHT }, (_, i) => ({
  x: i % COIN_TOSS.WIDTH,
  y: Math.floor(i / COIN_TOSS.WIDTH),
}));

/** Colour themes, applied to the original colours */
const PRESETS = [
  { id: 'original' },
  { id: 'gold', tint: '#f8c000' },
  { id: 'bronze', tint: '#c06828' },
  { id: 'silver', adjust: { hue: 0, saturation: 0, lightness: 1.05 } },
];

/** Both faces as the game shows them, on the colour of the choice boxes */
function FacePreviews({ t, faces, colors, scale = 5 }) {
  const images = useMemo(
    () => COIN_FACES.map((f) => renderCoinFace(faces[f], colors, { backdrop: BOX })),
    [faces, colors],
  );
  return (
    <div className="coin-previews">
      {COIN_FACES.map((f, i) => (
        <figure key={f} className="coin-preview">
          <PixelCanvas image={images[i]} scale={scale} label={t(`coinFace_${f}`)} />
          <figcaption>{t(`coinFace_${f}`)}</figcaption>
        </figure>
      ))}
    </div>
  );
}

/** Image -> one face (current or new colours), preview, apply / cancel */
function CoinImport({ t, faces, colors, onApply }) {
  const [img, setImg] = useState(null);
  const [name, setName] = useState('');
  const [face, setFace] = useState('heads');
  const [mode, setMode] = useState('current');
  const [count, setCount] = useState(15);
  const [removeBackground, setRemoveBackground] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!img) {
      setResult(null);
      return;
    }
    const image = prepareImage(img, { ...COIN_IMAGE, cover: true, removeBackground });
    setResult(
      buildCoinFace({ image, face, faces, colors, newColors: mode === 'new', maxColors: count }),
    );
  }, [img, face, mode, count, removeBackground, faces, colors]);

  const cancel = () => {
    setImg(null);
    setName('');
  };
  const apply = () => {
    if (!result?.ok) return;
    const res = onApply(result.faces, mode === 'new' ? result.colors : null);
    if (res.ok) cancel();
    else setResult({ ...res, ok: false });
  };

  return (
    <div className="ts-logo-import">
      <DraftGuard dirty={!!img} />
      <div className="detail-section-title ts-subtitle">{t('coinImport')}</div>
      <div className="mp-presets">
        <label className="mp-field ts-small-field">
          <span>{t('coinImportFace')}</span>
          <select className="input-stat" value={face} onChange={(e) => setFace(e.target.value)}>
            {COIN_FACES.map((f) => (
              <option key={f} value={f}>
                {t(`coinFace_${f}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="mp-field">
          <span>{t('coinImportColors')}</span>
          <select className="input-stat" value={mode} onChange={(e) => setMode(e.target.value)}>
            {['current', 'new'].map((m) => (
              <option key={m} value={m}>
                {t(`coinImportColors_${m}`)}
              </option>
            ))}
          </select>
        </label>
        {mode === 'new' && (
          <label className="mp-field ts-small-field">
            <span>{t('coinImportCount')}</span>
            <select
              className="input-stat"
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            >
              {[15, 12, 10, 8, 6, 4, 3, 2].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
        <ImagePicker
          t={t}
          fileName={name}
          onImage={(image, fileName) => {
            setImg(image);
            setName(fileName);
          }}
        />
      </div>
      <label className="mp-check">
        <input
          type="checkbox"
          checked={removeBackground}
          onChange={(e) => setRemoveBackground(e.target.checked)}
        />
        {t('coinRemoveBackground')}
      </label>
      <p className="mp-hint">{t('coinImportHelp')}</p>
      {result?.ok && (
        <>
          <div className="mp-hint">{t('coinImportPreview')}</div>
          <FacePreviews t={t} faces={result.faces} colors={result.colors} scale={4} />
        </>
      )}
      {result && !result.ok && (
        <p className="mp-warning">{t(result.error || 'coinErrFaces', result)}</p>
      )}
      {img && (
        <div className="mp-presets">
          <button className="kit-btn active" disabled={!result?.ok} onClick={apply}>
            {t('coinApply')}
          </button>
          <button className="kit-btn" onClick={cancel}>
            {t('tsCancel')}
          </button>
        </div>
      )}
    </div>
  );
}

export default function CoinTossEditor() {
  const { t } = useI18n();
  const confirm = useConfirm();
  const { romParser, coinToss, matchPalettes, handleCoinTossChange, handleMatchPaletteChange } =
    useRom();
  const [face, setFace] = useState('heads');
  const [brush, setBrush] = useState(1);
  const [stroke, setStroke] = useState(null);
  const strokeRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState(null);

  const originals = useMemo(() => {
    if (!romParser) return null;
    const orig = new RomParser(romParser.getOriginalData());
    return { coin: orig.readCoinToss(), colors: orig.readMatchPalettes()[PALETTE_ID] };
  }, [romParser]);

  if (!romParser || !matchPalettes || !originals) {
    return <div className="editor-panel empty">{t('openRomToSee')}</div>;
  }

  const header = (
    <div className="editor-header-title">
      <span className="editor-icon">
        <IconCoin size={18} />
      </span>
      <h2>{t('editorMatchCoin')}</h2>
      <span className="editor-subtitle">- {t('coinSubtitle')}</span>
    </div>
  );
  if (!coinToss) {
    return (
      <div className="editor-panel title-screen-editor">
        <div className="editor-header">{header}</div>
        <div className="mp-body">
          <p className="mp-warning">{t('coinErrLayout')}</p>
        </div>
      </div>
    );
  }

  const colors = matchPalettes[PALETTE_ID];
  const faces = stroke || coinToss.faces;
  const grid = faces[face];
  const colorsOriginal = JSON.stringify(colors) === JSON.stringify(originals.colors);
  const drawingOriginal = coinToss.state === 'original';
  const hex = (c) => (c ? rawToHex(colors[c - 1] ?? 0) : rawToHex(BOX));

  const commit = (next, nextColors = null) => {
    const res = handleCoinTossChange(next, nextColors);
    setError(res.ok ? null : res);
    return res;
  };

  // A brush stroke is painted locally and written (one undo step) on mouse up
  const paint = (x, y) => {
    const base = strokeRef.current || coinToss.faces;
    const next = paintCoinFace(base, face, [{ x, y }], brush);
    if (next === base) return;
    strokeRef.current = next;
    setStroke(next);
  };
  const endStroke = () => {
    if (!drawing) return;
    setDrawing(false);
    const painted = strokeRef.current;
    strokeRef.current = null;
    setStroke(null);
    if (painted) commit(painted);
  };

  const clearFace = async () => {
    const ok = await confirm({
      message: t('coinConfirmClear', { face: t(`coinFace_${face}`) }),
      confirmLabel: t('coinClearFace'),
      danger: true,
    });
    if (ok) commit(paintCoinFace(coinToss.faces, face, ALL_POINTS, 0));
  };
  const restoreFace = () => {
    if (!originals.coin) return;
    commit(syncCoinShared({ ...coinToss.faces, [face]: originals.coin.faces[face] }, face));
  };
  const restoreAll = async () => {
    const ok = await confirm({
      message: t('coinConfirmRestoreAll'),
      confirmLabel: t('tsRestoreAll'),
      danger: true,
    });
    if (!ok) return;
    if (originals.coin) commit(originals.coin.faces, [...originals.colors]);
    else handleMatchPaletteChange(PALETTE_ID, [...originals.colors]);
  };

  const setColor = (index, raw) => {
    const next = [...colors];
    next[index] = raw;
    handleMatchPaletteChange(PALETTE_ID, next);
  };
  const applyPreset = (p) => {
    const base = originals.colors;
    let next = [...base];
    if (p.tint) next = tintPalette(base, hexToRaw(p.tint));
    else if (p.adjust) next = adjustPalette(base, p.adjust);
    handleMatchPaletteChange(PALETTE_ID, next);
  };

  return (
    <div className="editor-panel title-screen-editor">
      <div className="editor-header">
        {header}
        <button
          className="kit-btn danger"
          disabled={drawingOriginal && colorsOriginal}
          onClick={restoreAll}
        >
          {t('tsRestoreAll')}
        </button>
      </div>

      <div className="ts-layout">
        <div className="ts-preview">
          <div className="detail-section-title">{t('coinPreview')}</div>
          <FacePreviews t={t} faces={faces} colors={colors} />
          <p className="mp-hint">{t('coinPreviewHelp')}</p>
        </div>

        <div className="mp-body ts-body">
          {/* ---------------- Drawing ---------------- */}
          <section className="detail-section mp-section">
            <div className="detail-section-title">{t('coinDrawing')}</div>
            <div className="mp-toggle-group" role="group" aria-label={t('coinFace')}>
              <span>{t('coinFace')}</span>
              {COIN_FACES.map((f) => (
                <button
                  key={f}
                  className={`kit-btn ${face === f ? 'active' : ''}`}
                  aria-pressed={face === f}
                  onClick={() => setFace(f)}
                >
                  {t(`coinFace_${f}`)}
                </button>
              ))}
            </div>
            <div className="coin-brushes" role="group" aria-label={t('coinBrush')}>
              {Array.from({ length: 16 }, (_, c) => (
                <button
                  key={c}
                  className={`flag-palette-btn coin-brush ${brush === c ? 'active' : ''}`}
                  style={{ backgroundColor: hex(c) }}
                  aria-pressed={brush === c}
                  title={c ? `#${c} ${hex(c)}` : t('transparent')}
                  onClick={() => setBrush(c)}
                >
                  {c ? '' : '✕'}
                </button>
              ))}
            </div>
            <div
              className="flag-design-grid coin-grid"
              style={{
                gridTemplateColumns: `repeat(${COIN_TOSS.WIDTH}, ${PIXEL}px)`,
                gridTemplateRows: `repeat(${COIN_TOSS.HEIGHT}, ${PIXEL}px)`,
              }}
              onMouseUp={endStroke}
              onMouseLeave={endStroke}
            >
              {grid.map((row, y) =>
                row.map((c, x) => {
                  if (!coinDrawable(x, y))
                    return <div key={`${x},${y}`} className="coin-pixel off" />;
                  return (
                    <div
                      key={`${x},${y}`}
                      className={`coin-pixel ${coinShared(x, y) ? 'shared' : ''}`}
                      style={{ backgroundColor: hex(c) }}
                      onMouseDown={(e) => {
                        if (e.button !== 0) return;
                        e.preventDefault();
                        strokeRef.current = null;
                        setDrawing(true);
                        paint(x, y);
                      }}
                      onMouseEnter={() => drawing && paint(x, y)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setBrush(c);
                      }}
                    />
                  );
                }),
              )}
            </div>
            <p className="mp-hint">{t('coinGridHelp')}</p>
            <div className="mp-presets">
              <button className="kit-btn danger" onClick={clearFace}>
                {t('coinClearFace')}
              </button>
              <button className="kit-btn" disabled={!originals.coin} onClick={restoreFace}>
                {t('coinRestoreFace')}
              </button>
            </div>
            <p className="mp-hint">
              {t(drawingOriginal ? 'coinState_original' : 'coinState_custom', coinToss)}
            </p>
            {error && <p className="mp-warning">{t(error.error || 'coinErrFaces', error)}</p>}
            <CoinImport t={t} faces={coinToss.faces} colors={colors} onApply={commit} />
          </section>

          {/* ---------------- Colours ---------------- */}
          <section className="detail-section mp-section">
            <div className="detail-section-title">{t('coinColorsTitle')}</div>
            <SwatchRow label={t('coinPalette')} colors={colors} onChange={setColor} />
            <div className="mp-presets">
              <span>{t('coinPresets')}</span>
              {PRESETS.map((p) => (
                <button key={p.id} className="kit-btn" onClick={() => applyPreset(p)}>
                  {t(`coinPreset_${p.id}`)}
                </button>
              ))}
            </div>
            <p className="mp-hint">{t('coinColorsHelp')}</p>
            <div className="mp-presets">
              <button
                className="kit-btn"
                disabled={colorsOriginal}
                onClick={() => handleMatchPaletteChange(PALETTE_ID, [...originals.colors])}
              >
                {t('mpRestore')}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
