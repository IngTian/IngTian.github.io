// tests/gateVariantDescentTrunc.test.ts
//
// THE "TRUNCATED DESCENT" GATE VARIANT. Like gatePaths.test.ts, everything under test here runs at BUILD time,
// so this file is the only place the code will ever be observed — there is no runtime to watch it in.
//
// WHY THESE PARTICULAR ASSERTIONS. The variant exists because the owner looked at the shipped gate and said
// "ur lines are horrible", and three separate things were wrong: a hairpin, a knot where 36 descents piled into
// 3 basins, and a 22x spread in stroke length with 19 of 36 strokes running outside the viewBox. "Looks nicer"
// is not checkable, so each complaint was turned into a number, and those numbers are the tests below. The
// shipped version's values are quoted next to each one, measured the same way, so a regression is visible as a
// slide back toward them rather than as a bare threshold nobody can place.
//
// Measured on `gateTrails()` (the shipped geometry) with exactly the helpers in this file:
//   worst turn 76.6 deg · length ratio 21x · busiest 20x20 cell holds 55.6% of the trails.
// Measured on `trails()` (this variant):
//   worst turn 18.8 deg · length ratio 1.001 · busiest cell holds 8.6%.
import { describe, expect, it } from 'vitest';
import { GATE_VIEW_H, GATE_VIEW_W, type Pt } from '../src/lib/gatePaths';
import { LABEL, NOTE, combPoints, streamline, trails, worstTurnDeg } from '../src/lib/gateVariants/descentTrunc';
import { field, grad, runDescent } from '../src/lib/terrain';

// ── Helpers: read the geometry back out of the path data ────────────────────────────────────────────────────
//
// The metrics are asserted against the DRAWN path wherever possible, not against the points the module happened
// to feed the spline. That distinction is not pedantry: the shipped gate's defect was created BY the spline —
// uniform Catmull-Rom threw control points past their neighbours and drew a 173.8-degree hairpin through a set
// of input points that were perfectly tame. Measuring the inputs would have called that picture clean.

/** Every coordinate pair in a `d` string, control points included. This is the stream gatePaths.test.ts
 *  measures its own turning angle on, so the 76.6-degree baseline and this file's numbers are comparable. */
function allCoords(d: string): Pt[] {
  return [...d.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)]
    .map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
}

/**
 * The curve the browser will actually paint, flattened: each cubic sampled at 8 interior steps.
 *
 * 8 is enough because the knots are ~37px apart, so a sample lands every ~5px and nothing a 1.6px stroke can
 * show hides between two of them. This is what the coverage, length and cell-occupancy metrics run on — a
 * metric computed on 9 knots per stroke would happily miss a curve that bulged into a neighbouring cell.
 */
function flatten(d: string): Pt[] {
  const n = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
  const out: Pt[] = [{ x: n[0], y: n[1] }];
  for (let i = 2; i + 5 < n.length; i += 6) {
    const p0 = out[out.length - 1];
    const [c1x, c1y, c2x, c2y, p3x, p3y] = [n[i], n[i + 1], n[i + 2], n[i + 3], n[i + 4], n[i + 5]];
    for (let k = 1; k <= 8; k++) {
      const t = k / 8, u = 1 - t;
      out.push({
        x: u * u * u * p0.x + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * p3x,
        y: u * u * u * p0.y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * p3y,
      });
    }
  }
  return out;
}

function polyLen(pts: readonly Pt[]): number {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return L;
}

const T = trails();
const flat = T.map((t) => flatten(t.d));

// ── The rhythm metrics: the three complaints, as numbers ────────────────────────────────────────────────────

describe('determinism, because a gate that shimmers between deploys undercuts itself', () => {
  it('produces byte-identical output on a second call', () => {
    // The site's standing rule, inherited from the Rules slide's seeded fan: "a fan that shimmered between
    // builds would undercut a slide whose whole claim is that the scale is real". Every random-looking choice
    // here — the lattice jitter and the order candidates are visited in — comes from hash01, so this is the
    // test that would catch a Math.random() creeping back in.
    expect(JSON.stringify(trails())).toBe(JSON.stringify(T));
  });

  it('is identical again at a non-default viewBox', () => {
    expect(JSON.stringify(trails(900, 600))).toBe(JSON.stringify(trails(900, 600)));
  });

  it('carries a label and a note for the switcher', () => {
    expect(LABEL.length).toBeGreaterThan(0);
    expect(NOTE.length).toBeGreaterThan(40);
  });
});

