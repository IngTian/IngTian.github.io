import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * WRITING IS MARKDOWN NOW. The owner: "i want the writing to be flexible. so essentially writing.ts displays
 * some markdown notes i have. My favorite quotes is just a markdown file."
 *
 * So a new piece is a FILE, not a code change: drop a .md into src/content/writing/, give it frontmatter, and
 * it appears on /writing under its kind and gets its own page at /writing/<slug>. data/writing.ts keeps only
 * the taxonomy — what the kinds ARE and what belongs in each — which is editorial copy rather than content.
 *
 * WHY A COLLECTION AND NOT import.meta.glob, which this repo already uses for the gallery's images: the schema
 * below is validated at BUILD time, so a typo in `kind:` or a missing `date:` fails `npm run build` with the
 * offending file named. The glob alternative would render a broken row instead. CI is the merge gate here, so
 * the difference is between catching it and shipping it.
 */
const writing = defineCollection({
  loader: glob({ base: './src/content/writing', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    /**
     * ISO date, normalised to YYYY-MM-DD.
     *
     * ACCEPTS BOTH A STRING AND A DATE ON PURPOSE. YAML parses an unquoted `2026-08-15` as a Date OBJECT, not a
     * string, so a plain z.string() rejects the most natural way to write a date — which is exactly how the
     * first file failed to build. Requiring quotes would work and would be a trap for every future piece, since
     * the error only appears at build time and names a type mismatch rather than the missing quotes. Coercing
     * here means either spelling is correct and downstream code always gets the same string, which is what
     * `datetime=` and the sort both want.
     */
    date: z
      .union([z.string(), z.date()])
      .transform((d) => (typeof d === 'string' ? d : d.toISOString().slice(0, 10)))
      .refine((d) => /^\d{4}-\d{2}-\d{2}$/.test(d), { message: 'date must be YYYY-MM-DD' }),
    /**
     * Which section of /writing this belongs to. An ENUM rather than a free string, so a misspelled kind is a
     * build error instead of a piece that silently belongs to no section and never renders.
     * Must stay in step with the keys in data/writing.ts — there is a test asserting exactly that.
     */
    kind: z.enum(['notes', 'essays', 'explainers', 'misc']),
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
    updated: z
      .union([z.string(), z.date()])
      .transform((d) => (typeof d === 'string' ? d : d.toISOString().slice(0, 10)))
      .refine((d) => /^\d{4}-\d{2}-\d{2}$/.test(d), { message: 'updated must be YYYY-MM-DD' })
      .optional(),
    /** One or two sentences: what it argues, in plain language. Shown on the index, not on the piece. */
    blurb: z.string(),
    /** Rough reading time. Omit rather than guess — the index only prints it when it is real. */
    minutes: z.number().int().positive().optional(),
    /** Marks a piece worth leading with, if a kind ever holds many. */
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

export const collections = { writing };
