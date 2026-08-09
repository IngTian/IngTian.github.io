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

/** The discs of known field after walking `k` stops (k = 0 means nothing known yet). */
export function knownAfter(k: number): KnownDisc[] {
  return WAYPOINTS.slice(0, Math.max(0, k)).map((w, i) => ({
    x: w.x, y: w.y, r: knowledgeRadius(i), index: i, label: w.label,
  }));
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
