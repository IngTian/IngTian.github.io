// src/lib/gateVariants/contour.ts
//
// THE GATE'S BACKGROUND AS A TOPOGRAPHIC MAP. Same loss field as the hero, same camera, same build-time-only
// rule as gatePaths.ts — but level sets instead of descent runs.
//
// WHY LEVEL SETS, GIVEN THAT DESCENT TRAILS ARE THE SITE'S METAPHOR. The owner's verdict on the descent
// version was "ur lines are horrible", and the measurement agreed in three places. Two were fixable by
// hand (the cusps, now dead — catmullRomPath is centripetal), but the third is structural: every descent run
// on this field ENDS at one of the three Gaussian minima, so 36 trails pile into 3 points and the middle of
// the frame is a knot of lines crossing at every angle. No amount of smoothing removes that; convergence is
// what gradient descent IS.
//
// Level sets of a function cannot cross each other. That is a theorem, not a tuning: two curves f = a and
// f = b with a != b share no point, and a single level's components are disjoint by construction. So the knot
// is gone by construction rather than by parameter, which is the only kind of fix worth shipping for a
// defect that was structural. And it still reads as the same object — these are the hero's mountain seen from
// above, on the hero's surface, through the hero's camera.
//
// WHAT IS HONEST AND WHAT IS COMPOSED, stated up front because this site bins surfaces that "look like they
// mean something without meaning anything". The curves are real: marching squares over field() on a 256x256
// grid, chained, projected. The COMPOSITION is chosen — which iso-heights, where a long ring breaks into
// separate strokes, how short a fragment is before it is noise, how sharp a bend is before it is a kink. Those
// choices are named in the constants below with the number that drove each one.
import { GATE_VIEW_H, GATE_VIEW_W, catmullRomPath, type Pt, type Trail } from '../gatePaths';
import { RANGE, field, project } from '../terrain';
import { TERRAIN_CONFIG_DEFAULTS } from '../terrainRender';

export const LABEL = 'Contours';
export const NOTE =
  'Level sets of the hero’s loss field: marching squares at eight iso-heights, chained, then projected '
  + 'through the hero’s own camera — so a ring of constant height still takes the surface’s perspective.';

/**
 * The hero's camera, imported rather than retyped, for the same reason gatePaths.ts imports it:
 * TerrainHero.astro's comment says anything drawn on the surface must use the SAME zoom to stay on it.
 */
const ZOOM = TERRAIN_CONFIG_DEFAULTS.zoom;

/**
 * Grid resolution for the scalar field. 257^2 = 66,049 field() calls, once, at build time — tens of ms, and
 * the output is static markup, so there is no reason to be frugal. Resolution matters because marching squares
 * produces a staircase at the grid scale: at 256 a cell is 0.0203 world units, which projects to ~4.7 screen
 * px, well under the 16px resample step that averages it out. It was 128 first (9.4px cells), which forced a
 * 30px resample step to hide the staircase, and a 30px step inflated every measured turning angle by ~2x —
 * see SAMPLE.
 */
const GRID = 256;

/**
 * Iso-heights, as fractions of the field's own measured [min, max] = [-1.533, 0.932].
 *
 * THE EXTREMES ARE LEFT OUT, AND THAT IS THE ONE COMPOSED CHOICE THAT CHANGES THE PICTURE. Total projected
 * contour length per level is strongly peaked: 561px at the 5% level, 3850px at 50%, 628px at 95% — a 6.9x
 * spread, because near the floor or the ceiling of a Gaussian mixture every component is a small closed ring
 * around one critical point, while a mid level is a long sweep across the whole frame. Run with nine levels
 * spanning 0.05..0.95, the 5% level contributes ZERO strokes (its rings are under the MIN_RUN floor) and the
 * rest come out 2, 3, 2, 4, 8, 6, 2, 2 — a comb with bald patches, and coverage drops to 0.88 x 0.89.
 *
 * These eight sit between 0.20 and 0.82, and that is the whole difference: 2, 3, 6, 6, 8, 6, 5, 2 strokes per
 * level, 38 total, coverage 1.00 x 0.94. Spacing inside the band is near-even with a slight widening at the
 * ends, which is what equalises those counts — the levels are not equally productive, so equal spacing is the
 * wrong target.
 */
