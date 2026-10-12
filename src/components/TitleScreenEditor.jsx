import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { useRom } from '../context/RomContext';
import { useConfirm, DraftGuard } from '../context/ConfirmContext';
import RomParser from '../rom/RomParser';
import { TEAMS, TITLE_SCREEN } from '../rom/constants';
import { adjustPalette, GRASS_PRESETS } from '../rom/palettes';
import { renderTitleScreen, renderPoseSheet } from '../rom/titleScreen';
import { buildBackground, buildBackgroundFitting } from '../rom/titleBackground';
import { OBJECT_LIMITS } from '../rom/titleObjects';
import { checkTitleTexts } from '../rom/titleScreenText';
import {
  buildLogo,
  buildLogoAuto,
  logoSize,
  originalTmTiles,
  LOGO_CAPACITY,
} from '../rom/titleLogo';
import { loadImageFile, prepareLogoImage, prepareImage } from '../utils/imageToLogo';
import { IconTitleScreen } from './Icons';
import { ColorSwatch, SwatchRow } from './ColorSwatch';
import '../styles/match-palettes.css';
import '../styles/title-screen.css';

/** Groups the quick adjustment can recolour */
const ADJUST_TARGETS = {
  logo: ['logoTop', 'logoBottom'],
  logoTop: ['logoTop'],
  logoBottom: ['logoBottom'],
  stroke: ['stroke'],
  all: ['logoTop', 'logoBottom', 'stroke', 'tm'],
};

/**
 * Logo colour themes: adjustment per part, applied to the original colours
 * (parts left out go back to the original).
 */
const LOGO_PRESETS = [
  { id: 'original', parts: {} },
  { id: 'brazil', parts: { stroke: { hue: 125, saturation: 1, lightness: 0.85 } } },
  {
    id: 'blue',
    parts: {
      logoBottom: { hue: 195, saturation: 1, lightness: 1 },
      stroke: { hue: 215, saturation: 1, lightness: 1 },
    },
  },
  {
    id: 'pink',
    parts: {
      logoBottom: { hue: -50, saturation: 1, lightness: 1.05 },
      stroke: { hue: -60, saturation: 1, lightness: 1 },
    },
  },
  {
    id: 'silver',
    parts: {
      logoTop: { hue: 0, saturation: 0, lightness: 1 },
      logoBottom: { hue: 0, saturation: 0, lightness: 1.1 },
      stroke: { hue: 0, saturation: 0, lightness: 0.8 },
    },
  },
];
const PRESET_PARTS = ['logoTop', 'logoBottom', 'stroke'];

function TitlePreview({ romParser, titleScreen, teams, pressStart, drafts, objects }) {
  const ref = useRef(null);
  // imports not applied yet (logo, background) are drawn from a copy of the ROM
  const active = drafts.filter(Boolean);
  const view = useMemo(() => {
    if (!active.length || !romParser) return null;
    const work = new RomParser(romParser.getRomData());
    work.originalData = romParser.getOriginalData();
    return active.every((d) => d.apply(work).ok) ? work : null;
    // drafts always has the same length (one slot per kind of import)
  }, [...drafts, romParser, titleScreen]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !romParser || !titleScreen) return;
    const rom = view || romParser;
    const base = view ? view.readTitleScreen() : titleScreen;
    // objects being dragged with a slider (not written yet)
    const state = objects ? { ...base, objects } : base;
    const { width, height, data } = renderTitleScreen(rom, state, { pressStart });
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').putImageData(new ImageData(data, width, height), 0, 0);
    // `teams` is a dependency on purpose: the players wear the teams' kits
  }, [romParser, titleScreen, teams, pressStart, view, objects]);
  return (
    <canvas ref={ref} className={`ts-canvas ${view ? 'draft' : ''}`} width={256} height={224} />
  );
}

