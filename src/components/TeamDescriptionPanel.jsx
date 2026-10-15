import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { useRom } from '../context/RomContext';
import { useToast } from '../context/ToastContext';
import { DraftGuard } from '../context/ConfirmContext';
import {
  TEAM_DESC,
  TEAM_DESC_CAPACITY,
  TITLE_COLORS,
  wrapDescriptionBody,
  measureTeamDescriptions,
  withFormationInTitle,
  encodeTeamDescription,
  readTeamDescriptionRaw,
} from '../rom/teamDescription';
import { findInvalidChars } from '../rom/scenario';
import GameTextPreview from './GameTextPreview';
import { originalTeams } from '../utils/originalTeams';

/**
 * Selection-screen description editor ("Offensive 4-4-2" + short text).
 * Shown in the Formation tab because the title normally names the formation.
 */
export default function TeamDescriptionPanel({ team, teamIndex }) {
  const { t } = useI18n();
  const toast = useToast();
  const { teams, romParser, handleTeamDescriptionChange } = useRom();
  const [draft, setDraft] = useState(team.description);
  // the description of the ROM as loaded (goes to the draft: Apply writes it)
  const original = useMemo(
    () => originalTeams(romParser)[teamIndex]?.description || null,
    [romParser, teamIndex],
  );

  useEffect(() => {
    setDraft(team.description);
  }, [team.description]);

  const usage = useMemo(
    () =>
      measureTeamDescriptions(
        teams.map((tm, i) => (i === teamIndex ? draft : tm.description)),
        romParser,
      ),
    [teams, teamIndex, draft, romParser],
  );

  // What the game draws: the exact ROM bytes while unchanged (they may colour words
  // inside the body), the encoded draft once edited
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(team.description);
  const previewBytes = useMemo(() => {
    if (!draft) return [];
    if (!dirty && romParser) return readTeamDescriptionRaw(romParser, teamIndex);
    return encodeTeamDescription(draft);
  }, [draft, dirty, romParser, teamIndex]);

  if (!draft) return null;

  const lines = wrapDescriptionBody(draft.body);
  const tooLong = lines.length > TEAM_DESC.BODY_LINES;
  const over = usage > TEAM_DESC_CAPACITY;
  const invalid = findInvalidChars(`${draft.title}${draft.body}`);
  const formationName = team.formation?.name;
  const titleFormation = /\d-\d-\d/.exec(draft.title)?.[0];
  const formationMismatch = formationName && titleFormation && titleFormation !== formationName;

  const update = (patch) => {
    setDraft((d) => ({ ...d, ...patch }));
  };

  const apply = () => {
    const res = handleTeamDescriptionChange(teamIndex, draft);
    toast[res.ok ? 'success' : 'error'](t(res.ok ? 'descApplied' : 'descFull'));
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
          <GameTextPreview
            kind="bytes"
            bytes={previewBytes}
            box={{ lines: TEAM_DESC.LINES, columns: TEAM_DESC.COLUMNS }}
            palette="selection"
            label={t('scenarioPreview')}
          />
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

      <div className="scenario-actions">
        <button
          className="kit-btn active"
          onClick={apply}
          disabled={!dirty || over || tooLong || invalid.length > 0}
        >
          {t('scenarioApply')}
        </button>
        <button className="kit-btn" onClick={() => setDraft(team.description)} disabled={!dirty}>
          {t('scenarioDiscard')}
        </button>
        <button
          className="kit-btn"
          onClick={() => original && update(original)}
          disabled={!original || JSON.stringify(draft) === JSON.stringify(original)}
        >
          {t('restoreOriginal')}
        </button>
      </div>
    </div>
  );
}
