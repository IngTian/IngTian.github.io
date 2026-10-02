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
export function refFamily(position: number, count = REF_COUNT): Trail[] {
  return Array.from({ length: count }, (_, i) => {
    const dx = i * 5 * position;
    const dy = i * 6;

    const x0 = -(380 - dx), y0 = -(189 + dy);   // start, and its own first control point
    const cx1 = -(312 - dx), cy1 = 216 - dy;
    const ex1 = 152 - dx, ey1 = 343 - dy;        // end of the first cubic
    const cx2 = 616 - dx, cy2 = 470 - dy;
    const cx3 = 684 - dx, cy3 = 875 - dy;        // the final control point and the endpoint coincide

    return {
      d: `M${x0} ${y0}C${x0} ${y0} ${cx1} ${cy1} ${ex1} ${ey1}`
        + `C${cx2} ${cy2} ${cx3} ${cy3} ${cx3} ${cy3}`,
      i,
      // The source's ramps. Opacity is clamped: at i = 35 the expression gives 1.15, and an SVG
      // stroke-opacity above 1 is invalid — the browser clamps it, so doing it here keeps the emitted
      // attribute honest rather than relying on the renderer to tidy up.
      opacity: Math.min(1, Math.round((0.1 + i * 0.03) * 1000) / 1000),
      width: Math.round((0.5 + i * 0.03) * 100) / 100,
    };
  });
}

/** Both mirrored families, in draw order, re-indexed 0..n-1 so a CSS stagger can key off `i`. */
export function refTrails(count = REF_COUNT): Trail[] {
  const out: Trail[] = [];
  for (const p of REF_POSITIONS) for (const t of refFamily(p, count)) out.push(t);
  return out.map((t, i) => ({ ...t, i }));
}
