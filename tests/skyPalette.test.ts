import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { rampFor, luminanceRange, type RampStop, type Theme } from '../src/lib/skyPalette';
import { wcagLuminance, contrastRatio, AA_BODY, type SkyVariant } from '../src/lib/skyLegibility';

const hexToRgb = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16),
];

describe('rampFor — variant selection', () => {
  it('gives descent and reading DIFFERENT ramps (inverting the choice must fail)', () => {
    expect(rampFor('descent', 'light')).not.toEqual(rampFor('reading', 'light'));
    expect(rampFor('descent', 'dark')).not.toEqual(rampFor('reading', 'dark'));
  });

  it('descent sinks to near-black; reading never does', () => {
    const descentEnd = wcagLuminance(hexToRgb(rampFor('descent', 'light').at(-1)![1]));
    const readingEnd = wcagLuminance(hexToRgb(rampFor('reading', 'light').at(-1)![1]));
    expect(descentEnd).toBeLessThan(0.1);
    expect(readingEnd).toBeGreaterThan(0.6);
  });

  it('every reading-light stop clears AA against --ink-3 unmodified', () => {
    // The reading ramp exists so dark ink stays legible top-to-bottom. If a raw
    // stop already fails, no downstream guard can save it.
    const ink3 = wcagLuminance([0x5a, 0x54, 0x4a]);
    for (const [, hex] of rampFor('reading', 'light')) {
      expect(contrastRatio(wcagLuminance(hexToRgb(hex)), ink3)).toBeGreaterThanOrEqual(AA_BODY);
    }
  });

  it('stops are ordered and span the full 0-1 range in every combination', () => {
    for (const v of ['descent', 'reading'] as const) {
      for (const t of ['light', 'dark'] as const) {
        const stops = rampFor(v, t);
        expect(stops[0][0]).toBe(0);
        expect(stops.at(-1)![0]).toBe(1);
        for (let i = 1; i < stops.length; i++) {
          expect(stops[i][0]).toBeGreaterThan(stops[i - 1][0]);
        }
      }
    }
  });
});

describe('luminanceRange — why the two variants need different mechanisms', () => {
  it('shows the reading ramp is far flatter, so displacement alone cannot show on it', () => {
    const d = luminanceRange(rampFor('descent', 'light'));
    const r = luminanceRange(rampFor('reading', 'light'));
    expect(d.span).toBeGreaterThan(0.85);
    expect(r.span).toBeLessThan(0.20);
    expect(d.span / r.span).toBeGreaterThan(4.4);
  });

  it('shows the dark descent ramp is also flat — hence its additive nebula', () => {
    expect(luminanceRange(rampFor('descent', 'dark')).span).toBeLessThan(0.01);
  });
});

/* ============================================================================================
   THE DUPLICATION, ACTUALLY CHECKED.

   skyPalette.ts opens by saying its ramps "mirror --descent-grad and --reading-grad from
   tokens.css" and that "tests/skyPalette.test.ts asserts the properties that matter so drift is
   caught rather than assumed away". Until this block existed that sentence was false: nothing in
   this file had ever opened tokens.css. Every test above reads the TypeScript copy and would pass
   unchanged if the CSS said something completely different.

   Why the drift matters more than a normal duplication. The two copies are not two renderings of
   one thing that a viewer compares side by side — they are the SAME BAND OF SKY on different
   devices. The WebGL sky samples the TS ramp; the CSS gradient is what phones get, what a
   no-WebGL browser gets, and what `data-fluid=off` and reduced-motion get. So a stop edited in one
   place and not the other does not look wrong to whoever edits it — it looks wrong only to someone
   on the other rendering path, i.e. to the visitor and not the author. That is the exact failure
   profile a test has to cover, because looking at the page cannot.

   The check is deliberately EXACT (same count, same offsets, same hex, same order) rather than
   "close enough". A tolerance would have to be justified against something, and there is nothing
   to justify it against: the intent is byte-identical, so any difference is a mistake.
   ============================================================================================ */
