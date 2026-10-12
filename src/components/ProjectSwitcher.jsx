import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../i18n';
import { useRom } from '../context/RomContext';
import { filterProjects, formatDateTime, projectSavedAt } from '../utils/projectList';
import { IconProject, IconPlus, IconImport, IconOpen, IconClose } from './Icons';
import '../styles/UnsavedModal.css';
import '../styles/projects.css';

/**
 * Quick project switcher (File > Open project, Ctrl+Shift+O, the project name in the
 * sidebar). Type to filter, arrows + Enter to open. Opening another project with unsaved
 * changes goes through the usual "save first?" prompt.
 */
export default function ProjectSwitcher({ onClose }) {
  const { t, lang } = useI18n();
  const {
    projects,
    currentProject,
    romParser,
    openProject,
    openProjectForm,
    importProject,
    handleOpenRom,
    closeSession,
  } = useRom();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const shown = useMemo(() => filterProjects(projects, query), [projects, query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Start on the first project that is not the open one (the usual reason to switch)
  useEffect(() => {
    const first = shown.findIndex((p) => p.id !== currentProject?.id);
    setActive(query || first < 0 ? 0 : first);
  }, [shown, query, currentProject]);

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const open = (project) => {
    onClose();
    if (project.id !== currentProject?.id) openProject(project.id);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(shown.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && e.target === inputRef.current) {
      e.preventDefault();
      if (shown[active]) open(shown[active]);
    }
  };

  const run = (fn) => () => {
    onClose();
    fn();
  };

  return createPortal(
    <div
      className="unsaved-overlay project-switcher-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={onKeyDown}
    >
      <div
        className="project-switcher"
        role="dialog"
        aria-modal="true"
        aria-label={t('projectSwitcherTitle')}
      >
        <div className="project-switcher-search">
          <IconProject size={16} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('projectSwitcherPlaceholder')}
            aria-label={t('projectSwitcherPlaceholder')}
            aria-controls="project-switcher-list"
            aria-activedescendant={shown[active] ? `project-option-${shown[active].id}` : undefined}
            autoComplete="off"
          />
          <kbd className="project-switcher-kbd">Esc</kbd>
        </div>

        {shown.length > 0 ? (
          <ul
            id="project-switcher-list"
            ref={listRef}
            className="project-switcher-list"
            role="listbox"
            aria-label={t('projectsTitle')}
          >
            {shown.map((project, i) => {
              const isCurrent = project.id === currentProject?.id;
              return (
                <li
                  key={project.id}
                  id={`project-option-${project.id}`}
                  role="option"
                  aria-selected={i === active}
                  className={`project-switcher-item ${i === active ? 'active' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => open(project)}
                >
                  <div className="project-switcher-item-main">
                    <span className="projects-item-name">
                      {project.name}
                      {isCurrent && <span className="projects-tag">{t('projectOpenNow')}</span>}
                      {project.autosaveAt && (
                        <span className="projects-badge" title={t('projectHasAutosaveHint')}>
                          {t('projectHasAutosave')}
                        </span>
                      )}
                    </span>
                    <span className="projects-item-meta">
                      {[
                        project.description,
                        t('projectSavedAt', {
                          date: formatDateTime(projectSavedAt(project), lang),
                        }),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="project-switcher-empty">
            {projects.length ? t('projectSwitcherNoMatch') : t('projectsEmpty')}
          </p>
        )}

        <div className="project-switcher-footer">
          <button className="projects-btn" onClick={() => openProjectForm('create')}>
            <IconPlus size={14} />
            {t('projectNew')}
          </button>
          <button
            className="projects-btn"
            onClick={run(async () => {
              const imported = await importProject();
              if (imported) openProject(imported.id);
            })}
          >
            <IconImport size={14} />
            {t('projectImport')}
          </button>
          <button className="projects-btn" onClick={run(handleOpenRom)}>
            <IconOpen size={14} />
            {t('projectOpenLooseRom')}
          </button>
          {romParser && (
            <button
              className="projects-btn projects-btn--right"
              onClick={run(closeSession)}
              title={t('projectGoHomeHint')}
            >
              <IconClose size={14} />
              {t('projectGoHome')}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
