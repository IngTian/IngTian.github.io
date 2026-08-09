// src/lib/split.ts
// WHAT A SPLIT IS WORTH AFTER AN EVENT — the arithmetic behind the defining slide.
//
// Small on purpose. The slide's job is to define "portfolio" and "multi-period" to someone who has never met
// either word, and the only maths it needs is: a split of money, an event that moves each holding, and what
// the money is worth afterwards. Anything more would be teaching the wrong thing.
//
// It lives in lib/ with a spec rather than inline in the component because the numbers appear as COPY on the
// slide ("£100 becomes £91"), and a number in copy that nothing checks is exactly how a page starts lying.
//
// Pure: no DOM. Deterministic.

/** Value of a split after one event. weights are percentages of the total and must sum to 100. */
export function afterEvent(
  weights: readonly number[],
  moves: readonly number[],
  total = 100,
): number {
  let out = 0;
  for (let i = 0; i < weights.length; i++) {
    const w = (weights[i] ?? 0) / 100;
    out += total * w * (1 + (moves[i] ?? 0));
  }
  return out;
}

/** Change in value, as a signed percentage of the starting total. */
export function changePct(
  weights: readonly number[],
  moves: readonly number[],
  total = 100,
): number {
  return (afterEvent(weights, moves, total) - total) / total * 100;
}

/** Does a split actually allocate everything? Used by tests to catch a hand-edited split that no longer sums
 *  to the whole — which would silently make one alternative look better than another. */
export function sumsToWhole(weights: readonly number[], tolerance = 1e-9): boolean {
  const s = weights.reduce((a, b) => a + b, 0);
  return Math.abs(s - 100) <= tolerance;
}

/** Cumulative offsets for drawing a split as one divided bar, in percent. Returned as [start, width] pairs so
 *  the caller does no running-total arithmetic of its own. */
export function segments(weights: readonly number[]): { start: number; width: number }[] {
  const out: { start: number; width: number }[] = [];
  let run = 0;
  for (const w of weights) {
    out.push({ start: run, width: Math.max(0, w) });
    run += Math.max(0, w);
  }
  return out;
}
