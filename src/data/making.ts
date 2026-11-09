// src/data/making.ts
// Copy for the writings-and-projects slide.
//
// The owner's brief: "for projects, they are less important for a quant. So we will spend one tab
// listing my writings (coming next) and my projects."
//
// THIS FILE IS THE EMPTY STATE. Work.astro decides whether writing exists from pieces() in data/writing.ts,
// the seam /writing reads, and shows what is below only when no piece is published (its own note says why).
// That branch is kept on purpose and is not dead code: show the column with copy that names what is coming,
// because a silently-missing column is less honest than an empty one. Naming what the writing will cover is
// useful to a reader; inventing three fake essay titles would not be.

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
