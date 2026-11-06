// src/lib/problemSize.ts
// ONE FORMATTER. Rules.astro imports `humanCount` from here, and it stays out of lib/complexity.ts on purpose:
// it is presentation, not arithmetic, and the wording of a count has to be identical everywhere it appears.
// (This file's problem-size arithmetic was deleted as a duplicate of complexity.ts's; nothing on the page
// computes a decision-variable count today.)
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
