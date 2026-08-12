// src/lib/problemSize.ts
// THE ARITHMETIC OF "WHY IT IS HARD".
//
// A reader with no finance background cannot be told the problem is hard — they have to see the size of it.
// These are the two or three numbers that do that, computed here so they are testable rather than typed
// into copy where they could quietly drift.
//
// Pure. No DOM.

/** Decision variables in a single-period problem: one weight per holding. */
export function singlePeriodVars(assets: number): number {
  return Math.max(0, Math.floor(assets));
}

/** Decision variables in a multi-period problem: one weight per holding PER period.
 *  This is the number that surprises people — it is the whole reason multi-period is a different problem
 *  rather than the same problem repeated. */
export function multiPeriodVars(assets: number, periods: number): number {
  return Math.max(0, Math.floor(assets)) * Math.max(0, Math.floor(periods));
}

/** How many times larger the real problem is than the teaching example. */
export function scaleFactor(
  toy: { assets: number; periods: number },
  real: { tickers: number; periods: number },
): number {
  const small = multiPeriodVars(toy.assets, toy.periods);
  const big = multiPeriodVars(real.tickers, real.periods);
  return small > 0 ? big / small : 0;
}

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

/**
 * The count of vertices of the feasible simplex under a budget + no-shorting constraint, for k active
 * holdings out of n — i.e. how many "corner" portfolios exist. It explodes combinatorially, which is the
 * cleanest honest way to show that enumeration is not an option.
 *
 * Returned as a log10 magnitude, because the value itself overflows a double almost immediately. That is
 * itself the point worth showing: the number does not fit in a number.
 */
export function log10Combinations(n: number, k: number): number {
  const N = Math.floor(n);
  const K = Math.floor(k);
  if (K <= 0 || N <= 0 || K > N) return 0;
  // log10 C(n,k) via lgamma, so it stays finite for large n.
  const lg = (x: number): number => {
    // Lanczos approximation of ln Γ(x).
    const g = [
      676.5203681218851, -1259.1392167224028, 771.32342877765313,
      -176.61502916214059, 12.507343278686905, -0.13857109526572012,
      9.9843695780195716e-6, 1.5056327351493116e-7,
    ];
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lg(1 - x);
    const z = x - 1;
    let a = 0.99999999999980993;
    const t = z + 7.5;
    for (let i = 0; i < g.length; i++) a += g[i] / (z + i + 1);
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
  };
  const lnC = lg(N + 1) - lg(K + 1) - lg(N - K + 1);
  return lnC / Math.LN10;
}
