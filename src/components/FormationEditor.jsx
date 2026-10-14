import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { useRom } from '../context/RomContext';
import { useConfirm } from '../context/ConfirmContext';
import { FORMATION_PRESETS, FORMATION_ROLES, FORMATION_DATA } from '../rom/constants';
import {
  getFormationName,
  getPositionLabel,
  positionText,
  getLineCategory,
  getPresetSlots,
  withRole,
  validateFormation,
} from '../rom/formation';
import { IconFormation } from './Icons';
import DraftInput from './DraftInput';
import '../styles/formation.css';

// Pitch geometry (SVG units). Own goal at the bottom, attacking upwards.
const W = 320;
const H = 440;
const PAD = 14;
const FIELD_W = W - PAD * 2;
const FIELD_H = H - PAD * 2;
const LATERAL_STEPS = 16;
const MAX_DEPTH = FORMATION_DATA.MAX_DEPTH;

const toX = (lateral) => PAD + ((lateral + 0.5) / LATERAL_STEPS) * FIELD_W;
const toY = (depth) => PAD + FIELD_H - (depth / MAX_DEPTH) * FIELD_H;
const fromX = (x) => Math.round(((x - PAD) / FIELD_W) * LATERAL_STEPS - 0.5);
const fromY = (y) => Math.round(((PAD + FIELD_H - y) / FIELD_H) * MAX_DEPTH);

