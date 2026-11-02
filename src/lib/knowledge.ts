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
// So knowledge is modelled as coverage: a disc of known field around every place the WALKER has been
// along the curve, whose radius GROWS with experience — you do not just stand in more places, you get
// better at reading each one. Everything outside the union of those discs is genuinely unknown and is
// drawn as unknown.
//
// MEASURED ON THE MODEL THE PAGE RUNS — `knownnessFn` over `trail()`, with the readout's own 0.02
// threshold. Deep-basin knownness at each stop the readout prints:
//
//     stop                       u      deep basin   readout
//     1  B.Eng · McGill        0.000      0.0000      nothing deeper is visible
//     2  SDE Intern · TikTok   0.143      0.0000      nothing deeper is visible
//     3  SDE Intern · Amazon   0.286      0.0000      nothing deeper is visible
//     4  Ericsson AI Lab       0.429      0.0000      nothing deeper is visible
//     5  Senior SWE · TikTok   0.571      0.0000      nothing deeper is visible
//     6  Electronic Arts       0.714      0.0000      nothing deeper is visible
//     7  Independent quant     0.857      0.0000      nothing deeper is visible
//     8  PhD · OR              1.000      0.6906      a deeper basin is now visible
//
// It first crosses 0.02 at u = 0.865 — just past Independent quant, with the walker 0.05 from that
// waypoint — so the readout's first "a deeper basin is now visible" prints on "stop 7/8". The local
// basin is known from u = 0.115, before the second stop. None of that was tuned to come out that way.
//
// THIS TABLE WAS WRONG IN TWO WAYS UNTIL IT WAS RE-MEASURED, and both are worth knowing. It was a
// measurement of a DIFFERENT model — discs at each waypoint, keyed to stop count — that the walker
// model below superseded and that has since been deleted; under it the basin appeared only at the
// last stop. And it listed Independent quant BEFORE Electronic Arts, while the waypoints run the other
// way. Both errors were invisible because the table is prose. tests/knowledge.test.ts now asserts the
// story against the live function and the page's own path, so a retune that changes it goes red.

import { WAYPOINTS } from './trajectory';

/** How far you can read the field, at a given amount of experience (in stop-equivalents).
 *
 *  Grows linearly with experience: the base is what one position teaches you, the increment is
 *  getting better at reading. Deliberately simple — a fancier law would be unfalsifiable, and the
 *  claim only needs to be "your reach improves". */
export function knowledgeRadius(experience: number, base = 0.75, growth = 0.16): number {
  return base + experience * growth;
}

/** One disc of known field: a place the walker has been, and how far it could read from there. */
interface KnownDisc { x: number; y: number; r: number }

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
function walkerKnowledge(
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
    // Experience at this point of the walk, in stop-equivalents, so the radius law reads the same way
    // whether you think in stops or in distance along the curve.
    out.push({ x: p.x, y: p.y, r: knowledgeRadius(t * (WAYPOINTS.length - 1)) });
  }
  return out;
}

/**
 * A knownness FUNCTION for a fixed frontier — build once per frame, call thousands of times.
 *
 * Returns 0 outside everything known, rising toward 1 at a disc's centre. SMOOTH RATHER THAN BINARY so
 * the drawn surface can fade in at the edge of knowledge instead of ending on a hard circle — a hard
 * edge reads as a rendering artefact, while a soft one reads as the limit of what you can see.
 *
 * THE PERFORMANCE BUG THIS FIXES, because it made the animation a slideshow: the previous
 * walkerKnownness(x, y, u, pathAt) rebuilt the entire frontier on EVERY CALL. At full reveal that is
 * up to 97 discs, each requiring a spline sample, and the draw calls it once per contour point —
 * roughly 290,000 disc constructions per frame. Measured: a single 1739ms synchronous long task per
 * frame, i.e. 0.6fps, which is exactly the "step function, like a powerpoint" symptom.
 *
 * Hoisting the frontier out of the inner loop is the whole fix. The caller builds this once per frame
 * and then the per-point cost is just a distance test against a fixed array.
 *
 * THE ONLY EXPORT THE PAGE USES. Five more used to sit below it — `knownAfter`, `isKnown`, `knownness`,
 * `discoveredAt`, `knownMean` — the per-stop model of the same feature, which this replaced and which
 * nothing on the site had called since. Their spec was the only thing that made them look alive, and it
 * was also the only thing asserting the discovery story; it now asserts it against this.
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
