// Which stops does a page's marginal rail carry, and what does each one point at?
//
// This is the rail's CONTENT rule, kept pure so it can be unit-tested and so the
// rail component stays dumb markup. It exists because /research had the bug this
// module makes impossible: the page rendered N featured papers with
// `featured.map(...)` but built its rail with `featured.some(...)`, so N papers
// collapsed into ONE flat anchor set — pointing at IDs that were emitted once per
// paper and therefore duplicated. getElementById resolves the first match, so
// every "Method" link jumped to paper 1.
//
// The fix is structural, not a patch: the SAME function that names a stop's
// anchor also hands the page the id to render (`sectionId`). A stop can no longer
// point at an id the page didn't emit, because there is only one place that
// spells it.

import type { Publication, Project } from '../data/profile';

export interface Stop {
  label: string;
  /** DOM id this stop scrolls to (no '#'). */
  target: string;
  /** Nested stops. Absent/empty = a leaf; the rail renders flat if NO stop nests. */
  children?: Stop[];
}

/** Per-paper section ids. One speller, so rail and page cannot disagree. */
export function paperSectionId(index: number, section: 'idea' | 'math' | 'results'): string {
  return `r-p${index}-${section}`;
}

/** A paper's own anchor — its masthead (title + byline).
 *  Distinct from its first section's id: a paper-name stop that reused the
 *  first child's target would collide with that child in the flattened rail,
 *  and clicking the name should land on the TITLE anyway, not mid-paper. */
export function paperAnchorId(index: number): string {
  return `r-p${index}`;
}

/** Does this paper have the fields its "The idea" block needs? */
function hasIdea(p: Publication): boolean {
  return !!p.idea;
}
/** Does this paper own a set of typeset equations? */
function hasMath(p: Publication): boolean {
  return !!p.mathKey;
}
/** Does this paper have headline numbers or a metrics table? */
function hasResults(p: Publication): boolean {
  return !!(p.results?.length || p.metrics);
}

/** The stops WITHIN one paper, in the order the page renders them. */
function paperChildren(p: Publication, index: number): Stop[] {
  const out: Stop[] = [];
  if (hasIdea(p)) out.push({ label: 'The idea', target: paperSectionId(index, 'idea') });
  if (hasMath(p)) out.push({ label: 'Method', target: paperSectionId(index, 'math') });
  if (hasResults(p)) out.push({ label: 'Results', target: paperSectionId(index, 'results') });
  return out;
}

/**
 * The /research rail.
 *
 * SHAPE FOLLOWS THE DATA, deliberately:
 *   • ONE featured paper  → the paper's sections are hoisted to the top level, so
 *     the rail is exactly the flat "Interests / The idea / Method / Results /
 *     Earlier" that shipped. Today's page is visually unchanged.
 *   • TWO OR MORE         → a "Selected research" parent holds one child per
 *     paper (labelled by shortTitle), each holding its own sections.
 *
 * Nesting appears only when it earns its place. Two levels, not three: at 11px
 * mono in a ~38px left margin, a third indent level is unreadable.
 */
export function researchStops(
  publications: readonly Publication[],
  interests: readonly unknown[],
): Stop[] {
  const featured = publications.filter((p) => p.featured);
  const others = publications.filter((p) => !p.featured);

  const stops: Stop[] = [];
  if (interests.length) stops.push({ label: 'Interests', target: 'r-interests' });

  if (featured.length === 1) {
    // Hoist: the single paper's sections ARE the page's sections.
    stops.push(...paperChildren(featured[0], 0));
  } else if (featured.length > 1) {
    stops.push({
      label: 'Selected research',
      target: 'r-selected',
      children: featured.map((p, i) => ({
        label: p.shortTitle ?? p.title,
        target: paperAnchorId(i),
        children: paperChildren(p, i),
      })),
    });
  }

  if (others.length) stops.push({ label: 'Earlier', target: 'r-earlier' });
  return stops;
}

/** Project section id — one speller, same reason as paperSectionId. */
export function projectSectionId(index: number): string {
  return `p-${index}`;
}

/**
 * The /projects rail: one stop per project, flat.
 *
 * Flat and literal rather than invented section labels ("Overview / Projects /
 * Archive") — the rail's job is navigation, and fake structure on a page that IS
 * projects would be padding. Two stops today; it grows with the list.
 */
export function projectStops(projects: readonly Project[]): Stop[] {
  return projects.map((p, i) => ({ label: p.name, target: projectSectionId(i) }));
}

/** Flatten a stop tree into document order — what the scrollspy walks. */
export function flattenStops(stops: readonly Stop[]): Stop[] {
  const out: Stop[] = [];
  for (const s of stops) {
    out.push(s);
    if (s.children?.length) out.push(...flattenStops(s.children));
  }
  return out;
}

/** True when any stop in the tree nests — the rail renders two-level if so. */
export function isNested(stops: readonly Stop[]): boolean {
  return stops.some((s) => !!s.children?.length);
}
