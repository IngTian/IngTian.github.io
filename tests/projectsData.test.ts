// tests/projectsData.test.ts
// The /projects records: which projects are on the page, in what order, and the facts the page's
// computed lines (the ls summary, the homepage appendix) are derived from.
import { describe, it, expect } from 'vitest';
import { projects, inProgress, repoUrl, appendixProjects } from '../src/data/profile';

const bySlug = (slug: string) => projects.find((p) => p.slug === slug)!;

describe('the project records', () => {
  it('orders every notable project, selected first', () => {
    expect(projects.map((p) => p.slug)).toEqual([
      'rl-bhrp', 'offchart', 'trading-desk', 'witness', 'daylogs', 'manifold', 'macboot',
    ]);
    const lastSelected = projects.map((p) => p.tier).lastIndexOf('selected');
    const firstWorkshop = projects.map((p) => p.tier).indexOf('workshop');
    expect(lastSelected).toBeLessThan(firstWorkshop);
  });

  it('keeps rebal and argmin off the page', () => {
    // rebal: "not for release yet". argmin: one script with no tests or output — it would overclaim.
    for (const held of ['rebal', 'argmin']) expect(projects.map((p) => p.slug)).not.toContain(held);
  });

  it('has one unique slug per project', () => {
    const slugs = projects.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('links only public repos', () => {
    expect(repoUrl(bySlug('macboot'))).toBeNull();
    expect(repoUrl(bySlug('rl-bhrp'))).toBe('https://github.com/IngTian/rl-bhrp');
    for (const p of projects) expect(repoUrl(p) === null, p.slug).toBe(p.visibility === 'private');
  });

  it('gives every short line ≤ 44 chars and every idea one sentence ≤ 220 chars', () => {
    for (const p of projects) {
      expect(p.short.length, p.slug).toBeLessThanOrEqual(44);
      expect(p.idea.length, p.slug).toBeLessThanOrEqual(220);
      expect(p.idea, p.slug).toMatch(/\.$/);
      // One sentence: no terminator followed by a space anywhere before the final full stop.
      expect(p.idea.slice(0, -1), p.slug).not.toMatch(/[.!?]\s/);
    }
  });

  it('computes the counts the summary line prints', () => {
    // "7 shipped · 2 on PyPI · 1 on npm · 29 releases of witness · CI on 5 of 7" — from the records.
    expect(projects.filter((p) => p.visibility === 'public' || p.visibility === 'private')).toHaveLength(7);
    expect(projects.filter((p) => p.registry === 'pypi')).toHaveLength(2);
    expect(projects.filter((p) => p.registry === 'npm')).toHaveLength(1);
    expect(projects.filter((p) => p.ci)).toHaveLength(5);
    expect(bySlug('witness').releases?.count).toBe(29);
    expect(bySlug('witness').releases?.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('lists the homepage appendix by tier, not by array order', () => {
    // RL-BHRP already sits in the Publications column beside it, so the appendix skips research-kind.
    expect(appendixProjects(projects).map((p) => p.slug)).toEqual(['offchart', 'trading-desk']);
  });

  it('keeps in-progress items out of projects', () => {
    expect(inProgress[0].repo).toBe('ai-mentor-core');
    expect(inProgress[1].repo).toBeUndefined();
    const slugs = projects.map((p) => p.slug);
    for (const w of inProgress) expect(slugs).not.toContain(w.name);
  });
});
