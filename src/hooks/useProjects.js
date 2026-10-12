/**
 * useProjects — the user's projects (one managed folder per mod: "Campeonato Brasileiro",
 * "Premier League"...). Desktop only: the store lives in the main process
 * (electron/projects.mjs). Every action reports to the user through toasts and returns
 * the new project metadata (or null / false when it did not happen).
 */
import { useCallback, useEffect, useState } from 'react';
import { isElectron, openBinaryFile, openRomWeb } from '../utils/fileHelpers';
import * as electronBridge from '../services/electronBridge';
import { quickValidate } from '../rom/romValidator';
import {
  buildProjectArchive,
  parseProjectArchive,
  restoreProjectArchive,
  isArchiveBase,
  romBaseCrc,
  projectArchiveFileName,
  PROJECT_ARCHIVE_EXTENSION,
} from '../utils/projectArchive';

/** File name shown for a project session (title bar fallback, patch names) */
function projectFileName(project) {
  return project.romFileName || `${project.name}.sfc`;
}

export default function useProjects({
  toast,
  t,
  confirm,
  guardDrafts,
  romParser,
  romInfo,
  modified,
  currentProject,
  setCurrentProject,
  requestLoadRom,
  unloadRom,
  markSaved,
  setLoading,
  clearBackup,
  clearProjectAutosave,
}) {
  const available = isElectron() && !!window.electronAPI?.projectsList;
  const [projects, setProjects] = useState([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);

  const refreshProjects = useCallback(async () => {
    if (!available) return [];
    const res = await electronBridge.projectsList();
    const list = res.success ? res.projects : [];
    setProjects(list);
    setProjectsLoaded(true);
    if (!res.success) toast.error(t('projectListFailed'), { detail: t(res.error) });
    return list;
  }, [available, toast, t]);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  const fail = useCallback(
    (titleKey, error) => toast.error(t(titleKey), { detail: error ? t(error) : undefined }),
    [toast, t],
  );

  /** Pick a ROM file and check it is an ISS ROM. @returns {Promise<{name, data}|null>} */
  const pickRom = useCallback(async () => {
    const file = await openRomWeb();
    if (!file) return null;
    const validation = quickValidate(file.data);
    if (!validation.isValid) {
      toast.error(t('toastRomInvalid', { file: file.name }), {
        detail: t(validation.messageKey),
      });
      return null;
    }
    return file;
  }, [toast, t]);

  const openProject = useCallback(
    async (id) => {
      if (!available) return false;
      if (currentProject?.id === id) return true;
      if (!(await guardDrafts())) return false;
      const res = await electronBridge.projectLoad(id);
      if (!res.success) {
        fail('projectOpenFailed', res.error);
        refreshProjects();
        return false;
      }
      const { project } = res;
      let data = res.data;
      let restored = false;
      if (res.autosave) {
        const date = new Date(project.autosaveAt || Date.now()).toLocaleString();
        restored = await confirm({
          title: project.name,
          message: t('projectAutosaveFound', { date }),
          confirmLabel: t('backupRestore'),
          cancelLabel: t('projectOpenSaved'),
        });
        if (restored) data = res.autosave;
      }
      setLoading(true);
      requestLoadRom(data, projectFileName(project), null, {
        originalData: res.original,
        restored,
        project,
      });
      return true;
    },
    [
      available,
      currentProject,
      guardDrafts,
      confirm,
      requestLoadRom,
      setLoading,
      refreshProjects,
      fail,
      t,
    ],
  );

  /**
   * New project from a ROM file, opened right away.
   * @param {{ name: string, description?: string, rom: {name: string, data: Uint8Array} }} params
   */
  const createProject = useCallback(
    async ({ name, description, rom }) => {
      if (!available || !rom) return null;
      const res = await electronBridge.projectCreate({
        name,
        description,
        romFileName: rom.name,
        baseCrc: romBaseCrc(rom.data),
        original: rom.data,
      });
      if (!res.success) {
        fail('projectCreateFailed', res.error);
        return null;
      }
      toast.success(t('toastProjectCreated', { name: res.project.name }));
      await refreshProjects();
      await openProject(res.project.id);
      return res.project;
    },
    [available, refreshProjects, openProject, fail, toast, t],
  );

  /** Turn the open loose ROM (with its edits) into a project; the session continues in it */
  const createProjectFromCurrent = useCallback(
    async ({ name, description }) => {
      if (!available || !romParser || currentProject) return null;
      try {
        romParser.fixChecksum();
      } catch (err) {
        console.warn('[Checksum] Could not fix internal checksum:', err.message);
      }
      const original = romParser.getOriginalData();
      const res = await electronBridge.projectCreate({
        name,
        description,
        romFileName: romInfo?.fileName || '',
        baseCrc: romBaseCrc(original),
        original,
        data: romParser.getRomData(),
      });
      if (!res.success) {
        fail('projectCreateFailed', res.error);
        return null;
      }
      // "Save" now goes to the project, not to the file the ROM came from
      electronBridge.setCurrentRomPath(null);
      setCurrentProject(res.project);
      markSaved(res.project.name);
      toast.success(t('toastProjectCreated', { name: res.project.name }));
      refreshProjects();
      return res.project;
    },
    [
      available,
      romParser,
      romInfo,
      currentProject,
      setCurrentProject,
      markSaved,
      refreshProjects,
      fail,
      toast,
      t,
    ],
  );

  /** @param {{ name?: string, description?: string }} changes */
  const updateProject = useCallback(
    async (id, changes) => {
      const res = await electronBridge.projectUpdate(id, changes);
      if (!res.success) {
        fail('projectUpdateFailed', res.error);
        return null;
      }
      if (currentProject?.id === id) setCurrentProject(res.project);
      refreshProjects();
      return res.project;
    },
    [currentProject, setCurrentProject, refreshProjects, fail],
  );

  /** Copy of the saved state of a project */
  const duplicateProject = useCallback(
    async (id, changes) => {
      const res = await electronBridge.projectDuplicate(id, changes);
      if (!res.success) {
        fail('projectDuplicateFailed', res.error);
        return null;
      }
      toast.success(t('toastProjectCreated', { name: res.project.name }));
      refreshProjects();
      return res.project;
    },
    [refreshProjects, fail, toast, t],
  );

  const deleteProject = useCallback(
    async (project) => {
      if (currentProject?.id === project.id) {
        toast.info(t('projectDeleteOpen'));
        return false;
      }
      const ok = await confirm({
        message: t('confirmDeleteProject', { name: project.name }),
        confirmLabel: t('projectDelete'),
        danger: true,
      });
      if (!ok) return false;
      const res = await electronBridge.projectDelete(project.id);
      if (!res.success) {
        fail('projectDeleteFailed', res.error);
        return false;
      }
      toast.success(t('toastProjectDeleted', { name: project.name }));
      refreshProjects();
      return true;
    },
    [currentProject, confirm, refreshProjects, fail, toast, t],
  );

  /** Save the last saved state of a project as a .issproj file (no ROM inside) */
  const exportProject = useCallback(
    async (id) => {
      const res = await electronBridge.projectLoad(id);
      if (!res.success) {
        fail('projectExportFailed', res.error);
        return false;
      }
      if (currentProject?.id === id && modified) toast.info(t('projectExportSavedOnly'));
      try {
        const archive = buildProjectArchive({
          project: res.project,
          original: res.original,
          data: res.data,
        });
        const saved = await electronBridge.projectSaveArchive(
          archive,
          projectArchiveFileName(res.project.name),
        );
        if (saved.canceled) return false;
        if (!saved.success) {
          fail('projectExportFailed', saved.error);
          return false;
        }
        toast.success(t('toastProjectExported', { name: res.project.name }), {
          detail: saved.path,
        });
        return true;
      } catch (err) {
        fail('projectExportFailed', err.message);
        return false;
      }
    },
    [currentProject, modified, fail, toast, t],
  );

  /**
   * Import a .issproj file as a new project. The original ROM comes from a project with
   * the same base, the open ROM, or (last resort) a file the user picks.
   */
  const importProject = useCallback(async () => {
    if (!available) return null;
    const file = await openBinaryFile(`${PROJECT_ARCHIVE_EXTENSION},.json`);
    if (!file) return null;
    try {
      const archive = parseProjectArchive(file.data);

      let base = null;
      const found = await electronBridge.projectFindOriginal(archive.baseCrc);
      if (found.success && found.original && isArchiveBase(archive, found.original)) {
        base = found.original;
      } else if (romParser && isArchiveBase(archive, romParser.getOriginalData())) {
        base = romParser.getOriginalData();
      } else {
        const ok = await confirm({
          title: archive.project.name || t('projectImport'),
          message: t('projectImportNeedRom', { crc: archive.baseCrc }),
          confirmLabel: t('projectChooseRom'),
        });
        if (!ok) return null;
        const rom = await pickRom();
        if (!rom) return null;
        if (!isArchiveBase(archive, rom.data)) {
          fail('projectImportFailed', 'projectArchiveWrongBase');
          return null;
        }
        base = rom.data;
      }

      const { original, data } = restoreProjectArchive(archive, base);
      const res = await electronBridge.projectCreate({
        name: archive.project.name || file.name.replace(/\.[^.]+$/, ''),
        description: archive.project.description,
        romFileName: archive.project.romFileName,
        baseCrc: archive.baseCrc,
        original,
        data,
      });
      if (!res.success) {
        fail('projectImportFailed', res.error);
        return null;
      }
      toast.success(t('toastProjectImported', { name: res.project.name }));
      refreshProjects();
      return res.project;
    } catch (err) {
      fail('projectImportFailed', err.message);
      return null;
    }
  }, [available, romParser, confirm, pickRom, refreshProjects, fail, toast, t]);

  /**
   * Close the open ROM / project and go back to the start screen.
   * Asks before throwing away unapplied drafts or unsaved changes.
   */
  const closeSession = useCallback(async () => {
    if (!romParser) return true;
    if (!(await guardDrafts())) return false;
    if (modified) {
      const ok = await confirm({
        message: currentProject
          ? t('confirmCloseProject', { name: currentProject.name })
          : t('confirmCloseRom'),
        confirmLabel: t('closeWithoutSaving'),
        danger: true,
      });
      if (!ok) return false;
      // the edits were thrown away: so is their auto-save
      if (currentProject) clearProjectAutosave(currentProject.id);
      else clearBackup();
    }
    unloadRom();
    refreshProjects();
    return true;
  }, [
    romParser,
    modified,
    currentProject,
    guardDrafts,
    confirm,
    unloadRom,
    clearBackup,
    clearProjectAutosave,
    refreshProjects,
    t,
  ]);

  // --- Dialogs (one at a time, rendered once by <ProjectDialogs />) ---
  // { type: 'switcher' } | { type: 'form', mode, project }
  const [projectDialog, setProjectDialog] = useState(null);

  const openProjectSwitcher = useCallback(() => {
    if (!available) return;
    refreshProjects();
    setProjectDialog({ type: 'switcher' });
  }, [available, refreshProjects]);

  /** mode: 'create' | 'edit' | 'duplicate' | 'fromCurrent' (see ProjectFormModal) */
  const openProjectForm = useCallback(
    (mode, project = null) => {
      if (!available) return;
      setProjectDialog({ type: 'form', mode, project });
    },
    [available],
  );

  const closeProjectDialog = useCallback(() => setProjectDialog(null), []);

  /** Open a project folder / select a file in the system file manager */
  const showInFolder = useCallback(
    async (target) => {
      if (!available || !target) return;
      const res = await electronBridge.showInFolder(target);
      if (!res.success) toast.error(t('showInFolderFailed'), { detail: t(res.error) });
    },
    [available, toast, t],
  );

  // Native menu: File > New project / Open project / Close
  useEffect(() => {
    if (!available) return undefined;
    return electronBridge.onProjectMenus({
      newProject: () => openProjectForm('create'),
      openProject: openProjectSwitcher,
      closeSession,
    });
  }, [available, openProjectForm, openProjectSwitcher, closeSession]);

  // Tell the main process what is open (menu labels, "Save As" file name)
  const sessionKind = !romParser ? null : currentProject ? 'project' : 'rom';
  const sessionName = currentProject?.name || romInfo?.fileName || '';
  const sessionExt = /\.smc$/i.test(currentProject?.romFileName || romInfo?.fileName || '')
    ? '.smc'
    : '.sfc';
  useEffect(() => {
    if (!isElectron()) return;
    electronBridge.setSession({ kind: sessionKind, name: sessionName, ext: sessionExt });
  }, [sessionKind, sessionName, sessionExt]);

  return {
    projectsAvailable: available,
    projects,
    projectsLoaded,
    refreshProjects,
    projectDialog,
    openProjectSwitcher,
    openProjectForm,
    closeProjectDialog,
    showInFolder,
    pickRom,
    openProject,
    createProject,
    createProjectFromCurrent,
    updateProject,
    duplicateProject,
    deleteProject,
    exportProject,
    importProject,
    closeSession,
  };
}
