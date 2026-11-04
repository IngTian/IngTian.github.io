// tests/paperPalette.test.ts
// THE PAPER PALETTE — the research routes' register, scoped by `html[data-page='paper']` in tokens.css.
//
// Like the drafting register it overrides the site's ROLE tokens, so the shared corner nav and rail reskin with no
// edit, and it adds its own `--sheet-*` tokens for what only these pages draw. The page has no sky: its ground is
// `--sheet-ground`, and `--bg` is that ground so the body paints it. Every ink a reader gets is measured on it here.
import { describe, expect, it } from 'vitest';
import { AA_BODY } from '../src/lib/skyLegibility';
import { onGround, over, ratio, rgbaOf, rgbOf, tokens } from './helpers/palette';

/** WCAG 1.4.11: a mark that is not text — a rule, a band under words — against what it sits on. */
const NON_TEXT = 3;

const THEMES = [
  { theme: 'light', sel: "html[data-page='paper']", base: ':root' },
  { theme: 'dark', sel: "html[data-page='paper'][data-theme='dark']", base: "html[data-theme='dark']" },
] as const;

const ROLE = ['--paper', '--ink-1', '--ink-2', '--ink-3', '--ink-4', '--ink-5', '--ochre', '--on-accent',
  '--hairline-rgb', '--bg'];
const SHEET = ['--sheet-ground', '--sheet-ul', '--sheet-band', '--sheet-mark'];

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

      it('--on-accent clears AA on the accent (the nav pill on hover)', () => {
        expect(ratio(tk['--on-accent'], tk['--ochre'])).toBeGreaterThanOrEqual(AA_BODY);
      });
    });
  }
});
