import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { useRom } from '../context/RomContext';
import { DraftGuard, useConfirm } from '../context/ConfirmContext';
import RomParser from '../rom/RomParser';
import { MENU_BACKGROUND } from '../rom/constants';
import { adjustPalette } from '../rom/palettes';
import { renderScreenView, SCREEN_VIEWS } from '../rom/screenView';
import {
  buildMenuBackground,
  buildMenuBackgroundFitting,
  readMenuBackground,
} from '../rom/menuBackground';
import { prepareImage } from '../utils/imageToLogo';
import { IconMenuBackground } from './Icons';
import { SwatchRow } from './ColorSwatch';
import PixelCanvas from './PixelCanvas';
import ImagePicker from './ImagePicker';

const PALETTE_ID = 'menuBackground';
/** Menu screens of the screen viewer (they all load the background) */
const VIEWS = SCREEN_VIEWS.filter((v) => v.loads);
/** Layers hidden by "background only" */
const BG_ONLY = { bg1: false, bg3: false, obj: false, math: false, texts: false };
const NO_ADJUST = { hue: 0, saturation: 1, lightness: 1 };
/** Scroll options (MENU_BACKGROUND.SCROLL); 'normal' is the original speed */
const SCROLL_SPEEDS = ['fixed', 'slow', 'normal', 'fast'];

/** Colour themes: adjustments of the original (blue) colours */
const PRESETS = [
  { id: 'original', adjust: null },
  { id: 'red', adjust: { hue: 145, saturation: 1, lightness: 1 } },
  { id: 'green', adjust: { hue: -95, saturation: 1, lightness: 1 } },
  { id: 'purple', adjust: { hue: 60, saturation: 1, lightness: 1 } },
  { id: 'gold', adjust: { hue: -170, saturation: 1.1, lightness: 1.05 } },
  { id: 'gray', adjust: { hue: 0, saturation: 0, lightness: 1 } },
  { id: 'dark', adjust: { hue: 0, saturation: 1, lightness: 0.6 } },
];

const copyOf = (romParser) => () => {
  const work = new RomParser(romParser.getRomData());
  work.originalData = romParser.getOriginalData();
  return work;
};

/** A menu screen drawn from the ROM, or from a copy with the import not applied yet */
function Preview({
  romParser,
  viewId,
  onlyBackground,
  scroll,
  draft,
  menuScreens,
  palettes,
  label,
}) {
  const work = useMemo(() => {
    if (!draft) return null;
    const copy = copyOf(romParser)();
    return copy.importMenuBackground(draft).ok ? copy : null;
    // menuScreens / palettes change with every edit of the blocks and colours (undo included)
  }, [draft, romParser, menuScreens, palettes]); // eslint-disable-line react-hooks/exhaustive-deps
  const image = useMemo(() => {
    const view = VIEWS.find((v) => v.id === viewId) || VIEWS[0];
    return renderScreenView(work || romParser, view, {
      layers: onlyBackground ? BG_ONLY : {},
      // the game puts $1910 - 1 in VOFS: 0 is the top of the pattern on line 0 (fixed)
      scroll: { bg2: [0, scroll - 1] },
    });
  }, [work, romParser, viewId, onlyBackground, scroll, menuScreens, palettes]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <PixelCanvas
      image={image}
      scale={2}
      label={label}
      className={`ts-canvas ${work ? 'draft' : ''}`}
    />
  );
}

