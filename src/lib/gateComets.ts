/**
 * THE GATE'S TRACKS: the ported curves, re-expressed as arc-length-parameterised polylines so something can
 * TRAVEL along them.
 *
 * Why this exists at all. Six dash schemes shipped on the gate and every one was rejected, because a dash makes
 * a line partial and its gap reads either as the line vanishing or as a trail hanging off it. Then the
 * dash-free version read as a static drawing. The brief that resolved both is the owner's:
 *
 *     "what i imagine is lines travelling through the background like the trails of asteroids."
 *
 * An asteroid trail is not a lit section of a line that is otherwise there — it is a bright HEAD with a tail
 * that decays to nothing, over an empty background. So the curves stop being things that get drawn and become
 * the TRACKS that heads move along, which is why this module turns a `d`-string into points and distances.
 * The site already speaks this language: the hero paints its gradient-descent walkers as fading comet trails
 * (`TerrainHero` + `lib/terrainRender.ts`), so the gate is now a relative of the hero rather than a borrowed
 * drawing with its own unrelated motion.
 *
 * Pure and unit-tested, per the Interactivity contract — the plumbing that owns a canvas and a rAF loop stays
 * in the component.
 */

/** A point in the curves' own user space (the viewBox's coordinates, not pixels). */
export interface Pt { x: number; y: number }

/**
 * A curve flattened for travel: the sample points, the cumulative arc length at each, and the total. `cum` is
 * what makes "where is the head after travelling 420 units" answerable without re-integrating the curve.
 */
export interface Track {
  pts: Pt[];
  /** cum[i] is the arc length from pts[0] to pts[i]. Monotone non-decreasing, cum[0] = 0. */
  cum: number[];
  total: number;
}

/** One cubic, as the `d`-strings here always spell it: start, two controls, end. */
interface Cubic { p0: Pt; c1: Pt; c2: Pt; p1: Pt }

const bez = (a: number, b: number, c: number, d: number, t: number): number => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
};

/**
 * Read the two cubics out of a gate `d`-string.
 *
 * Deliberately a narrow parser rather than a general one: these strings are emitted by `refFamily` in exactly
 * one shape (`M x y C x y x y x y C x y x y x y`), so the honest thing is to pull the 14 numbers out in order
 * and assert the count. A general SVG path parser here would be code with no second caller and a lot of
 * unreachable branches — and it would hide a malformed string instead of failing on it.
 */
export function parseCubics(d: string): Cubic[] {
  const n = d.replace(/[MC]/g, ' ').trim().split(/[\s,]+/).map(Number);
  if (n.length !== 14 || n.some((v) => !Number.isFinite(v))) {
    throw new Error(`gate track: expected 14 finite coordinates, got ${n.length} from "${d}"`);
  }
  const p = (i: number): Pt => ({ x: n[i], y: n[i + 1] });
  // n = [start, c1, c2, join, c3, c4, end] — the first cubic's own first control equals its start, which is how
  // the source writes it, so index 2 is skipped as a control and used only as the start.
  return [
    { p0: p(0), c1: p(2), c2: p(4), p1: p(6) },
    { p0: p(6), c1: p(8), c2: p(10), p1: p(12) },
  ];
}

/**
 * Flatten a gate curve into a travellable track.
 *
 * `steps` is per cubic. 120 puts the chord error far below a pixel for curves this smooth at the gate's ~2.1x
 * render scale, and the cost is paid once at startup rather than per frame.
 */
export function parseTrack(d: string, steps = 120): Track {
  const cubics = parseCubics(d);
  const pts: Pt[] = [];
  for (let ci = 0; ci < cubics.length; ci++) {
    const { p0, c1, c2, p1 } = cubics[ci];
    // Skip t=0 on the second cubic: it is the first one's endpoint, and a duplicated point would add a
    // zero-length segment that contributes nothing and makes `pointAt` interpolate 0/0.
    const from = ci === 0 ? 0 : 1;
    for (let s = from; s <= steps; s++) {
      const t = s / steps;
      pts.push({ x: bez(p0.x, c1.x, c2.x, p1.x, t), y: bez(p0.y, c1.y, c2.y, p1.y, t) });
    }
  }
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  return { pts, cum, total: cum[cum.length - 1] };
}

