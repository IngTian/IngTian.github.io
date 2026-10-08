// src/lib/gateRefPaths.ts
//
// A FAITHFUL PORT OF THE 21st.dev "BackgroundPaths" GEOMETRY, because the owner's verdict on it was "it's
// already good enough. i mean itself is already good enough." Everything in this file is transcription — the
// numbers are theirs, not a derivation of ours.
//
// PROVENANCE, STATED PLAINLY. The curve family below is an authored artifact from a third-party component, not
// mathematics this site worked out. That matters for a personal portfolio whose stated rule is that a surface
// has to be real math, computed — five showpieces were rejected for looking like they meant something without
// meaning anything, and this one genuinely does not mean anything: it is a shape somebody liked. Shipping it is
// a deliberate decision to prefer a borrowed drawing that works over an original one that did not, and if it
// ships it should be credited.
//
// WHAT THE ORIGINAL ACTUALLY DOES, since it is easy to misread (I did, twice):
//
//   1. It is NOT a translated family. The `i * 5 * position` offset enters the two halves of the curve with
//      OPPOSITE sign — the left end moves right (`-(380 - 5i)` grows) while the right end moves left
//      (`684 - 5i` shrinks). So each successive curve is SQUEEZED INWARD horizontally while rising 6px. The
//      family converges rather than running parallel, and that nesting is where its visual interest comes
//      from. Our own combed version structurally cannot do this: its no-knot guarantee needs a tilt that
//      exceeds the field's maximum gradient, which forces the strokes parallel.
//   2. The opacity ramp runs 0.1 -> 1.0 across the 36. Most strokes are therefore nearly invisible and a
//      reader picks out roughly eight over a haze. That is why 72 of these read sparser than 30 of ours did at
//      0.10 -> 0.55, where nothing receded.
//   3. The component renders the family TWICE, at position = +1 and -1, so the shipped drawing is 72 paths —
//      two mirrored, converging combs crossing at a shallow angle.
//   4. Most of the geometry lies outside the viewBox: y runs -189 to 875 against a 316-tall box, so only the
//      slice crossing the frame is ever seen. That is load-bearing, not sloppiness — it is what makes the
//      curves read as long sweeps passing through rather than as arcs that start and stop.
/**
 * One curve, as the gate draws it.
 *
 * This used to live in `lib/gatePaths.ts` alongside a viewBox and a centripetal spline that served the comb and
 * descent-trail candidates. Those were rejected, `/proto-gate` retired, and the file went with them — so the
 * type now lives with its only producer.
 *
 * `len` is REQUIRED, and that is the simplification the move bought. It was optional because the comb's trails
 * had no arc length to report; every curve here has one, and it is load-bearing: dashing a ~1580-unit path via
 * `pathLength="1"` and fractional dash values renders as a sub-unit stipple in Chrome, because the scale factor
 * is ~2000x and the dash computation loses its precision. Knowing the true length keeps the dash and its offset
 * in plain user units with nothing scaled.
 */
export interface Trail {
  /** SVG path data, rounded to 0.1px. */
  d: string;
  /** Index among the emitted curves, which is what DOM order and the ramps key off. */
  i: number;
  opacity: number;
  width: number;
  /** Arc length in user units. */
  len: number;
}

/** The original's viewBox, kept exactly: the curve constants are only meaningful against it. */
export const REF_VIEW_W = 696;
export const REF_VIEW_H = 316;

/** 36 curves per family, as in the source. */
export const REF_COUNT = 36;

/** Both families, as the component renders them. */
export const REF_POSITIONS = [1, -1] as const;

/**
 * One family's paths, transcribed from the source template literal.
 *
 * The original builds its `d` by string interpolation with a leading minus on some coordinates, e.g.
 * `M-${380 - i * 5 * position}` — which is the NEGATIVE of (380 - 5ip), not (-380 - 5ip). Getting that wrong
 * is what flips the convergence into a translation, so the arithmetic is written out rather than inlined.
 */
