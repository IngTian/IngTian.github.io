// src/lib/problemSize.ts
// ONE FORMATTER, and the reason it is alone in a file that used to hold five functions.
//
// This module was written to compute "why the problem is hard": decision-variable counts for the single- and
// multi-period problems, the ratio between the teaching example and a real book, and the log10 count of
// feasible-simplex vertices. Every one of those numbers is now computed in lib/complexity.ts instead —
// decisionVariables, scenarioLeaves, rulePairs — which is what src/sections/Rules.astro actually renders.
// Two modules deriving the same arithmetic is how a slide ends up quoting one of them while a test guards the
// other, so the duplicate half is gone rather than kept "in case".
//
// What Rules.astro imports from here is exactly `humanCount`, and it stays HERE rather than moving into
// complexity.ts on purpose: it is presentation, not arithmetic. The counting and the wording of the count are
// separate concerns, and the wording is the part that has to be identical everywhere it appears on the page.
//
// Pure. No DOM.

/**
 * A human-readable order of magnitude: "72,000" rather than 72000, and "1.2 million" past a million.
 * Formatting lives here rather than in the component so the same rule applies everywhere and can be tested.
 */
export function humanCount(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const v = Math.round(n);
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    return `${m >= 10 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, '')} million`;
  }
  return v.toLocaleString('en-US');
}
