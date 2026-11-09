// src/data/writing.ts
// THE WRITING SHELF: its taxonomy and voice, and the one seam between them and the pieces, which are markdown files
// in src/content/writing/.
//
// WHY A SEPARATE ROUTE from /research: a paper is co-authored, dated, citable and has results; a post is one person
// thinking out loud, revisable the day after it ships. Filed together, the informal writing borrows the paper's
// authority. The owner chose the split for that reason; /research stays papers-only.
//
// WHAT IT IS FOR, in the owner's terms: the evergreen thinking (research notes, explainers, the trading system's
// METHOD). Trade calls go to TradingView. Not a listing of everything but "a base you can search … we might have lots
// of writings": pages/writing.astro says how the index grows by count.
//
// ONE AXIS FOR NOW, the kind. A topic axis was prototyped and the owner deferred it: "let's wait on the topics. i
// dont have much topics yet." A cover is drawn by a figure the piece names, not by a topic (lib/writingCovers.ts).

import { readingMinutes, countWords } from '../lib/words';
import { figureFor, type Figure } from '../lib/writingCovers';
import { fold } from '../lib/writingSearch';

/** The kinds, in the order the chips show them. content.config.ts's `kind` enum is this list, so the schema and the
 *  taxonomy cannot disagree. */
export const KIND_KEYS = ['notes', 'explainers', 'methods', 'misc'] as const;
export type Kind = (typeof KIND_KEYS)[number];

/** What each kind is called, and the line that says what belongs in it (a chip's title). */
export const KINDS: Record<Kind, { label: string; gloss: string }> = {
  notes: { label: 'Notes', gloss: 'Working notes from the PhD reading: derivations, dead ends, what turned out to matter.' },
  explainers: { label: 'Explainers', gloss: 'One idea made legible, with the mathematics left in.' },
  methods: { label: 'Methods', gloss: 'How the trading system is built and tested: the method, never the call.' },
  // The favourite quotes live here ("Keep in /writing for now"): a commonplace book is none of the three above.
  misc: { label: 'Misc', gloss: 'What is none of those: a commonplace book of quotes, each with its source, and whatever else is worth keeping.' },
};

/** What /writing is for: the index's header, its headline and its subtitle. */
export const CHARTER = {
  headline: 'Notes, explainers and methods.',
  sub: 'The thinking that should still be worth reading in three years. Trade ideas live on TradingView; this is how they are made.',
};

/** From this many pieces the index shows its search and kind chips; under it, every piece is on one screen or two. */
export const SEARCH_FROM = 12;

/** A published piece, as every surface that shows one reads it (the index, a piece's page, the homepage's appendix). */
export interface Piece {
  slug: string;
  href: string;
  title: string;
  kind: Kind;
  /** YYYY-MM-DD. */
  date: string;
  /** YYYY-MM-DD the piece last GAINED something; absent unless it differs from `date`, so a page prints it as it is. */
  updated?: string;
  /** One or two sentences: the card's text and the piece's standfirst. */
  blurb: string;
  /** Computed from the body (bodyWords), never typed. */
  minutes: number;
  figure: Figure;
  featured: boolean;
  /** What the search matches: the words a reader sees on the card (title, blurb, kind), folded. */
  q: string;
}

/** An entry of the `writing` collection, narrowed to what the seam reads. */
export interface WritingEntry {
  id: string;
  filePath?: string;
  data: {
    title: string; date: string; kind: Kind; blurb: string;
    updated?: string; featured?: boolean; draft?: boolean; cover?: Figure;
  };
  rendered?: { html: string };
}

/** The words a reader reads in a rendered body (lib/words' countWords over its text), maths left out: a display or
 *  an inline formula is read as symbols, not as words. */
export function bodyWords(html: string): number {
  // An entity is dropped, not spaced: inside a word (don&#x27;t) it would split it, and alone (&#x26;) it is no word.
  return countWords(html.replace(/<math\b[\s\S]*?<\/math>/g, ' ').replace(/<[^>]*>/g, ' ').replace(/&[#\w]+;/g, ''));
}

/**
 * THE SEAM: the collection's entries as the published pieces, newest first (two on one day by slug), drafts dropped.
 * Every page that shows a piece reads it from here, so they agree on what exists, its order and its reading time.
 * A markdown plugin's throw does not fail the build (Astro logs it and stores the entry unrendered), so an entry
 * with no render throws here, naming its file.
 */
export function pieces(entries: readonly WritingEntry[]): Piece[] {
  return entries
    .filter((e) => !e.data.draft)
    .map((e): Piece => {
      if (!e.rendered) throw new Error(`${e.filePath ?? e.id} did not render; its error is logged above`);
      const { title, date, kind, blurb, updated, featured, cover } = e.data;
      return {
        slug: e.id, href: `/writing/${e.id}`, title, kind, date, blurb,
        updated: updated && updated !== date ? updated : undefined,
        minutes: readingMinutes(bodyWords(e.rendered.html)),
        figure: figureFor(e.id, cover),
        featured: featured ?? false,
        q: fold([title, blurb, KINDS[kind].label].join(' ')),
      };
    })
    .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.slug < b.slug ? -1 : 1));
}

/** The index's lead, the newest `featured` piece or else the newest, and the rest, newest first. */
export function leadAndRest(list: readonly Piece[]): { lead?: Piece; rest: Piece[] } {
  const lead = list.find((p) => p.featured) ?? list[0];
  return { lead, rest: list.filter((p) => p !== lead) };
}

/** A piece's neighbours in date order: the newer one before it and the older one after it, each where it exists. */
export function neighbours(list: readonly Piece[], slug: string): { prev?: Piece; next?: Piece } {
  const i = list.findIndex((p) => p.slug === slug);
  return i < 0 ? {} : { prev: list[i - 1], next: list[i + 1] };
}
