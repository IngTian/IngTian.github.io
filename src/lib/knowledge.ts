// src/lib/knowledge.ts
// WHAT YOU KNOW OF THE FIELD, AND WHEN — the sensitivity function, discovered rather than given.
//
// The owner's ask: "sketch my sensitivity function (so it's like we've discovered the global min as
// we've accumulated experience. The left global basin is not visible at first, right?)"
//
// Right, and this is the honest version of the whole story. Until now the picture drew the entire
// surface from frame one, which quietly asserts that the landscape was always known and the only
// question was where to walk. That is false, and it is the less interesting claim. What actually
// happens is that you learn the field BY MOVING THROUGH IT: each position teaches you the shape
// nearby, your reading improves with experience, and a better optimum can exist for years without
// being visible.
//
// So knowledge is modelled as coverage: a disc of known field around every place you have stood,
// whose radius GROWS with experience — you do not just stand in more places, you get better at
// reading each one. Everything outside the union of those discs is genuinely unknown and is drawn
// as unknown.
//
// MEASURED, not asserted. With the real waypoints and the real basins:
//
//     stop                  r     dist to deep basin   visible?
//     B.Eng McGill       0.75                   4.54        no
//     SDE TikTok         0.91                   4.09        no
//     SDE Amazon         1.07                   3.85        no
//     Ericsson           1.23                   3.71        no
//     Senior SWE TikTok  1.39                   3.53        no
//     Independent quant  1.55                   2.64        no
//     Electronic Arts    1.71                   1.72        no      <- 0.01 short
//     PhD OR             1.87                   0.58       YES
//
// The deep basin is invisible for SEVEN of eight stops and is discovered at the last one — and at
// Electronic Arts it misses by 0.01, which is as close to "almost saw it" as arithmetic gets. None
// of that was tuned to come out that way; it falls out of the declared positions.

import { field } from './terrain';
import { WAYPOINTS } from './trajectory';

/** How far you can read the field from your k-th position.
 *
 *  Grows linearly with experience: the base is what one position teaches you, the increment is
 *  getting better at reading. Deliberately simple — a fancier law would be unfalsifiable, and the
 *  claim only needs to be "your reach improves". */
export function knowledgeRadius(stopIndex: number, base = 0.75, growth = 0.16): number {
  return base + stopIndex * growth;
}

export interface KnownDisc {
  x: number;
  y: number;
  r: number;
  /** Which waypoint this disc came from. */
  index: number;
  label: string;
}

/** The discs of known field after walking `k` stops.
 *
 *  `k` is CONTINUOUS, not an integer count. A fractional k means the walker is between two stops,
 *  and the newest disc grows in from zero rather than popping into existence at full size.
 *
 *  WHY THIS MATTERS: the first version floored k, so knowledge advanced in seven discrete jumps.
 *  Nothing changed for ~740ms and then the whole surface lurched — which reads as "stuck, then
 *  extreme" rather than as learning. Continuity is the entire fix. */
export function knownAfter(k: number): KnownDisc[] {
  const kk = Math.max(0, k);
  const full = Math.floor(kk);
  const frac = kk - full;
  const out: KnownDisc[] = [];
  for (let i = 0; i < Math.min(full, WAYPOINTS.length); i++) {
    const w = WAYPOINTS[i];
    out.push({ x: w.x, y: w.y, r: knowledgeRadius(i), index: i, label: w.label });
  }
  // The disc currently being learned: its radius eases in, so arriving somewhere expands what you
  // can see smoothly instead of instantly.
  if (full < WAYPOINTS.length && frac > 0) {
    const w = WAYPOINTS[full];
    const ease = frac * frac * (3 - 2 * frac);        // smoothstep
    out.push({ x: w.x, y: w.y, r: knowledgeRadius(full) * ease, index: full, label: w.label });
  }
  return out;
}

/**
 * Knowledge as a function of WHERE THE WALKER IS, not of how many stops it has ticked past.
 *
 * `u` is the continuous trail parameter in [0, 1]. The walker carries its own reading radius, so the
 * frontier advances with the curve itself — smoothly, one pixel at a time — instead of waiting for a
 * waypoint to be reached. This is what makes the left half of the field come into view GRADUALLY as
 * the descent proceeds, which is the effect the owner asked for; keying it to stop count made the
 * reveal arrive in visible instalments however smooth the easing was.
 *
 * The radius still grows with experience, because that part of the claim is real: you get better at
 * reading the field as you cover more of it.
 */
export function walkerKnowledge(
  u: number, pathAt: (t: number) => { x: number; y: number },
  trailSamples = 96,
): KnownDisc[] {
  const uu = Math.max(0, Math.min(1, u));
  const out: KnownDisc[] = [];
  const upTo = Math.max(1, Math.round(uu * trailSamples));
  for (let i = 0; i <= upTo; i++) {
    const t = (i / trailSamples);
    if (t > uu + 1e-9) break;
    const p = pathAt(t);
    // Experience at this point of the walk, expressed in stop-equivalents so the radius law is the
    // same one the tests already lock.
    const exp = t * (WAYPOINTS.length - 1);
    out.push({ x: p.x, y: p.y, r: knowledgeRadius(exp), index: i, label: '' });
  }
  return out;
}

