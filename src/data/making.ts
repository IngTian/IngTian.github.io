// src/data/making.ts
// Copy for the writings-and-projects slide.
//
// The owner's brief: "for projects, they are less important for a quant. So we will spend one tab
// listing my writings (coming next) and my projects."
//
// THIS FILE IS NOW THE EMPTY STATE, NOT THE CURRENT STATE. It used to say "the writing does not exist yet,
// and this says so" — true when it was written, false since `src/content/writing/favourite-quotes.md` was
// published. Work.astro no longer reads these constants to decide whether writing exists; it derives that
// from `getCollection('writing')` filtered on `!draft`, which is the same seam /writing uses, so the two
// pages cannot disagree. See the long note at Work.astro:23 for why that mattered — the homepage spent a
// release telling visitors there was no writing while a piece was live in the nav.
//
// What is below is therefore reached only when the collection is genuinely empty. That branch is kept on
// purpose and is not dead code: it is the same policy /writing applies to an empty kind — show the section
// with copy that names what is coming, because a silently-missing section is less honest than an empty one.
// Naming what the writing will cover is useful to a reader; inventing three fake essay titles would not be.

// MAKING_INTRO USED TO OPEN THIS FILE — "The research is the work. These are the things around it — notes I
// intend to write, and software that already runs." A good sentence, and it has never been on the site: the
// only consumer of this module is src/sections/Work.astro, which imports WRITINGS_PROMISE and WRITINGS_TOPICS
// and writes its own heading. Deleted rather than wired up, because deciding what the section says is an
// editorial call, and a data file is the wrong place to make one silently. If the slide wants a lede, it
// should be written in the slide.

/** The promise, in the same voice as the rest of the site. Italic display type on the page. */
export const WRITINGS_PROMISE =
  'Notes on the mathematics I am working through, written for the version of me who did not understand it yet.';

/** What the writing will actually cover. Drawn from the declared research scope, so the promise and the
 *  research slide cannot drift apart. */
export const WRITINGS_TOPICS: string[] = [
  'Multi-period allocation, and why one-shot mean–variance is the wrong shape for it',
  'Risk parity and hierarchy — distributing risk across structure rather than chasing return',
  'Where reinforcement learning helps an allocation policy, and where it quietly breaks it',
  'Convexity and duality as the load-bearing structure underneath all of it',
];