describe('no NaN or Infinity anywhere in the path data', () => {
  it('keeps every `d` string numeric', () => {
    // Not hypothetical: the walk divides by |grad| to normalise the step, the resample divides by a segment
    // length, and the spline divides by a knot distance. Three divisions, each by something that can be zero
    // on a stationary point or a pair of coincident samples. One NaN in a `d` attribute drops the whole path
    // silently, so the picture would just quietly lose a stroke.
    for (const t of T) expect(t.d, `trail ${t.i}`).not.toMatch(/NaN|Infinity/);
  });

  it('keeps every parsed coordinate finite', () => {
    for (const t of T) for (const p of allCoords(t.d)) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y), t.d).toBe(true);
    }
  });
});

describe('count: 24 to 48 strokes', () => {
  it('ships 35', () => {
    // The band is the brief's; 35 is where the geometry settles, and it is deliberately NOT where the
    // MAX_TRAILS cap sits (40). If this number ever equals the cap, the cap — not the spacing — is choosing
    // the density, and the picture stopped being the thing that was judged.
    expect(T).toHaveLength(35);
    expect(T.length).toBeGreaterThanOrEqual(24);
    expect(T.length).toBeLessThanOrEqual(48);
  });

  it('indexes them 0..n-1 in draw order', () => {
    expect(T.map((t) => t.i)).toEqual(T.map((_, i) => i));
  });
});

describe('bounded curvature: the hairpin is gone', () => {
  it('turns at most 60 degrees anywhere on the drawn curve', () => {
    // 76.6 degrees is the shipped version's worst, measured by this exact function on this exact coordinate
    // stream — and 76.6 is itself the POST-FIX number, after catmullRomPath went centripetal; before that it
    // was 173.8, a fold rather than a curve. This variant measures 18.8, and the reason it is so much calmer
    // is not a better spline: it is that the knots arrive EVENLY spaced. runDescent downsamples by index, so
    // one trail's segments varied 412.8x in length and the spline had to bend hard to connect them; walking
    // the gradient normalised and resampling by arc length makes every knot gap ~37px by construction.
    let worst = 0;
    for (const t of T) worst = Math.max(worst, worstTurnDeg(allCoords(t.d)));
    expect(worst, `worst turn ${worst.toFixed(1)} deg (shipped: 76.6)`).toBeLessThan(60);
    expect(worst).toBeLessThan(25);                 // where it actually sits, so an approach to 60 shows up
  });

  it('turns at most 60 degrees on the knot polyline too', () => {
    // The knots are the stricter measurement of the two here (29.5 vs the drawn 18.8), because centripetal
    // Catmull-Rom spreads a turn over two control points instead of cornering at the knot. Asserted separately
    // so that a future change to the spline cannot make a kinked input look smooth.
    let worst = 0;
    for (const p of combPoints()) worst = Math.max(worst, worstTurnDeg(p.pts));
    expect(worst, `worst knot turn ${worst.toFixed(1)} deg`).toBeLessThan(60);
  });
});

describe('length rhythm: longest / shortest under 3.0', () => {
  it('holds every stroke to within 1% of the same drawn length', () => {
    // Shipped: 22x, from 40px to 865px — a handful of giant swoops over a scatter of stubs, which is the "no
    // rhythm" half of the complaint. Here the cut is made at a fixed SCREEN arc length, so this is near 1.000
    // by construction and the test is really guarding the construction.
    //
    // It is not EXACTLY 1.000, and the reason is worth knowing because it looks like a bug: the camera can run
    // a descent backwards on screen (z falls as the stroke descends, pushing it up the screen while ry pushes
    // it down), and where those cancel the projected path turns back on itself inside one knot gap. The arc
    // spent on that excursion is paid for but not seen, so the stroke draws slightly short.
    const lens = flat.map(polyLen);
    const ratio = Math.max(...lens) / Math.min(...lens);
    expect(ratio, `ratio ${ratio.toFixed(3)} (shipped: 21)`).toBeLessThan(3);
    expect(ratio).toBeLessThan(1.1);
  });
});

