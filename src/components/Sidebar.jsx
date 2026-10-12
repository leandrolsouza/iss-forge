import React, { useState } from 'react';
import { useI18n } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';
import { useSettings } from '../context/SettingsContext';
import { IconSun, IconMoon, IconChevron, IconInfo, IconMenu } from './Icons';
import { EDITORS } from './editors';

export default function Sidebar({ onOpenTab, activeTab, collapsed, onToggleCollapse }) {
  const { t, lang, switchLang, languages } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const { settings: appSettings } = useSettings();
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
