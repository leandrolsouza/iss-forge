import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { useRom } from '../context/RomContext';
import RomParser from '../rom/RomParser';
import { SCREEN_TEXTS } from '../rom/constants';
import {
  encodeScreenField,
  measureScreenPacks,
  screenTextCells,
  validateScreenTexts,
} from '../rom/screenTexts';
import { decodeIss, layoutFixed } from '../rom/gameTexts';
import { wrapScenarioText } from '../rom/scenario';
import { MENU_SPRITE_CHARS } from '../rom/menuSprites';
import { TITLE_CHARS } from '../rom/titleScreens';

/** Lines as the game draws them (fixed texts with several lines, boxes) */
function previewLines(field, text) {
  if (field.kind === 'box') return wrapScenarioText(text, field.columns);
  const { codes } = layoutFixed(text, field.lines, field.columns);
  return Array.from({ length: field.lines }, (_, l) =>
    decodeIss(codes.slice(l * field.columns, (l + 1) * field.columns)),
  );
}

/** Texts drawn by code: joypad controls, scenario screen, cup group line, ... */
export default function ScreenTextPanel() {
  const { t } = useI18n();
  const { romParser, screenTexts, handleScreenTextsChange } = useRom();
  const [selected, setSelected] = useState(SCREEN_TEXTS[0].id);
  const [draft, setDraft] = useState(null);
  const [message, setMessage] = useState(null);

  const originals = useMemo(
    () => (romParser ? new RomParser(romParser.getOriginalData()).readScreenTexts() : null),
    [romParser],
  );

  useEffect(() => {
    if (screenTexts) setDraft(structuredClone(screenTexts));
  }, [screenTexts]);

  if (!draft || !screenTexts) return <div className="editor-panel empty">{t('openRomToSee')}</div>;

  const screen = SCREEN_TEXTS.find((s) => s.id === selected) || SCREEN_TEXTS[0];
  const issues = validateScreenTexts(draft);
  const packs = measureScreenPacks(draft);
  const dirty = JSON.stringify(draft) !== JSON.stringify(screenTexts);
  const screenDirty = (id) => JSON.stringify(draft[id]) !== JSON.stringify(screenTexts[id]);

  const update = (fieldId, value) => {
    setMessage(null);
    setDraft((d) => ({ ...d, [screen.id]: { ...d[screen.id], [fieldId]: value } }));
  };

  const apply = () => {
    const res = handleScreenTextsChange(draft);
    setMessage(res.ok ? { ok: true, text: t('gtApplied') } : { ok: false, text: t('gtInvalid') });
  };

  const usedPacks = [...new Set(screen.fields.map((f) => f.pack).filter(Boolean))];

  return (
    <div className="scenario-body">
      <div className="scenario-list tournament-list">
        {SCREEN_TEXTS.map((s) => (
          <button
            key={s.id}
            className={`scenario-card tournament-card ${s.id === screen.id ? 'active' : ''}`}
            onClick={() => {
              setSelected(s.id);
              setMessage(null);
            }}
          >
            <span className="tournament-card-teams">{t(`st_${s.id}`)}</span>
            <span />
            {screenDirty(s.id) ? (
              <span className="tournament-card-warn">*</span>
            ) : (
              <span className="scenario-card-clock">{s.fields.length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="scenario-form">
        <div className="detail-section">
          <div className="detail-section-title">{t(`st_${screen.id}`)}</div>
          <div className="gt-menu-runs">
            {screen.fields.map((f) => {
              const value = draft[screen.id][f.id] ?? '';
              const res = encodeScreenField(f, value);
              const bad = Boolean(res.error) || res.invalid.length > 0;
              const multi = f.kind === 'box' || f.kind === 'title' || f.lines > 1;
              const label = t(`stf_${screen.id}_${f.id}`);
              const original = originals?.[screen.id]?.[f.id];
              if (f.kind === 'sprite') {
                return (
                  <label key={f.id} className="gt-menu-run" title={label}>
                    <span className="gt-menu-pos gt-screen-label">{label}</span>
                    <input
                      className={`gt-menu-input ${bad ? 'over' : ''}`}
                      value={value}
                      spellCheck={false}
                      onChange={(e) => update(f.id, e.target.value.toUpperCase())}
                    />
                    <span className={`gt-menu-len ${res.error ? 'over' : ''}`}>
                      {128 + res.right}
                    </span>
                    <span className="gt-menu-orig">
                      {res.invalid.length
                        ? `${t('scenarioInvalidChars')}: ${res.invalid.join(' ')}`
                        : t('stSpriteWidth', { x: 128 + res.right, sprites: res.sprites })}
                    </span>
                  </label>
                );
              }
              if (f.kind === 'title') {
                return (
                  <div key={f.id} className="gt-screen-box">
                    <div className="gt-screen-box-title">
                      {label}
                      <span className="gt-menu-orig">
                        {' '}
                        {t('stTitleWidth', { widths: res.widths.join(', ') })}
                        {original !== value ? ` · ${original.replace(/\n/g, ' / ')}` : ''}
                      </span>
                    </div>
                    <textarea
                      className={`scenario-textarea ${bad ? 'over' : ''}`}
                      rows={3}
                      value={value}
                      spellCheck={false}
                      onChange={(e) => update(f.id, e.target.value.toUpperCase())}
                    />
                    {res.invalid.length > 0 && (
                      <p className="scenario-warning">
                        {t('scenarioInvalidChars')}: {res.invalid.join(' ')}
                      </p>
                    )}
                  </div>
                );
              }
              if (!multi) {
                return (
                  <label key={f.id} className="gt-menu-run" title={label}>
                    <span className="gt-menu-pos gt-screen-label">{label}</span>
                    <input
                      className={`gt-menu-input ${bad ? 'over' : ''}`}
                      value={value}
                      spellCheck={false}
                      onChange={(e) => update(f.id, e.target.value)}
                    />
                    <span className={`gt-menu-len ${res.error ? 'over' : ''}`}>
                      {screenTextCells(value)}/{f.columns}
                    </span>
                    <span className="gt-menu-orig">{original !== value ? original : ''}</span>
                  </label>
                );
              }
              const lines = previewLines(f, value);
              return (
                <div key={f.id} className="gt-screen-box">
                  <div className="gt-screen-box-title">
                    {label}
                    <span className="gt-menu-orig">
                      {' '}
                      {f.kind === 'box'
                        ? t('stBoxLimit', { lines: f.lines, columns: f.columns })
                        : t('stFixedLimit', { lines: f.lines, columns: f.columns })}
                      {f.room ? ` · ${res.bytes?.length ?? '?'}/${f.room} bytes` : ''}
                    </span>
                  </div>
                  <div className="scenario-text-row">
                    <textarea
                      className={`scenario-textarea ${bad ? 'over' : ''}`}
                      rows={Math.max(2, f.lines)}
                      value={value}
                      spellCheck={false}
                      onChange={(e) => update(f.id, e.target.value)}
                    />
                    <div className="scenario-preview" aria-label={t('scenarioPreview')}>
                      {Array.from({ length: f.lines }).map((_, i) => (
                        <div key={i} className="scenario-preview-line">
                          {(lines[i] || '').padEnd(f.columns, ' ')}
                        </div>
                      ))}
                      {lines.length > f.lines && (
                        <div className="scenario-preview-overflow">{t('gtTooLong')}</div>
                      )}
                    </div>
                  </div>
                  {res.invalid.length > 0 && (
                    <p className="scenario-warning">
                      {t('scenarioInvalidChars')}: {res.invalid.join(' ')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <p className="scenario-hint">
            {screen.id === 'mainMenu'
              ? t('stSpriteHelp', { chars: MENU_SPRITE_CHARS })
              : screen.id === 'titles'
                ? t('stTitleHelp', { chars: TITLE_CHARS })
                : t('stHelp')}
          </p>
        </div>

        {usedPacks.map((p) => (
          <div
            key={p}
            className={`scenario-capacity ${packs[p].used > packs[p].capacity ? 'over' : ''}`}
          >
            {t(`stPack_${p}`)}: {packs[p].used} / {packs[p].capacity} bytes
          </div>
        ))}

        {issues
          .filter((i) => i.error === 'fontFull' && screen.id === 'mainMenu')
          .map((i) => (
            <div key={i.letters.join()} className="scenario-warnings">
              {t('stFontFull', { letters: i.letters.join(' ') })}
            </div>
          ))}
        {issues.length > 0 && <div className="scenario-warnings">{t('gtInvalid')}</div>}
        {message && (
          <div className={message.ok ? 'scenario-msg-ok' : 'scenario-msg-error'}>
            {message.text}
          </div>
        )}

        <div className="scenario-actions">
          <button className="kit-btn active" onClick={apply} disabled={!dirty || issues.length > 0}>
            {t('scenarioApply')}
          </button>
          <button
            className="kit-btn"
            onClick={() => setDraft(structuredClone(screenTexts))}
            disabled={!dirty}
          >
            {t('scenarioDiscard')}
          </button>
          <button
            className="kit-btn"
            onClick={() =>
              originals &&
              setDraft((d) => ({ ...d, [screen.id]: structuredClone(originals[screen.id]) }))
            }
          >
            {t('scenarioRestore')}
          </button>
        </div>
      </div>
    </div>
  );
}