/**
 * THE WIDTHS ARE THE SOURCE'S, UNSCALED, AND THE SCALE CONSTANT IS KEPT ONLY AS THE DIAL IT WAS.
 *
 * This was 0.4, then 0.6, and both were the wrong fix for a correctly-reported symptom. Measured off the
 * reference screenshot the owner supplied (1467x958), `meet` scales the 696-wide viewBox by 2.108x there, so the
 * authored 0.5-1.55 renders as **1.05-3.27 CSS px**. The site was rendering at 2.859x on a 1990px window, where
 * the same authored widths give 1.4-4.4px — so the strokes really were too heavy, and I thinned them. Twice.
 *
 * But the strokes were never the problem: at 2.859x the whole DRAWING is 1.357x too big, and the owner saw that
 * directly — "seems like the example i gave you zoomed out a bit compared to yours". Zooming out to the
 * reference's own scale (see `REF_ZOOM`) makes the authored widths land at 1.05-3.27px by themselves. Scaling
 * them too would then make them a third THINNER than the reference, which is what "lifeless" was.
 *
 * The lesson, since it has now cost three rounds: when a drawing looks wrong at one size, check the SIZE before
 * retuning what is in it. Two of the three dials I turned were compensating for the third.
 */
export const REF_STROKE_SCALE = 0.7;

/**
 * How much a stroke's width may depart from the ramp, as a fraction of it.
 *
 * The source's widths are monotone in the index (0.5 + 0.03i), so neighbours differ by 0.03 and the family
 * reads as a single smooth gradient — "different lines may have different thicknesses among them" is asking for
 * the opposite of that. This breaks the ordering locally while leaving the ramp's trend intact, which is what
 * still carries depth: the thin end stays thin on average and the heavy end stays heavy.
 *
 * SIZED AGAINST THE SCALE, not chosen alone. At 0.3 with REF_STROKE_SCALE 0.8 the heaviest curve measured 3.45
 * CSS px against the previous release's 3.27 — the wobble had pushed the maximum UP, so "a little bit thinner"
 * was not delivered at the one place it shows most. 0.22 against a 0.7 scale puts the band at roughly
 * 0.58-2.79px: about 15% under the old maximum, with the variation unmistakable.
 *
 * Deterministic, never Math.random() — a drawing that differs between builds is against the same house rule the
 * Rules slide's seeded walk follows.
 */
export const REF_WIDTH_SPREAD = 0.22;

/**
 * Stable [-1, 1) from a curve index. Two independent streams via `salt`, so width variation cannot correlate
 * with anything else keyed off the same index.
 */
