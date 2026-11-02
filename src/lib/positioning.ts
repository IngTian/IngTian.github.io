// src/lib/positioning.ts
// offchart's positioning method, ported from IngTian/offchart lib/metrics.py at 4ae4229 (`share_of`,
// `expanding_percentile`), so /projects can draw offchart's own reading of a public CFTC series in tested code.
//
// The percentile is EXPANDING — each week ranked against every week up to it, never after — because a rank taken
// against the full sample tells you where a level sat relative to a future nobody had seen. offchart ranks the
// share over the WHOLE series (scripts/build.py:161-162); only its open-interest rank restarts at segment seams,
// since a share is a ratio and a re-denomination cancels in it. The vendoring script refuses a series that
// offchart's own segment rule (lib/segments.py) would split, so "whole series" and "one segment" agree here.
// Pure.

/** `100 * net / oi`, NaN where open interest is not positive (offchart guards the vanishing denominator). */
export function shareOf(net: readonly number[], oi: readonly number[]): number[] {
  if (net.length !== oi.length) throw new Error(`shareOf: ${net.length} positions against ${oi.length} open interests`);
  return net.map((n, i) => (oi[i] > 0 ? (100 * n) / oi[i] : NaN));
}

/** At each non-NaN i: 100 * #{j <= i, v_j non-NaN, v_j <= v_i} / #{j <= i, v_j non-NaN}. null for a NaN input and
 *  while fewer than `minHistory` values have been seen, so the warm-up ships no meaningless 100th percentile. */
export function expandingPercentile(v: readonly number[], minHistory = 1): (number | null)[] {
  // ponytail: O(n^2), ~0.6M comparisons for the ~1,000 weekly reports it ranks, once per build. offchart's
  // argsort + Fenwick tree is the O(n log n) version if this ever ranks a 100k-point series.
  const seen: number[] = [];
  return v.map((x) => {
    if (Number.isNaN(x)) return null;
    seen.push(x);
    if (seen.length < Math.max(minHistory, 1)) return null;
    let le = 0;
    for (const s of seen) if (s <= x) le++;
    return (100 * le) / seen.length;
  });
}
