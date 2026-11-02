// tests/draftingPalette.test.ts
// THE DRAFTING PALETTE — /projects' own register, scoped by `html[data-page='drafting']` in tokens.css.
//
// It overrides the site's ROLE tokens (the ink ramp, --ochre, --paper, --bg …) rather than adding a parallel set,
// so every shared component on the page — the corner nav, the rail, the cow — reskins with no edit. That is also
// why it needs a test: a shared component chose its ink assuming the site's grounds, and here it lands on a
// different one. The numbers below are the ones a reader actually gets.
//
// tokens.css is read as TEXT (comments stripped): the values live in a stylesheet, not a module.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AA_BODY, contrastRatio, wcagLuminance } from '../src/lib/skyLegibility';

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** The custom properties declared in the rule whose selector is exactly `sel`. */
function tokens(sel: string): Record<string, string> {
  const at = css.indexOf(`${sel} {`);
  if (at < 0) throw new Error(`tokens.css has no "${sel} {" rule`);
  const body = css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at));
  return Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

const fieldSrc = readFileSync(new URL('../src/components/projects/DraftingField.astro', import.meta.url), 'utf8');

const lum = (hex: string): number => {
  expect(hex, `${hex} is not a #rrggbb literal`).toMatch(/^#[0-9a-f]{6}$/i);
  return wcagLuminance([1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]);
};
const ratio = (fg: string, bg: string): number => contrastRatio(lum(fg), lum(bg));

const THEMES = [
  {
    theme: 'light', sel: "html[data-page='drafting']", base: ':root',
    ground: '#f3f1ea', line: '30, 28, 24', hi: '178, 58, 46', seal: '#b23a2e',
  },
  {
    theme: 'dark', sel: "html[data-page='drafting'][data-theme='dark']", base: "html[data-theme='dark']",
    ground: '#08080a', line: '226, 224, 216', hi: '255, 138, 118', seal: '#e0574a',
  },
] as const;

const ROLE = ['--paper', '--ink-1', '--ink-2', '--ink-3', '--ink-4', '--ink-5', '--ochre', '--on-accent',
  '--hairline-rgb', '--bg'];
const DRAFT = ['--draft-ground', '--draft-line-rgb', '--draft-hi-rgb', '--draft-panel', '--draft-glass',
  '--draft-shadow', '--draft-ph', '--draft-tag', '--draft-vig'];

describe('the drafting palette (tokens.css)', () => {
  it('declares the same tokens in both themes', () => {
    // NOT TIDINESS. `html[data-page='drafting']` and `html[data-theme='dark']` have EQUAL specificity, so in dark
    // theme the drafting light block beats the site's dark block by source order. A token set only in the light
    // drafting block would therefore show its LIGHT value in dark theme. Both blocks must declare every token.
    const [light, dark] = THEMES.map((t) => Object.keys(tokens(t.sel)).sort());
    expect(light).toEqual([...ROLE, ...DRAFT].sort());
    expect(dark).toEqual(light);
  });

  for (const t of THEMES) {
    describe(t.theme, () => {
      const tk = tokens(t.sel);

      it('draws on its own ground, with its own line and highlight', () => {
        expect(tk['--draft-ground']).toBe(t.ground);
        expect(tk['--draft-line-rgb'].replace(/\s+/g, ' ')).toBe(t.line);
        expect(tk['--draft-hi-rgb'].replace(/\s+/g, ' ')).toBe(t.hi);
      });

      it('makes the accent the seal, so seal red stays the only colour on the page', () => {
        expect(tk['--ochre']).toBe(t.seal);
        // and the seal the rest of the site declares for this theme, so the two cannot drift apart
        expect(tk['--ochre']).toBe(tokens(t.base)['--seal']);
      });

      for (const ink of ['--ink-1', '--ink-3', '--ink-4']) {
        it(`${ink} clears AA on the ground`, () => {
          expect(ratio(tk[ink], t.ground)).toBeGreaterThanOrEqual(AA_BODY);
        });
      }

      // The vignette sits over the field and UNDER the page's text, so wherever it is drawn the ground the text reads
      // against is the ground with the vignette composited on. In light theme that is darker than the bare ground,
      // so it costs contrast. Its darkest point is a corner (the farthest point of the box from the gradient's
      // centre); the geometry is read from the component that ships it, so the two cannot drift apart.
      it('every text ink clears AA at the darkest point of the edge vignette', () => {
        const g = /radial-gradient\((\d+)% (\d+)% at (\d+)% (\d+)%, transparent (\d+)%, var\(--draft-vig\)\)/.exec(fieldSrc);
        expect(g, 'DraftingField.astro has no radial-gradient(… var(--draft-vig)) vignette').not.toBeNull();
        const [rx, ry, cx, cy, stop] = g!.slice(1).map((n) => Number(n) / 100);
        const d = Math.hypot(Math.max(cx, 1 - cx) / rx, Math.max(cy, 1 - cy) / ry);
        const share = Math.min(1, Math.max(0, (d - stop) / (1 - stop)));
        const v = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(tk['--draft-vig']);
        expect(v, `--draft-vig is not an rgba(): ${tk['--draft-vig']}`).not.toBeNull();
        const a = Number(v![4]) * share;
        const ground = [1, 3, 5].map((i) => parseInt(t.ground.slice(i, i + 2), 16));
        const under = ground.map((c, i) => c * (1 - a) + Number(v![i + 1]) * a) as [number, number, number];
        for (const ink of ['--ink-1', '--ink-3', '--ink-4', '--ochre']) {
          expect(contrastRatio(lum(tk[ink]), wcagLuminance(under)), `${ink} under the vignette`).toBeGreaterThanOrEqual(AA_BODY);
        }
      });

      // The computed pictures (lib/projectVisuals.ts) print their words in ink-1 and ink-3 on --draft-ph, not on
      // the ground — tests/projectVisuals.test.ts holds them to those two inks.
      for (const ink of ['--ink-1', '--ink-3']) {
        it(`${ink} clears AA on a picture's ground (--draft-ph)`, () => {
          expect(ratio(tk[ink], tk['--draft-ph'])).toBeGreaterThanOrEqual(AA_BODY);
        });
      }

      it('--on-accent clears AA on the accent (the nav pill on hover)', () => {
        expect(ratio(tk['--on-accent'], tk['--ochre'])).toBeGreaterThanOrEqual(AA_BODY);
      });
    });
  }
});
