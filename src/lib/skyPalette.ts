// The sky's colour data: one ramp per theme, mirroring the CSS token.
//
// These mirror --descent-grad from tokens.css. They are duplicated here because
// the canvas is JS-painted and cannot read CSS custom properties per-stop;
// tests/skyPalette.test.ts asserts the properties that matter so drift is caught
// rather than assumed away.

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

export function rampFor(theme: Theme): readonly RampStop[] {
  return theme === 'dark' ? DESCENT_DARK : DESCENT_LIGHT;
}