const LINE_COLORS = { gk: '#4fc3f7', def: '#81c784', mid: '#ffb74d', fwd: '#ef5350' };

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export default function FormationEditor({ team, teamIndex, onFormationChange, onSwapPlayers }) {
  const { t, lang } = useI18n();
  const { romParser } = useRom();
  const confirm = useConfirm();
  const svgRef = useRef(null);
  const [draft, setDraft] = useState(team?.formation?.slots || []);
  const [selected, setSelected] = useState(1);
  const [dragging, setDragging] = useState(null); // { slot, moved }
  const [presetId, setPresetId] = useState(FORMATION_PRESETS[0].id);

  // Keep the local draft in sync with ROM state (team switch, undo/redo, presets)
  useEffect(() => {
    if (!dragging) setDraft(team?.formation?.slots || []);
  }, [team, dragging]);

  const warnings = useMemo(() => (draft.length ? validateFormation(draft) : []), [draft]);

  if (!team || !team.formation || draft.length !== FORMATION_DATA.SLOTS) {
    return <div className="editor-panel empty">{t('selectTeamToEdit')}</div>;
  }

  const players = team.players;
  const slot = draft[selected];

  const commit = (slots) => {
    setDraft(slots);
    onFormationChange(teamIndex, slots);
  };

  const updateSlot = (index, patch) => {
    const slots = draft.map((s, i) => (i === index ? { ...s, ...patch } : s));
    // nothing changed (e.g. a value clamped back to the stored one): no write, no undo step
    if (slots.every((s, i) => JSON.stringify(s) === JSON.stringify(draft[i]))) return;
    commit(slots);
  };

  // Number fields (DraftInput) commit on Enter/blur; an emptied field keeps the stored value
  const commitNumber = (min, max, toPatch) => (value) => {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) return;
    updateSlot(selected, toPatch(clamp(parsed, min, max)));
  };

  // --- Drag & drop on the pitch ---
  const svgPoint = (e) => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };

  const handlePointerDown = (e, index) => {
    // Commit a number being typed into the current slot before selecting another one
    // (the input would only blur after the selection changed)
    if (document.activeElement instanceof HTMLInputElement) document.activeElement.blur();
    setSelected(index);
    if (index === 0) return; // goalkeeper stays on the goal line
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragging({ slot: index, moved: false });
  };

  const handlePointerMove = (e) => {
    if (!dragging) return;
    const p = svgPoint(e);
    const lateral = clamp(fromX(p.x), 0, FORMATION_DATA.MAX_LATERAL);
    const depth = clamp(fromY(p.y), 1, MAX_DEPTH);
    setDraft((prev) =>
      prev.map((s, i) => {
        if (i !== dragging.slot || (s.lateral === lateral && s.depth === depth)) return s;
        return { ...s, lateral, depth };
      }),
    );
    if (!dragging.moved) setDragging({ ...dragging, moved: true });
  };

  const handlePointerUp = () => {
    if (!dragging) return;
    const { moved } = dragging;
    setDragging(null);
    if (moved) onFormationChange(teamIndex, draft);
  };

  // --- Actions ---
  const applyPreset = async () => {
    const preset = FORMATION_PRESETS.find((p) => p.id === presetId);
    const ok = await confirm({
      message: t('confirmFormationPreset', { name: preset ? presetLabel(preset) : presetId }),
      confirmLabel: t('formationApplyPreset'),
    });
    if (ok) commit(getPresetSlots(presetId));
  };

  const restoreOriginal = async () => {
    if (!romParser) return;
    const ok = await confirm({
      message: t('confirmFormationRestore'),
      confirmLabel: t('formationRestore'),
    });
    if (ok) commit(romParser.readOriginalFormation(teamIndex));
  };

  const mirror = () =>
    commit(draft.map((s, i) => (i === 0 ? s : { ...s, lateral: clamp(14 - s.lateral, 0, 15) })));

  const swapWith = (otherIndex) => {
    if (otherIndex !== selected) onSwapPlayers(teamIndex, selected, otherIndex);
  };

  const presetLabel = (p) => (lang === 'en' && p.nameEn ? p.nameEn : p.name);
  const roleLabel = (r) => `${positionText(r.short, t)} — ${t(r.key)}`;

  return (
    <div className="editor-panel formation-editor">
      <div className="editor-header">
        <div className="editor-header-title">
          <span className="editor-icon">
            <IconFormation size={18} />
          </span>
          <h2>{team.name}</h2>
          <span className="editor-subtitle">
            - {t('formation')} {getFormationName(draft)}
          </span>
        </div>
        <div className="formation-toolbar">
          <select
            className="input-stat"
            value={presetId}
            onChange={(e) => setPresetId(e.target.value)}
            aria-label={t('formationPreset')}
          >
            {FORMATION_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {presetLabel(p)} ({p.source})
              </option>
            ))}
          </select>
          <button className="kit-btn active" onClick={applyPreset}>
            {t('formationApplyPreset')}
          </button>
          <button className="kit-btn" onClick={mirror} title={t('formationMirrorHelp')}>
            {t('formationMirror')}
          </button>
          <button className="kit-btn" onClick={restoreOriginal}>
            {t('formationRestore')}
          </button>
        </div>
      </div>

      <div className="formation-body">
        <div className="formation-pitch-wrap">
          <svg
            ref={svgRef}
            className="formation-pitch"
            viewBox={`0 0 ${W} ${H}`}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            <Pitch />
            {draft.map((s, i) => {
              const color = LINE_COLORS[getLineCategory(s.line)];
              const player = players[i];
              const isSel = i === selected;
              return (
                <g
                  key={i}
                  className={`formation-marker ${i === 0 ? 'locked' : ''} ${isSel ? 'selected' : ''}`}
                  transform={`translate(${toX(s.lateral)}, ${toY(s.depth)})`}
                  onPointerDown={(e) => handlePointerDown(e, i)}
                >
                  <circle r={isSel ? 15 : 13} fill={color} stroke={isSel ? '#fff' : '#111'} />
                  <text className="formation-marker-num" y={4}>
                    {player?.number ?? i + 1}
                  </text>
                  <text className="formation-marker-name" y={26}>
                    {player?.name || '---'}
                  </text>
                  <text className="formation-marker-pos" y={-18}>
                    {positionText(getPositionLabel(s), t)}
                  </text>
                </g>
              );
            })}
          </svg>
          <p className="formation-hint">{t('formationPitchHint')}</p>
        </div>

        <div className="formation-side">
          {warnings.length > 0 && (
            <div className="formation-warnings">
              {warnings.map((w) => (
                <div key={w}>{t(w)}</div>
              ))}
            </div>
          )}

          {slot && (
            <div className="detail-section">
              <div className="detail-section-title">
                {t('formationSlot')} {selected + 1} ·{' '}
                <span className={`pos-badge pos-${getLineCategory(slot.line)}`}>
                  {positionText(getPositionLabel(slot), t)}
                </span>
              </div>

              <label className="formation-field">
                <span>{t('formationPlayer')}</span>
                <select
                  className="input-stat"
                  value={selected}
                  onChange={(e) => swapWith(parseInt(e.target.value, 10))}
                >
                  {players.map((p, i) => (
                    <option key={i} value={i}>
                      {i < 11 ? `${i + 1}.` : `${t('formationBenchShort')} ${i + 1}.`} #{p.number}{' '}
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="formation-hint">{t('formationPlayerHelp')}</p>

              <label className="formation-field">
                <span>{t('formationRole')}</span>
                <select
                  className="input-stat"
                  value={slot.role}
                  disabled={selected === 0}
                  onChange={(e) =>
                    commit(
                      draft.map((s, i) =>
                        i === selected ? withRole(s, parseInt(e.target.value, 10)) : s,
                      ),
                    )
                  }
                >
                  {FORMATION_ROLES.filter((r) => (selected === 0 ? r.id === 0 : r.id !== 0)).map(
                    (r) => (
                      <option key={r.id} value={r.id}>
                        {roleLabel(r)}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <div className="formation-grid">
                <label className="formation-field">
                  <span>{t('formationLateral')}</span>
                  <DraftInput
                    type="number"
                    className="input-mini"
                    min={0}
                    max={15}
                    value={slot.lateral}
                    disabled={selected === 0}
                    onCommit={commitNumber(0, 15, (v) => ({ lateral: v }))}
                  />
                </label>
                <label className="formation-field">
                  <span>{t('formationDepth')}</span>
                  <DraftInput
                    type="number"
                    className="input-mini"
                    min={0}
                    max={MAX_DEPTH}
                    value={slot.depth}
                    disabled={selected === 0}
                    onCommit={commitNumber(0, MAX_DEPTH, (v) => ({ depth: v }))}
                  />
                </label>
              </div>

              <details className="formation-advanced">
                <summary>{t('formationAdvanced')}</summary>
                <p className="formation-hint">{t('formationBehaviorHelp')}</p>
                <div className="formation-grid">
                  <label className="formation-field">
                    <span>{t('formationBehaviorA')}</span>
                    <DraftInput
                      type="number"
                      className="input-mini"
                      min={0}
                      max={15}
                      value={slot.behavior & 0x0f}
                      onCommit={commitNumber(0, 15, (v) => ({
                        behavior: (slot.behavior & 0xf0) | v,
                      }))}
                    />
                  </label>
                  <label className="formation-field">
                    <span>{t('formationBehaviorB')}</span>
                    <DraftInput
                      type="number"
                      className="input-mini"
                      min={0}
                      max={15}
                      value={slot.behavior >> 4}
                      onCommit={commitNumber(0, 15, (v) => ({
                        behavior: (v << 4) | (slot.behavior & 0x0f),
                      }))}
                    />
                  </label>
                </div>
                <div className="formation-raw">
                  {t('formationRaw')}:{' '}
                  {[slot.depth, (slot.lateral << 4) | slot.line, slot.role, slot.behavior]
                    .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
                    .join(' ')}
                </div>
              </details>
            </div>
          )}

          <div className="detail-section">
            <div className="detail-section-title">{t('substitutes')}</div>
            <div className="formation-bench">
              {players.slice(11).map((p, k) => {
                const idx = 11 + k;
                return (
                  <button
                    key={idx}
                    className="formation-bench-item"
                    onClick={() => swapWith(idx)}
                    title={t('formationSwapHelp')}
                  >
                    <span className="pos-badge pos-sub">SUB</span>
                    <span className="formation-bench-num">#{p.number}</span>
                    <span className="formation-bench-name">{p.name}</span>
                    <span className="formation-bench-action">⇄ {selected + 1}</span>
                  </button>
                );
              })}
            </div>
            <p className="formation-hint">{t('formationBenchHelp')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Pitch() {
  const cx = W / 2;
  const boxW = FIELD_W * 0.6;
  const boxH = FIELD_H * 0.16;
  const sixW = FIELD_W * 0.28;
  const sixH = FIELD_H * 0.06;
  return (
    <g className="formation-pitch-lines">
      <rect x={0} y={0} width={W} height={H} className="formation-grass" />
      {Array.from({ length: 8 }).map((_, i) => (
        <rect
          key={i}
          x={PAD}
          y={PAD + (FIELD_H / 8) * i}
          width={FIELD_W}
          height={FIELD_H / 8}
          className={i % 2 ? 'formation-stripe' : 'formation-stripe alt'}
        />
      ))}
      <rect x={PAD} y={PAD} width={FIELD_W} height={FIELD_H} />
      <line x1={PAD} y1={H / 2} x2={W - PAD} y2={H / 2} />
      <circle cx={cx} cy={H / 2} r={34} />
      {/* Own box (bottom) */}
      <rect x={cx - boxW / 2} y={H - PAD - boxH} width={boxW} height={boxH} />
      <rect x={cx - sixW / 2} y={H - PAD - sixH} width={sixW} height={sixH} />
      {/* Opponent box (top) */}
      <rect x={cx - boxW / 2} y={PAD} width={boxW} height={boxH} />
      <rect x={cx - sixW / 2} y={PAD} width={sixW} height={sixH} />
    </g>
  );
}