describe('coverage: the strokes fill the field rather than clustering', () => {
  const xs = flat.flat().map((p) => p.x);
  const ys = flat.flat().map((p) => p.y);

  it('spans at least 70% of the viewBox width and 50% of its height', () => {
    const w = (Math.max(...xs) - Math.min(...xs)) / GATE_VIEW_W;
    const h = (Math.max(...ys) - Math.min(...ys)) / GATE_VIEW_H;
    expect(w, `width coverage ${w.toFixed(3)}`).toBeGreaterThanOrEqual(0.7);
    expect(h, `height coverage ${h.toFixed(3)}`).toBeGreaterThanOrEqual(0.5);
  });

  it('is an honest bar, and this is the part of it the bar does NOT see', () => {
    // A union-of-bounding-boxes span is a weak measure — two strokes in opposite corners satisfy it — so the
    // stronger claim is made here rather than left implied: the strokes touch 213 of the 400 cells of the 20x20
    // grid, and every one of the 20 columns and 20 rows has ink in it.
    //
    // The 187 empty cells are not a bug to chase. The terrain is a SQUARE in world space and the camera shears
    // it into a quadrilateral, so parts of the viewBox are off the terrain altogether; and beyond the terrain's
    // edge the five Gaussians have decayed far enough that |grad| drops under the module's FLAT cutoff, which
    // means there is no descent there to draw. A picture with ink in those regions would be a picture with ink
    // where the field has nothing to say.
    const cells = new Set<string>(), cols = new Set<number>(), rows = new Set<number>();
    for (const pts of flat) for (const p of pts) {
      const cx = Math.floor((p.x / GATE_VIEW_W) * 20), cy = Math.floor((p.y / GATE_VIEW_H) * 20);
      cells.add(`${cx},${cy}`); cols.add(cx); rows.add(cy);
    }
    expect(cells.size, `${cells.size} of 400 cells`).toBeGreaterThanOrEqual(180);
    expect(cols.size).toBeGreaterThanOrEqual(18);
    expect(rows.size).toBeGreaterThanOrEqual(18);
  });

  it('keeps every drawn point inside the viewBox', () => {
    // The shipped version had 19 of 36 trails with points outside the 1200x800 box, and because the gate's SVG
    // uses preserveAspectRatio="xMidYMid slice" those strokes leave one edge and reappear somewhere else — a
    // line from nowhere. This is that defect, as a test.
    for (const pts of flat) for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(GATE_VIEW_W);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(GATE_VIEW_H);
    }
  });
});

describe('no knot: this is the assertion the shipped version fails', () => {
  it('lets no 20x20 cell hold points from more than 40% of the strokes', () => {
    // THE POINT OF THE WHOLE EXERCISE, so it is computed honestly: the grid is over the full viewBox (cells of
    // 60x40px), occupancy is counted from the FLATTENED curve rather than from the knots, and a stroke counts
    // once per cell no matter how many of its samples land there.
    //
    // Shipped: 20 of 36 trails — 55.6% — share one cell at roughly (390, 270), because all 36 descents run to
    // one of only three minima and that is where two of the basins land on screen. Here: 3 of 35, 8.6%.
    //
    // Two things buy that. Truncation removes the attractors from the picture entirely. And the dart-throwing
    // pass measures separation between WHOLE STROKES rather than between their starting points — separating
    // only the starts was tried first and still left a visible bundle of 8 strokes near (700, 380), because
    // strokes can fan out from well-spread heads and converge anyway.
    const cells = new Map<string, Set<number>>();
    flat.forEach((pts, i) => {
      for (const p of pts) {
        const key = `${Math.floor((p.x / GATE_VIEW_W) * 20)},${Math.floor((p.y / GATE_VIEW_H) * 20)}`;
        const set = cells.get(key) ?? new Set<number>();
        set.add(i);
        cells.set(key, set);
      }
    });
    const worst = Math.max(...[...cells.values()].map((s) => s.size));
    expect(worst / T.length, `busiest cell holds ${worst}/${T.length} (shipped: 20/36)`).toBeLessThan(0.4);
    expect(worst / T.length).toBeLessThan(0.15);
  });
});

// ── The claim underneath the picture: these are real descents ───────────────────────────────────────────────

