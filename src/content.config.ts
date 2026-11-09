import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { publications } from './data/profile';
import { KIND_KEYS } from './data/writing';
import { PAPERS_DIR } from './lib/paperMarkdown/names';
import { FIGURES } from './lib/writingCovers';

/**
 * An ISO date, normalised to YYYY-MM-DD: every date in every collection is one of these.
 *
 * ACCEPTS BOTH A STRING AND A DATE ON PURPOSE. YAML parses an unquoted `2026-08-15` as a Date OBJECT, not a
 * string, so a plain z.string() rejects the most natural way to write a date — which is exactly how the first
 * file failed to build. Requiring quotes would work and would be a trap for every future file, since the error
 * only appears at build time and names a type mismatch rather than the missing quotes. Coercing here means
 * either spelling is correct and downstream code always gets the same string, which is what `datetime=` and
 * the sort both want.
 */
const isoDate = (field: string) =>
  z
    .union([z.string(), z.date()])
    .transform((d) => (typeof d === 'string' ? d : d.toISOString().slice(0, 10)))
    .refine((d) => /^\d{4}-\d{2}-\d{2}$/.test(d), { message: `${field} must be YYYY-MM-DD` });

/**
 * WRITING IS MARKDOWN NOW. The owner: "i want the writing to be flexible. so essentially writing.ts displays
 * some markdown notes i have. My favorite quotes is just a markdown file."
 *
 * So a new piece is a FILE, not a code change: drop a .md into src/content/writing/, give it frontmatter, and
 * it appears on /writing and gets its own page at /writing/<slug>. data/writing.ts keeps the taxonomy — what the
 * kinds ARE and what belongs in each, which is editorial copy rather than content — and `pieces()`, the one seam.
 *
 * WHY A COLLECTION AND NOT import.meta.glob, which this repo already uses for the gallery's images: the schema
 * below is validated at BUILD time, so a typo in `kind:` or a missing `date:` fails `npm run build` with the
 * offending file named. The glob alternative would render a broken row instead. CI is the merge gate here, so
 * the difference is between catching it and shipping it. For the same reason the object is STRICT: a field it does
 * not know (a misspelt `featured`, or a `minutes`, which is computed) fails the build rather than being
 * dropped in silence.
 */
const writing = defineCollection({
  loader: glob({ base: './src/content/writing', pattern: '**/*.md' }),
  schema: z.strictObject({
    title: z.string(),
    date: isoDate('date'),
    /**
     * Which kind of /writing this is (its chip, and its label on the card). An ENUM rather than a free string, so
     * a misspelled kind is a build error instead of a piece that silently belongs to no kind. The list is
     * data/writing.ts's KIND_KEYS, so the schema and the taxonomy cannot disagree.
     */
    kind: z.enum(KIND_KEYS),
    /**
     * The figure its cover draws (lib/writingCovers.ts's FIGURES, each named for what it draws). Optional: without
     * one, the slug's hash picks a figure, the same on every build.
     */
    cover: z.enum(FIGURES).optional(),
    /**
     * When the piece last GAINED SOMETHING. Optional, and meant to stay optional.
     *
     * The owner: "we might need to keep track of date vs. last edited at because we will add more quotes to
     * this doc later." A running collection has two different facts about it — when it started, and whether it
     * is still being added to — and `date` alone can only carry the first.
     *
     * SET BY HAND, NOT DERIVED FROM GIT. The file's last commit date is available at build time and is the
     * wrong number: a reformat, a typo fix or a rebase would each register as an edit, and CI's shallow clones
     * make it unreliable besides. A date that moves on its own teaches a reader to distrust every date on the
     * site. Set this when the piece gains a quote or a paragraph; leave it alone for a CSS change.
     * Rendered only when it DIFFERS from `date`, so a piece written once shows one date rather than two
     * identical ones.
     */
    updated: isoDate('updated').optional(),
    /** One or two sentences: what it argues, in plain language. The card's text on the index, and the piece's
     *  standfirst under its title. (Its reading time is not a field: it is computed from the body.) */
    blurb: z.string(),
    /** Leads the index (the newest featured piece does; without one, the newest piece). */
    featured: z.boolean().optional(),
    /**
     * Unfinished work can be committed without appearing. Worth having from the first file rather than added
     * later in a hurry: the alternative is keeping drafts out of git, which is where drafts go to die.
     */
    draft: z.boolean().optional(),
  })
    // An `updated` before `date` is a typo, not a fact, and it would render as a piece edited before it
    // existed. Both fields are normalised to YYYY-MM-DD above, so a string compare is a date compare.
    .refine((d) => !d.updated || d.updated >= d.date, {
      message: 'updated must not be earlier than date',
      path: ['updated'],
    }),
});