const LEVEL_FRACTIONS = [0.20, 0.29, 0.38, 0.46, 0.54, 0.63, 0.72, 0.82];

/**
 * Uniform arc-length resample step, in screen px.
 *
 * SAY WHAT THIS DOES TO THE MEASUREMENT, because it is not neutral. A turning angle between two chords of
 * length s on a curve of radius r is about s/r radians, so the sample step is a MULTIPLIER on every angle the
 * tests report. Raw marching-squares vertices land wherever a cell edge happens to be crossed — chords of a
 * fraction of a pixel — so measured on those the worst turn is 90+ degrees of pure grid quantisation and says
 * nothing about the curve. 16px (3.4 cells at GRID = 256) is small enough that the drawn Bézier tracks the
 * true level set and large enough that the staircase is averaged out; measured on the unfiltered set, the same
 * geometry reports 53.7 degrees at this step and 71.1 at 30px, with every chord coming out at 15-16px, which
 * confirms both numbers are real curvature rather than noise. The honest summary: the angles the tests report
 * describe the curve at a 16px scale, and the tightest bend that survives MAX_TURN has a radius of ~29px.
 */
const SAMPLE = 16;

/**
 * Hard ceiling on a stroke's worst turning angle, in degrees, at SAMPLE spacing. Over it, the stroke is
 * dropped.
 *
 * THIS IS A SELECTION, NOT A SMOOTHING, and the distribution is why it is defensible. The 42 strokes split
 * cleanly in two: 38 of them turn at most 32 degrees, and four turn 44, 47, 49 and 54. Those four are the
 * contours that squeeze past a saddle of the Gaussian mixture, where a level set really does bend with a
 * ~16px radius — a kink, not a curve, and the one shape in the set that would break a combed sweep. 40
 * degrees sits in the empty band between the two groups, so this threshold is not splitting hairs: moving it
 * anywhere in 33..43 drops exactly the same four strokes.
 */
const MAX_TURN = 40;

/**
 * Target screen length of one stroke, and the floor below which a fragment is noise rather than a line.
 *
 * The floor is set at 0.62 x TARGET for an arithmetical reason: splitting a run of length S into
 * n = round(S/TARGET) pieces gives pieces in [TARGET(1 - 1/2n), TARGET(1 + 1/2n)], worst case n = 1, i.e. up
 * to 1.5 x TARGET. So longest/shortest <= 1.5 / 0.62 = 2.42, which clears the < 3.0 rhythm bar with room for
 * the gap trimming below to eat into the short end.
 */
const TARGET = 330;
const MIN_RUN = TARGET * 0.62;

/**
 * Whitespace left at a break when one long contour becomes several strokes, in screen px.
 *
 * THIS GAP IS WHY THE SPLIT IS NOT METRIC-GAMING. A ring 900px long counted as one 900px stroke blows the
 * rhythm bar; the same ring cut into three and re-joined seamlessly passes the bar while still being one
 * 900px stroke on screen, which would be cheating the measurement rather than fixing the picture. Trimming
 * one sample point (GAP / 2 / SAMPLE = exactly 1, so 16px) off each side of every break makes the strokes
 * genuinely separate — real whitespace, the way a topo map breaks a contour for a label — so the number the
 * test measures is the number a reader sees.
 */
const GAP = 32;

/** Edge-crossing id. Interpolation for a shared cell edge is computed identically from both sides, so the
 *  two cells produce bit-identical coordinates and this key dedupes them exactly — no epsilon needed. */
type EdgeId = string;

interface Iso { pts: Map<EdgeId, Pt>; segs: Array<[EdgeId, EdgeId]> }

