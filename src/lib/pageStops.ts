// Which stops does a page's marginal rail carry, and what does each one point at?
//
// This is the rail's CONTENT rule, kept pure so it can be unit-tested and so the
// rail component stays dumb markup. The SAME function that names a stop's anchor
// also hands the page the id to render (`projectSectionId`, `experienceSectionId`,
// `paperSections`), so a stop cannot point at an id the page did not emit: there is
// one place that spells it. A rail built apart from its page fails silently — a
// repeated id is resolved to its first match by getElementById and by a #fragment,
// so every link naming it lands on the first section.

import type { Project, TimelineEntry } from '../data/profile';
import {
  type WritingKind, sorted as sortedEntries, kindSectionId, entrySectionId,
} from '../data/writing';

export interface Stop {
  label: string;
  /** DOM id this stop scrolls to (no '#'). */
  target: string;
  /** Nested stops. Absent/empty = a leaf. SideRail renders one indent level per
   *  level present, so the rail's depth follows this tree. */
  children?: Stop[];
}

/** Project section id — one speller, so rail and page cannot disagree. Keyed by slug, not index, so
 *  `/projects#p-witness` keeps pointing at witness when a project is added above it. */
export function projectSectionId(slug: string): string {
  return `p-${slug}`;
}

/**
 * The /projects rail: the page's four sections, with the selected projects nested under theirs.
 *
 * Only the selected tier gets per-project stops: those are the large rows a reader scans for, while the
 * workshop is a grid of cards read at a glance. Labels are slugs — bookmarks, not sentences.
 */
export function projectStops(projects: readonly Project[]): Stop[] {
  return [
    { label: 'Index', target: 'p-index' },
    {
      label: 'Selected', target: 'p-selected',
      children: projects
        .filter((p) => p.tier === 'selected')
        .map((p) => ({ label: p.slug, target: projectSectionId(p.slug) })),
    },
    { label: 'The workshop', target: 'p-workshop' },
    { label: 'In progress', target: 'p-in-progress' },
  ];
}

/** The /research index's rail: the papers, then the research interests. The page renders each section's id from
 *  this, so the two are spelled here and nowhere else. */
export function researchIndexStops(): Stop[] {
  return [
    { label: 'Papers', target: 'r-papers' },
    { label: 'Interests', target: 'r-interests' },
  ];
}

/** The sections a paper page writes itself after its file's body, in order: each id, the title its heading and the
 *  phone's Contents print, and its rail bookmark. Spelled once, so the page and the rail cannot disagree. */
export const PAPER_END = [
  { id: 'read', title: 'Read the full paper', rail: 'Full paper' },
  { id: 'references', title: 'References', rail: 'References' },
  { id: 'cite', title: 'Cite', rail: 'Cite' },
] as const;

interface PaperSection { id: string; n?: string; title: string; rail: string }

/**
 * A paper page's sections: its file's, as the markdown plugin reports them (lib/paperMarkdown, `sections`), in
 * order, then the page's own (PAPER_END). The rail (paperStops) and the phone's Contents both list exactly this.
 * The ids are the file's as written: a paper has a page of its own, so no other paper's ids are ever beside them,
 * and a deep link reads `/research/rl-bhrp#results`. The plugin refuses an id used twice in the file, and the page
 * one it writes itself (paperPageOwns).
 */
export function paperSections(sections: readonly PaperSection[]): PaperSection[] {
  return [...sections, ...PAPER_END];
}

/** A paper page's rail. Flat, though a section holds equations and figures: the rail bookmarks the sections a
 *  reader moves between. */
export function paperStops(sections: readonly PaperSection[]): Stop[] {
  return paperSections(sections).map((s) => ({ label: s.rail, target: s.id }));
}

// The ids a paper page writes around its file's body: PAPER_END's sections, its BibTeX and the corner nav's
// list. Its references' are `ref-<key>` (lib/paperMarkdown refId).
const PAPER_PAGE_IDS = new Set<string>([...PAPER_END.map((s) => s.id), 'bibtex', 'cnav-list']);

/** Whether a paper page writes `id` itself. A file that writes it too makes a second element with that id, and a
 *  #fragment or getElementById finds the first, so the page refuses the file. distSmoke holds this to the built
 *  page: each id there is either the file's (the plugin's `ids`) or the page's, never both, never neither. */
export function paperPageOwns(id: string): boolean {
  return PAPER_PAGE_IDS.has(id) || id.startsWith('ref-');
}

/** Experience section id — one speller, so rail and page cannot disagree. */
export function experienceSectionId(index: number): string {
  return `x-${index}`;
}

/**
 * The /experience rail: two groups, roles and education, each with its entries nested.
 *
 * Grouped rather than flat because the timeline mixes two KINDS and the
 * site's identity hierarchy is load-bearing — education carries the incoming PhD, which
 * must not be buried among nine jobs. The rail's two parents point at their group headings;
 * the leaves point at individual entries.
 */
export function experienceStops(timeline: readonly TimelineEntry[]): Stop[] {
  const group = (kind: TimelineEntry['kind']) =>
    timeline
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => t.kind === kind)
      .map(({ t, i }) => ({ label: railLabel(t), target: experienceSectionId(i) }));

  const stops: Stop[] = [];
  const education = group('education');
  const work = group('work');
  // Education first, so the incoming PhD is the first thing the rail offers.
  if (education.length) stops.push({ label: 'Education', target: 'x-education', children: education });
  if (work.length) stops.push({ label: 'Roles', target: 'x-roles', children: work });
  return stops;
}

