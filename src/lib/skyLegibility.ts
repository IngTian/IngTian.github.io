// The contrast policy for the fluid sky, in one place.
//
// The sky is generated, so no CSS tool can audit it — Lighthouse's contrast check
// reads background-color and sees nothing. These values and checks are therefore the
// only guarantee that generated colour cannot make text unreadable, which is why they
// live here, named and tested, rather than as literals in the shader or the component.
//
// The governing asymmetry: what threatens text depends on the text's own colour.
// The sky's text is PAPER-coloured, so a LIGHTER sky erases it and a darker one
// does not: the policy restrains the lightward direction and leaves the dark one
// nearly free.

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
 * The text is paper-coloured, so LIGHTWARD is restrained hard; the dark side stays
 * near 1, nearly free, so the ink keeps its character.
 */
export const GATES = { dark: 0.75, light: 0.10 } as const;

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