describe('the TS ramps mirror tokens.css — the duplication skyPalette.ts admits to', () => {
  // Comments are stripped first and everything downstream is derived from the stripped text: the
  // per-stop notes inside --descent-grad include "(Monet)", so a `[^)]*` grab of the gradient body
  // would otherwise stop at that parenthesis and read half a ramp.
  const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  // Both themes declare the SAME property names — :root for light, then the dark block re-declares
  // them — so a search over the whole file would always return the light one. Split at the dark
  // selector and search the correct half. (tokens.css contains the selector exactly once, and after
  // comment-stripping it cannot appear inside prose.)
  const darkAt = css.indexOf("html[data-theme='dark']");
  const half = (theme: Theme) => (theme === 'dark' ? css.slice(darkAt) : css.slice(0, darkAt));

  it('finds the dark block at all, so neither half can silently be the whole file', () => {
    expect(darkAt, "tokens.css no longer contains html[data-theme='dark']").toBeGreaterThan(0);
  });

  /** The stops of one CSS gradient token, as skyPalette's [offset 0-1, '#rrggbb'] shape. */
  const cssStops = (theme: Theme, prop: string): RampStop[] => {
    const decl = new RegExp(`--${prop}:\\s*linear-gradient\\(([^)]*)\\)`).exec(half(theme));
    expect(decl, `--${prop} not found in the ${theme} block of tokens.css`).toBeTruthy();

    const parts = decl![1].split(',').map((s) => s.trim()).filter(Boolean);
    // Drop the leading angle (180deg for the descent, 168deg for reading). Asserting it is present
    // rather than just skipping parts[0] keeps a hand-edited `to bottom` from eating a colour stop.
    expect(parts[0], `--${prop} should start with an explicit angle`).toMatch(/^-?[\d.]+deg$/);

    return parts.slice(1).map((p) => {
      const m = /^(#[0-9a-f]{6})\s+([\d.]+)%$/i.exec(p);
      expect(m, `unparsed stop "${p}" in --${prop} (${theme})`).toBeTruthy();
      // Percent → the 0-1 offsets skyPalette uses. Rounded to 4 places because 8% becomes
      // 0.08000000000000002 otherwise and toEqual is exact; 4 places is finer than any stop the
      // gradient expresses (it uses whole percents).
      return [Math.round((parseFloat(m![2]) / 100) * 1e4) / 1e4, m![1].toLowerCase()] as const;
    });
  };

  // The mapping is spelled out per variant because that mapping IS the thing under test: pointing a
  // variant at the wrong CSS token is one of the ways these two files can disagree.
  const PROP: Record<SkyVariant, string> = { descent: 'descent-grad', reading: 'reading-grad' };

  for (const variant of ['descent', 'reading'] as const) {
    for (const theme of ['light', 'dark'] as const) {
      it(`${variant}/${theme} matches --${PROP[variant]} stop for stop`, () => {
        const ts = rampFor(variant, theme).map(([o, hex]) => [o, hex.toLowerCase()]);
        expect(cssStops(theme, PROP[variant])).toEqual(ts);
      });
    }
  }

  it('parses real stops, so a regex that matched nothing cannot pass as agreement', () => {
    // Two empty arrays are equal. Without this, a change to tokens.css's formatting that broke the
    // parser above would turn all four comparisons green — the failure mode this whole block was
    // added to close, wearing a different hat.
    expect(cssStops('light', 'descent-grad').length).toBeGreaterThanOrEqual(6);
    expect(cssStops('light', 'reading-grad').length).toBeGreaterThanOrEqual(3);
    expect(cssStops('dark', 'descent-grad').length).toBeGreaterThanOrEqual(3);
    expect(cssStops('dark', 'reading-grad').length).toBeGreaterThanOrEqual(3);
  });
});
