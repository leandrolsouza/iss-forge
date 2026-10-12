import { describe, it, expect } from 'vitest';
import { filterProjects, projectSavedAt, formatDateTime } from '../projectList';

const projects = [
  { id: 'a', name: 'Campeonato Brasileiro', description: 'Série A 2026', romFileName: 'ISS.sfc' },
  { id: 'b', name: 'Premier League', description: 'England', romFileName: 'ISS (E).smc' },
  { id: 'c', name: 'Copa do Brasil', description: '', romFileName: '' },
];

describe('projectList', () => {
  it('returns everything for an empty search', () => {
    expect(filterProjects(projects, '')).toBe(projects);
    expect(filterProjects(projects, '   ')).toBe(projects);
  });

  it('matches every word in name, description or ROM, ignoring case and accents', () => {
    const ids = (q) => filterProjects(projects, q).map((p) => p.id);
    expect(ids('bras')).toEqual(['a', 'c']);
    expect(ids('serie a')).toEqual(['a']);
    expect(ids('SÉRIE')).toEqual(['a']);
    expect(ids('premier england')).toEqual(['b']);
    expect(ids('smc')).toEqual(['b']);
    expect(ids('la liga')).toEqual([]);
  });

  it('uses the save date, then the creation date', () => {
    expect(projectSavedAt({ createdAt: 1, updatedAt: 5, savedAt: 3 })).toBe(3);
    expect(projectSavedAt({ createdAt: 1, updatedAt: 5 })).toBe(1);
    expect(projectSavedAt({})).toBeNull();
  });

  it('formats dates and accepts missing ones', () => {
    expect(formatDateTime(null, 'pt-BR')).toBe('');
    expect(formatDateTime(Date.UTC(2026, 9, 12, 12), 'pt-BR')).toMatch(/2026|26/);
  });
});