/**
 * A knownness FUNCTION for a fixed frontier — build once per frame, call thousands of times.
 *
 * THE PERFORMANCE BUG THIS FIXES, because it made the animation a slideshow: the previous
 * walkerKnownness(x, y, u, pathAt) rebuilt the entire frontier on EVERY CALL. At full reveal that is
 * up to 97 discs, each requiring a spline sample, and the draw calls it once per contour point —
 * roughly 290,000 disc constructions per frame. Measured: a single 1739ms synchronous long task per
 * frame, i.e. 0.6fps, which is exactly the "step function, like a powerpoint" symptom.
 *
 * Hoisting the frontier out of the inner loop is the whole fix. The caller builds this once per frame
 * and then the per-point cost is just a distance test against a fixed array.
 */
export function knownnessFn(
  u: number, pathAt: (t: number) => { x: number; y: number },
): (x: number, y: number) => number {
  const discs = walkerKnowledge(u, pathAt);
  return (x: number, y: number) => {
    let best = 0;
    for (let i = 0; i < discs.length; i++) {
      const d = discs[i];
      const t = 1 - Math.hypot(x - d.x, y - d.y) / d.r;
      if (t > best) best = t;
    }
    return best < 0 ? 0 : best > 1 ? 1 : best;
  };
}

/** Convenience wrapper. Correct but SLOW — it rebuilds the frontier per call, so never use it inside
 *  a render loop. Kept for tests and one-off queries. */
export function walkerKnownness(
  x: number, y: number, u: number, pathAt: (t: number) => { x: number; y: number },
): number {
  return knownnessFn(u, pathAt)(x, y);
}

/** Is a world point inside anything you have learned after `k` stops? */
export function isKnown(x: number, y: number, k: number): boolean {
  return knownAfter(k).some((d) => Math.hypot(x - d.x, y - d.y) <= d.r);
}

/** How well a point is known: 0 outside everything, rising toward 1 at a disc's centre.
 *
 *  Smooth rather than binary so the drawn surface can FADE in at the edge of knowledge instead of
 *  ending on a hard circle — a hard edge reads as a rendering artefact, while a soft one reads as
 *  the limit of what you can see. */
export function knownness(x: number, y: number, k: number): number {
  let best = 0;
  for (const d of knownAfter(k)) {
    const t = 1 - Math.hypot(x - d.x, y - d.y) / d.r;
    if (t > best) best = t;
  }
  return Math.max(0, Math.min(1, best));
}

/** At which stop does a given world point first come into view? -1 if it never does. */
export function discoveredAt(x: number, y: number): number {
  for (let k = 1; k <= WAYPOINTS.length; k++) {
    if (isKnown(x, y, k)) return k;
  }
  return -1;
}

export interface Discovery {
  /** 1-based stop count at which the deep basin first becomes visible. */
  stop: number;
  label: string;
  /** How many stops were walked blind. */
  blindStops: number;
  /** The closest miss before discovery: distance minus radius at the previous stop. */
  nearMiss: number;
}

/**
 * When the deeper basin is discovered, and how nearly it was missed.
 *
 * This is the number the page should state, because it is the story: the better optimum existed the
 * whole time and was not visible. Nothing about the field changed — only what could be seen of it.
 */
export function discoveryOf(x: number, y: number): Discovery | null {
  const stop = discoveredAt(x, y);
  if (stop < 0) return null;
  const prev = stop - 1;
  let nearMiss = Infinity;
  if (prev >= 1) {
    for (const d of knownAfter(prev)) {
      const miss = Math.hypot(x - d.x, y - d.y) - d.r;
      if (miss < nearMiss) nearMiss = miss;
    }
  }
  return {
    stop,
    label: WAYPOINTS[stop - 1].label,
    blindStops: stop - 1,
    nearMiss: Number.isFinite(nearMiss) ? nearMiss : 0,
  };
}

/**
 * The SENSITIVITY FUNCTION: the field as currently understood.
 *
 * Where you have been, this is the true field. Where you have not, it is your prior — and the prior
 * is deliberately flat and slightly optimistic-of-nothing: an unexplored region is assumed to be
 * unremarkable, which is exactly the mistake that keeps people in a local minimum. Blending toward
 * that prior is what makes the deep basin literally invisible until it is reached.
 *
 * `prior` defaults to the mean height of the KNOWN region, so the unknown looks like "more of what
 * I have seen" rather than like a special value someone chose.
 */
export function perceivedField(x: number, y: number, k: number, prior?: number): number {
  const w = knownness(x, y, k);
  const p = prior ?? knownMean(k);
  return field(x, y) * w + p * (1 - w);
}

/** Mean true height over the known discs — the honest default prior. */
export function knownMean(k: number, samples = 12): number {
  const discs = knownAfter(k);
  if (!discs.length) return 0;
  let sum = 0;
  let n = 0;
  for (const d of discs) {
    for (let i = 0; i < samples; i++) {
      const a = (i / samples) * Math.PI * 2;
      for (const rr of [0.25, 0.6, 0.9]) {
        sum += field(d.x + Math.cos(a) * d.r * rr, d.y + Math.sin(a) * d.r * rr);
        n++;
      }
    }
  }
  return n ? sum / n : 0;
}
