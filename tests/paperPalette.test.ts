// tests/paperPalette.test.ts
// THE PAPER PALETTE — the research routes' register, scoped by `html[data-page='paper']` in tokens.css.
//
// Like the drafting register it overrides the site's ROLE tokens, so the shared corner nav and rail reskin with no
// edit, and it adds its own `--sheet-*` tokens for what only these pages draw. The page has no sky: its ground is
// `--sheet-ground`, and `--bg` is that ground so the body paints it. Every ink a reader gets is measured on it here.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { AA_BODY } from '../src/lib/skyLegibility';
import { between, onGround, over, railMark, ratio, rgbaOf, rgbOf, tokens, type RGB } from './helpers/palette';

const rgbToken = (v: string): number[] => v.split(',').map(Number);

/** WCAG 1.4.11: a mark that is not text — a rule, a band under words — against what it sits on. */
const NON_TEXT = 3;

const THEMES = [
  { theme: 'light', sel: "html[data-page='paper']", base: ':root' },
  { theme: 'dark', sel: "html[data-page='paper'][data-theme='dark']", base: "html[data-theme='dark']" },
] as const;

const ROLE = ['--paper', '--ink-1', '--ink-2', '--ink-3', '--ink-4', '--ink-5', '--ochre', '--on-accent',
  '--hairline-rgb', '--bg'];
const SHEET = ['--sheet-ground', '--sheet-ul', '--sheet-band', '--sheet-axis', '--sheet-one', '--sheet-grid', '--sheet-mark',
  '--sheet-link'];

// The two research pages' own stylesheets and the sheet they share (styles/paper.css, where Figure 2's series are
// coloured), comments stripped: the alphas their marks are drawn at are read from them, so the number measured is the
// one drawn.
const styleOf = (page: string): string =>
  readFileSync(new URL(`../src/pages/research/${page}`, import.meta.url), 'utf8').match(/<style is:global>([\s\S]*?)<\/style>/)?.[1] ?? '';
const pageCss = [
  styleOf('[slug].astro'),
  readFileSync(new URL('../src/styles/paper.css', import.meta.url), 'utf8'),
  // last: rule() takes the first match, and the index's miniature re-sizes the series' strokes (`.mini .f-rl`)
  styleOf('index.astro'),
].join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
/** The declarations of the page's rule whose selector is exactly `sel`. */
function rule(sel: string): string {
  const body = new RegExp(`(?:^|[}\\s])${sel.replace(/[.()[\]*+?^$|\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(pageCss)?.[1];
  expect(body, `the paper page has no "${sel} {" rule`).toBeTruthy();
  return body!;
}
const decl = (sel: string, prop: string): string => {
  const v = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`).exec(rule(sel))?.[1].trim();
  expect(v, `${sel} sets no ${prop}`).toBeTruthy();
  return v!;
};
const hairAlpha = (sel: string, prop: string): number => {
  const m = /^rgba\(var\(--hairline-rgb\),\s*([\d.]+)\)$/.exec(decl(sel, prop));
  expect(m, `${sel}'s ${prop} is not rgba(var(--hairline-rgb), a)`).not.toBeNull();
  return Number(m![1]);
};
/** WCAG 1.4.11's exemptions here, each with its reason at the token (tokens.css) and in the design spec. */
const EXEMPT = ['--sheet-grid', '--sheet-band'];

