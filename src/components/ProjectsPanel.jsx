import { useState } from 'react';
import { useI18n } from '../i18n';
import { useRom } from '../context/RomContext';
import { filterProjects, formatDateTime, projectSavedAt } from '../utils/projectList';
import {
  IconProject,
  IconPlus,
  IconImport,
  IconEdit,
  IconDuplicate,
  IconExport,
  IconTrash,
  IconOpen,
} from './Icons';
import '../styles/projects.css';

// Above this many projects the list gets a search field
const SEARCH_FROM = 6;

/**
 * Start screen list of projects (desktop only): open, create, import, and per project
 * edit / duplicate / export / show folder / delete. Most recently used first.
 */
export default function ProjectsPanel() {
  const { t, lang } = useI18n();
  const {
    projectsAvailable,
    projects,
    projectsLoaded,
    currentProject,
    openProject,
    openProjectForm,
    deleteProject,
    exportProject,
    importProject,
    showInFolder,
  } = useRom();
  const [query, setQuery] = useState('');

  if (!projectsAvailable) return null;

  const shown = filterProjects(projects, query);

  const action = (fn) => (e) => {
    e.stopPropagation();
    fn();
  };

  const tools = (project) => [
    {
      key: 'edit',
      label: t('projectEdit'),
      Icon: IconEdit,
      run: () => openProjectForm('edit', project),
    },
    {
      key: 'duplicate',
      label: t('projectDuplicate'),
      Icon: IconDuplicate,
      run: () => openProjectForm('duplicate', project),
    },
    {
      key: 'export',
      label: t('projectExport'),
      Icon: IconExport,
      run: () => exportProject(project.id),
    },
    {
      key: 'folder',
      label: t('projectShowFolder'),
      Icon: IconOpen,
      run: () => showInFolder(project.dir),
    },
    {
      key: 'delete',
      label: t('projectDelete'),
      Icon: IconTrash,
      run: () => deleteProject(project),
      danger: true,
    },
  ];

  return (
    <section className="projects-panel" aria-labelledby="projects-title">
      <div className="projects-header">
        <h3 id="projects-title">
          <IconProject size={16} />
          {t('projectsTitle')}
          {projects.length > 0 && <span className="projects-count">{projects.length}</span>}
        </h3>
        <div className="projects-header-actions">
          <button className="projects-btn" onClick={importProject} title={t('projectImportHint')}>
            <IconImport size={14} />
            {t('projectImport')}
          </button>
          <button
            className="projects-btn projects-btn--primary"
            onClick={() => openProjectForm('create')}
          >
            <IconPlus size={14} />
            {t('projectNew')}
          </button>
        </div>
      </div>

      {projects.length >= SEARCH_FROM && (
        <input
          type="search"
          className="project-input projects-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('projectSwitcherPlaceholder')}
          aria-label={t('projectSwitcherPlaceholder')}
        />
      )}

      {projectsLoaded && projects.length === 0 ? (
        <p className="projects-empty">{t('projectsEmpty')}</p>
      ) : shown.length === 0 && query ? (
        <p className="projects-empty">{t('projectSwitcherNoMatch')}</p>
      ) : (
        <ul className="projects-list">
          {shown.map((project) => (
            <li
              key={project.id}
              className={`projects-item ${currentProject?.id === project.id ? 'projects-item--current' : ''}`}
              role="button"
              tabIndex={0}
              title={t('projectOpenHint', { name: project.name })}
              onClick={() => openProject(project.id)}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openProject(project.id);
                }
              }}
            >
              <IconProject size={18} />
              <div className="projects-item-info">
                <span className="projects-item-name">
                  {project.name}
                  {project.autosaveAt && (
                    <span className="projects-badge" title={t('projectHasAutosaveHint')}>
                      {t('projectHasAutosave')}
                    </span>
                  )}
                </span>
                {project.description && (
                  <span className="projects-item-desc">{project.description}</span>
                )}
                <span className="projects-item-meta">
                  {t('projectSavedAt', { date: formatDateTime(projectSavedAt(project), lang) })}
                  {project.romFileName ? ` · ${project.romFileName}` : ''}
                </span>
              </div>
              <div className="projects-item-tools">
                {tools(project).map(({ key, label, Icon, run, danger }) => (
                  <button
                    key={key}
                    className={`projects-tool ${danger ? 'projects-tool--danger' : ''}`}
                    onClick={action(run)}
                    title={label}
                    aria-label={`${label}: ${project.name}`}
                  >
                    <Icon size={14} />
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
