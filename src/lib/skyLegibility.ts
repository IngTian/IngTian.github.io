// The contrast policy for the fluid sky, in one place.
//
// The sky is generated, so no CSS tool can audit it — Lighthouse's contrast check
// reads background-color and sees nothing. These functions are therefore the only
// guarantee that generated colour cannot make text unreadable, which is why they
// live here as pure functions with tests rather than as inline constants.
//
// The governing asymmetry: what threatens text depends on the text's own colour.
//   descent pages carry PAPER-coloured text -> a LIGHTER sky erases it
//   reading pages carry DARK INK on pale paper -> a DARKER sky erases it
// So the two variants restrain opposite directions. Treating them alike is the
// mistake this module exists to make impossible.

export type SkyVariant = 'descent' | 'reading';

/** WCAG 2.x relative luminance from sRGB 0-255. */
export function wcagLuminance(rgb: readonly [number, number, number]): number {
  const lin = (c: number): number => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}

/** WCAG contrast ratio between two relative luminances. */
export function contrastRatio(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** WCAG AA floor for body text. */
export const AA_BODY = 4.5;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * How fully the legibility rules apply at a given page depth.
 *
 * A reading page is text from top to bottom, so the rules apply everywhere. A
 * descent page has an open sky above its content, so they ramp in at the
 * content boundary and leave the hero unconstrained.
 */
export function zoneAt(depth: number, gateTop: number, variant: SkyVariant): number {
  if (variant === 'reading') return 1;
  return smoothstep(gateTop, gateTop + 0.1, depth);
}

/**
 * Per-direction multipliers on the sky's excursion along its palette ramp.
 * The permissive direction stays near 1 so the ink keeps its character; the
 * dangerous direction is clamped.
 */
export function gateFor(zone: number, variant: SkyVariant): { dark: number; light: number } {
  const FREE = 0.25;
  const CLAMPED = 0.9;
  return variant === 'reading'
    ? { dark: 1 - CLAMPED * zone, light: 1 - FREE * zone }
    : { dark: 1 - FREE * zone, light: 1 - CLAMPED * zone };
}

/**
 * The largest darkward move the field can produce, in ramp units.
 *
 * Any cap on that move must be compared against this: a cap set above it never
 * binds and is therefore not a guarantee, however it is documented.
 */
export function maxDarkwardExcursion(amp: number, displacement: number): number {
  return displacement * amp * 0.5;   // (f - 0.5) peaks at 0.5
}

/**
 * Bounds on the two stages that darken the composed colour: the viscous
 * multiply and the subtractive tint.
 *
 * Bounding these rather than the ramp-lookup index is deliberate. The lookup
 * index cannot express what these stages do — they operate on the colour after
 * it leaves the ramp, so a colour darker than any ramp stop is reachable and no
 * cap on the index can prevent it.
 *
 * The reading-page constants are derived from holding WCAG AA (4.5:1) against
 * --ink-3 at the ramp's darkest stop (#dcd5cf).
 */
export function tintBudget(variant: SkyVariant): {
  magnitude: number;
  cap: number;
  viscousFloor: number;
} {
  return variant === 'reading'
    ? { magnitude: 0.055, cap: 0.55, viscousFloor: 0.985 }
    : { magnitude: 0.095, cap: 1.0, viscousFloor: 0.86 };
}