/** Texture or image: options, result and apply / cancel */
function BackgroundImport({ t, romParser, setDraft, onApply }) {
  const [mode, setMode] = useState('texture');
  const [img, setImg] = useState(null);
  const [name, setName] = useState('');
  const [size, setSize] = useState(32);
  const [colors, setColors] = useState(15);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!img || !romParser) {
      setResult(null);
      setDraft(null);
      return;
    }
    const side = mode === 'texture' ? size : 256;
    const image = prepareImage(img, { width: side, height: side, cover: true });
    const built = buildMenuBackgroundFitting(romParser, { mode, image, colors }, copyOf(romParser));
    setResult(built);
    setDraft(built.ok ? built : null);
  }, [img, mode, size, colors, romParser, setDraft]);

  const cancel = () => {
    setImg(null);
    setName('');
  };
  const apply = () => {
    if (!result?.ok) return;
    const res = onApply(result);
    if (res.ok) cancel();
    else setResult({ ...res, ok: false });
  };

  return (
    <div className="ts-logo-import">
      <DraftGuard dirty={!!img} />
      <div className="detail-section-title ts-subtitle">{t('mbgImport')}</div>
      <div className="mp-presets">
        <label className="mp-field">
          <span>{t('mbgMode')}</span>
          <select className="input-stat" value={mode} onChange={(e) => setMode(e.target.value)}>
            {['texture', 'image'].map((m) => (
              <option key={m} value={m}>
                {t(`mbgMode_${m}`)}
              </option>
            ))}
          </select>
        </label>
        {mode === 'texture' && (
          <label className="mp-field ts-small-field">
            <span>{t('tsBgTextureSize')}</span>
            <select
              className="input-stat"
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
            >
              {MENU_BACKGROUND.TEXTURE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n} x {n}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="mp-field ts-small-field">
          <span>{t('mbgColors')}</span>
          <select
            className="input-stat"
            value={colors}
            onChange={(e) => setColors(Number(e.target.value))}
          >
            {[15, 12, 10, 8, 6, 4, 3, 2].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <ImagePicker
          t={t}
          fileName={name}
          onImage={(image, fileName) => {
            setImg(image);
            setName(fileName);
          }}
        />
      </div>
      <p className="mp-hint">{t(`mbgHelp_${mode}`)}</p>
      {result?.ok && (
        <p className="mp-hint">
          {t('mbgInfo', {
            tiles: result.tileCount - 1,
            max: MENU_BACKGROUND.MAX_TILES,
            size: result.size,
            colors: result.colorCount,
          })}
        </p>
      )}
      {result && !result.ok && <p className="mp-warning">{t(result.error || 'mbgErrNoSpace')}</p>}
      {img && (
        <div className="mp-presets">
          <button className="kit-btn active" disabled={!result?.ok} onClick={apply}>
            {t('mbgApply')}
          </button>
          <button className="kit-btn" onClick={cancel}>
            {t('tsCancel')}
          </button>
        </div>
      )}
    </div>
  );
}

export default function MenuBackgroundEditor() {
  const { t } = useI18n();
  const confirm = useConfirm();
  const {
    romParser,
    matchPalettes,
    menuScreens,
    handleMatchPaletteChange,
    handleMenuBackgroundChange,
    menuScroll,
    handleMenuScrollChange,
  } = useRom();
  const [viewId, setViewId] = useState('prematch');
  const [onlyBackground, setOnlyBackground] = useState(false);
  const [scroll, setScroll] = useState(0);
  const [draft, setDraft] = useState(null);
  const [adjust, setAdjust] = useState(NO_ADJUST);
  const [error, setError] = useState(null);

  const originals = useMemo(
    () => (romParser ? new RomParser(romParser.getOriginalData()).readMatchPalettes() : null),
    [romParser],
  );
  const originalScroll = useMemo(
    () => (romParser ? new RomParser(romParser.getOriginalData()).readMenuScroll() : null),
    [romParser],
  );
  // re-read whenever the blocks (menu screens) or the colours change, undo included
  const state = useMemo(
    () => (romParser ? readMenuBackground(romParser) : null),
    [romParser, menuScreens, matchPalettes], // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (!romParser || !matchPalettes || !originals || !state) {
    return <div className="editor-panel empty">{t('openRomToSee')}</div>;
  }

  const colors = matchPalettes[PALETTE_ID];
  const colorsOriginal = JSON.stringify(colors) === JSON.stringify(originals[PALETTE_ID]);
  const patternOriginal = state.state === 'original';
  const scrollOriginal = menuScroll === originalScroll;

  const setColor = (index, raw) => {
    const next = [...colors];
    next[index] = raw;
    handleMatchPaletteChange(PALETTE_ID, next);
  };
  const applyPreset = (p) =>
    handleMatchPaletteChange(
      PALETTE_ID,
      p.adjust ? adjustPalette(originals[PALETTE_ID], p.adjust) : [...originals[PALETTE_ID]],
    );
  const applySliders = () => {
    handleMatchPaletteChange(PALETTE_ID, adjustPalette(colors, adjust));
    setAdjust(NO_ADJUST);
  };
  const apply = (built) => {
    const res = handleMenuBackgroundChange(built);
    setError(res.ok ? null : res.error);
    return res;
  };
  const restorePattern = () => apply(buildMenuBackground(romParser, { mode: 'original' }));
  const restoreAll = async () => {
    const ok = await confirm({
      message: t('mbgConfirmRestoreAll'),
      confirmLabel: t('tsRestoreAll'),
      danger: true,
    });
    if (!ok) return;
    // back to the original pattern also brings back the original colours
    if (!patternOriginal) restorePattern();
    else if (!colorsOriginal) handleMatchPaletteChange(PALETTE_ID, [...originals[PALETTE_ID]]);
    if (!scrollOriginal && SCROLL_SPEEDS.includes(originalScroll)) {
      handleMenuScrollChange(originalScroll);
    }
  };

  return (
    <div className="editor-panel title-screen-editor">
      <div className="editor-header">
        <div className="editor-header-title">
          <span className="editor-icon">
            <IconMenuBackground size={18} />
          </span>
          <h2>{t('editorMenuBackground')}</h2>
          <span className="editor-subtitle">- {t('mbgSubtitle')}</span>
        </div>
        <button
          className="kit-btn danger"
          disabled={patternOriginal && colorsOriginal && scrollOriginal}
          onClick={restoreAll}
        >
          {t('tsRestoreAll')}
        </button>
      </div>

      <div className="ts-layout">
        <div className="ts-preview">
          <Preview
            romParser={romParser}
            viewId={viewId}
            onlyBackground={onlyBackground}
            scroll={scroll}
            draft={draft}
            menuScreens={menuScreens}
            palettes={matchPalettes}
            label={t(`svScreen_${viewId}`)}
          />
          {draft && <p className="mp-warning">{t('mbgPreviewing')}</p>}
          <label className="mp-field">
            <span>{t('mbgScreen')}</span>
            <select
              className="input-stat"
              value={viewId}
              onChange={(e) => setViewId(e.target.value)}
            >
              {VIEWS.map((v) => (
                <option key={v.id} value={v.id}>
                  {t(`svScreen_${v.id}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="mp-slider">
            <span>
              {t('mbgScroll')}: {scroll}
            </span>
            <input
              type="range"
              min={0}
              max={255}
              value={scroll}
              onChange={(e) => setScroll(Number(e.target.value))}
            />
          </label>
          <label className="mp-check">
            <input
              type="checkbox"
              checked={onlyBackground}
              onChange={(e) => setOnlyBackground(e.target.checked)}
            />
            {t('mbgOnlyBackground')}
          </label>
          <p className="mp-hint">{t('mbgPreviewHelp')}</p>
        </div>

        <div className="mp-body ts-body">
          {/* ---------------- Colours ---------------- */}
          <section className="detail-section mp-section">
            <div className="detail-section-title">{t('mbgColorsTitle')}</div>
            <SwatchRow label={t('mbgPalette')} colors={colors} onChange={setColor} />
            {patternOriginal && (
              <div className="mp-presets">
                <span>{t('mbgPresets')}</span>
                {PRESETS.map((p) => (
                  <button key={p.id} className="kit-btn" onClick={() => applyPreset(p)}>
                    {t(`mbgPreset_${p.id}`)}
                  </button>
                ))}
              </div>
            )}
            <div className="mp-sliders">
              {[
                ['hue', -180, 180, 1],
                ['saturation', 0, 2, 0.05],
                ['lightness', 0.5, 1.5, 0.05],
              ].map(([key, min, max, step]) => (
                <label key={key} className="mp-slider">
                  <span>
                    {t(`mp_${key}`)}: {adjust[key]}
                  </span>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={adjust[key]}
                    onChange={(e) => setAdjust((a) => ({ ...a, [key]: Number(e.target.value) }))}
                  />
                </label>
              ))}
              <button className="kit-btn active" onClick={applySliders}>
                {t('mpApplyAdjust')}
              </button>
            </div>
            <p className="mp-hint">{t('mbgColorsHelp')}</p>
            <div className="mp-presets">
              <button
                className="kit-btn"
                disabled={colorsOriginal}
                onClick={() => handleMatchPaletteChange(PALETTE_ID, [...originals[PALETTE_ID]])}
              >
                {t('mpRestore')}
              </button>
            </div>
          </section>

          {/* ---------------- Movement ---------------- */}
          <section className="detail-section mp-section">
            <div className="detail-section-title">{t('mbgMovement')}</div>
            {menuScroll === null ? (
              <p className="mp-warning">{t('mbgErrScrollCode')}</p>
            ) : (
              <>
                <div className="mp-toggle-group" role="group" aria-label={t('mbgMovement')}>
                  {SCROLL_SPEEDS.map((s) => (
                    <button
                      key={s}
                      className={`kit-btn ${menuScroll === s ? 'active' : ''}`}
                      aria-pressed={menuScroll === s}
                      onClick={() => {
                        const res = handleMenuScrollChange(s);
                        setError(res.ok ? null : res.error);
                        if (res.ok && s === 'fixed') setScroll(0);
                      }}
                    >
                      {t(`mbgSpeed_${s}`)}
                    </button>
                  ))}
                </div>
                {menuScroll === 'custom' && <p className="mp-hint">{t('mbgSpeedCustom')}</p>}
                <p className="mp-hint">{t('mbgMovementHelp')}</p>
              </>
            )}
          </section>

          {/* ---------------- Pattern ---------------- */}
          <section className="detail-section mp-section">
            <div className="detail-section-title">{t('mbgPattern')}</div>
            <p className="mp-hint">
              {t(patternOriginal ? 'mbgState_original' : 'mbgState_custom', {
                tiles: state.tileCount - 1,
                size: state.size,
              })}
              {state.moved ? ` ${t('mbgMoved')}` : ''}
            </p>
            <div className="mp-presets">
              <button className="kit-btn" disabled={patternOriginal} onClick={restorePattern}>
                {t('mbgRestorePattern')}
              </button>
            </div>
            {error && <p className="mp-warning">{t(error)}</p>}
            <BackgroundImport t={t} romParser={romParser} setDraft={setDraft} onApply={apply} />
          </section>
        </div>
      </div>
    </div>
  );
}