/** field() sampled on a regular (GRID+1)^2 lattice over the RANGE square. v[i][j], i along x, j along y. */
function scalarGrid(): { xs: number[]; ys: number[]; v: number[][] } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= GRID; i++) {
    const t = -RANGE + (2 * RANGE * i) / GRID;
    xs.push(t);
    ys.push(t);
  }
  const v = xs.map((x) => ys.map((y) => field(x, y)));
  return { xs, ys, v };
}

/**
 * Marching squares at one level, emitting cell-edge crossings and the segments that join them.
 *
 * Corner bits are bl=1, br=2, tr=4, tl=8 ("set" = strictly above the level, consistently, so a corner that
 * sits exactly on the level reads the same from both neighbouring cells). The two saddle cases (5 and 10) are
 * resolved by the four-corner average — the cheap standard disambiguation. They are rare on a grid this fine,
 * but getting them wrong connects the wrong pair of edges and chaining then walks a contour into its
 * neighbour, which is visible as a line that jumps across a ridge.
 */
function marchingSquares(g: { xs: number[]; ys: number[]; v: number[][] }, level: number): Iso {
  const { xs, ys, v } = g;
  const pts = new Map<EdgeId, Pt>();
  const segs: Array<[EdgeId, EdgeId]> = [];

  // Horizontal edge (i,j)-(i+1,j); null when the level does not cross it.
  const hEdge = (i: number, j: number): EdgeId | null => {
    const a = v[i][j], b = v[i + 1][j];
    if ((a > level) === (b > level)) return null;
    const id = `h${i}.${j}`;
    const t = (level - a) / (b - a);
    pts.set(id, { x: xs[i] + t * (xs[i + 1] - xs[i]), y: ys[j] });
    return id;
  };
  // Vertical edge (i,j)-(i,j+1).
  const vEdge = (i: number, j: number): EdgeId | null => {
    const a = v[i][j], b = v[i][j + 1];
    if ((a > level) === (b > level)) return null;
    const id = `v${i}.${j}`;
    const t = (level - a) / (b - a);
    pts.set(id, { x: xs[i], y: ys[j] + t * (ys[j + 1] - ys[j]) });
    return id;
  };

  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      const code = (v[i][j] > level ? 1 : 0) | (v[i + 1][j] > level ? 2 : 0)
        | (v[i + 1][j + 1] > level ? 4 : 0) | (v[i][j + 1] > level ? 8 : 0);
      if (code === 0 || code === 15) continue;
      // Edge order: 0 = bottom, 1 = right, 2 = top, 3 = left.
      const e = [hEdge(i, j), vEdge(i + 1, j), hEdge(i, j + 1), vEdge(i, j)];
      const hi = (v[i][j] + v[i + 1][j] + v[i + 1][j + 1] + v[i][j + 1]) / 4 > level;
      const pairs: Array<[number, number]> =
        code === 1 || code === 14 ? [[3, 0]]
          : code === 2 || code === 13 ? [[0, 1]]
            : code === 3 || code === 12 ? [[3, 1]]
              : code === 4 || code === 11 ? [[1, 2]]
                : code === 6 || code === 9 ? [[0, 2]]
                  : code === 7 || code === 8 ? [[3, 2]]
                    // 5 = bl+tr set, 10 = br+tl set. When the cell centre agrees with the diagonal pair,
                    // that pair is connected through the centre, so the contour isolates the OTHER two
                    // corners; when it disagrees, the opposite.
                    : code === 5 ? (hi ? [[0, 1], [3, 2]] : [[3, 0], [1, 2]])
                      : (hi ? [[3, 0], [1, 2]] : [[0, 1], [3, 2]]);
      for (const [a, b] of pairs) {
        const ea = e[a], eb = e[b];
        if (ea !== null && eb !== null) segs.push([ea, eb]);
      }
    }
  }
  return { pts, segs };
}