describe('the paper palette (tokens.css)', () => {
  it('declares the same tokens in both themes', () => {
    // `html[data-page='paper']` and `html[data-theme='dark']` have EQUAL specificity, so a token set only in the
    // light paper block would show its light value in dark theme. Both blocks must declare every token.
    const [light, dark] = THEMES.map((t) => Object.keys(tokens(t.sel)).sort());
    expect(light).toEqual([...ROLE, ...SHEET].sort());
    expect(dark).toEqual(light);
  });

  for (const t of THEMES) {
    describe(t.theme, () => {
      const tk = tokens(t.sel);
      const seal = tokens(t.base)['--seal'];
      const ground = rgbOf(tk['--sheet-ground']);

      it('paints the sheet as the page base, so the body and overscroll show it', () => {
        expect(tk['--bg']).toBe('var(--sheet-ground)');
      });

      it("makes every colour it adds this theme's seal, so seal red stays the only colour", () => {
        expect(tk['--ochre']).toBe(seal);
        expect(tk['--sheet-mark']).toBe(seal);
        for (const k of ['--sheet-ul', '--sheet-band']) expect(rgbaOf(tk[k])[0], k).toEqual(rgbOf(seal));
      });

      // --sheet-mark is text too: a marked symbol in an equation is coloured with it.
      for (const ink of ['--ink-1', '--ink-2', '--ink-3', '--ink-4', '--sheet-mark']) {
        it(`${ink} clears AA on the sheet`, () => {
          expect(onGround(tk[ink], ground)).toBeGreaterThanOrEqual(AA_BODY);
        });
      }

      // The rail's labels are ink-3, ink-2 and ink-1 (above); its dash is a mark, ink-1 at SideRail's strength.
      it("the rail's dash clears 3:1 on the sheet", () => {
        expect(between(over(rgbOf(tk['--ink-1']), railMark(), ground), ground)).toBeGreaterThanOrEqual(NON_TEXT);
      });

      // The underline highlight is emphasis under words that stay legible on their own, so what is measured is the
      // text over it, not the band as a mark.
      it('keeps ink-1 legible over the underline highlight', () => {
        const [ul, alpha] = rgbaOf(tk['--sheet-ul']);
        const band = over(ul, alpha, ground);
        expect(onGround(tk['--ink-1'], band), 'ink-1 over the underline').toBeGreaterThanOrEqual(AA_BODY);
        // Pins tokens.css's "bare sheet only" for --sheet-mark: seal over the seal band is under 3:1, which is why
        // the explainer format refuses a linked term inside a highlight.
        expect(onGround(tk['--sheet-mark'], band), '--sheet-mark over the underline').toBeLessThan(NON_TEXT);
      });

      // A link in the text is the body's ink, so its underline is the only thing that tells it from the words round it.
      it("a link's underline clears 3:1 on the sheet, and the link stays ink", () => {
        expect(decl('.paper a', 'color')).toBe('inherit');
        expect(decl('.paper a', 'text-decoration-color')).toBe('var(--sheet-link)');
        const [hairline, a] = rgbaOf(tk['--sheet-link']);
        expect(hairline).toEqual(rgbToken(tk['--hairline-rgb']));
        expect(between(over(hairline, a, ground), ground)).toBeGreaterThanOrEqual(NON_TEXT);
      });

      it('--on-accent clears AA on the accent (the nav pill on hover)', () => {
        expect(ratio(tk['--on-accent'], tk['--ochre'])).toBeGreaterThanOrEqual(AA_BODY);
      });

      // ── the figures' marks, WCAG 1.4.11: what a reader needs to read a figure clears 3:1 on the sheet ──────
      const mark = (v: string): RGB => (v.startsWith('#') ? rgbOf(v) : over(...rgbaOf(v), ground));
      const hair = rgbToken(tk['--hairline-rgb']);

      it("Figure 2's three lines and the readout's dots clear 3:1", () => {
        expect(decl('.f-rl', 'stroke')).toBe('var(--seal)');
        expect(decl('.f-bhrp', 'stroke')).toBe('var(--ink-1)');
        expect(decl('.f-bench', 'stroke')).toBe('var(--ink-3)');
        expect(decl('.f-dot-bench', 'stroke')).toBe('var(--ink-2)');
        for (const ink of [seal, tk['--ink-1'], tk['--ink-3'], tk['--ink-2']]) expect(onGround(ink, ground), ink).toBeGreaterThanOrEqual(NON_TEXT);
      });

      it("the readout's hairline clears 3:1, at the strength the page draws it", () => {
        expect(decl('.f-hair', 'stroke')).toBe('var(--ink-1)');
        const a = Number(decl('.f-hair', 'stroke-opacity'));
        expect(between(over(rgbOf(tk['--ink-1']), a, ground), ground)).toBeGreaterThanOrEqual(NON_TEXT);
      });

      it('the axis, its ticks and the break-even line clear 3:1, each its own token', () => {
        expect(decl('.f-axis', 'stroke')).toBe('var(--sheet-axis)');
        expect(decl('.f-one', 'stroke')).toBe('var(--sheet-one)');
        for (const k of ['--sheet-axis', '--sheet-one']) expect(between(mark(tk[k]), ground), k).toBeGreaterThanOrEqual(NON_TEXT);
      });

      // Named, and held BELOW 3:1: a retune that drops a needed mark under 3:1 fails the test above, and one that
      // quietly changes what is exempt fails here.
      it('exempts exactly the grid and the band, each under 3:1', () => {
        expect(decl('.f-grid', 'stroke')).toBe('var(--sheet-grid)');
        expect(decl('.f-band', 'fill')).toBe('var(--sheet-band)');
        for (const k of EXEMPT) expect(between(mark(tk[k]), ground), k).toBeLessThan(NON_TEXT);
      });

      it("Figure 1's arrows and their heads clear 3:1", () => {
        for (const [sel, prop] of [['.p-arrow', 'stroke'], ['.p-head', 'stroke']]) {
          expect(between(over(hair, hairAlpha(sel, prop), ground), ground), sel).toBeGreaterThanOrEqual(NON_TEXT);
        }
      });

      // An index card's hover and focus state: the hairline frame round it and its title's underline, both marks.
      it("an index card's frame and underline clear 3:1", () => {
        const a = Number(/^1px solid rgba\(var\(--hairline-rgb\),\s*([\d.]+)\)$/.exec(decl('.research .pc::before', 'border'))?.[1]);
        expect(a, "the frame is not 1px solid rgba(var(--hairline-rgb), a)").toBeGreaterThan(0);
        expect(between(over(hair, a, ground), ground), 'the frame').toBeGreaterThanOrEqual(NON_TEXT);
        expect(decl('.research .ul', 'background')).toBe('var(--ink-1)');
      });

      // While a term and its note are linked, the other notes dim; dimmed, they are still text a reader reads.
      it('keeps a dimmed margin note legible', () => {
        const a = Number(decl('.paper.lk-on .mn:not(.lk)', 'opacity'));
        expect(between(over(rgbOf(tk['--ink-3']), a, ground), ground)).toBeGreaterThanOrEqual(AA_BODY);
      });
    });
  }

  // In the dark theme --paper is the TEXT colour, so a ground painted with it would turn the sheet light.
  it("paints no ground with --paper: the paper page's own CSS never reads it", () => {
    expect(pageCss.length, 'no <style is:global> block on the paper page').toBeGreaterThan(1000);
    expect(pageCss).not.toMatch(/var\(--paper\b/);
  });
});