/** Import a logo from an image: options, size report and apply / cancel / restore */
function LogoImport({ t, romParser, logo, draft, setDraft, onApply }) {
  const [img, setImg] = useState(null);
  const [fileName, setFileName] = useState('');
  const [opts, setOpts] = useState({
    scale: 1,
    removeBackground: false,
    tolerance: 24,
    colors: 'auto',
    keepTm: true,
    hideStroke: true,
  });
  const [result, setResult] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const fileRef = useRef(null);
  const set = (k, v) => setOpts((o) => ({ ...o, [k]: v }));

  const onFile = async (file) => {
    if (!file) return;
    try {
      const image = await loadImageFile(file);
      // images without transparency: key out the background colour by default
      const c = document.createElement('canvas');
      c.width = image.width;
      c.height = image.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(image, 0, 0);
      const { data } = ctx.getImageData(0, 0, image.width, image.height);
      let alpha = false;
      for (let i = 3; i < data.length && !alpha; i += 4) if (data[i] < 250) alpha = true;
      setOpts((o) => ({ ...o, removeBackground: !alpha, scale: 1 }));
      setImg(image);
      setFileName(file.name);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  };

  // build again whenever the image or an option changes
  useEffect(() => {
    if (!img || !romParser) return;
    const image = prepareLogoImage(img, opts);
    const options = { tm: opts.keepTm ? originalTmTiles(romParser) : null };
    const built =
      opts.colors === 'auto'
        ? buildLogoAuto(image, options)
        : (() => {
            const b = buildLogo(image, { ...options, colors: opts.colors });
            return b.ok
              ? { ...b, colors: opts.colors, size: logoSize(b), capacity: LOGO_CAPACITY }
              : b;
          })();
    const fits = built.ok && built.size <= LOGO_CAPACITY;
    setResult(fits ? built : { ...built, ok: false, error: built.error || 'logoNoSpace' });
    const options2 = { hideStroke: opts.hideStroke };
    setDraft(
      fits
        ? { built, options: options2, apply: (work) => work.importTitleLogo(built, options2) }
        : null,
    );
  }, [img, opts, romParser, setDraft]);

  const cancel = () => {
    setImg(null);
    setFileName('');
    setResult(null);
    setDraft(null);
    if (fileRef.current) fileRef.current.value = '';
  };
  const apply = () => {
    if (!draft) return;
    const res = onApply(draft.built, draft.options);
    if (res.ok) cancel();
    else setResult({ ...result, ok: false, ...res });
  };
  const err = (r) =>
    t(`tsErr_${r.error}`, {
      size: r.size ?? '?',
      capacity: r.capacity ?? LOGO_CAPACITY,
      sprites: r.sprites ?? '?',
      max: TITLE_SCREEN.LOGO.MAX_SPRITES,
    });

  return (
    <div className="ts-logo-import">
      <div className="detail-section-title ts-subtitle">{t('tsLogoImport')}</div>
      <p className="mp-hint">{t('tsLogoImportHelp')}</p>
      <div className="mp-presets">
        <button className="kit-btn active" onClick={() => fileRef.current?.click()}>
          {t('tsChooseImage')}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        {fileName && <span className="mp-hint">{fileName}</span>}
        <button
          className="kit-btn"
          disabled={logo.original}
          onClick={() => onApply(null)}
          title={t('tsRestoreLogoHelp')}
        >
          {t('tsRestoreLogo')}
        </button>
      </div>
      {loadError && <p className="mp-warning">{t('tsErr_logoLoad')}</p>}
      {img && (
        <>
          <div className="mp-sliders">
            <label className="mp-slider">
              <span>
                {t('tsLogoScale')}: {Math.round(opts.scale * 100)}%
              </span>
              <input
                type="range"
                min={0.3}
                max={1}
                step={0.05}
                value={opts.scale}
                onChange={(e) => set('scale', Number(e.target.value))}
              />
            </label>
            <label className="mp-slider">
              <span>{t('tsLogoColors')}</span>
              <select
                className="input-stat"
                value={opts.colors}
                onChange={(e) =>
                  set('colors', e.target.value === 'auto' ? 'auto' : Number(e.target.value))
                }
              >
                <option value="auto">{t('tsColorsAuto')}</option>
                {[15, 12, 10, 8, 6, 4, 3, 2].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            {opts.removeBackground && (
              <label className="mp-slider">
                <span>
                  {t('tsTolerance')}: {opts.tolerance}
                </span>
                <input
                  type="range"
                  min={0}
                  max={96}
                  step={4}
                  value={opts.tolerance}
                  onChange={(e) => set('tolerance', Number(e.target.value))}
                />
              </label>
            )}
          </div>
          <div className="mp-presets">
            {[
              ['removeBackground', 'tsRemoveBg'],
              ['keepTm', 'tsKeepTm'],
              ['hideStroke', 'tsHideStroke'],
            ].map(([k, label]) => (
              <label key={k} className="mp-check">
                <input
                  type="checkbox"
                  checked={opts[k]}
                  onChange={(e) => set(k, e.target.checked)}
                />
                {t(label)}
              </label>
            ))}
          </div>
          {result?.ok && (
            <p className="mp-hint">
              {t('tsLogoInfo', {
                sprites: result.sprites,
                max: TITLE_SCREEN.LOGO.MAX_SPRITES,
                size: result.size,
                capacity: result.capacity,
                colors: result.colors,
              })}
            </p>
          )}
          {result && !result.ok && <p className="mp-warning">{err(result)}</p>}
          <div className="mp-presets">
            <button className="kit-btn active" disabled={!draft} onClick={apply}>
              {t('tsApplyLogo')}
            </button>
            <button className="kit-btn" onClick={cancel}>
              {t('tsCancel')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
/** Copyright lines + PRESS START, applied together with a button */
function TitleTexts({ t, texts, original, onApply }) {
  const [copyright, setCopyright] = useState(texts.copyright);
  const [pressStart, setPressStart] = useState(texts.pressStart);
  const [result, setResult] = useState(null);
  const areaRef = useRef(null);
  useEffect(() => {
    setCopyright(texts.copyright);
    setPressStart(texts.pressStart);
  }, [texts.copyright, texts.pressStart]);

  const draft = { copyright, pressStart };
  const check = checkTitleTexts(draft);
  const changed =
    copyright.toUpperCase() !== texts.copyright || pressStart.toUpperCase() !== texts.pressStart;
  const insertCopyright = () => {
    const el = areaRef.current;
    const at = el ? el.selectionStart : copyright.length;
    const end = el ? el.selectionEnd : at;
    setCopyright(copyright.slice(0, at) + '©' + copyright.slice(end));
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(at + 1, at + 1);
    });
  };
  const isOriginal =
    texts.copyright === original.copyright && texts.pressStart === original.pressStart;
  const errorText = (res) =>
    t(`tsErr_${res.error}`, { chars: (res.invalid || []).join(' ') }) || res.error;

  const apply = (value) => {
    const res = onApply(value);
    setResult(res);
  };

  return (
    <div className="ts-texts">
      <DraftGuard dirty={changed} />
      <label className="mp-field ts-field">
        <span>{t('tsCopyrightText')}</span>
        <textarea
          className="ts-textarea"
          rows={3}
          spellCheck={false}
          value={copyright}
          ref={areaRef}
          onChange={(e) => setCopyright(e.target.value)}
        />
        <span className="mp-hint">
          {t('tsCopyrightChars')}{' '}
          <button type="button" className="kit-btn ts-insert" onClick={insertCopyright}>
            {t('tsInsertCopyright')}
          </button>
        </span>
      </label>
      <label className="mp-field ts-field">
        <span>{t('tsPressText')}</span>
        <input
          className="ts-input"
          spellCheck={false}
          value={pressStart}
          maxLength={32}
          onChange={(e) => setPressStart(e.target.value)}
        />
        <span className="mp-hint">{t('tsPressChars')}</span>
      </label>
      {check.error && <p className="mp-warning">{errorText(check)}</p>}
      {!check.error && result && !result.ok && <p className="mp-warning">{errorText(result)}</p>}
      <div className="mp-presets">
        <button
          className="kit-btn active"
          disabled={!changed || !!check.error}
          onClick={() => apply(draft)}
        >
          {t('tsApplyTexts')}
        </button>
        <button className="kit-btn" disabled={isOriginal} onClick={() => apply({ ...original })}>
          {t('mpRestore')}
        </button>
      </div>
    </div>
  );
}

const TOP_MODES = ['current', 'original', 'none', 'image'];
const GRASS_MODES = ['current', 'original', 'none', 'full', 'texture'];

/** Image file picker (button + hidden input) that hands back an HTMLImageElement */
function ImagePicker({ t, onImage, fileName }) {
  const ref = useRef(null);
  const [error, setError] = useState(false);
  return (
    <span className="ts-picker">
      <button className="kit-btn" onClick={() => ref.current?.click()}>
        {t('tsChooseImage')}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            onImage(await loadImageFile(file), file.name);
            setError(false);
          } catch {
            setError(true);
          }
          e.target.value = '';
        }}
      />
      {fileName && <span className="mp-hint">{fileName}</span>}
      {error && <span className="mp-warning">{t('tsErr_logoLoad')}</span>}
    </span>
  );
}

/** Brush stroke area and grass: keep, original, remove or image */
function BackgroundImport({ t, romParser, state, setDraft, onApply }) {
  const [top, setTop] = useState({ mode: 'current', img: null, name: '', scale: 1, bg: false });
  const [grass, setGrass] = useState({ mode: 'current', img: null, name: '', size: 32 });
  const [result, setResult] = useState(null);

  const needsImage = (p, modes) => modes.includes(p.mode) && !p.img;
  const pending =
    (top.mode !== 'current' || grass.mode !== 'current') &&
    !needsImage(top, ['image']) &&
    !needsImage(grass, ['full', 'texture']);

  useEffect(() => {
    if (!romParser || !pending) {
      setResult(null);
      setDraft(null);
      return;
    }
    const spec = {
      top:
        top.mode === 'image'
          ? {
              mode: 'image',
              image: prepareImage(top.img, {
                maxWidth: 256,
                maxHeight: 112,
                scale: top.scale,
                removeBackground: top.bg,
              }),
            }
          : { mode: top.mode },
      grass:
        grass.mode === 'full'
          ? {
              mode: 'image',
              image: prepareImage(grass.img, { width: 256, height: 112, cover: true }),
            }
          : grass.mode === 'texture'
            ? {
                mode: 'image',
                repeat: true,
                image: prepareImage(grass.img, {
                  width: grass.size,
                  height: grass.size,
                  cover: true,
                }),
              }
            : { mode: grass.mode },
    };
    const copy = () => {
      const work = new RomParser(romParser.getRomData());
      work.originalData = romParser.getOriginalData();
      return work;
    };
    const built = buildBackgroundFitting(romParser, spec, copy);
    const modes = { top: spec.top.mode, grass: spec.grass.mode };
    setResult(built);
    setDraft(
      built.ok ? { built, modes, apply: (work) => work.importTitleBackground(built, modes) } : null,
    );
  }, [romParser, top, grass, pending, setDraft]);

  const cancel = () => {
    setTop((p) => ({ ...p, mode: 'current', img: null, name: '' }));
    setGrass((p) => ({ ...p, mode: 'current', img: null, name: '' }));
  };
  const apply = () => {
    if (!result?.ok) return;
    const res = onApply(result, {
      top: top.mode === 'image' ? 'image' : top.mode,
      grass: ['full', 'texture'].includes(grass.mode) ? 'image' : grass.mode,
    });
    if (res.ok) cancel();
    else setResult({ ...res, ok: false });
  };

  return (
    <div className="ts-logo-import">
      <div className="detail-section-title ts-subtitle">{t('tsBgImport')}</div>
      <p className="mp-hint">
        {t('tsBgState', { top: t(`tsBgNow_${state.top}`), grass: t(`tsBgNow_${state.grass}`) })}
      </p>
      <div className="mp-presets">
        <label className="mp-field">
          <span>{t('tsBgTop')}</span>
          <select
            className="input-stat"
            value={top.mode}
            onChange={(e) => setTop((p) => ({ ...p, mode: e.target.value }))}
          >
            {TOP_MODES.map((m) => (
              <option key={m} value={m}>
                {t(`tsBgMode_${m}`)}
              </option>
            ))}
          </select>
        </label>
        {top.mode === 'image' && (
          <ImagePicker
            t={t}
            fileName={top.name}
            onImage={(img, name) => setTop((p) => ({ ...p, img, name }))}
          />
        )}
      </div>
      {top.mode === 'image' && top.img && (
        <div className="mp-sliders">
          <label className="mp-slider">
            <span>
              {t('tsLogoScale')}: {Math.round(top.scale * 100)}%
            </span>
            <input
              type="range"
              min={0.3}
              max={1}
              step={0.05}
              value={top.scale}
              onChange={(e) => setTop((p) => ({ ...p, scale: Number(e.target.value) }))}
            />
          </label>
          <label className="mp-check">
            <input
              type="checkbox"
              checked={top.bg}
              onChange={(e) => setTop((p) => ({ ...p, bg: e.target.checked }))}
            />
            {t('tsRemoveBg')}
          </label>
        </div>
      )}
      <div className="mp-presets">
        <label className="mp-field">
          <span>{t('tsBgGrass')}</span>
          <select
            className="input-stat"
            value={grass.mode}
            onChange={(e) => setGrass((p) => ({ ...p, mode: e.target.value }))}
          >
            {GRASS_MODES.map((m) => (
              <option key={m} value={m}>
                {t(`tsBgGrassMode_${m}`)}
              </option>
            ))}
          </select>
        </label>
        {['full', 'texture'].includes(grass.mode) && (
          <ImagePicker
            t={t}
            fileName={grass.name}
            onImage={(img, name) => setGrass((p) => ({ ...p, img, name }))}
          />
        )}
        {grass.mode === 'texture' && (
          <label className="mp-field ts-small-field">
            <span>{t('tsBgTextureSize')}</span>
            <select
              className="input-stat"
              value={grass.size}
              onChange={(e) => setGrass((p) => ({ ...p, size: Number(e.target.value) }))}
            >
              {[16, 32, 64].map((n) => (
                <option key={n} value={n}>
                  {n} x {n}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <p className="mp-hint">{t('tsBgHelp')}</p>
      {result?.ok && (
        <p className="mp-hint">
          {t('tsBgInfo', { tiles: result.tileCount, size: result.size, colors: result.colorCount })}
        </p>
      )}
      {result && !result.ok && (
        <p className="mp-warning">{t(`tsErr_${result.error}`) || result.error}</p>
      )}
      {pending && (
        <div className="mp-presets">
          <button className="kit-btn active" disabled={!result?.ok} onClick={apply}>
            {t('tsApplyBg')}
          </button>
          <button className="kit-btn" onClick={cancel}>
            {t('tsCancel')}
          </button>
        </div>
      )}
    </div>
  );
}

/** Grid of every pose of the game for one player; click to choose */
function PosePicker({ t, romParser, titleScreen, side, original, onPick, onClose }) {
  const ref = useRef(null);
  const sheet = useMemo(
    () => renderPoseSheet(romParser, titleScreen, side),
    [romParser, titleScreen, side],
  );
  const current = sheet.frames.indexOf(titleScreen.poses[side]);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = sheet.width;
    canvas.height = sheet.height;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(new ImageData(sheet.data, sheet.width, sheet.height), 0, 0);
    const [cw, ch] = sheet.cell;
    const mark = (k, color) => {
      if (k < 0) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(
        (k % sheet.columns) * cw + 0.5,
        Math.floor(k / sheet.columns) * ch + 0.5,
        cw - 1,
        ch - 1,
      );
    };
    mark(sheet.frames.indexOf(original), '#888');
    mark(current, '#4fc3f7');
  }, [sheet, current, original]);

  const pick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = sheet.width / rect.width;
    const [cw, ch] = sheet.cell;
    const col = Math.floor(((e.clientX - rect.left) * scale) / cw);
    const row = Math.floor(((e.clientY - rect.top) * scale) / ch);
    const k = row * sheet.columns + col;
    if (sheet.frames[k] !== undefined) onPick(sheet.frames[k]);
  };

  return (
    <div className="ts-pose-picker">
      <div className="mp-presets">
        <span>{t(`tsPoseOf_${side}`, { n: sheet.frames.length })}</span>
        <button className="kit-btn" onClick={() => onPick(original)}>
          {t('tsPoseOriginal')}
        </button>
        <button className="kit-btn" onClick={onClose}>
          {t('tsClose')}
        </button>
      </div>
      <div className="ts-pose-scroll">
        <canvas ref={ref} className="ts-pose-canvas" onClick={pick} />
      </div>
    </div>
  );
}

/**
 * Range + number input. While dragging, `onPreview` gets every value; the
 * value is committed (one undo step) on release, Enter or blur.
 */
function NumberSlider({ label, value, min, max, onPreview, onCommit, disabled }) {
  const [v, setV] = useState(value);
  const ref = useRef(null);
  const latest = useRef({ value, onCommit });
  latest.current = { value, onCommit };
  useEffect(() => setV(value), [value]);
  const commit = (n) => {
    const x = Math.max(min, Math.min(max, Math.round(Number(n))));
    if (Number.isFinite(x) && x !== latest.current.value) latest.current.onCommit(x);
    else setV(latest.current.value);
  };
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const onChange = (e) => commit(e.target.value);
    el.addEventListener('change', onChange);
    return () => el.removeEventListener('change', onChange);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <label className="mp-slider ts-num-slider">
      <span>{label}</span>
      <span className="ts-num-row">
        <input
          ref={ref}
          type="range"
          min={min}
          max={max}
          value={v}
          disabled={disabled}
          onChange={(e) => {
            setV(Number(e.target.value));
            onPreview(Number(e.target.value));
          }}
        />
        <input
          type="number"
          className="ts-num"
          min={min}
          max={max}
          value={v}
          disabled={disabled}
          onChange={(e) => setV(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commit(e.target.value)}
        />
      </span>
    </label>
  );
}

/** Ball, ball shadow, player shadows and player positions */
function ObjectsEditor({ t, objects, original, setDraft, onCommit }) {
  const [follow, setFollow] = useState(true);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  /** objects with one value changed (+ the shadows following the players) */
  const withValue = (part, key, value) => {
    const next = structuredClone(objects);
    if (part === 'players' && follow) {
      const d = value - objects.players[key];
      if (key === 'leftX') next.shadowLeft.x = clamp(next.shadowLeft.x + d, 'x');
      if (key === 'rightX') next.shadowRight.x = clamp(next.shadowRight.x + d, 'x');
      if (key === 'y') {
        next.shadowLeft.y = clamp(next.shadowLeft.y + d, 'y');
        next.shadowRight.y = clamp(next.shadowRight.y + d, 'y');
      }
    }
    next[part][key] = value;
    return next;
  };
  const clamp = (v, k) => Math.max(OBJECT_LIMITS[k][0], Math.min(OBJECT_LIMITS[k][1], v));
  const slider = (part, key, label, limits = OBJECT_LIMITS[key] || OBJECT_LIMITS.x) => (
    <NumberSlider
      key={`${part}.${key}`}
      label={label}
      value={objects[part][key]}
      min={limits[0]}
      max={limits[1]}
      onPreview={(v) => setDraft(withValue(part, key, v))}
      onCommit={(v) => {
        setDraft(null);
        onCommit(withValue(part, key, v));
      }}
    />
  );
  const height = objects.ball.z;
  const toggle = (part) => (
    <label className="mp-check">
      <input
        type="checkbox"
        checked={objects[part].visible}
        onChange={(e) =>
          onCommit({ ...objects, [part]: { ...objects[part], visible: e.target.checked } })
        }
      />
      {t(`tsShow_${part}`)}
    </label>
  );

  return (
    <div className="ts-logo-import">
      <div className="detail-section-title ts-subtitle">{t('tsObjects')}</div>
      <div className="ts-objects">
        <div className="ts-object">
          {toggle('ball')}
          {slider('ball', 'x', t('tsObjX'))}
          {slider('ball', 'y', t('tsObjGround'))}
          <NumberSlider
            label={t('tsObjHeight')}
            value={-height}
            min={0}
            max={-OBJECT_LIMITS.z[0]}
            onPreview={(v) => setDraft(withValue('ball', 'z', -v))}
            onCommit={(v) => {
              setDraft(null);
              onCommit(withValue('ball', 'z', -v));
            }}
          />
        </div>
        {['shadowLeft', 'shadowRight'].map((part) => (
          <div key={part} className="ts-object">
            {toggle(part)}
            {slider(part, 'x', t('tsObjX'))}
            {slider(part, 'y', t('tsObjY'))}
          </div>
        ))}
        <div className="ts-object">
          <span className="mp-swatch-label">{t('tsObjPlayers')}</span>
          {slider('players', 'leftX', t('tsObjLeftX'))}
          {slider('players', 'rightX', t('tsObjRightX'))}
          {slider('players', 'y', t('tsObjFeet'))}
          <label className="mp-check">
            <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
            {t('tsObjFollow')}
          </label>
        </div>
      </div>
      <div className="mp-presets">
        <button
          className="kit-btn"
          onClick={() => onCommit({ ...objects, ball: { ...objects.ball, z: 0 } })}
        >
          {t('tsBallOnGround')}
        </button>
        <button
          className="kit-btn"
          disabled={same(objects, original)}
          onClick={() => onCommit(structuredClone(original))}
        >
          {t('tsObjRestore')}
        </button>
      </div>
      <p className="mp-hint">{t('tsObjHelp')}</p>
    </div>
  );
}

export default function TitleScreenEditor() {
  const { t } = useI18n();
  const confirm = useConfirm();
  const {
    romParser,
    titleScreen,
    teams,
    handleTitleScreenChange,
    handleTitleTextsChange,
    handleTitleLogoChange,
    handleTitleBackgroundChange,
  } = useRom();
  const [logoDraft, setLogoDraft] = useState(null);
  const [bgDraft, setBgDraft] = useState(null);
  const [poseSide, setPoseSide] = useState(null);
  const [objectsDraft, setObjectsDraft] = useState(null);
  const [pressStart, setPressStart] = useState(true);
  const [adjust, setAdjust] = useState({ hue: 0, saturation: 1, lightness: 1 });
  const [target, setTarget] = useState('logo');

  const originals = useMemo(
    () => (romParser ? new RomParser(romParser.getOriginalData()).readTitleScreen() : null),
    [romParser],
  );

  if (!romParser || !titleScreen || !originals) {
    return <div className="editor-panel empty">{t('openRomToSee')}</div>;
  }

  const { colors } = titleScreen;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const isOriginal = (id) => same(colors[id], originals.colors[id]);

  const setColor = (id) => (index, raw) => {
    const next = [...colors[id]];
    next[index] = raw;
    handleTitleScreenChange({ [id]: next });
  };
  const restore = (...ids) => {
    const updates = {};
    ids.forEach((id) => {
      if (!isOriginal(id)) updates[id] = [...originals.colors[id]];
    });
    handleTitleScreenChange(updates);
  };
  const applyAdjust = (ids, adj) => {
    const updates = {};
    ids.forEach((id) => {
      updates[id] = adj ? adjustPalette(originals.colors[id], adj) : [...originals.colors[id]];
    });
    handleTitleScreenChange(updates);
  };
  const applyPreset = (preset) => {
    const updates = {};
    PRESET_PARTS.forEach((id) => {
      const adj = preset.parts[id];
      updates[id] = adj ? adjustPalette(originals.colors[id], adj) : [...originals.colors[id]];
    });
    handleTitleScreenChange(updates);
  };
  const restoreAll = async () => {
    const ok = await confirm({
      message: t('confirmTitleRestoreAll'),
      confirmLabel: t('tsRestoreAll'),
      danger: true,
    });
    if (!ok) return;
    const logoParts = ['logoTop', 'logoBottom'];
    const imported = titleScreen.logo?.original === false;
    // the logo (blocks + its colours) first, then everything else
    if (imported) handleTitleLogoChange(null);
    const bg = titleScreen.background;
    const bgCustom = bg && (bg.top !== 'original' || bg.grass !== 'original');
    if (bgCustom) {
      const modes = { top: 'original', grass: 'original' };
      const built = buildBackground(romParser, {
        top: { mode: 'original' },
        grass: { mode: 'original' },
      });
      if (built.ok) handleTitleBackgroundChange(built, modes);
    }
    const updates = {};
    Object.keys(colors).forEach((id) => {
      if (imported && logoParts.includes(id)) return;
      if (!isOriginal(id)) updates[id] = [...originals.colors[id]];
    });
    ['left', 'right'].forEach((side) => {
      const orig = originals.teams[side];
      if (orig !== null && orig !== titleScreen.teams[side]) updates[`team:${side}`] = orig;
      if (titleScreen.poses[side] !== originals.poses[side]) {
        updates[`pose:${side}`] = originals.poses[side];
      }
    });
    if (!same(titleScreen.objects, originals.objects)) updates.objects = originals.objects;
    handleTitleScreenChange(updates);
  };
  const allOriginal =
    Object.keys(colors).every(isOriginal) &&
    same(titleScreen.teams, originals.teams) &&
    same(titleScreen.poses, originals.poses) &&
    same(titleScreen.objects, originals.objects) &&
    titleScreen.background?.top === 'original' &&
    titleScreen.background?.grass === 'original' &&
    titleScreen.logo?.original !== false;

  const teamName = (i) => teams[i]?.name || TEAMS[i]?.name || '?';
  // presets and adjustments start from the Konami colours: only for the original logo
  const logoOriginal = titleScreen.logo?.original !== false;
  const targets = logoOriginal ? Object.keys(ADJUST_TARGETS) : ['stroke'];
  const adjustTarget = targets.includes(target) ? target : targets[0];

  const restoreButton = (ids) => (
    <button className="kit-btn" disabled={ids.every(isOriginal)} onClick={() => restore(...ids)}>
      {t('mpRestore')}
    </button>
  );

  return (
    <div className="editor-panel title-screen-editor">
      <div className="editor-header">
        <div className="editor-header-title">
          <span className="editor-icon">
            <IconTitleScreen size={18} />
          </span>
          <h2>{t('editorTitleScreen')}</h2>
          <span className="editor-subtitle">- {t('tsSubtitle')}</span>
        </div>
        <button className="kit-btn" disabled={allOriginal} onClick={restoreAll}>
          {t('tsRestoreAll')}
        </button>
      </div>

      <div className="ts-layout">
        <div className="ts-preview">
          <TitlePreview
            romParser={romParser}
            titleScreen={titleScreen}
            teams={teams}
            pressStart={pressStart}
            drafts={[logoDraft, bgDraft]}
            objects={objectsDraft}
          />
          {(logoDraft || bgDraft) && <p className="mp-warning">{t('tsLogoPreviewing')}</p>}
          <label className="mp-check">
            <input
              type="checkbox"
              checked={pressStart}
              onChange={(e) => setPressStart(e.target.checked)}
            />
            {t('tsShowPressStart')}
          </label>
          <p className="mp-hint">{t('tsPreviewHelp')}</p>
        </div>

        <div className="mp-body ts-body">
          {/* ---------------- Logo ---------------- */}
          <section className="detail-section mp-section">
            <div className="detail-section-title">{t('tsLogo')}</div>
            <p className="mp-hint">{t('tsLogoHelp')}</p>
            <SwatchRow
              label={t('tsLogoTop')}
              colors={colors.logoTop}
              onChange={setColor('logoTop')}
            />
            <SwatchRow
              label={t('tsLogoBottom')}
              colors={colors.logoBottom}
              onChange={setColor('logoBottom')}
            />
            <SwatchRow label={t('tsStroke')} colors={colors.stroke} onChange={setColor('stroke')} />
            <SwatchRow label={t('tsTm')} colors={colors.tm} onChange={setColor('tm')} />
            {logoOriginal && (
              <div className="mp-presets">
                <span>{t('tsLogoPresets')}</span>
                {LOGO_PRESETS.map((p) => (
                  <button key={p.id} className="kit-btn" onClick={() => applyPreset(p)}>
                    {t(`tsLogo_${p.id}`)}
                  </button>
                ))}
              </div>
            )}
            <div className="mp-sliders">
              <label className="mp-slider">
                <span>{t('tsAdjustTarget')}</span>
                <select
                  className="input-stat"
                  value={adjustTarget}
                  onChange={(e) => setTarget(e.target.value)}
                >
                  {targets.map((k) => (
                    <option key={k} value={k}>
                      {t(`tsTarget_${k}`)}
                    </option>
                  ))}
                </select>
              </label>
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
              <button
                className="kit-btn active"
                onClick={() => applyAdjust(ADJUST_TARGETS[adjustTarget], adjust)}
              >
                {t('mpApplyAdjust')}
              </button>
            </div>
            <p className="mp-hint">{t('tsAdjustHelp')}</p>
            <div className="mp-presets">
              {restoreButton(
                logoOriginal ? ['logoTop', 'logoBottom', 'stroke', 'tm'] : ['stroke', 'tm'],
              )}
            </div>
            <LogoImport
              t={t}
              romParser={romParser}
              logo={titleScreen.logo}
              draft={logoDraft}
              setDraft={setLogoDraft}
              onApply={handleTitleLogoChange}
            />
          </section>

          {/* ---------------- Background ---------------- */}
          <section className="detail-section mp-section">
            <div className="detail-section-title">{t('tsBackground')}</div>
            <div className="mp-referee-part">
              <span className="mp-swatch-label">{t('tsSky')}</span>
              <ColorSwatch raw={colors.sky[0]} onCommit={(v) => setColor('sky')(0, v)} />
              {restoreButton(['sky'])}
            </div>
            <p className="mp-hint">{t('tsSkyHelp')}</p>
            <SwatchRow
              label={t('mpGrassRow1')}
              colors={colors.grass.slice(0, 15)}
              onChange={setColor('grass')}
            />
            <SwatchRow
              label={t('mpGrassRow2')}
              colors={colors.grass.slice(15)}
              offset={15}
              onChange={setColor('grass')}
            />
            <div className="mp-presets">
              <span>{t('mpGrassPresets')}</span>
              {GRASS_PRESETS.map((p) => (
                <button
                  key={p.id}
                  className="kit-btn"
                  onClick={() => applyAdjust(['grass'], p.adjust)}
                >
                  {t(`mpGrass_${p.id}`)}
                </button>
              ))}
            </div>
            <p className="mp-hint">{t('tsGrassHelp')}</p>
            <BackgroundImport
              t={t}
              romParser={romParser}
              state={titleScreen.background}
              setDraft={setBgDraft}
              onApply={handleTitleBackgroundChange}
            />
          </section>

          {/* ---------------- Texts ---------------- */}
          <section className="detail-section mp-section">
            <div className="detail-section-title">{t('tsTexts')}</div>
            <TitleTexts
              t={t}
              texts={titleScreen.texts}
              original={originals.texts}
              onApply={handleTitleTextsChange}
            />
            <div className="mp-referee-part">
              <SwatchRow
                label={t('tsCopyright')}
                colors={colors.copyright}
                onChange={setColor('copyright')}
              />
              {restoreButton(['copyright'])}
            </div>
            <div className="mp-referee-part">
              <SwatchRow
                label={t('tsPressStart')}
                colors={colors.pressStart}
                onChange={setColor('pressStart')}
              />
              {restoreButton(['pressStart'])}
            </div>
            <p className="mp-hint">{t('tsTextsHelp')}</p>
          </section>

          {/* ---------------- Players ---------------- */}
          <section className="detail-section mp-section">
            <div className="detail-section-title">{t('tsPlayers')}</div>
            <div className="mp-crowd-header">
              {['left', 'right'].map((side) => (
                <label key={side} className="mp-field">
                  <span>{t(`tsTeam_${side}`)}</span>
                  <select
                    className="input-stat"
                    value={titleScreen.teams[side] ?? ''}
                    onChange={(e) =>
                      handleTitleScreenChange({ [`team:${side}`]: Number(e.target.value) })
                    }
                  >
                    {titleScreen.teams[side] === null && <option value="">?</option>}
                    {TEAMS.map((tm, i) => (
                      <option key={tm.id} value={i}>
                        {teamName(i)}
                        {i === originals.teams[side] ? ` (${t('tsOriginal')})` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="mp-presets">
              {['left', 'right'].map((side) => (
                <button
                  key={side}
                  className={`kit-btn ${poseSide === side ? 'active' : ''}`}
                  onClick={() => setPoseSide(poseSide === side ? null : side)}
                >
                  {t(`tsChoosePose_${side}`)}
                  {titleScreen.poses[side] !== originals.poses[side] ? ' *' : ''}
                </button>
              ))}
            </div>
            {poseSide && (
              <PosePicker
                t={t}
                romParser={romParser}
                titleScreen={titleScreen}
                side={poseSide}
                original={originals.poses[poseSide]}
                onPick={(y) =>
                  y !== titleScreen.poses[poseSide] &&
                  handleTitleScreenChange({ [`pose:${poseSide}`]: y })
                }
                onClose={() => setPoseSide(null)}
              />
            )}
            <p className="mp-hint">{t('tsPlayersHelp')}</p>
            <p className="mp-hint">{t('tsPoseHelp')}</p>
            <ObjectsEditor
              t={t}
              objects={titleScreen.objects}
              original={originals.objects}
              setDraft={setObjectsDraft}
              onCommit={(objects) => handleTitleScreenChange({ objects })}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
