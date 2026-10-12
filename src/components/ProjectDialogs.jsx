import { useRom } from '../context/RomContext';
import ProjectSwitcher from './ProjectSwitcher';
import ProjectFormModal from './ProjectFormModal';

/** The project switcher / project form, opened from anywhere through useRom() */
export default function ProjectDialogs() {
  const { projectDialog, closeProjectDialog } = useRom();
  if (!projectDialog) return null;
  if (projectDialog.type === 'switcher') return <ProjectSwitcher onClose={closeProjectDialog} />;
  return (
    <ProjectFormModal
      visible
      mode={projectDialog.mode}
      project={projectDialog.project}
      onClose={closeProjectDialog}
    />
  );
}
