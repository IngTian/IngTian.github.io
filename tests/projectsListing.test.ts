// tests/projectsListing.test.ts
// The /projects terminal header's listing and summary line are computed from the records, never typed — the
// homepage's rule that a number in prose comes from the data it describes. These pin both against profile.ts.
import { describe, expect, it } from 'vitest';
import { inProgress, projects, type Project } from '../src/data/profile';
import { projectSectionId } from '../src/lib/pageStops';
import { listingLines, summaryCounts } from '../src/lib/projectsListing';

describe('listingLines', () => {
  const lines = listingLines(projects, inProgress);

  it('lists every project, then one wip line per in-progress item that has a repo', () => {
    expect(lines).toHaveLength(8);
    expect(lines.map((l) => l.name)).toEqual([...projects.map((p) => `${p.slug}/`), 'ai-mentor-core/']);
    // the not-yet-created repo has nothing to `ls`
    expect(lines.some((l) => /new AI-learning/.test(l.name))).toBe(false);
  });

  it('gives a project its kind, its short line and a jump to its section', () => {
    const [first] = lines;
    expect(first).toEqual({
      perm: 'drwxr-xr-x', name: 'rl-bhrp/', kind: projects[0].kind, short: projects[0].short,
      href: `#${projectSectionId('rl-bhrp')}`, wip: false,
    });
    expect(lines.slice(0, -1).every((l) => l.perm === 'drwxr-xr-x' && !l.wip)).toBe(true);
  });

  // The listing is set in JetBrains Mono, vendored as a latin subset. A character outside it falls back to the
  // system mono at another size (witness's short line had a →, T5-F7). The class is a conservative slice of the
  // subset's cmap, read from src/assets/fonts/jetbrains-mono-latin-var.woff2: no arrow is in it.
  it('uses only characters the mono subset can draw', () => {
    const drawable = /^[\x20-\x7e\xa0-\xff\u2013\u2014\u2018\u2019\u201c\u201d\u2022\u2026]*$/;
    const off = lines.flatMap((l) => [l.perm, l.name, l.kind, l.short]).filter((s) => !drawable.test(s));
    expect(off).toEqual([]);
  });

  it('closes on the wip line, which jumps to In progress', () => {
    expect(lines.at(-1)).toEqual({
      perm: 'drwxr-x---', name: 'ai-mentor-core/', kind: 'wip', short: 'in progress', href: '#p-in-progress', wip: true,
    });
  });
});

describe('summaryCounts', () => {
  it('counts the records: 7 shipped · 2 on PyPI · 1 on npm · 29 releases of witness · CI on 5', () => {
    expect(summaryCounts(projects)).toEqual({ shipped: 7, pypi: 2, npm: 1, ci: 5, witnessReleases: 29 });
  });

  it('reports no release count when witness has none, rather than inventing one', () => {
    const noWitness: Project[] = projects.filter((p) => p.slug !== 'witness');
    expect(summaryCounts(noWitness).witnessReleases).toBeNull();
  });
});