describe('it is still gradient descent, which is the only reason it is allowed to exist', () => {
  // This site binned five showpieces for "looking like they meant something without meaning anything", and the
  // replacement rule is that the surface has to be real math, computed. A picture of plausible curves would
  // pass every metric above. These are the tests that say the curves are what they claim to be.
  const P = combPoints();

  it('loses height at every single step of every single stroke', () => {
    // The definition of descent, asserted directly on the field. Worst case measured: the field still FALLS by
    // 0.033 between the closest pair of knots, so there is not one uphill segment anywhere in the picture.
    for (const p of P) {
      for (let i = 1; i < p.world.length; i++) {
        const drop = field(p.world[i - 1].x, p.world[i - 1].y) - field(p.world[i].x, p.world[i].y);
        expect(drop, `stroke rose at knot ${i}`).toBeGreaterThan(0);
      }
    }
  });

  it('has NOT converged — every stroke stops on a real slope', () => {
    // The truncation claim, and the inverse of what gatePaths.test.ts asserts about the shipped version ("ends
    // each trail at a stationary point of the field", |grad| < 0.05 for 30+ of 36). Here the smallest gradient
    // at any stroke's END is 0.150 — three times that threshold, and thirty times the module's own FLAT cutoff.
    for (const p of P) {
      const e = p.world[p.world.length - 1];
      const [gx, gy] = grad(e.x, e.y);
      expect(Math.hypot(gx, gy), `stroke ended flat at ${e.x},${e.y}`).toBeGreaterThan(0.05);
    }
  });

  it('leaves real descent on the table — 0.14 to 1.34 world units of it', () => {
    // A sharper version of the same claim: finish each stroke with runDescent and see how far it still had to
    // go. The nearest call is 0.14 world units, which is why the module's prose says "still on a real slope"
    // rather than "long before the basin" — one stroke does get fairly close, and overclaiming in a comment is
    // how this repo's guide went stale twice.
    let nearest = Infinity;
    for (const p of P) {
      const e = p.world[p.world.length - 1];
      const done = runDescent(e.x, e.y);
      const f = done[done.length - 1];
      nearest = Math.min(nearest, Math.hypot(f.x - e.x, f.y - e.y));
    }
    expect(nearest, `nearest stroke stopped ${nearest.toFixed(3)} from its minimum`).toBeGreaterThan(0.1);
  });

  it('is numerically the same curve a four-times-finer walk traces', () => {
    // Explicit Euler, so the error is FIRST order in the step and the step size is a real choice rather than a
    // detail. At 0.02 the traced path sat up to 7.1px off the converged streamline, which is visible on a 300px
    // stroke; at the shipped 0.005 the worst knot is 0.82px from where a 0.00125 walk puts it. The bar is 2px,
    // which sits between the two so that a loosened step fails this rather than quietly bending the picture.
    let worst = 0;
    for (const p of P) {
      const a = p.world[0];
      const fine = streamline(a.x, a.y, 0.00125, 300, GATE_VIEW_W, GATE_VIEW_H);
      expect(fine, 'the finer walk should reach the same length').not.toBeNull();
      if (fine === null) continue;
      for (let i = 0; i < p.pts.length; i++) {
        worst = Math.max(worst, Math.hypot(p.pts[i].x - fine.pts[i].x, p.pts[i].y - fine.pts[i].y));
      }
    }
    expect(worst, `worst knot drift ${worst.toFixed(2)}px`).toBeLessThan(2);
  });

  it('returns null rather than a stub when the walk stalls', () => {
    // A Gaussian's centre is a stationary point, so the normalised step there is 0/0. The module answers that
    // by dropping the candidate — shipping it short would re-create the length lottery the variant exists to
    // remove — and this hands it that input directly, because asserting on the output count proves nothing
    // about which filter did the work. (-1.4, -0.5) is the deep valley's centre, straight out of BUMPS.
    expect(streamline(-1.4, -0.5, 0.005, 300, GATE_VIEW_W, GATE_VIEW_H)).toBeNull();
  });
});

describe('the ramps the markup carries', () => {
  it('ramps opacity inside 0.10..0.55 and width inside 0.5..1.6, monotonically', () => {
    for (let i = 1; i < T.length; i++) {
      expect(T[i].opacity).toBeGreaterThanOrEqual(T[i - 1].opacity);
      expect(T[i].width).toBeGreaterThanOrEqual(T[i - 1].width);
    }
    for (const t of T) {
      expect(t.opacity).toBeGreaterThanOrEqual(0.1);
      expect(t.opacity).toBeLessThanOrEqual(0.55);
      expect(t.width).toBeGreaterThanOrEqual(0.5);
      expect(t.width).toBeLessThanOrEqual(1.6);
    }
  });

  it('orders the strokes by camera depth, so the ramp is aerial perspective', () => {
    // Draw order is not arbitrary here: the strokes are sorted by the depth project() returns for their start,
    // so the faint thin end of the ramp is the far side of the terrain. Without the sort the weights would
    // scatter at random across the frame, since candidates are visited in hash order.
    const d = combPoints().map((p) => p.depth);
    for (let i = 1; i < d.length; i++) expect(d[i]).toBeGreaterThanOrEqual(d[i - 1]);
  });
});

describe('it scales with the viewBox instead of hardcoding 1200x800', () => {
  it('keeps the same comb proportions at 900x600', () => {
    // Gate.astro ships a fixed viewBox today, so this is about the function being honest rather than about a
    // size anyone renders. The tuning constants are px against GATE_VIEW_H and get scaled by min(w,h)/800 —
    // if one of them were left unscaled the stroke count would swing with the size.
    const small = trails(900, 600);
    expect(small.length).toBeGreaterThanOrEqual(24);
    expect(small.length).toBeLessThanOrEqual(48);
    for (const t of small) for (const p of flatten(t.d)) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(900);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(600);
    }
  });
});