/** A rail label short enough to fit a thin margin: the institution, not the whole title.
 *  Titles read "Senior Software Engineer · TikTok"; the rail wants "TikTok". */
export function railLabel(entry: TimelineEntry): string {
  const parts = entry.title.split('·').map((s) => s.trim());
  const tail = parts.length > 1 ? parts[parts.length - 1] : parts[0];
  return tail.length > 24 ? `${tail.slice(0, 23)}…` : tail;
}

/**
 * The /writing rail: one group per KIND, its pieces nested underneath.
 *
 * Same shape as /experience — a page that mixes kinds gets a group per kind — and for the same reason: the
 * distinction between a research note and an essay is the page's whole organising idea, so the rail should
 * carry it rather than flatten it.
 *
 * An EMPTY kind still gets its stop, because the page still renders its heading and its "nothing here yet"
 * line: the section genuinely exists, so the stop points at something.
 */
export function writingStops(kinds: readonly WritingKind[]): Stop[] {
  return kinds.map((k) => {
    const children = sortedEntries(k).map((e) => ({
      // 18, not 22: a nested label gets 158px of the rail's 200 (its 30px dash gutter and 12px indent out), and
      // 22 characters of 10px mono at 0.12em tracking take 158.4px. SideRail clips with an ellipsis as a backstop,
      // but the tree should hand it something that fits rather than relying on the fallback.
      label: e.title.length > 18 ? `${e.title.slice(0, 17)}…` : e.title,
      target: entrySectionId(k.key, e.slug),
    }));
    return children.length
      ? { label: k.railLabel, target: kindSectionId(k.key), children }
      : { label: k.railLabel, target: kindSectionId(k.key) };
  });
}

/**
 * THE HOMEPAGE RAIL, nested — the deck's three explainer slides live under the field that names them.
 *
 * The owner: "the ToC still says choices. i think this is more a 'the problem' section. similarly that An OR
 * Quant slide deserves a ToC Tag as well… for the problem, the constraint, stuff, you can maybe learn from
 * research's nested ToC. this way it's clearer on the top level."
 *
 * Both halves are right, and the flat rail was hiding the page's actual shape. "Choice" was a label for a file
 * name, not for a slide: that slide asks what multi-period portfolio optimization IS, which is the problem
 * statement. And the field slide — the one that says "An OR quant in multi-period portfolio optimization" —
 * had no stop at all, so the rail skipped straight from About to a slide about constraints.
 *
 * Nesting fixes the top level. An optimisation problem is an objective, a feasible set, and a way to search
 * it — which is exactly what the three slides are, in order. Read as a tree the rail now says: here is the
 * field, and here are the three things it consists of. Flat, it said five unrelated words.
 *
 * The three children keep the mathematical names rather than the slide names, because those are the words a
 * reader will meet again everywhere else in the field.
 *
 * SideRail renders it, as on every rail page. Unlike theirs, this parent's section (#interlude) does not hold its
 * children's: the slides are siblings. So on an explainer slide "The field" is lit as its ancestor, and current
 * only while the Interlude itself is in the reading band.
 */
export function homeStops(): Stop[] {
  return [
    { label: 'About', target: 'heights' },
    {
      label: 'The field',
      target: 'interlude',
      // SHORT labels: a bookmark, not a sentence, and the rail must clear the slides' text, which starts at x=168
      // or more wherever the rail shows (above 1100px). SideRail's right edge is its left (clamp(18px, 2.4vw,
      // 38px)) + its 30px dash gutter + the widest label, and 11px mono at 0.18em tracking is 8.58px a character:
      // "The field" ends at x=145 at most, and the 11 characters tests/pageStops.test.ts allows a top-level label
      // at 162. A child is 7.2px a character after a 12px indent, so its 8 end at 138.
      children: [
        { label: 'Problem', target: 'choice' },
        { label: 'Limits', target: 'rules' },
        // 'Method' claimed a method exists. The slide says the opposite — the problem is open and what it
        // names are directions of attack — so the rail must not promise a solution the section withdraws.
        { label: 'Open', target: 'solve' },
      ],
    },
    { label: 'The climb', target: 'story' },
    // The last slide, and the page ends on it (sections/Work.astro).
    { label: 'Appendix', target: 'appendix' },
  ];
}

/** Flatten a stop tree depth-first (parent before its children): SideRail numbers its rows by it for their
 *  entrance. NOTE this is TREE order, which need not be top-to-bottom VISUAL order — a page may set a section
 *  higher on screen than its tree position implies — so lib/scrollspy's railMarks sorts by measured top where the
 *  order matters; do not assume this order is geometrically monotonic. */
export function flattenStops(stops: readonly Stop[]): Stop[] {
  const out: Stop[] = [];
  for (const s of stops) {
    out.push(s);
    if (s.children?.length) out.push(...flattenStops(s.children));
  }
  return out;
}

/** The id a URL fragment names (`location.hash`, or a link's `hash`): '#results' → 'results', '' for none. A
 *  fragment that cannot be decoded (a stray '%', as in '#100%') names nothing, rather than throwing inside the setup
 *  of whatever page reads it. Every fragment a script reads goes through this. */
export function fragmentId(hash: string): string {
  try {
    return decodeURIComponent(hash.replace(/^#/, ''));
  } catch {
    return '';
  }
}
