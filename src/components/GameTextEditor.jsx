import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { useRom } from '../context/RomContext';
import RomParser from '../rom/RomParser';
import { GAME_TEXTS } from '../rom/constants';
import {
  measureTrainingTexts,
  validateTrainingTexts,
  findInvalidBoxChars,
  findInvalidIssChars,
  layoutFixed,
  decodeIss,
} from '../rom/gameTexts';
import { wrapScenarioText } from '../rom/scenario';
import { IconTeamName } from './Icons';
import MenuTextPanel from './MenuTextPanel';
import ScreenTextPanel from './ScreenTextPanel';
import '../styles/scenario.css';
import '../styles/tournament.css';
import '../styles/game-texts.css';

const G = GAME_TEXTS;
const MODES = ['Dribble', 'Pass', 'Shoot', 'Defence', 'Corner Kick'];

/** All editable texts as a flat list of { key, group, label, kind, box } */
function buildItems(t) {
  const items = [];
  MODES.forEach((m, i) =>
    items.push({
      key: `titles.${i}`,
      group: 'gtGroupTitles',
      label: m,
      kind: 'fixed',
      box: { lines: 1, columns: G.TITLE_LENGTH },
    }),
  );
  MODES.forEach((m, i) =>
    items.push({
      key: `intros.${i}`,
      group: 'gtGroupIntros',
      label: m,
      kind: 'box',
      box: G.INTRO_BOX,
    }),
  );
  MODES.forEach((m, g) =>
    [0, 1, 2, 3].forEach((k) =>
      items.push({
        key: `results.${g}.${k}`,
        group: 'gtGroupResults',
        label: `${m} · ${t('gtGrade')} ${k + 1}`,
        kind: 'box',
        box: G.RESULT_BOX,
      }),
    ),
  );
  items.push({
    key: 'record',
    group: 'gtGroupResults',
    label: t('gtRecord'),
    kind: 'box',
    box: G.RESULT_BOX,
  });
  [0, 1, 2, 3].forEach((i) =>
    items.push({
      key: `messages.${i}`,
      group: 'gtGroupMessages',
      label: `${t('gtMessage')} ${i + 1}`,
      kind: 'fixed',
      box: G.MESSAGE_BOX,
    }),
  );
  return items;
}

const getPath = (obj, key) => key.split('.').reduce((o, k) => o?.[k], obj);
function setPath(obj, key, value) {
  const copy = structuredClone(obj);
  const parts = key.split('.');
  let o = copy;
  parts.slice(0, -1).forEach((p) => (o = o[p]));
  o[parts[parts.length - 1]] = value;
  return copy;
}

/** Lines exactly as the game will draw them */
function previewLines(item, text) {
  if (item.kind === 'box') return wrapScenarioText(text, item.box.columns);
  const { codes } = layoutFixed(text, item.box.lines, item.box.columns);
  const lines = [];
  for (let l = 0; l < item.box.lines; l++) {
    lines.push(decodeIss(codes.slice(l * item.box.columns, (l + 1) * item.box.columns)));
  }
  return lines;
}