/**
 * Chain the segment soup into polylines.
 *
 * SKIPPING THIS STEP IS THE CLASSIC MARCHING-SQUARES MISTAKE: raw output is thousands of disconnected
 * 2-point segments, and drawn as such it is static, not contours. Every cell edge is shared by at most two
 * cells, so a crossing has degree <= 2 and the walk is unambiguous — no branching to resolve. Open chains are
 * grown from their degree-1 ends first (a contour that leaves the RANGE square), then whatever is left is a
 * closed ring and is grown from any of its nodes, returning to the start.
 */
function chain({ pts, segs }: Iso): Pt[][] {
  const inc = new Map<EdgeId, number[]>();
  segs.forEach(([a, b], k) => {
    for (const id of [a, b]) {
      const cur = inc.get(id);
      if (cur) cur.push(k); else inc.set(id, [k]);
    }
  });
  const used = segs.map(() => false);
  const walk = (start: EdgeId): EdgeId[] => {
    const ids = [start];
    let cur = start;
    for (;;) {
      const next = (inc.get(cur) ?? []).find((k) => !used[k]);
      if (next === undefined) return ids;
      used[next] = true;
      const [a, b] = segs[next];
      cur = a === cur ? b : a;
      ids.push(cur);
    }
  };
  const chains: EdgeId[][] = [];
  for (const [id, ks] of inc) if (ks.length === 1 && !used[ks[0]]) chains.push(walk(id));
  for (let k = 0; k < segs.length; k++) if (!used[k]) chains.push(walk(segs[k][0]));
  // Map iteration is insertion order, and insertion order is the i/j scan above, so this is deterministic.
  return chains.map((ids) => ids.flatMap((id) => {
    const p = pts.get(id);
    return p === undefined ? [] : [p];
  }));
}

/**
 * WORLD-SPACE level set at one height, chained. Exported as the test seam for the only claim this variant
 * really has to make: that these curves ARE level sets of field(), not curves that look like it. Nothing
 * downstream can show that — trails() returns screen coordinates, and this camera is not cheaply invertible
 * (screen y mixes the world y with field(x, y)), so the assertion has to be made here, before projection.
 *
 * The grid is a parameter so trails() can build it once for all eight levels instead of 66k field() calls
 * per level; the default exists for the test's benefit.
 */
export function isoCurves(level: number, g = scalarGrid()): Pt[][] {
  return chain(marchingSquares(g, level));
}

/** Maximal runs of consecutive in-viewBox points. A contour leaving the frame simply ends there, instead of
 *  running off and re-entering from nowhere — which is defect 3 of the descent version. The break lands
 *  within one grid cell (~4.7px) of the edge, and the gate's SVG uses `slice`, so that margin is off-screen. */
function clipRuns(pts: readonly Pt[], w: number, h: number): Pt[][] {
  const runs: Pt[][] = [];
  let cur: Pt[] = [];
  for (const p of pts) {
    if (p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= h) cur.push(p);
    else { if (cur.length > 1) runs.push(cur); cur = []; }
  }
  if (cur.length > 1) runs.push(cur);
  return runs;
}

/** Worst turning angle between consecutive chords, in degrees. Zero-length chords are skipped rather than
 *  dividing by zero — resample() can emit a duplicate endpoint on a closed ring. */
function worstTurnDeg(pts: readonly Pt[]): number {
  let worst = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const ax = pts[i].x - pts[i - 1].x, ay = pts[i].y - pts[i - 1].y;
    const bx = pts[i + 1].x - pts[i].x, by = pts[i + 1].y - pts[i].y;
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    if (la < 1e-9 || lb < 1e-9) continue;
    const cos = Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb)));
    worst = Math.max(worst, (Math.acos(cos) * 180) / Math.PI);
  }
  return worst;
}

/** Cumulative chord length of a polyline. */
function arcLength(pts: readonly Pt[]): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return s;
}

