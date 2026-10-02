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
import type { Trail } from './gatePaths';

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
 * Stroke widths are scaled DOWN from the source's, and the GOAL is to match the original's APPARENT weight at
 * the size it was designed in — not to be thinner than it.
 *
 * The source ramps 0.5 -> 1.55 in user units, and `meet` scales a 696-wide viewBox by the viewport width. In a
 * ~1200px demo container that is 1.72x, so the demo's own lines land at 0.86-2.67 CSS px. On a 2000px desktop
 * the scale is 2.86x, so shipping the authored widths unchanged gives 1.4-4.4px — visibly heavier than the
 * reference, which is the "lines are again too thick" report. The factor that reproduces the demo is therefore
 * 1.72 / 2.86 = 0.6, not an eyeballed number.
 *
 * It was 0.4 for one release, which overshot: 0.57-1.78px is a THIRD thinner than the reference, and thin dim
 * strokes are most of why the field read as "lifeless ... some kids drew them in kindergarten". Correcting a
 * too-thick complaint by going well past the target is how the fix became the next defect.
 */
export const REF_STROKE_SCALE = 0.6;

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

export function refFamily(position: number, count = REF_COUNT): Trail[] {
  return Array.from({ length: count }, (_, i) => {
    const dx = i * 5 * position;
    const dy = i * 6;

    const x0 = -(380 - dx), y0 = -(189 + dy);   // start, and its own first control point
    const cx1 = -(312 - dx), cy1 = 216 - dy;
    const ex1 = 152 - dx, ey1 = 343 - dy;        // end of the first cubic
    const cx2 = 616 - dx, cy2 = 470 - dy;
    const cx3 = 684 - dx, cy3 = 875 - dy;        // the final control point and the endpoint coincide

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
      d: `M${x0} ${y0}C${x0} ${y0} ${cx1} ${cy1} ${ex1} ${ey1}`
        + `C${cx2} ${cy2} ${cx3} ${cy3} ${cx3} ${cy3}`,
      len: Math.round(len * 10) / 10,
      i,
      // The source's ramps. Opacity is clamped: at i = 35 the expression gives 1.15, and an SVG
      // stroke-opacity above 1 is invalid — the browser clamps it, so doing it here keeps the emitted
      // attribute honest rather than relying on the renderer to tidy up.
      opacity: Math.min(1, Math.round((0.1 + i * 0.03) * 1000) / 1000),
      width: Math.round((0.5 + i * 0.03) * REF_STROKE_SCALE * 1000) / 1000,
    };
  });
}

/** Both mirrored families, in draw order, re-indexed 0..n-1 so a CSS stagger can key off `i`. */
export function refTrails(count = REF_COUNT): Trail[] {
  const out: Trail[] = [];
  for (const p of REF_POSITIONS) for (const t of refFamily(p, count)) out.push(t);
  return out.map((t, i) => ({ ...t, i }));
}