export default function GameTextEditor() {
  const { t } = useI18n();
  const { romParser, gameTexts, handleGameTextsChange, handleExportTexts, handleImportTexts } =
    useRom();
  const [importResult, setImportResult] = useState(null);
  const [selected, setSelected] = useState('intros.0');
  const [draft, setDraft] = useState(null);
  const [message, setMessage] = useState(null);
  const [mode, setMode] = useState('training');

  const items = useMemo(() => buildItems(t), [t]);
  const originals = useMemo(
    () => (romParser ? new RomParser(romParser.getOriginalData()).readTrainingTexts() : null),
    [romParser],
  );

  useEffect(() => {
    if (gameTexts) setDraft(structuredClone(gameTexts));
  }, [gameTexts]);

  const usage = useMemo(() => (draft ? measureTrainingTexts(draft) : null), [draft]);
  const issues = useMemo(() => (draft ? validateTrainingTexts(draft) : []), [draft]);

  if (!romParser || !draft || !gameTexts) {
    return <div className="editor-panel empty">{t('openRomToSee')}</div>;
  }

  const item = items.find((i) => i.key === selected) || items[0];
  const value = getPath(draft, item.key) ?? '';
  const dirty = JSON.stringify(draft) !== JSON.stringify(gameTexts);
  const changed = (key) => getPath(draft, key) !== getPath(gameTexts, key);
  const lines = previewLines(item, value);
  const tooMany = lines.length > item.box.lines;
  const invalid = item.kind === 'box' ? findInvalidBoxChars(value) : findInvalidIssChars(value);

  const update = (text) => {
    setMessage(null);
    setDraft((d) => setPath(d, item.key, text));
  };

  const apply = () => {
    const res = handleGameTextsChange(draft);
    setMessage(res.ok ? { ok: true, text: t('gtApplied') } : { ok: false, text: t('gtInvalid') });
  };

  const groups = [...new Set(items.map((i) => i.group))];

  return (
    <div className="editor-panel scenario-editor game-text-editor">
      <div className="editor-header">
        <div className="editor-header-title">
          <span className="editor-icon">
            <IconTeamName size={18} />
          </span>
          <h2>{t('editorGameTexts')}</h2>
          <span className="editor-subtitle">- {t('gtSubtitle')}</span>
        </div>
        <div className="gt-mode">
          <button
            className={`kit-btn ${mode === 'training' ? 'active' : ''}`}
            onClick={() => setMode('training')}
          >
            {t('gtModeTraining')}
          </button>
          <button
            className={`kit-btn ${mode === 'menus' ? 'active' : ''}`}
            onClick={() => setMode('menus')}
          >
            {t('gtModeMenus')}
          </button>
          <button
            className={`kit-btn ${mode === 'screens' ? 'active' : ''}`}
            onClick={() => setMode('screens')}
          >
            {t('gtModeScreens')}
          </button>
          <span className="preview-actions-sep" />
          <button className="kit-btn" onClick={handleExportTexts} title={t('gtExportHelp')}>
            {t('gtExportJson')}
          </button>
          <button
            className="kit-btn"
            title={t('gtImportHelp')}
            onClick={async () => {
              const res = await handleImportTexts();
              if (res) setImportResult(res);
            }}
          >
            {t('gtImportJson')}
          </button>
        </div>
      </div>

      {importResult && (
        <div
          className={`gt-import-result ${
            !importResult.ok
              ? 'scenario-msg-error'
              : importResult.skipped?.length
                ? 'scenario-warnings'
                : 'scenario-msg-ok'
          }`}
        >
          <div className="gt-import-head">
            <strong>
              {importResult.ok
                ? t('gtImportOk', {
                    training: importResult.changed.training,
                    menus: importResult.changed.menus,
                    screens: importResult.changed.screens ?? 0,
                    scenarios: importResult.changed.scenarios,
                    descriptions: importResult.changed.teamDescriptions,
                  })
                : t('gtImportFailed')}
            </strong>
            <button className="kit-btn" onClick={() => setImportResult(null)}>
              ×
            </button>
          </div>
          {importResult.errors.map((m, i) => (
            <div key={`e${i}`} className="gt-import-line">
              {m}
            </div>
          ))}
          {importResult.skipped?.length > 0 && (
            <div className="gt-import-section">
              {t('gtImportSkipped', { count: importResult.skipped.length })}
            </div>
          )}
          {importResult.skipped?.map((m, i) => (
            <div key={`s${i}`} className="gt-import-line">
              {m}
            </div>
          ))}
          {importResult.moved?.length > 0 && (
            <div className="gt-import-section">
              {t('gtImportMoved', {
                screens: importResult.moved.map((id) => t(`gtScreen_${id}`)).join(', '),
              })}
            </div>
          )}
          {importResult.warnings.length > 0 && (
            <div className="gt-import-section">{t('gtImportWarnings')}</div>
          )}
          {importResult.warnings.map((m, i) => (
            <div key={`w${i}`} className="gt-import-line gt-import-warn">
              {m}
            </div>
          ))}
        </div>
      )}

      {mode === 'menus' ? (
        <MenuTextPanel />
      ) : mode === 'screens' ? (
        <ScreenTextPanel />
      ) : (
        <div className="scenario-body">
          <div className="scenario-list tournament-list">
            {groups.map((g) => (
              <div key={g}>
                <div className="tournament-group-title gt-group-title">{t(g)}</div>
                {items
                  .filter((i) => i.group === g)
                  .map((i) => (
                    <button
                      key={i.key}
                      className={`scenario-card tournament-card ${i.key === selected ? 'active' : ''}`}
                      onClick={() => setSelected(i.key)}
                      title={getPath(draft, i.key)}
                    >
                      <span className="tournament-card-teams">{i.label}</span>
                      <span />
                      {changed(i.key) && <span className="tournament-card-warn">*</span>}
                    </button>
                  ))}
              </div>
            ))}
          </div>

          <div className="scenario-form">
            <div className="detail-section">
              <div className="detail-section-title">
                {t(item.group)} · {item.label}
              </div>
              <div className="scenario-text-row">
                <textarea
                  className="scenario-textarea"
                  rows={Math.max(3, item.box.lines)}
                  value={value}
                  onChange={(e) => update(e.target.value)}
                  spellCheck={false}
                />
                <div className="scenario-preview" aria-label={t('scenarioPreview')}>
                  {Array.from({ length: item.box.lines }).map((_, i) => (
                    <div key={i} className="scenario-preview-line">
                      {(lines[i] || '').padEnd(item.box.columns, ' ')}
                    </div>
                  ))}
                  {tooMany && <div className="scenario-preview-overflow">{t('gtTooLong')}</div>}
                </div>
              </div>
              <p className="scenario-hint">
                {item.kind === 'box'
                  ? t('gtBoxHelp', { lines: item.box.lines, columns: item.box.columns })
                  : t('gtFixedHelp', { lines: item.box.lines, columns: item.box.columns })}
              </p>
              {invalid.length > 0 && (
                <p className="scenario-warning">
                  {t('scenarioInvalidChars')}: {invalid.join(' ')}
                </p>
              )}
            </div>

            <div
              className={`scenario-capacity ${issues.some((i) => i.kind.endsWith('Full')) ? 'over' : ''}`}
            >
              {t('gtSpaceIntros')}: {usage.intro} / {usage.introCapacity} bytes ·{' '}
              {t('gtSpaceResults')}: {usage.result} / {usage.resultCapacity} bytes
            </div>

            {issues.length > 0 && <div className="scenario-warnings">{t('gtInvalid')}</div>}
            {message && (
              <div className={message.ok ? 'scenario-msg-ok' : 'scenario-msg-error'}>
                {message.text}
              </div>
            )}

            <div className="scenario-actions">
              <button
                className="kit-btn active"
                onClick={apply}
                disabled={!dirty || issues.length > 0}
              >
                {t('scenarioApply')}
              </button>
              <button
                className="kit-btn"
                onClick={() => setDraft(structuredClone(gameTexts))}
                disabled={!dirty}
              >
                {t('scenarioDiscard')}
              </button>
              <button
                className="kit-btn"
                onClick={() => originals && update(getPath(originals, item.key))}
              >
                {t('scenarioRestore')}
              </button>
              <button
                className="kit-btn"
                onClick={() => originals && setDraft(structuredClone(originals))}
              >
                {t('tournamentRestoreAll')}
              </button>
            </div>

            <p className="scenario-hint">{t('gtMenusNote')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
