import React, { useState } from 'react';
import { useI18n } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';
import {
  IconPlayers,
  IconUniform,
  IconHairSkin,
  IconFlag,
  IconFlagDesign,
  IconTeamName,
  IconOverview,
  IconCompare,
  IconMenu,
  IconSun,
  IconMoon,
  IconChevron,
} from './Icons';

export default function Sidebar({
  teams,
  selectedTeamIndex,
  onSelectTeam,
  onOpenTab,
  collapsed,
  onToggleCollapse,
  romLoaded,
}) {
  const { t, lang, switchLang, languages } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [expandedSections, setExpandedSections] = useState({
    teams: true,
    editors: true,
  });

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  if (collapsed) {
    return (
      <div className="sidebar sidebar-collapsed">
        <div className="sidebar-icons">
          <button className="sidebar-icon-btn" onClick={onToggleCollapse} title="Expandir">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 3h12v1H2V3zm0 4h12v1H2V7zm0 4h12v1H2v-1z" />
            </svg>
          </button>
          <button
            className="sidebar-icon-btn"
            onClick={() => onOpenTab('players', 'Jogadores')}
            title="Jogadores"
          >
            <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 1c-3.315 0-6 1.79-6 4v1h12v-1c0-2.21-2.685-4-6-4z" />
            </svg>
          </button>
          <button
            className="sidebar-icon-btn"
            onClick={() => onOpenTab('uniforms', 'Uniformes')}
            title="Uniformes"
          >
            <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 1L1 4v8l3 3h8l3-3V4l-3-3H4zm0 1h8l2 2v8l-2 2H4l-2-2V4l2-2z" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">{t('explorer')}</span>
        <button className="sidebar-collapse-btn" onClick={onToggleCollapse} title="Recolher">
          <IconMenu size={16} />
        </button>
      </div>

      {/* Editors Section */}
      <div className="sidebar-section">
        <div className="sidebar-section-header" onClick={() => toggleSection('editors')}>
          <span className={`chevron ${expandedSections.editors ? 'expanded' : ''}`}>
            <IconChevron expanded={expandedSections.editors} />
          </span>
          <span className="section-label">{t('editors')}</span>
        </div>
        {expandedSections.editors && (
          <div className="sidebar-section-content">
            <div
              className="sidebar-item editor-item"
              onClick={() => onOpenTab('players', t('editorPlayers'))}
            >
              <span className="item-icon">
                <IconPlayers size={14} />
              </span>
              <span>{t('editorPlayers')}</span>
            </div>
            <div
              className="sidebar-item editor-item"
              onClick={() => onOpenTab('uniforms', t('editorUniforms'))}
            >
              <span className="item-icon">
                <IconUniform size={14} />
              </span>
              <span>{t('editorUniforms')}</span>
            </div>
            <div
              className="sidebar-item editor-item"
              onClick={() => onOpenTab('hairskin', t('editorHairSkin'))}
            >
              <span className="item-icon">
                <IconHairSkin size={14} />
              </span>
              <span>{t('editorHairSkin')}</span>
            </div>
            <div
              className="sidebar-item editor-item"
              onClick={() => onOpenTab('flagcolors', t('editorFlagColors'))}
            >
              <span className="item-icon">
                <IconFlag size={14} />
              </span>
              <span>{t('editorFlagColors')}</span>
            </div>
            <div
              className="sidebar-item editor-item"
              onClick={() => onOpenTab('flagdesign', t('editorFlagDesign'))}
            >
              <span className="item-icon">
                <IconFlagDesign size={14} />
              </span>
              <span>{t('editorFlagDesign')}</span>
            </div>
            <div
              className="sidebar-item editor-item"
              onClick={() => onOpenTab('teamname', t('editorTeamName'))}
            >
              <span className="item-icon">
                <IconTeamName size={14} />
              </span>
              <span>{t('editorTeamName')}</span>
            </div>
            <div
              className="sidebar-item editor-item"
              onClick={() => onOpenTab('preview', t('editorPreview'))}
            >
              <span className="item-icon">
                <IconOverview size={14} />
              </span>
              <span>{t('editorPreview')}</span>
            </div>
            <div
              className="sidebar-item editor-item"
              onClick={() => onOpenTab('compare', t('editorCompare'))}
            >
              <span className="item-icon">
                <IconCompare size={14} />
              </span>
              <span>{t('editorCompare')}</span>
            </div>
            <div
              className="sidebar-item editor-item"
              onClick={() => onOpenTab('ai', t('editorAiGenerator'))}
            >
              <span className="item-icon">&#x2728;</span>
              <span>{t('editorAiGenerator')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Teams Section */}
      <div className="sidebar-section">
        <div className="sidebar-section-header" onClick={() => toggleSection('teams')}>
          <span className={`chevron ${expandedSections.teams ? 'expanded' : ''}`}>
            <IconChevron expanded={expandedSections.teams} />
          </span>
          <span className="section-label">
            {t('selections')} ({teams.length})
          </span>
        </div>
        {expandedSections.teams && (
          <div className="sidebar-section-content team-list">
            {teams.length === 0 && !romLoaded && (
              <div className="sidebar-item disabled">
                <span className="item-hint">{t('openRomToSee')}</span>
              </div>
            )}
            {teams.map((team, index) => (
              <div
                key={team.id}
                className={`sidebar-item team-item ${index === selectedTeamIndex ? 'selected' : ''
                  }`}
                onClick={() => onSelectTeam(index)}
              >
                <span className="team-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="team-name">{team.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Settings Section - Theme & Language */}
      <div className="sidebar-settings">
        <button
          className="sidebar-setting-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? t('lightTheme') : t('darkTheme')}
        >
          {theme === 'dark' ? <IconSun size={14} /> : <IconMoon size={14} />}
        </button>
        <button
          className="sidebar-setting-btn"
          onClick={() => onOpenTab('about', 'Sobre')}
          title="Sobre / About"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 1a6 6 0 1 1 0 12A6 6 0 0 1 8 2zm-.5 3h1v1h-1V5zm0 2h1v5h-1V7z" />
          </svg>
        </button>
        <div className="sidebar-lang-flags">
          <button
            className={`lang-flag-btn ${lang === 'pt-BR' ? 'active' : ''}`}
            onClick={() => switchLang('pt-BR')}
            title="Portugues"
          >
            <svg width="20" height="14" viewBox="0 0 20 14">
              <rect width="20" height="14" fill="#009739" />
              <polygon points="10,1 19,7 10,13 1,7" fill="#FEDD00" />
              <circle cx="10" cy="7" r="3" fill="#012169" />
            </svg>
          </button>
          <button
            className={`lang-flag-btn ${lang === 'en' ? 'active' : ''}`}
            onClick={() => switchLang('en')}
            title="English"
          >
            <svg width="20" height="14" viewBox="0 0 20 14">
              <rect width="20" height="14" fill="#012169" />
              <path d="M0,0 L20,14 M20,0 L0,14" stroke="#fff" strokeWidth="2.5" />
              <path d="M0,0 L20,14 M20,0 L0,14" stroke="#C8102E" strokeWidth="1.5" />
              <path d="M10,0 V14 M0,7 H20" stroke="#fff" strokeWidth="4" />
              <path d="M10,0 V14 M0,7 H20" stroke="#C8102E" strokeWidth="2.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
