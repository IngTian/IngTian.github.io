// tests/deckPalette.test.ts
// THE HOMEPAGE'S RAIL INK — `html[data-page='deck']` in tokens.css.
//
// The homepage's rail (SideRail) is fixed, and the page moves under it: off the hero (hideOver), it sits over the
// Interlude's sky and then over the five opaque paper panels. Light --ink-3, the resting ink on every other rail
// page, is under 4.5:1 on the tan panel, so the page names its own, --rail-ink, which SideRail reads with --ink-3 as
// its fallback; and light --ochre, the focus ring on every other page, is barely visible there, so the page names
// --rail-focus too. Each label the rail draws (resting, the quiet mark's --ink-2, the lead's --ink-1), its dash and
// its focus ring are measured here on each ground it can sit on, in both themes. The sky is its CSS gradient, the
// ramp in lib/skyPalette.ts: the state with no WebGL.
//
// Not measured:
// - the footer below the Work panel, on the near-black foot of the sky. It comes behind the rail only in a window
//   less than about 560px tall, on the page's last screen, and no ink dark enough for the tan clears it;
// - the live sky over the Interlude: FluidSky's descent shader, which a desktop with WebGL draws over the gradient,
//   and SkyWash's and .descent::before/::after's washes. The descent variant restrains a lighter sky, the danger for
//   its paper-coloured text, and leaves darkening nearly free (a viscous floor of 0.86 and a darkward gate of 0.75,
//   lib/skyLegibility.ts), so in the light theme, whose labels are dark, it can darken the sky under one past the
//   gradient measured here.
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { rampFor, type Theme } from '../src/lib/skyPalette';
import { AA_BODY, nebulaCeiling } from '../src/lib/skyLegibility';
import { between, onGround, over, railMark, ratio, rgbOf, tokens, type RGB } from './helpers/palette';

const THEMES = [
  { theme: 'light', sel: "html[data-page='deck']", base: ':root' },
  { theme: 'dark', sel: "html[data-page='deck'][data-theme='dark']", base: "html[data-theme='dark']" },
] as const;

/** The panels' grounds, as the five slides declare them (`--<slide>-bg`), light then dark. */
const PANEL = { light: '#c4b7a1', dark: '#14161a' } as const;

/**
 * How far down the page the sky under the rail can be. The rail shows once the hero's bottom is above mid-screen,
 * and every slide after the Interlude is an opaque panel, so the sky it sits on ends at the Interlude's foot: with
 * the hero at its 108vh and every slide at its 100vh floor, (1.08 + 1) / (1.08 + 6) = 0.294 of the page. A taller
 * slide below only lowers it.
 */
const SKY_DEPTH = 0.3;

const NEBULA: RGB = [0.055, 0.105, 0.115]; // FluidSky's uNebula: the dark sky's lift, at most nebulaCeiling()

/** The descent sky from the top down to `depth`: every ramp stop above it, and the ramp at it. */
function skyTo(theme: Theme, depth: number): RGB[] {
  const ramp = rampFor('descent', theme);
  const out = ramp.filter(([at]) => at <= depth).map(([, hex]) => rgbOf(hex));
  const i = ramp.findIndex(([at]) => at > depth);
  const [a, ca] = ramp[i - 1], [b, cb] = ramp[i];
  const f = (depth - a) / (b - a);
  out.push(rgbOf(ca).map((c, k) => c + (rgbOf(cb)[k] - c) * f) as RGB);
  return out;
}

describe("the homepage's rail ink (tokens.css)", () => {
  it('is two tokens, declared in both themes', () => {
    // `html[data-page='deck']` and `html[data-theme='dark']` tie on specificity, so a light-only value would win in dark.
    for (const t of THEMES) expect(Object.keys(tokens(t.sel)), t.sel).toEqual(['--rail-ink', '--rail-focus']);
  });

  it('is what SideRail draws a resting label and its focus ring in, and the marks are --ink-2 and --ink-1', () => {
    const rail = readFileSync(new URL('../src/components/SideRail.astro', import.meta.url), 'utf8');
    expect(rail).toContain('.side-rail .dim { color: var(--rail-ink, var(--ink-3)); }');
    expect(rail).toContain('.side-rail a:focus-visible { outline: 1px solid var(--rail-focus, var(--ochre));');
    expect(rail).toContain('.side-rail .ink2 { color: var(--ink-2); }');
    expect(rail).toContain('.side-rail .ink1 { color: var(--ink-1); }');
  });

  it("matches the five panels' grounds", () => {
    const dir = new URL('../src/sections/', import.meta.url);
    const grounds = readdirSync(dir).filter((f) => f.endsWith('.astro'))
      .flatMap((f) => [...readFileSync(new URL(f, dir), 'utf8').matchAll(/--[\w-]+-bg:\s*(#[0-9a-f]{6})/gi)].map((m) => m[1].toLowerCase()));
    expect(grounds.length, 'no panel declares a ground').toBe(10);
    expect(new Set(grounds)).toEqual(new Set(Object.values(PANEL)));
  });

  for (const t of THEMES) {
    describe(t.theme, () => {
      const base = tokens(t.base);
      const resolve = (v: string): string => v.replace(/^var\((--[\w-]+)\)$/, (_, k: string) => base[k]);
      const rest = resolve(tokens(t.sel)['--rail-ink']);
      const focus = resolve(tokens(t.sel)['--rail-focus']);
      const panel = rgbOf(PANEL[t.theme]);
      const sky = skyTo(t.theme, SKY_DEPTH).flatMap((g): RGB[] => t.theme === 'dark'
        ? [g, g.map((c, k) => Math.min(255, c + 255 * NEBULA[k] * nebulaCeiling())) as RGB]
        : [g]);
      const grounds = [panel, ...sky];

      it('clears 4.5:1 on the panel and the sky, resting and marked', () => {
        for (const [name, ink] of [['resting', rest], ['quiet', base['--ink-2']], ['lead', base['--ink-1']]]) {
          for (const g of grounds) expect(onGround(ink, g), `${name} ${ink} on ${g.map(Math.round)}`).toBeGreaterThanOrEqual(AA_BODY);
        }
      });

      it('keeps a resting label short of the quiet mark, so the two stay apart', () => {
        expect(ratio(rest, PANEL[t.theme])).toBeLessThan(ratio(base['--ink-2'], PANEL[t.theme]));
      });

      it("draws the dash at 3:1 or more on every ground", () => {
        const ink1 = rgbOf(base['--ink-1']);
        for (const g of grounds) expect(between(over(ink1, railMark(), g), g)).toBeGreaterThanOrEqual(3);
      });

      it('draws the focus ring at 3:1 or more on every ground', () => {
        for (const g of grounds) expect(onGround(focus, g), `${focus} on ${g.map(Math.round)}`).toBeGreaterThanOrEqual(3);
      });
    });
  }

  // Why the tokens exist: the site's resting ink and focus ring do not clear the light panel.
  it('is needed: light --ink-3 is under 4.5:1 on the tan, and light --ochre under 3:1', () => {
    expect(ratio(tokens(':root')['--ink-3'], PANEL.light)).toBeLessThan(AA_BODY);
    expect(ratio(tokens(':root')['--ochre'], PANEL.light)).toBeLessThan(3);
  });
});
