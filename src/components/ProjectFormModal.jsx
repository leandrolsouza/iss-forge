import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../i18n';
import { useRom } from '../context/RomContext';
import { IconCartridge } from './Icons';
import '../styles/UnsavedModal.css';
import '../styles/ExportPatchModal.css';
import '../styles/projects.css';

const MAX_NAME = 80;
const MAX_DESCRIPTION = 1000;

const TITLES = {
  create: 'projectNewTitle',
  edit: 'projectEditTitle',
  duplicate: 'projectDuplicateTitle',
  fromCurrent: 'projectFromCurrentTitle',
};

const SUBMIT = {
  create: 'projectCreateBtn',
  edit: 'projectSaveBtn',
  duplicate: 'projectDuplicateBtn',
  fromCurrent: 'projectCreateBtn',
};

/**
 * Form for a project: name + description, and the ROM when creating one.
 *
 * mode: 'create'      new project from a ROM file (opened right away)
 *       'edit'        rename / change the description of `project`
 *       'duplicate'   copy of `project`
 *       'fromCurrent' turn the open ROM into a project
 */
export default function ProjectFormModal({ visible, mode = 'create', project = null, onClose }) {
  const { t } = useI18n();
  const {
    romInfo,
    pickRom,
    createProject,
    createProjectFromCurrent,
    updateProject,
    duplicateProject,
  } = useRom();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rom, setRom] = useState(null);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef(null);

  useEffect(() => {
    if (!visible) return;
    setBusy(false);
    setRom(null);
    if (mode === 'edit' && project) {
      setName(project.name);
      setDescription(project.description || '');
    } else if (mode === 'duplicate' && project) {
      setName(t('projectCopyName', { name: project.name }).slice(0, MAX_NAME));
      setDescription(project.description || '');
    } else {
      setName('');
      setDescription('');
    }
    // focus after the modal is painted
    setTimeout(() => nameRef.current?.select(), 0);
  }, [visible, mode, project, t]);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visible, busy, onClose]);

  if (!visible) return null;

  const needsRom = mode === 'create';
  const canSubmit = !busy && name.trim().length > 0 && (!needsRom || rom);

  const handlePickRom = async () => {
    const file = await pickRom();
    if (!file) return;
    setRom(file);
    // suggest a name from the file when none was typed yet
    if (!name.trim()) setName(file.name.replace(/\.[^.]+$/, '').slice(0, MAX_NAME));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    const values = { name: name.trim(), description: description.trim() };
    let result = null;
    if (mode === 'create') result = await createProject({ ...values, rom });
    else if (mode === 'edit') result = await updateProject(project.id, values);
    else if (mode === 'duplicate') result = await duplicateProject(project.id, values);
    else if (mode === 'fromCurrent') result = await createProjectFromCurrent(values);
    setBusy(false);
    if (result) onClose();
  };

  // Portal: the start screen animates with a transform, which would trap a fixed overlay
  return createPortal(
    <div
      className="unsaved-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-form-title"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <form className="patch-modal project-form" onSubmit={handleSubmit}>
        <div className="patch-header">
          <h3 id="project-form-title" className="patch-title">
            {t(TITLES[mode])}
          </h3>
          <p className="patch-subtitle">
            {mode === 'fromCurrent'
              ? t('projectFromCurrentHint', { file: romInfo?.fileName || '' })
              : t('projectFormHint')}
          </p>
        </div>

        <div className="patch-section">
          <label className="patch-label" htmlFor="project-name">
            {t('projectName')}
          </label>
          <input
            id="project-name"
            ref={nameRef}
            className="project-input"
            type="text"
            value={name}
            maxLength={MAX_NAME}
            placeholder={t('projectNamePlaceholder')}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className="patch-section">
          <label className="patch-label" htmlFor="project-description">
            {t('projectDescription')}
          </label>
          <textarea
            id="project-description"
            className="patch-metadata"
            rows={3}
            value={description}
            maxLength={MAX_DESCRIPTION}
            placeholder={t('projectDescriptionPlaceholder')}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {needsRom && (
          <div className="patch-section">
            <div className="patch-label">{t('projectRom')}</div>
            <div className="patch-base">
              <div className="patch-base-info project-rom-info">
                <IconCartridge size={16} />
                <span className="patch-base-name">{rom ? rom.name : t('projectRomNone')}</span>
              </div>
              <div className="patch-base-actions">
                <button
                  type="button"
                  className="unsaved-btn unsaved-btn-secondary"
                  onClick={handlePickRom}
                  disabled={busy}
                >
                  {rom ? t('projectRomChange') : t('projectChooseRom')}
                </button>
              </div>
            </div>
            <p className="patch-hint">{t('projectRomHint')}</p>
          </div>
        )}

        <div className="unsaved-actions">
          <button type="submit" className="unsaved-btn unsaved-btn-primary" disabled={!canSubmit}>
            {t(SUBMIT[mode])}
          </button>
          <button
            type="button"
            className="unsaved-btn unsaved-btn-ghost"
            onClick={onClose}
            disabled={busy}
          >
            {t('unsavedCancel')}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
