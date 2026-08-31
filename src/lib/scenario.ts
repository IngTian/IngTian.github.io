// src/lib/scenario.ts
// THE SEEDED RANDOMNESS EVERY GENERATED FIGURE ON THE SITE DRAWS FROM.
//
// This file used to be a 371-line world simulator: an invented year of six real tickers, six news shocks, and
// a population of 48 discretionary "traders" whose dials (chase / cut / revert / concentration) produced a fan
// of PnL curves. That generation is GONE, and the reason is worth writing down so nobody rebuilds it.
//
// The slide it fed was replaced. What ships now is data/define.ts — FIVE NAMED POLICIES over FOUR HOLDINGS,
// each a rule a real book actually follows (buy-and-never-rebalance, sell-after-the-fall, 2x levered,
// mandated rebalance, vol-targeted), run through lib/policyPnl.ts. Five legible policies beat 48 anonymous
// dial-settings for the same argument: a reader can name the difference between the curves, which was never
// true of a Monte Carlo cloud. Keeping the cloud around meant maintaining a second, unrendered model of the
// same idea — a model that could drift out of agreement with the shipped one and be believed anyway, because
// it had unit tests. Git has it if the argument ever needs the other shape.
//
// WHAT SURVIVES IS THE LOW-LEVEL HALF, and it survives because three live modules need it: lib/complexity.ts
// and lib/policyPnl.ts both import { mulberry32, gauss } to build their declared figures.
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
