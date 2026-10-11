import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { useRom } from '../context/RomContext';
import { menuTextLength, findInvalidMenuChars } from '../rom/menuScreens';

/** Menu screens: edit the text runs of the compressed tilemaps */
export default function MenuTextPanel() {
  const { t } = useI18n();
  const { menuScreens, handleMenuScreenChange } = useRom();
  const [selected, setSelected] = useState(0);
  const [draft, setDraft] = useState([]);
  const [message, setMessage] = useState(null);

  const screen = menuScreens[selected];

  useEffect(() => {
    if (screen) setDraft(screen.runs.map((r) => r.text));
  }, [screen]);

  if (!screen) return <div className="editor-panel empty">{t('openRomToSee')}</div>;

  const dirty = draft.some((v, i) => v !== screen.runs[i]?.text);
  const tooLong = draft.some((v, i) => menuTextLength(v) > (screen.runs[i]?.maxLength ?? 0));

  const apply = () => {
    const texts = Object.fromEntries(
      draft.map((v, i) => [i, v]).filter(([i, v]) => v !== screen.runs[i].text),
    );
    const res = handleMenuScreenChange(screen.offset, texts);
    setMessage(
      res.ok
        ? {
            ok: true,
            text: `${t('gtApplied')} (${res.size} / ${res.capacity} bytes)${res.moved ? ` - ${t('gtMenuMoved')}` : ''}`,
          }
        : { ok: false, text: `${t('gtMenuFull')} (${res.size} / ${res.capacity} bytes)` },
    );
  };

  return (
    <div className="scenario-body">
      <div className="scenario-list tournament-list">
        {menuScreens.map((s, i) => (
          <button
            key={s.id}
            className={`scenario-card tournament-card ${i === selected ? 'active' : ''}`}
            onClick={() => {
              setSelected(i);
              setMessage(null);
            }}
            title={s.runs.map((r) => r.text).join(' · ')}
          >
            <span className="tournament-card-teams">{t(`gtScreen_${s.id}`)}</span>
            <span />
            <span className="scenario-card-clock">{s.runs.length}</span>
          </button>
        ))}
      </div>

      <div className="scenario-form">
        <div className="detail-section">
          <div className="detail-section-title">
            {t(`gtScreen_${screen.id}`)}
            {screen.moved && <span className="gt-moved-badge">{t('gtMenuMoved')}</span>}
          </div>
          <div className="gt-menu-runs">
            {screen.runs.map((run, i) => {
              const value = draft[i] ?? '';
              const len = menuTextLength(value);
              const over = len > run.maxLength;
              const invalid = findInvalidMenuChars(value);
              return (
                <label key={`${run.row}-${run.col}`} className="gt-menu-run">
                  <span className="gt-menu-pos">
                    {run.row},{run.col}
                  </span>
                  <input
                    className={`gt-menu-input ${over || invalid.length ? 'over' : ''}`}
                    value={value}
                    spellCheck={false}
                    onChange={(e) => {
                      setMessage(null);
                      setDraft((d) => d.map((v, k) => (k === i ? e.target.value : v)));
                    }}
                  />
                  <span className={`gt-menu-len ${over ? 'over' : ''}`}>
                    {len}/{run.maxLength}
                  </span>
                  <span className="gt-menu-orig">{run.text !== value ? run.text : ''}</span>
                </label>
              );
            })}
          </div>
          <p className="scenario-hint">{t('gtMenuHelp')}</p>
        </div>

        {message && (
          <div className={message.ok ? 'scenario-msg-ok' : 'scenario-msg-error'}>
            {message.text}
          </div>
        )}

        <div className="scenario-actions">
          <button className="kit-btn active" onClick={apply} disabled={!dirty || tooLong}>
            {t('scenarioApply')}
          </button>
          <button
            className="kit-btn"
            onClick={() => setDraft(screen.runs.map((r) => r.text))}
            disabled={!dirty}
          >
            {t('scenarioDiscard')}
          </button>
        </div>
        <p className="scenario-hint">{t('gtMenuNotCovered')}</p>
      </div>
    </div>
  );
}
