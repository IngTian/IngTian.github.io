// src/data/writing.ts
// THE WRITING SHELF — essays, notes and explainers, kept apart from the papers.
//
// The owner: "you might want pages that is expandable to contain research projects, we will have writings and
// more in the future."
//
// WHY A SEPARATE ROUTE rather than more sections on /research. A paper and a blog post are different objects
// with different contracts: one is co-authored, dated, citable and has results; the other is one person
// thinking out loud and can be revised the day after it ships. Filing them together forces one page to hold
// two voices, and the usual outcome is that the informal writing quietly borrows the paper's authority. The
// owner chose the split for that reason; /research stays papers-only.
//
// EXPANDABLE BY CONSTRUCTION. The page renders KINDS, and a kind is a data entry — adding a third or fourth
// (talks, teaching, a reading log) is an edit to KINDS below, not a new component. The rail follows the same
// tree, so structure and navigation cannot drift apart. This is the shape /research already uses for papers.
//
// EMPTY KINDS ARE SHOWN, with a "nothing here yet" line, on the owner's choice. It states intent — the shelf
// exists and is going to fill — and it is honest in a way a silently-missing section is not: a reader can see
// what this page is FOR before there is anything on it. The moment a kind has an entry the line disappears,
// with no code change.

export interface WritingEntry {
  /** Slug, used as the DOM id and (later) as the route to the piece itself. */
  slug: string;
  title: string;
  /** ISO date, so ordering is unambiguous and the page can format it as it likes. */
  date: string;
  /** One or two sentences: what it argues, in plain language. */
  blurb: string;
  /** Rough reading time in minutes. Omitted when it would be a guess. */
  minutes?: number;
  /** Where it lives. Absent = written but not yet published anywhere. */
  href?: string;
  /** Marks a piece worth leading with, if a kind ever holds many. */
  featured?: boolean;
}

export interface WritingKind {
  /** Stable key, also the section's DOM id prefix. */
  key: string;
  /** Section heading. */
  label: string;
  /** Short label for the rail — the margin is ~11px mono and cannot take a heading. */
  railLabel: string;
  /** One line on what belongs in this kind, so the distinction is stated rather than implied. */
  gloss: string;
  /** Shown in place of the list while the kind is empty. Specific to the kind: a generic
   *  "coming soon" reads as filler, whereas naming what is coming reads as a plan. */
  empty: string;
  entries: WritingEntry[];
}

/**
 * The kinds, in the order the page presents them.
 *
 * Notes lead essays deliberately: the notes are the ones that will actually appear first (they are a
 * by-product of the research, not a separate project), and a page whose first section is the emptiest one
 * reads as abandoned.
 */
export const KINDS: WritingKind[] = [
  {
    key: 'notes',
    label: 'Research notes',
    railLabel: 'Notes',
    gloss:
      'Working notes from the multi-period portfolio optimization research — derivations, dead ends, and the things that turned out to matter.',
    empty:
      'The first notes will come out of the PhD reading: multi-period formulations, and where the convex-optimization view stops being enough.',
    entries: [],
  },
  {
    key: 'essays',
    label: 'Essays',
    railLabel: 'Essays',
    gloss:
      'Longer pieces on quantitative finance and the engineering underneath it — written to be read by someone outside the field.',
    empty:
      'Nothing here yet. The queue starts with why multi-period optimization is harder than repeating a single-period solve.',
    entries: [],
  },
  {
    key: 'explainers',
    label: 'Explainers',
    railLabel: 'Explainers',
    gloss:
      'One idea, made legible — the same job the homepage slides do, at more length and with the mathematics left in.',
    empty:
      'Nothing here yet. The homepage explainer is the prototype; these would be the full-length versions of its three slides.',
    entries: [],
  },
];

/** Entries of a kind, newest first. Sorting here rather than in the page keeps the page dumb. */
export function sorted(kind: WritingKind): WritingEntry[] {
  return [...kind.entries].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** Total pieces across every kind — what decides whether the page has any content at all. */
export function totalEntries(kinds: readonly WritingKind[] = KINDS): number {
  return kinds.reduce((n, k) => n + k.entries.length, 0);
}

/** Section DOM id for a kind. One speller, so the rail and the page cannot disagree. */
export function kindSectionId(key: string): string {
  return `w-${key}`;
}

/** Entry DOM id. Prefixed by its kind so two kinds may hold the same slug. */
export function entrySectionId(kindKey: string, slug: string): string {
  return `w-${kindKey}-${slug}`;
}
