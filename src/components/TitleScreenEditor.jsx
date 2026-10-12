import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { useRom } from '../context/RomContext';
import RomParser from '../rom/RomParser';
import { TEAMS, TITLE_SCREEN } from '../rom/constants';
import { adjustPalette, GRASS_PRESETS } from '../rom/palettes';
import { renderTitleScreen } from '../rom/titleScreen';
import { checkTitleTexts } from '../rom/titleScreenText';
import {
  buildLogo,
  buildLogoAuto,
  logoSize,
  originalTmTiles,
  LOGO_CAPACITY,
} from '../rom/titleLogo';
import { loadImageFile, prepareLogoImage } from '../utils/imageToLogo';
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

function TitlePreview({ romParser, titleScreen, teams, pressStart, draft }) {
  const ref = useRef(null);
  // an imported logo not applied yet is drawn from a copy of the ROM
  const view = useMemo(() => {
    if (!draft || !romParser) return null;
    const work = new RomParser(romParser.getRomData());
    work.originalData = romParser.getOriginalData();
    const res = work.importTitleLogo(draft.built, draft.options);
    return res.ok ? work : null;
  }, [draft, romParser, titleScreen]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !romParser || !titleScreen) return;
    const rom = view || romParser;
    const state = view ? view.readTitleScreen() : titleScreen;
    const { width, height, data } = renderTitleScreen(rom, state, { pressStart });
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').putImageData(new ImageData(data, width, height), 0, 0);
    // `teams` is a dependency on purpose: the players wear the teams' kits
  }, [romParser, titleScreen, teams, pressStart, view]);
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
    setDraft(fits ? { built, options: { hideStroke: opts.hideStroke } } : null);
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

export default function TitleScreenEditor() {
  const { t } = useI18n();
  const {
    romParser,
    titleScreen,
    teams,
    handleTitleScreenChange,
    handleTitleTextsChange,
    handleTitleLogoChange,
  } = useRom();
  const [logoDraft, setLogoDraft] = useState(null);
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
  const restoreAll = () => {
    const logoParts = ['logoTop', 'logoBottom'];
    const imported = titleScreen.logo?.original === false;
    // the logo (blocks + its colours) first, then everything else
    if (imported) handleTitleLogoChange(null);
    const updates = {};
    Object.keys(colors).forEach((id) => {
      if (imported && logoParts.includes(id)) return;
      if (!isOriginal(id)) updates[id] = [...originals.colors[id]];
    });
    ['left', 'right'].forEach((side) => {
      const orig = originals.teams[side];
      if (orig !== null && orig !== titleScreen.teams[side]) updates[`team:${side}`] = orig;
    });
    handleTitleScreenChange(updates);
  };
  const allOriginal =
    Object.keys(colors).every(isOriginal) &&
    same(titleScreen.teams, originals.teams) &&
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
            draft={logoDraft}
          />
          {logoDraft && <p className="mp-warning">{t('tsLogoPreviewing')}</p>}
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
            <p className="mp-hint">{t('tsPlayersHelp')}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
