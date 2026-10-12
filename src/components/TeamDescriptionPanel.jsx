import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { useRom } from '../context/RomContext';
import { DraftGuard } from '../context/ConfirmContext';
import {
  TEAM_DESC,
  TEAM_DESC_CAPACITY,
  TITLE_COLORS,
  wrapDescriptionBody,
  measureTeamDescriptions,
  withFormationInTitle,
} from '../rom/teamDescription';
import { findInvalidChars } from '../rom/scenario';

// Approximate in-game colours of the two title styles
const TITLE_PREVIEW = { 0x2c: '#f070b0', 0x24: '#f8d040' };

/**
 * Selection-screen description editor ("Offensive 4-4-2" + short text).
 * Shown in the Formation tab because the title normally names the formation.
 */
export default function TeamDescriptionPanel({ team, teamIndex }) {
  const { t } = useI18n();
  const { teams, handleTeamDescriptionChange } = useRom();
  const [draft, setDraft] = useState(team.description);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    setDraft(team.description);
  }, [team.description]);

  useEffect(() => {
    setMessage(null);
  }, [teamIndex]);

  const usage = useMemo(
    () => measureTeamDescriptions(teams.map((tm, i) => (i === teamIndex ? draft : tm.description))),
    [teams, teamIndex, draft],
  );

  if (!draft) return null;

  const lines = wrapDescriptionBody(draft.body);
  const tooLong = lines.length > TEAM_DESC.BODY_LINES;
  const over = usage > TEAM_DESC_CAPACITY;
  const invalid = findInvalidChars(`${draft.title}${draft.body}`);
  const dirty = JSON.stringify(draft) !== JSON.stringify(team.description);
  const formationName = team.formation?.name;
  const titleFormation = /\d-\d-\d/.exec(draft.title)?.[0];
  const formationMismatch = formationName && titleFormation && titleFormation !== formationName;

  const update = (patch) => {
    setMessage(null);
    setDraft((d) => ({ ...d, ...patch }));
  };

  const apply = () => {
    const res = handleTeamDescriptionChange(teamIndex, draft);
    setMessage(res.ok ? { ok: true, text: t('descApplied') } : { ok: false, text: t('descFull') });
  };

  return (
    <div className="detail-section team-desc">
      <DraftGuard dirty={dirty} />
      <div className="detail-section-title">{t('descTitle')}</div>

      <div className="team-desc-row">
        <div className="team-desc-fields">
          <label className="formation-field">
            <span>{t('descHeading')}</span>
            <input
              className="input-name"
              value={draft.title}
              maxLength={TEAM_DESC.COLUMNS}
              onChange={(e) => update({ title: e.target.value })}
            />
          </label>
          <label className="formation-field">
            <span>{t('descHeadingColor')}</span>
            <select
              className="input-stat"
              value={draft.titleColor}
              onChange={(e) => update({ titleColor: Number(e.target.value) })}
            >
              {TITLE_COLORS.map((c) => (
                <option key={c.id} value={c.id}>
                  {t(c.key)}
                </option>
              ))}
              {!TITLE_COLORS.some((c) => c.id === draft.titleColor) && (
                <option value={draft.titleColor}>0x{draft.titleColor.toString(16)}</option>
              )}
            </select>
          </label>
          <label className="formation-field">
            <span>{t('descBody')}</span>
            <textarea
              className="scenario-textarea team-desc-textarea"
              rows={6}
              value={draft.body}
              spellCheck={false}
              onChange={(e) => update({ body: e.target.value })}
            />
          </label>
        </div>

        <div className="team-desc-preview" aria-label={t('scenarioPreview')}>
          <div style={{ color: TITLE_PREVIEW[draft.titleColor] || '#f070b0' }}>
            {draft.title.padEnd(TEAM_DESC.COLUMNS, ' ')}
          </div>
          <div>{' '.repeat(TEAM_DESC.COLUMNS)}</div>
          {Array.from({ length: TEAM_DESC.BODY_LINES }).map((_, i) => (
            <div key={i}>{(lines[i] || '').padEnd(TEAM_DESC.COLUMNS, ' ')}</div>
          ))}
        </div>
      </div>

      <p className="formation-hint">
        {t('descHelp')} {t('scenarioTextSpace')}: {usage} / {TEAM_DESC_CAPACITY} bytes
      </p>
      {formationMismatch && (
        <div className="formation-warnings">
          {t('descFormationMismatch')} ({titleFormation} ≠ {formationName}){' '}
          <button
            className="kit-btn"
            onClick={() => update({ title: withFormationInTitle(draft.title, formationName) })}
          >
            {t('descUseFormation')} {formationName}
          </button>
        </div>
      )}
      {tooLong && <div className="formation-warnings">{t('descTooLong')}</div>}
      {invalid.length > 0 && (
        <div className="formation-warnings">
          {t('scenarioInvalidChars')}: {invalid.join(' ')}
        </div>
      )}
      {over && <div className="scenario-msg-error">{t('descFull')}</div>}
      {message && (
        <div className={message.ok ? 'scenario-msg-ok' : 'scenario-msg-error'}>{message.text}</div>
      )}

      <div className="scenario-actions">
        <button className="kit-btn active" onClick={apply} disabled={!dirty || over || tooLong}>
          {t('scenarioApply')}
        </button>
        <button className="kit-btn" onClick={() => setDraft(team.description)} disabled={!dirty}>
          {t('scenarioDiscard')}
        </button>
      </div>
    </div>
  );
}
