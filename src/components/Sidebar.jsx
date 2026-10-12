import React, { useState } from 'react';
import { useI18n } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';
import { useSettings } from '../context/SettingsContext';
import { useRom } from '../context/RomContext';
import {
  IconSun,
  IconMoon,
  IconChevron,
  IconInfo,
  IconMenu,
  IconProject,
  IconCartridge,
  IconEdit,
  IconClose,
  IconOpen,
  IconExport,
} from './Icons';
import { EDITORS } from './editors';
import { formatDateTime, projectSavedAt } from '../utils/projectList';
import * as electronBridge from '../services/electronBridge';
import '../styles/projects.css';

const DETAILS_KEY = 'iss-forge-session-details';

// Paths are shown right-to-left so a long one is cut at the start (the end is what matters);
// the LRM marks keep the slashes and the drive letter in their place
const ltr = (p) => `\u200E${p}\u200E`;

/**
 * What is open, at the top of the sidebar.
 * Project: name (click = switch project), rename, details (where it is saved, dates, source
 * ROM, open folder, export ROM), close. Loose ROM file: its path, show in folder, turn it
 * into a project, close.
 */
function SessionCard({ t, lang }) {
  const {
    romParser,
    romInfo,
    romFilePath,
    modified,
    currentProject,
    projectsAvailable,
    closeSession,
    openProjectSwitcher,
    openProjectForm,
    showInFolder,
  } = useRom();
  const [details, setDetails] = useState(() => localStorage.getItem(DETAILS_KEY) !== '0');
  if (!romParser) return null;

  const toggleDetails = () => {
    localStorage.setItem(DETAILS_KEY, details ? '0' : '1');
    setDetails(!details);
  };

  const isProject = !!currentProject;
  const title = isProject ? currentProject.name : romInfo?.fileName;
  const icon = isProject ? <IconProject size={14} /> : <IconCartridge size={14} />;
  const name = (
    <>
      <span className="sidebar-session-icon">{icon}</span>
      <span className="sidebar-session-name">
        {title}
        {modified && <span className="sidebar-session-dirty"> *</span>}
      </span>
    </>
  );

  return (
    <div className="sidebar-session">
      <div className="sidebar-session-label">{isProject ? t('project') : t('looseRom')}</div>
      <div className="sidebar-session-main">
        {projectsAvailable ? (
          <button
            className="sidebar-session-switch"
            onClick={openProjectSwitcher}
            title={`${title}\n${t('projectSwitchHint')}`}
          >
            {name}
            <span className="sidebar-session-caret" aria-hidden="true">
              <IconChevron expanded />
            </span>
          </button>
        ) : (
          <span className="sidebar-session-switch sidebar-session-switch--static" title={title}>
            {name}
          </span>
        )}
        <button
          className={`sidebar-session-btn ${details ? 'active' : ''}`}
          onClick={toggleDetails}
          title={t('sessionDetails')}
          aria-label={t('sessionDetails')}
          aria-expanded={details}
        >
          <IconInfo size={12} />
        </button>
        {isProject && (
          <button
            className="sidebar-session-btn"
            onClick={() => openProjectForm('edit', currentProject)}
            title={t('projectEdit')}
            aria-label={t('projectEdit')}
          >
            <IconEdit size={12} />
          </button>
        )}
        <button
          className="sidebar-session-btn"
          onClick={closeSession}
          title={isProject ? t('projectClose') : t('romClose')}
          aria-label={isProject ? t('projectClose') : t('romClose')}
        >
          <IconClose size={12} />
        </button>
      </div>

      {details && isProject && (
        <div className="sidebar-session-details">
          <dl>
            <dt>{t('sessionSaved')}</dt>
            <dd>
              {modified
                ? t('sessionUnsavedSince', {
                    date: formatDateTime(projectSavedAt(currentProject), lang),
                  })
                : formatDateTime(projectSavedAt(currentProject), lang)}
            </dd>
            {currentProject.romFileName && (
              <>
                <dt>{t('projectRom')}</dt>
                <dd title={currentProject.romFileName}>{currentProject.romFileName}</dd>
              </>
            )}
            <dt>{t('sessionFolder')}</dt>
            <dd className="sidebar-session-path" title={currentProject.dir}>
              {ltr(currentProject.dir)}
            </dd>
          </dl>
          <div className="sidebar-session-actions">
            <button
              className="sidebar-session-link"
              onClick={() => showInFolder(currentProject.dir)}
            >
              <IconOpen size={12} />
              {t('projectShowFolder')}
            </button>
            <button
              className="sidebar-session-link"
              onClick={() => electronBridge.saveRomAs()}
              title={t('sessionExportRomHint')}
            >
              <IconExport size={12} />
              {t('sessionExportRom')}
            </button>
          </div>
        </div>
      )}

      {details && !isProject && (
        <div className="sidebar-session-details">
          <dl>
            <dt>{t('sessionFile')}</dt>
            <dd className="sidebar-session-path" title={romFilePath || ''}>
              {romFilePath ? ltr(romFilePath) : t('sessionNoFile')}
            </dd>
          </dl>
          <div className="sidebar-session-actions">
            {romFilePath && projectsAvailable && (
              <button className="sidebar-session-link" onClick={() => showInFolder(romFilePath)}>
                <IconOpen size={12} />
                {t('sessionShowFile')}
              </button>
            )}
            {projectsAvailable && (
              <button
                className="sidebar-session-link"
                onClick={() => openProjectForm('fromCurrent')}
              >
                <IconProject size={12} />
                {t('projectFromCurrent')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ onOpenTab, activeTab, collapsed, onToggleCollapse }) {
  const { t, lang, switchLang, languages } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const { settings: appSettings } = useSettings();
  const { projectsAvailable, currentProject, openProjectSwitcher } = useRom();
  const [expandedSections, setExpandedSections] = useState({
    editors: true,
  });

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const editors = EDITORS.filter((e) => !e.ai || appSettings.aiEnabled);
  const open = (e) => onOpenTab(e.id, t(e.labelKey));

  if (collapsed) {
    return (
      <nav className="sidebar sidebar-collapsed" aria-label={t('editors')}>
        <div className="sidebar-icons">
          <button
            className="sidebar-icon-btn"
            onClick={onToggleCollapse}
            title={t('expand')}
            aria-label={t('expand')}
          >
            <IconMenu size={20} />
          </button>
          {projectsAvailable && (
            <button
              className="sidebar-icon-btn"
              onClick={openProjectSwitcher}
              title={
                currentProject
                  ? `${currentProject.name}\n${t('projectSwitchHint')}`
                  : t('projectSwitcherTitle')
              }
              aria-label={t('projectSwitcherTitle')}
            >
              <IconProject size={20} />
            </button>
          )}
          {editors.map((e) => (
            <button
              key={e.id}
              className={`sidebar-icon-btn ${activeTab === e.id ? 'selected' : ''}`}
              onClick={() => open(e)}
              title={t(e.labelKey)}
              aria-label={t(e.labelKey)}
              aria-current={activeTab === e.id ? 'page' : undefined}
            >
              <e.Icon size={20} />
            </button>
          ))}
        </div>
      </nav>
    );
  }

  return (
    <nav className="sidebar" aria-label={t('explorer')}>
      <div className="sidebar-header">
        <span className="sidebar-title">{t('explorer')}</span>
        <button
          className="sidebar-collapse-btn"
          onClick={onToggleCollapse}
          title={t('collapseSidebar')}
          aria-label={t('collapseSidebar')}
        >
          <IconMenu size={16} />
        </button>
      </div>

      <SessionCard t={t} lang={lang} />

      {/* Editors Section */}
      <div className="sidebar-section">
        <button
          className="sidebar-section-header"
          onClick={() => toggleSection('editors')}
          aria-expanded={expandedSections.editors}
        >
          <span className={`chevron ${expandedSections.editors ? 'expanded' : ''}`}>
            <IconChevron expanded={expandedSections.editors} />
          </span>
          <span className="section-label">{t('editors')}</span>
        </button>
        {expandedSections.editors && (
          <div className="sidebar-section-content">
            {editors.map((e, i) => (
              <React.Fragment key={e.id}>
                {/* visual break between team editors and whole-ROM editors */}
                {i > 0 && editors[i - 1].scope !== e.scope && (
                  <div className="sidebar-divider" role="separator" />
                )}
                <button
                  className={`sidebar-item editor-item ${activeTab === e.id ? 'selected' : ''}`}
                  onClick={() => open(e)}
                  aria-current={activeTab === e.id ? 'page' : undefined}
                >
                  <span className="item-icon">
                    <e.Icon size={14} />
                  </span>
                  <span>{t(e.labelKey)}</span>
                </button>
              </React.Fragment>
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
          aria-label={theme === 'dark' ? t('lightTheme') : t('darkTheme')}
        >
          {theme === 'dark' ? <IconSun size={14} /> : <IconMoon size={14} />}
        </button>
        <button
          className="sidebar-setting-btn"
          onClick={() => onOpenTab('about', t('aboutTitle'))}
          title={t('aboutTitle')}
          aria-label={t('aboutTitle')}
        >
          <IconInfo size={14} />
        </button>
        <div className="sidebar-lang-flags">
          <button
            className={`lang-flag-btn ${lang === 'pt-BR' ? 'active' : ''}`}
            onClick={() => switchLang('pt-BR')}
            title={languages['pt-BR']}
            aria-label={languages['pt-BR']}
            aria-pressed={lang === 'pt-BR'}
          >
            <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true">
              <rect width="20" height="14" fill="#009739" />
              <polygon points="10,1 19,7 10,13 1,7" fill="#FEDD00" />
              <circle cx="10" cy="7" r="3" fill="#012169" />
            </svg>
          </button>
          <button
            className={`lang-flag-btn ${lang === 'en' ? 'active' : ''}`}
            onClick={() => switchLang('en')}
            title={languages.en}
            aria-label={languages.en}
            aria-pressed={lang === 'en'}
          >
            <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true">
              <rect width="20" height="14" fill="#012169" />
              <path d="M0,0 L20,14 M20,0 L0,14" stroke="#fff" strokeWidth="2.5" />
              <path d="M0,0 L20,14 M20,0 L0,14" stroke="#C8102E" strokeWidth="1.5" />
              <path d="M10,0 V14 M0,7 H20" stroke="#fff" strokeWidth="4" />
              <path d="M10,0 V14 M0,7 H20" stroke="#C8102E" strokeWidth="2.5" />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
}