/**
 * The point at arc length `s` along the track, clamped to its ends.
 *
 * Binary search rather than a linear scan: a head and its tail are sampled many times per frame, and the tail
 * is walked backwards from the head, so this is the one function in the gate that runs in a hot loop.
 */
export function pointAt(track: Track, s: number): Pt {
  const { pts, cum, total } = track;
  if (s <= 0) return pts[0];
  if (s >= total) return pts[pts.length - 1];
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= s) lo = mid; else hi = mid;
  }
  const span = cum[hi] - cum[lo];
  const f = span > 0 ? (s - cum[lo]) / span : 0;
  return {
    x: pts[lo].x + (pts[hi].x - pts[lo].x) * f,
    y: pts[lo].y + (pts[hi].y - pts[lo].y) * f,
  };
}

/**
 * The `meet` fit, in one place.
 *
 * The gate used to be an SVG, and `preserveAspectRatio="xMidYMid meet"` did this arithmetic in the renderer.
 * On a canvas it has to be written out, and it must agree with the SVG version exactly or the composition the
 * owner settled on — the zoom in particular, measured against his reference screenshot — would quietly change
 * the moment the element type did.
 */
export function fitMeet(
  viewBox: readonly [number, number, number, number],
  w: number,
  h: number,
): { scale: number; dx: number; dy: number } {
  const [vx, vy, vw, vh] = viewBox;
  const scale = Math.min(w / vw, h / vh);
  return { scale, dx: (w - vw * scale) / 2 - vx * scale, dy: (h - vh * scale) / 2 - vy * scale };
}

/**
 * Deterministic [0,1) from an integer index — the site forbids `Math.random()` in a drawing, because two builds
 * of the same content must not disagree (the same rule the Rules slide's seeded walk follows).
 */
export function jitter(i: number, salt = 1): number {
  const x = Math.sin((i + 1) * 12.9898 * salt) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * THE ARC WINDOW THAT IS ACTUALLY ON SCREEN — the other half of "entire lines go dark immediately", and the
 * half an opacity envelope cannot reach.
 *
 * Only about a quarter of each curve is inside the frame; the rest runs off past the corners. So a dash that
 * sweeps the WHOLE arc spends most of its cycle outside the picture, and the stroke is simply not there.
 * Measured on the shipped family, the dash is entirely off-frame for **t in [0.28, 0.72] — 44% of every
 * cycle.** That is not a snap and not a trail: it is a line that is absent for nine seconds out of twenty.
 *
 * Clipping travel to this window fixes it at the cause. The dash still grows, still travels, still carries the
 * source's gap of one whole arc — it just never wanders out of the picture to do it.
 *
 * COMPUTED AGAINST THE VIEWBOX, DELIBERATELY, AND THAT IS THE CONSERVATIVE DIRECTION. `meet` fits the viewBox
 * inside the element and an SVG clips to its ELEMENT, not its box, so on a real screen the letterboxed overflow
 * makes strictly MORE of each curve visible than this returns. Erring that way means the window is a subset of
 * what is on screen, so a dash held inside it is always visible — never the reverse. It also means this can be
 * computed at build time, which matters: the gate's driver is inline (it must beat first paint) and therefore
 * cannot import this module. The window ships per path as a data attribute.
 */
export function visibleWindow(
  track: Track,
  viewBox: readonly [number, number, number, number],
  pad = 0,
): { a: number; b: number } {
  const [vx, vy, vw, vh] = viewBox;
  const inside = (p: Pt): boolean =>
    p.x >= vx - pad && p.x <= vx + vw + pad && p.y >= vy - pad && p.y <= vy + vh + pad;

  let a = -1;
  let b = -1;
  for (let i = 0; i < track.pts.length; i++) {
    if (inside(track.pts[i])) {
      if (a < 0) a = track.cum[i];
      b = track.cum[i];
    }
  }
  // A curve with no sampled point inside the box: hand back the whole arc rather than an empty window, so a
  // caller clamping travel to it degrades to the unclipped behaviour instead of pinning the dash to one spot.
  if (a < 0) return { a: 0, b: track.total };
  return { a, b };
}
