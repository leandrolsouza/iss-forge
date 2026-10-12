/**
 * Helpers for showing lists of projects (start screen, project switcher).
 */

const fold = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/**
 * Projects matching a search: every word must appear in the name, description or
 * source ROM name (case and accents ignored). Keeps the list order.
 */
export function filterProjects(projects, query) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return projects;
  return projects.filter((p) => {
    const text = fold(`${p.name} ${p.description} ${p.romFileName}`);
    return words.every((w) => text.includes(w));
  });
}

/** When the project's ROM was last saved (creation for a project never saved) */
export function projectSavedAt(project) {
  return project.savedAt || project.createdAt || project.updatedAt || null;
}

/** Short date + time in the UI language ('' when unknown) */
export function formatDateTime(ms, lang) {
  if (!ms) return '';
  try {
    return new Date(ms).toLocaleString(lang, { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return new Date(ms).toLocaleString();
  }
}
