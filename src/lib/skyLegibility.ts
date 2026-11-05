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

/**
 * Per-direction multipliers on the sky's excursion along its palette ramp, over the
 * legibility zone (the shader mixes them in by zone: `mix(1.0, uGateDark, zone)`).
 * The permissive direction stays near 1 so the ink keeps its character; the
 * dangerous direction is clamped.
 */
export const GATES: Record<SkyVariant, { dark: number; light: number }> = {
  // descent: paper-coloured text, so restrain LIGHTWARD hard; the dark side stays nearly free
  descent: { dark: 0.75, light: 0.10 },
  // reading: dark ink, so restrain DARKWARD — but only enough to protect contrast, since
  // over-clamping here erases the effect on the reading pages entirely
  reading: { dark: 0.70, light: 0.75 },
};

/**
 * Bounds on the two stages that darken a reading page's composed colour: the viscous
 * multiply and the subtractive tint.
 *
 * Bounding these rather than the ramp-lookup index is deliberate. The lookup
 * index cannot express what these stages do — they operate on the colour after
 * it leaves the ramp, so a colour darker than any ramp stop is reachable and no
 * cap on the index can prevent it.
 *
 * The reading-page constants are derived from holding WCAG AA (4.5:1) against
 * --ink-3 at the ramp's darkest stop (#dcd5cf). A descent page runs neither stage
 * (the shader reads uTintCap only under `uReading > 0.5`, and uViscousFloor only
 * through `mix(…, uReading)`), so its pair binds nothing.
 */
export const TINT_BUDGET: Record<SkyVariant, { cap: number; viscousFloor: number }> = {
  reading: { cap: 0.55, viscousFloor: 0.985 },
  descent: { cap: 1.0, viscousFloor: 0.86 },
};

/** The reading tint's strongest channel, the red of the shader's warmTint. skyShader.ts
 *  interpolates it there, so the AA test holds the tint that ships. */
export const READING_TINT_WARM = 0.055;

/** The cool tint the dark theme's nebula lifts a descent sky with, uploaded as uNebula. */
export const NEBULA: readonly [number, number, number] = [0.055, 0.105, 0.115];

/**
 * Hard ceiling on the dark theme's nebula lift.
 *
 * The nebula ADDS light, so on a page whose text is light it is the dangerous
 * direction. It is damped by `zone`, but a descent page without an identifiable
 * content element runs its upper half at zone 0, where that damping does nothing —
 * so the lift needs a bound that holds regardless of zone.
 *
 * Sized against the dark theme's --ink-3 (#8b938c), the smallest ink these pages
 * set on the sky. tests/skyLegibility.test.ts pins the resulting contrast.
 */
export const NEBULA_CEILING = 0.16;
