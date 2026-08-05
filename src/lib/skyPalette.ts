// The sky's colour data: one ramp per (variant, theme), mirroring the CSS tokens.
//
// These mirror --descent-grad and --reading-grad from tokens.css. They are
// duplicated here because the canvas is JS-painted and cannot read CSS custom
// properties per-stop; tests/skyPalette.test.ts asserts the properties that
// matter so drift is caught rather than assumed away.

import { wcagLuminance, type SkyVariant } from './skyLegibility';

export type RampStop = readonly [number, string];
export type Theme = 'light' | 'dark';

/** --descent-grad: the full dawn -> ground descent. Text over it is paper-coloured. */
const DESCENT_LIGHT: readonly RampStop[] = [
  [0.0, '#f4efe4'], [0.08, '#f0eadf'], [0.15, '#efe6d4'], [0.23, '#e2d2c2'],
  [0.3, '#ccc4b6'], [0.37, '#a6a8ad'], [0.44, '#7d7e88'], [0.52, '#565660'],
  [0.62, '#3a3833'], [0.78, '#2a2720'], [0.9, '#1d1b16'], [1.0, '#16140f'],
];

/** The dark twin: a charcoal void. Its luminance span is tiny by design. */
const DESCENT_DARK: readonly RampStop[] = [
  [0.0, '#16191d'], [0.2, '#131619'], [0.4, '#111417'],
  [0.6, '#0e1013'], [0.8, '#0b0d0f'], [1.0, '#08090b'],
];

/** --reading-grad: stays luminous top-to-bottom so DARK ink reads all the way down. */
const READING_LIGHT: readonly RampStop[] = [
  [0.0, '#f4efe4'], [0.24, '#f1ebe0'], [0.48, '#efe6d4'],
  [0.74, '#e7ddce'], [1.0, '#dcd5cf'],
];

const READING_DARK: readonly RampStop[] = [
  [0.0, '#14171b'], [0.48, '#131619'], [1.0, '#111417'],
];

export function rampFor(variant: SkyVariant, theme: Theme): readonly RampStop[] {
  if (variant === 'reading') return theme === 'dark' ? READING_DARK : READING_LIGHT;
  return theme === 'dark' ? DESCENT_DARK : DESCENT_LIGHT;
}

/**
 * Luminance span of a ramp.
 *
 * This is the quantity that decides which mechanism a variant can use at all:
 * the effect works by displacing WHERE along a ramp a pixel samples, so a ramp
 * with almost no span has nothing to reveal and needs an additive treatment
 * instead. Both the reading ramp and the dark descent ramp are in that category.
 */
export function luminanceRange(stops: readonly RampStop[]): {
  min: number; max: number; span: number;
} {
  const ys = stops.map(([, hex]) => wcagLuminance([
    parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16),
  ]));
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  return { min, max, span: max - min };
}
