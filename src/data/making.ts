// src/data/making.ts
// Copy for the writings-and-projects slide.
//
// The owner's brief: "for projects, they are less important for a quant. So we will spend one tab
// listing my writings (coming next) and my projects."
//
// The writing does not exist yet, and this says so. That is deliberate rather than a placeholder: the
// site states the PhD as "incoming" everywhere for the same reason — honesty over flourish. Naming what
// the writing will cover is useful to a reader; inventing three fake essay titles would not be.

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
