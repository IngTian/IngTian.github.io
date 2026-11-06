// src/lib/scenario.ts
// THE SEEDED RANDOMNESS EVERY GENERATED FIGURE ON THE SITE DRAWS FROM.
//
// lib/complexity.ts and lib/policyPnl.ts import { mulberry32, gauss } to build their declared figures. (This
// file once also simulated 48 anonymous "traders"; it was deleted when Choice moved to data/define.ts's five
// NAMED policies, whose curves a reader can tell apart. Do not rebuild the cloud.)
//
// DETERMINISM IS THE WHOLE POINT OF THESE TWO FUNCTIONS. The project bans Math.random() at paint time: a
// figure that shimmered between repaints would make the site's own claim — that these specific differences
// are real — indefensible. A seeded PRNG gives texture without giving up reproducibility: same seed, same
// picture, on every build forever.
//
// Pure: no DOM, no canvas. Unit-tested (tests/scenario.test.ts).

/** Deterministic PRNG. Small, fast, and good enough for illustrative dispersion. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal from a uniform generator (Box–Muller, one draw per call). */
export function gauss(rand: () => number): number {
  // Guard the log against exactly zero, which would return -Infinity.
  const u = Math.max(1e-12, rand());
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