/** Uniform arc-length resample at `step`, endpoints kept. See SAMPLE for why this is not cosmetic. */
function resample(pts: readonly Pt[], step: number): Pt[] {
  const first = pts[0];
  if (first === undefined) return [];
  const out: Pt[] = [first];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (seg <= 1e-9) continue;
    let d = step - carry;
    while (d <= seg) {
      out.push({ x: a.x + ((b.x - a.x) * d) / seg, y: a.y + ((b.y - a.y) * d) / seg });
      d += step;
    }
    carry = seg - (d - step);
  }
  const last = pts[pts.length - 1];
  const tail = out[out.length - 1];
  // Keep the true endpoint unless the final resampled point is already essentially on it, so a stroke ends
  // where the contour ends rather than up to one step short of it.
  if (tail !== undefined && Math.hypot(last.x - tail.x, last.y - tail.y) > step * 0.25) out.push(last);
  return out;
}

/**
 * Cut a uniformly-sampled run into strokes of roughly TARGET length, with GAP of real whitespace at each
 * break. Points are evenly spaced by construction, so splitting on index IS splitting on arc length.
 */
function strokes(pts: readonly Pt[]): Pt[][] {
  const total = arcLength(pts);
  if (total < MIN_RUN) return [];
  const n = Math.max(1, Math.round(total / TARGET));
  if (n === 1) return [[...pts]];
  const drop = Math.max(1, Math.round(GAP / 2 / SAMPLE));  // points to trim at each side of a break
  const out: Pt[][] = [];
  for (let k = 0; k < n; k++) {
    const lo = Math.round((k * (pts.length - 1)) / n) + (k === 0 ? 0 : drop);
    const hi = Math.round(((k + 1) * (pts.length - 1)) / n) - (k === n - 1 ? 0 : drop);
    if (hi - lo >= 2) out.push(pts.slice(lo, hi + 1));
  }
  return out;
}

/**
 * The shipped contours. Sorted by iso-height, so the opacity/width ramp reads as elevation rather than as an
 * accident of the scan order — and so every stroke cut from one ring gets the SAME weight, which is what
 * keeps a break reading as whitespace instead of as a brightness step.
 */
export function trails(w: number = GATE_VIEW_W, h: number = GATE_VIEW_H): Trail[] {
  const g = scalarGrid();
  let lo = Infinity, hi = -Infinity;
  for (const col of g.v) for (const z of col) { if (z < lo) lo = z; if (z > hi) hi = z; }

  const byLevel: Pt[][][] = LEVEL_FRACTIONS.map((f) => {
    const level = lo + (hi - lo) * f;
    return isoCurves(level, g).flatMap((poly) => {
      // field() ALREADY folds in ZSCALE, so the height passed here is field()'s own output — the same
      // convention terrainRender and gatePaths use. A contour of constant height therefore does NOT come out
      // as a constant screen y: it picks up the surface's perspective, which is the point of projecting at all.
      const screen = poly.map(({ x, y }) => {
        const [sx, sy] = project(x, y, field(x, y), w, h, ZOOM);
        return { x: sx, y: sy };
      });
      return clipRuns(screen, w, h)
        .flatMap((run) => strokes(resample(run, SAMPLE)))
        .filter((s) => worstTurnDeg(s) <= MAX_TURN);
    });
  });

  // The ramp is keyed to the LEVEL, not to the stroke index: gatePaths ramps per trail because each of its
  // trails is a whole curve, but here several strokes are pieces of one ring and a per-stroke ramp would put
  // a brightness step in the middle of a contour. Same 0.10-0.55 / 0.5-1.6 envelopes, still non-decreasing
  // in i because the strokes come out in level order.
  const span = Math.max(1, LEVEL_FRACTIONS.length - 1);
  const out: Trail[] = [];
  byLevel.forEach((group, li) => {
    const t = li / span;
    for (const pts of group) {
      out.push({
        d: catmullRomPath(pts),
        i: out.length,
        opacity: Math.round((0.1 + t * 0.45) * 1000) / 1000,
        width: Math.round((0.5 + t * 1.1) * 100) / 100,
      });
    }
  });
  return out;
}
