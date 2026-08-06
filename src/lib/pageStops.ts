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
 * ALWAYS nests each paper under its own name, at any paper count. An earlier
 * version hoisted a lone paper's sections to the top level so the rail matched
 * the flat one that shipped — but that made the fix invisible on the real page
 * (identical to the buggy rail until a second paper exists) and, worse, meant the
 * rail's shape changed the day a paper was added. Naming the paper is also the
 * honest label: "Method" alone is ambiguous the moment the page can hold more
 * than one paper, and the page can.
 *
 * Two levels under "Selected research", not three: at 11px mono in a ~38px left
 * margin, a third indent level is unreadable.
 */
export function researchStops(
  publications: readonly Publication[],
  interests: readonly unknown[],
): Stop[] {
  const featured = publications.filter((p) => p.featured);
  const others = publications.filter((p) => !p.featured);

  const stops: Stop[] = [];
  if (interests.length) stops.push({ label: 'Interests', target: 'r-interests' });

  // Only papers that actually render a section get a rail entry: a paper stop
  // whose child list is empty would be a rail row pointing at nothing, and a
  // "Selected research" parent with no such papers would be a heading over air.
  const paperStops = featured
    .map((p, i) => ({ p, i, children: paperChildren(p, i) }))
    .filter(({ children }) => children.length > 0)
    .map(({ p, i, children }) => ({
      label: p.shortTitle ?? p.title,
      target: paperAnchorId(i),
      children,
    }));

  if (paperStops.length) {
    stops.push({ label: 'Selected research', target: 'r-selected', children: paperStops });
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
