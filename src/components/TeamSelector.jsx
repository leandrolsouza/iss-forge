import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useI18n } from '../i18n';
import { IconChevron } from './Icons';

/** Event other parts of the app dispatch to open the picker (Ctrl+G) */
export const OPEN_TEAM_PICKER_EVENT = 'iss:open-team-picker';

const normalize = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export default function TeamSelector({ teams, selectedTeamIndex, onSelectTeam }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(selectedTeamIndex);
  const containerRef = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);

  const hasPrev = selectedTeamIndex > 0;
  const hasNext = selectedTeamIndex < teams.length - 1;

  // Filter by name or slot number ("br", "07", "7")
  const matches = useMemo(() => {
    const q = normalize(query.trim());
    const all = teams.map((team, index) => ({ team, index }));
    if (!q) return all;
    return all.filter(
      ({ team, index }) =>
        normalize(team.name).includes(q) ||
        String(index + 1) === q.replace(/^0+/, '') ||
        String(index + 1).padStart(2, '0') === q,
    );
  }, [teams, query]);

  const openPicker = () => {
    setQuery('');
    setHighlight(selectedTeamIndex);
    setOpen(true);
  };

  const close = () => setOpen(false);

  const handleSelect = (index) => {
    onSelectTeam(index);
    close();
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) close();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Focus the search box when opening
  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  // Opened from a global shortcut
  useEffect(() => {
    const onOpen = () => openPicker();
    window.addEventListener(OPEN_TEAM_PICKER_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_TEAM_PICKER_EVENT, onOpen);
  });

  // Keep the highlighted option on screen
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`[data-index="${highlight}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [open, highlight]);

  // While typing, highlight the first match
  useEffect(() => {
    if (open && matches.length && !matches.some((m) => m.index === highlight)) {
      setHighlight(matches[0].index);
    }
  }, [open, matches, highlight]);

  const onSearchKeyDown = (e) => {
    const pos = matches.findIndex((m) => m.index === highlight);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = matches[Math.min(matches.length - 1, pos + 1)];
      if (next) setHighlight(next.index);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = matches[Math.max(0, pos - 1)];
      if (prev) setHighlight(prev.index);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (matches.some((m) => m.index === highlight)) handleSelect(highlight);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };

  const currentTeam = teams[selectedTeamIndex];
  const listId = 'team-selector-listbox';

  return (
    <div className="team-selector" ref={containerRef}>
      <button
        className="team-selector-arrow"
        onClick={() => hasPrev && onSelectTeam(selectedTeamIndex - 1)}
        disabled={!hasPrev}
        title={`${t('previousTeam')} (Alt+←)`}
        aria-label={t('previousTeam')}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
          <path d="M8 1L3 6l5 5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </button>

      <button
        className="team-selector-current"
        onClick={() => (open ? close() : openPicker())}
        title={`${t('selectTeam')} (Ctrl+G)`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="team-selector-index">
          {String(selectedTeamIndex + 1).padStart(2, '0')}
        </span>
        <span className="team-selector-name">{currentTeam?.name}</span>
        <span className={`team-selector-chevron ${open ? 'open' : ''}`}>
          <IconChevron expanded={open} />
        </span>
      </button>

      <button
        className="team-selector-arrow"
        onClick={() => hasNext && onSelectTeam(selectedTeamIndex + 1)}
        disabled={!hasNext}
        title={`${t('nextTeam')} (Alt+→)`}
        aria-label={t('nextTeam')}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
          <path d="M4 1l5 5-5 5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </button>

      {open && (
        <div className="team-selector-dropdown">
          <input
            ref={searchRef}
            type="search"
            className="team-selector-search"
            placeholder={t('teamSelectorSearch')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKeyDown}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={`team-option-${highlight}`}
            aria-label={t('teamSelectorSearch')}
            spellCheck={false}
          />
          <div className="team-selector-options" role="listbox" id={listId} ref={listRef}>
            {matches.length === 0 && (
              <div className="team-selector-empty">{t('teamSelectorNoMatch')}</div>
            )}
            {matches.map(({ team, index }) => (
              <div
                key={team.id ?? index}
                id={`team-option-${index}`}
                data-index={index}
                role="option"
                aria-selected={index === selectedTeamIndex}
                className={`team-selector-option ${index === selectedTeamIndex ? 'selected' : ''} ${
                  index === highlight ? 'highlighted' : ''
                }`}
                onMouseEnter={() => setHighlight(index)}
                onMouseDown={(e) => e.preventDefault()} // keep focus in the search box
                onClick={() => handleSelect(index)}
              >
                <span className="team-selector-option-index">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="team-selector-option-name">{team.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