/**
 * PAPERS ARE FILES TOO. A paper's explainer page is one .md in this collection, written in the directive syntax
 * documented in CLAUDE.md ("Papers are files") and compiled by src/lib/paperMarkdown. A mistake in the body is
 * reported by the plugins and fails the build from the paper page; a mistake here fails it from this schema.
 *
 * The frontmatter holds only what the record does not. Title, authors, abstract, BibTeX, links and tags are the
 * paper's record in profile.ts `publications` (rendered in several shapes, so it stays TypeScript), and are never
 * repeated in the file, where the two copies could disagree.
 */
const papers = defineCollection({
  // the one spelling of the directory: the plugins compile a file as a paper by its path under it
  loader: glob({ base: `./${PAPERS_DIR}`, pattern: '**/*.md' }),
  schema: z.object({
    /** The record this page explains: a slug in profile.ts `publications`. */
    publication: z.string().refine((s) => publications.some((p) => p.slug === s), {
      message: 'publication must be the slug of a record in profile.ts publications',
    }),
    /** When this page was written: "This page: <date>". */
    pageDate: isoDate('pageDate'),
    /**
     * What `:cite[key]` resolves against, in the page's order. An author is "Family, Given", so a citation can
     * read "López de Prado, 2016" without guessing where a name splits. `journal` is set in italics, `venue` plain
     * after it: a journal's volume and pages, or on its own an archive ("SSRN", "arXiv:1707.06347"). `addedHere`
     * is where the paper names a work its own bibliography leaves out ("§1"); the page marks such a reference.
     */
    references: z
      .array(
        z.object({
          // One hyphen at a time: smartypants turns a "--" in the :cite[…] that names the key into a dash.
          key: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'a reference key is a-z and 0-9 joined by single hyphens, as it becomes the id #ref-<key>' }),
          authors: z.array(z.string().regex(/^[^,]+, [^,]+$/, { message: 'an author is written "Family, Given"' })).min(1),
          year: z.number().int(),
          title: z.string(),
          journal: z.string().optional(),
          venue: z.string().optional(),
          doi: z.string().optional(),
          url: z.url().optional(),
          addedHere: z.string().optional(),
        }).refine((r) => r.journal || r.venue, { message: 'a reference names its journal, its venue, or both' }),
      )
      .refine((rs) => new Set(rs.map((r) => r.key)).size === rs.length, { message: 'reference keys must be unique' }),
    /** The works in the paper's bibliography that the page does not draw on, each described ("a work by …"), so the
     *  page can say how its reference list relates to the paper's. */
    bibliographyOmits: z.array(z.string()).default([]),
    /** What this page leaves out of the paper, for "Read the full paper": "the weight figures (the paper's Figs. 2–3)". */
    leftOut: z.string().optional(),
    /** Corrections to the paper's current version, each dated: the page's "Corrections to v1". A `:v[key]` in the
     *  text is filled in, as in the prose. */
    errata: z.array(z.object({ date: isoDate('an erratum date'), text: z.string() })).default([]),
  }),
});

export const collections = { writing, papers };