export function widthWobble(i: number, salt = 1): number {
  const x = Math.sin((i + 1) * 12.9898 * salt) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

/**
 * How far the camera is pulled back from the source's own viewBox.
 *
 * The source hands its SVG `viewBox="0 0 696 316"` and lets `meet` fit it to the container, so the apparent
 * zoom is entirely a function of container width: the reference screenshot sits at 2.108x, this site at 2.859x
 * on a 1990px window. Same geometry, same code, 1.357x bigger on screen — which is why the field read as
 * crowding the frame when the reference does not. Widening the viewBox about its own centre by that ratio puts
 * the site at 2.107x, and then every other number the source authored (widths, spacing, the 6px rise) is
 * correct as written.
 */
export const REF_ZOOM = 1.357;

/** One decimal is plenty for these coordinates, and keeps integers printing as integers. */
const r1 = (v: number): number => Math.round(v * 10) / 10;

/**
 * The viewBox, pulled back by `zoom` about the centre of the source's own. Exported rather than written into
 * the component so the zoom and the stroke widths cannot be retuned independently again.
 */
/**
 * HOW FAR THE DRAWING SITS LEFT OF CENTRE, as a fraction of the viewBox width.
 *
 * The owner's ask: *"it might be better to move the moving lines to the left a little bit."* Panning the
 * viewBox WINDOW right by this much moves the DRAWING left by the same amount — the sign is the thing to
 * get wrong here, so it is stated rather than left to be re-derived.
 *
 * It is a fraction, not a pixel count, because `preserveAspectRatio="xMidYMid meet"` means apparent scale
 * is purely a function of container width (that is the whole lesson behind `REF_ZOOM`): a literal offset
 * would move the drawing a different distance on every window. At 0.04 of a 944.5-wide box the shift is
 * 37.8 user units, which at the reference's 2.107x is about **80 CSS px** on a 1990px window.
 *
 * Panning is safe in a way zooming is not: the source's geometry already runs far outside the frame on
 * every side (y from -189 to 875 against a 316-tall box), so moving the window exposes more real curve
 * rather than empty space. Nothing about stroke width or opacity changes with it.
 */
export const REF_PAN_X = 0.04;

export function refViewBox(zoom = REF_ZOOM, panX = REF_PAN_X): string {
  const w = REF_VIEW_W * zoom;
  const h = REF_VIEW_H * zoom;
  return `${r1((REF_VIEW_W - w) / 2 + w * panX)} ${r1((REF_VIEW_H - h) / 2)} ${r1(w)} ${r1(h)}`;
}

/** A point, for the arc-length flattening below. */
interface P { x: number; y: number }

/** One cubic Bézier, sampled. 64 steps puts the length error under 0.1% for curves this smooth. */
function cubicLength(p0: P, c1: P, c2: P, p1: P): number {
  const at = (t: number): P => {
    const u = 1 - t;
    const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return { x: a * p0.x + b * c1.x + c * c2.x + d * p1.x, y: a * p0.y + b * c1.y + c * c2.y + d * p1.y };
  };
  let len = 0;
  let prev = at(0);
  for (let i = 1; i <= 64; i++) {
    const cur = at(i / 64);
    len += Math.hypot(cur.x - prev.x, cur.y - prev.y);
    prev = cur;
  }
  return len;
}

export function refFamily(position: number, count = REF_COUNT, smooth = false): Trail[] {
  // A SMALLER COUNT SUBSAMPLES THE SOURCE'S FAMILY — it does not truncate it.
  //
  // Every one of the source's per-curve numbers is indexed off `i`: the offsets 5i and 6i that make the family
  // converge, the opacity ramp 0.1 + 0.03i, the width ramp 0.5 + 0.03i. So just drawing the first 24 of 36 gives
  // a field that spans two thirds of the spread and tops out at 0.79 opacity instead of 1.0 — fewer lines AND a
  // smaller, flatter drawing, which is three changes when one was asked for. Spreading the indices over the
  // original range instead means 24 curves occupy exactly the 36's footprint, with the full opacity and width
  // ramps intact: the same picture, drawn with fewer strokes.
  //
  // At count = REF_COUNT the stretch is 1 and every value is the source's integer again, which is what keeps the
  // byte-for-byte d-string assertions meaningful rather than merely passing.
  const stretch = count > 1 ? (REF_COUNT - 1) / (count - 1) : 1;
  return Array.from({ length: count }, (_, idx) => {
    const i = idx * stretch;
    const dx = i * 5 * position;
    const dy = i * 6;

    const x0 = -(380 - dx), y0 = -(189 + dy);   // start, and its own first control point
    let cx1 = -(312 - dx), cy1 = 216 - dy;
    const ex1 = 152 - dx, ey1 = 343 - dy;        // end of the first cubic = the JOIN
    let cx2 = 616 - dx, cy2 = 470 - dy;
    const cx3 = 684 - dx, cy3 = 875 - dy;        // the final control point and the endpoint coincide

    // ── THE SOURCE HAS A CORNER IN EVERY CURVE BUT THE FIRST, AND `smooth` TAKES IT OUT ───────────────────
    //
    // Each curve is two cubics meeting at the join above. The tangent arriving is (464 - 2*dx, 127) and the
    // tangent leaving is (464, 127) — equal only when dx = 0. So the join is tangent-continuous for i = 0 and
    // kinks progressively after it: measured over the family, up to **32.8 degrees at i = 35 on the position
    // = +1 side**, and 6.4 degrees on the mirror, which is why the corners cluster in the left half of the
    // frame. That is the "i still see sharp edge corners" report, and it is in the reference too — the owner
    // spotted that himself ("in the example i show you it's already like this but bc it's black and white it's
    // less noticeable").
    //
    // The fix points both control arms along their AVERAGE direction and keeps their lengths, so the endpoints
    // and the overall sweep are untouched while the tangent becomes continuous. Averaging rather than
    // reflecting one arm onto the other matters: reflecting moves the whole second cubic, which is the long
    // visible sweep, and that changes the drawing instead of repairing it.
    if (smooth) {
      const inx = ex1 - cx1, iny = ey1 - cy1;
      const outx = cx2 - ex1, outy = cy2 - ey1;
      const li = Math.hypot(inx, iny), lo = Math.hypot(outx, outy);
      const ax = inx / li + outx / lo, ay = iny / li + outy / lo;
      const al = Math.hypot(ax, ay) || 1;
      const ux = ax / al, uy = ay / al;
      cx1 = r1(ex1 - li * ux); cy1 = r1(ey1 - li * uy);
      cx2 = r1(ex1 + lo * ux); cy2 = r1(ey1 + lo * uy);
    }

    // THE REAL ARC LENGTH, IN USER UNITS, computed here rather than declared as pathLength="1".
    //
    // The first attempt set pathLength="1" so the dash could be written as fractions (0.3 of the curve, 0.7
    // gap). Measured in a real browser, that renders as thousands of sub-unit dashes instead of one long
    // segment: these curves are ~2000 user units long, so pathLength="1" asks the renderer to work at a 2000x
    // scale factor and the dash computation loses its precision. On screen it is a stippled shimmer, which is
    // what "the screen is just flashing" actually was — not frame starvation, which was my second wrong guess,
    // and not the dash being inherently too expensive, which was my first.
    //
    // With the true length known, dash and offset are plain user units and nothing has to be scaled at all.
    const len = cubicLength({ x: x0, y: y0 }, { x: x0, y: y0 }, { x: cx1, y: cy1 }, { x: ex1, y: ey1 })
      + cubicLength({ x: ex1, y: ey1 }, { x: cx2, y: cy2 }, { x: cx3, y: cy3 }, { x: cx3, y: cy3 });

    return {
      // Every coordinate goes through r1 because a subsampled family has fractional offsets (stretch is 35/23
      // at count = 24). At count = REF_COUNT they are all integers and r1 leaves them, and JS prints an integer
      // without a trailing `.0`, so the d-string is byte-identical to the source there.
      d: `M${r1(x0)} ${r1(y0)}C${r1(x0)} ${r1(y0)} ${r1(cx1)} ${r1(cy1)} ${r1(ex1)} ${r1(ey1)}`
        + `C${r1(cx2)} ${r1(cy2)} ${r1(cx3)} ${r1(cy3)} ${r1(cx3)} ${r1(cy3)}`,
      len: Math.round(len * 10) / 10,
      // The ELEMENT index, not the stretched one — this keys DOM order and a CSS stagger, so it has to stay
      // 0..count-1. The stretched `i` above is the source's curve number and only feeds the formulas.
      i: idx,
      // The source's ramps. Opacity is clamped: at i = 35 the expression gives 1.15, and an SVG
      // stroke-opacity above 1 is invalid — the browser clamps it, so doing it here keeps the emitted
      // attribute honest rather than relying on the renderer to tidy up.
      opacity: Math.min(1, Math.round((0.1 + i * 0.03) * 1000) / 1000),
      // The source's ramp, scaled, then wobbled per curve so the family reads as varied weights rather than as
      // one gradient. `idx` rather than the stretched `i`, so the wobble does not change when GATE_COUNT does.
      width: Math.round(
        (0.5 + i * 0.03) * REF_STROKE_SCALE * (1 + widthWobble(idx) * REF_WIDTH_SPREAD) * 1000,
      ) / 1000,
    };
  });
}

/** Both mirrored families, in draw order, re-indexed 0..n-1 so a CSS stagger can key off `i`. */
export function refTrails(count = REF_COUNT, smooth = false): Trail[] {
  const out: Trail[] = [];
  for (const p of REF_POSITIONS) for (const t of refFamily(p, count, smooth)) out.push(t);
  return out.map((t, i) => ({ ...t, i }));
}

/**
 * How many curves per family the GATE draws, as opposed to how many the source authored.
 *
 * The source's 36 is kept as `REF_COUNT` because it is part of the transcription. This is the owner's dial, and
 * it is 24 on his instruction ("less lines"). The count is not free: the opacity ramp is `0.1 + 0.03i`, so it is
 * indexed to position in the family rather than to the family's size, and dropping the count therefore drops the
 * TOP of the ramp with it — 24 curves end at 0.79 rather than 1.0, so the whole field recedes slightly. That is
 * a look worth having on purpose and a surprise worth not rediscovering.
 */
export const GATE_COUNT = 24;
