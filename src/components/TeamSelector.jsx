import React, { useState, useRef, useEffect } from 'react';
import { useI18n } from '../i18n';
import { IconChevron } from './Icons';

export default function TeamSelector({ teams, selectedTeamIndex, onSelectTeam }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const hasPrev = selectedTeamIndex > 0;
  const hasNext = selectedTeamIndex < teams.length - 1;

  const handlePrev = () => {
    if (hasPrev) onSelectTeam(selectedTeamIndex - 1);
  };

  const handleNext = () => {
    if (hasNext) onSelectTeam(selectedTeamIndex + 1);
  };

  const handleSelect = (index) => {
    onSelectTeam(index);
    setOpen(false);
  };

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Close dropdown on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  const currentTeam = teams[selectedTeamIndex];

  return (
    <div className="team-selector" ref={containerRef}>
      <button
        className="team-selector-arrow"
        onClick={handlePrev}
        disabled={!hasPrev}
        title={t('previousTeam')}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <path d="M8 1L3 6l5 5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </button>

      <button
        className="team-selector-current"
        onClick={() => setOpen(!open)}
        title={t('selectTeam')}
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
        onClick={handleNext}
        disabled={!hasNext}
        title={t('nextTeam')}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <path d="M4 1l5 5-5 5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </button>

      {open && (
        <div className="team-selector-dropdown">
          {teams.map((team, index) => (
            <div
              key={team.id}
              className={`team-selector-option ${index === selectedTeamIndex ? 'selected' : ''}`}
              onClick={() => handleSelect(index)}
            >
              <span className="team-selector-option-index">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="team-selector-option-name">{team.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
