// src/lib/projectsListing.ts
// The /projects terminal header's `ls -l` listing and its summary line, computed from the records — never typed,
// the homepage's rule that a number in prose comes from the data it describes. Pure.
import type { InProgressItem, Project } from '../data/profile';
import { projectSectionId } from './pageStops';

interface ListingLine {
  perm: string;
  name: string;
  kind: string;
  short: string;
  href: string;   // a jump to the item's place on the page — the listing is an index
  wip: boolean;
}

/** Every project as a directory, then one wip line per in-progress item that has a repo: an item whose repo does
 *  not exist yet has nothing to list. */
export function listingLines(ps: readonly Project[], wip: readonly InProgressItem[]): ListingLine[] {
  return [
    ...ps.map((p) => ({
      perm: 'drwxr-xr-x', name: `${p.slug}/`, kind: p.kind, short: p.short, href: `#${projectSectionId(p.slug)}`, wip: false,
    })),
    ...wip.filter((w) => w.repo).map((w) => ({
      perm: 'drwxr-x---', name: `${w.repo}/`, kind: 'wip', short: 'in progress', href: '#p-in-progress', wip: true,
    })),
  ];
}

/** The summary line's numbers. witness's release count is hand-maintained on its record (it cannot be computed
 *  without the network); null when the record has none, so the line drops the clause rather than inventing one. */
export function summaryCounts(ps: readonly Project[]): {
  shipped: number; pypi: number; npm: number; ci: number; witnessReleases: number | null;
} {
  return {
    shipped: ps.length,
    pypi: ps.filter((p) => p.registry === 'pypi').length,
    npm: ps.filter((p) => p.registry === 'npm').length,
    ci: ps.filter((p) => p.ci).length,
    witnessReleases: ps.find((p) => p.slug === 'witness')?.releases?.count ?? null,
  };
}
