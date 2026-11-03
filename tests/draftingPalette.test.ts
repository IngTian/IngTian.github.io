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

const src = (f: string): string => readFileSync(new URL(`../src/components/projects/${f}`, import.meta.url), 'utf8');
const fieldSrc = src('DraftingField.astro');
const rowsSrc = src('SelectedRows.astro');
const cardsSrc = src('WorkshopCards.astro');

type RGB = [number, number, number];
const rgbOf = (hex: string): RGB => {
  expect(hex, `${hex} is not a #rrggbb literal`).toMatch(/^#[0-9a-f]{6}$/i);
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;
};
const lum = (hex: string): number => wcagLuminance(rgbOf(hex));
const ratio = (fg: string, bg: string): number => contrastRatio(lum(fg), lum(bg));
/** `top` at alpha `a` composited over `under`. */
const over = (top: readonly number[], a: number, under: RGB): RGB => under.map((u, i) => top[i] * a + u * (1 - a)) as RGB;
const onGround = (ink: string, ground: RGB): number => contrastRatio(lum(ink), wcagLuminance(ground));
const rgbToken = (v: string): number[] => v.split(',').map(Number);

/** The ground at the darkest point of the edge vignette: a corner, the farthest point of the box from the gradient's
 *  centre. The geometry is read from the component that ships it, so the two cannot drift apart. */
function vignetteCorner(tk: Record<string, string>, ground: string): RGB {
  const g = /radial-gradient\((\d+)% (\d+)% at (\d+)% (\d+)%, transparent (\d+)%, var\(--draft-vig\)\)/.exec(fieldSrc);
  expect(g, 'DraftingField.astro has no radial-gradient(… var(--draft-vig)) vignette').not.toBeNull();
  const [rx, ry, cx, cy, stop] = g!.slice(1).map((n) => Number(n) / 100);
  const d = Math.hypot(Math.max(cx, 1 - cx) / rx, Math.max(cy, 1 - cy) / ry);
  const share = Math.min(1, Math.max(0, (d - stop) / (1 - stop)));
  const v = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(tk['--draft-vig']);
  expect(v, `--draft-vig is not an rgba(): ${tk['--draft-vig']}`).not.toBeNull();
  return over(v!.slice(1, 4).map(Number), Number(v![4]) * share, rgbOf(ground));
}

/** The alpha a component's rule gives one of the drafting rgb tokens, e.g. the row wash's `rgba(var(--draft-line-rgb), .04)`. */
function alphaIn(file: string, text: string, rule: string, token: string): number {
  const body = new RegExp(`${rule.replace(/[.:()]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(text)?.[1];
  expect(body, `${file} has no "${rule} {" rule`).toBeTruthy();
  const a = new RegExp(`rgba\\(var\\(${token}\\),\\s*([\\d.]+)\\)`).exec(body!)?.[1];
  expect(a, `${file}'s ${rule} draws no rgba(var(${token}), a)`).toBeTruthy();
  return Number(a);
}

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
        const under = vignetteCorner(tk, t.ground);
        for (const ink of ['--ink-1', '--ink-3', '--ink-4', '--ochre']) {
          expect(onGround(tk[ink], under), `${ink} under the vignette`).toBeGreaterThanOrEqual(AA_BODY);
        }
      });

      // THE HOVER TINTS lie over grounds the palette alone does not describe, and compound with them: the row wash
      // with the vignette under the open field, the card spotlight (the seal, at the pointer) with a card's ground —
      // and on the dashed card, which has none, with the field and the vignette as well. So a lit row or card lifts
      // its ink-3 words to ink-2, and every ink it then wears must clear AA on the tint at the vignette's corner.
      // The seal cannot be lifted (it is the page's one colour), so the tints are capped by it.
      it('every word a hover lights clears AA on the tint it lies under', () => {
        const corner = vignetteCorner(tk, t.ground);
        const line = rgbToken(tk['--draft-line-rgb']), hi = rgbToken(tk['--draft-hi-rgb']);
        const wash = alphaIn('SelectedRows.astro', rowsSrc, '.row::before', '--draft-line-rgb');
        const spot = alphaIn('WorkshopCards.astro', cardsSrc, '.card-in::before', '--draft-hi-rgb');
        const grounds: [string, RGB, string[]][] = [
          ['a hovered row', over(line, wash, corner), ['--ink-1', '--ink-2', '--ochre']],
          ['a lit card', over(hi, spot, rgbOf(t.ground)), ['--ink-1', '--ink-2']],
          ['the lit dashed card', over(hi, spot, corner), ['--ink-1', '--ink-2']],
        ];
        for (const [where, ground, inks] of grounds) {
          for (const ink of inks) expect(onGround(tk[ink], ground), `${ink} on ${where}`).toBeGreaterThanOrEqual(AA_BODY);
        }
        // and the lifts themselves, so the ink-3 the numbers above leave out is not what a lit word still wears
        expect(rowsSrc).toMatch(/\.row:hover \.i, \.row:hover \.t:not\(\.hot\) \{ color: var\(--ink-2\); \}/);
        expect(cardsSrc).toMatch(/\.card:hover \.idea, \.card:hover \.t \{ color: var\(--ink-2\); \}/);
      });

      // The install line is the seal on a tint, inside a card the spotlight crosses: through it, the seal fell under
      // AA in both themes. Its tint sits on an opaque ground of its own, so the light never reaches under it.
      it("keeps the install line's seal on its own opaque ground, out of the spotlight", () => {
        const body = /\.cmd \{([^}]*)\}/.exec(cardsSrc)?.[1] ?? '';
        const m = /background: linear-gradient\(rgba\(var\(--draft-line-rgb\), ([\d.]+)\), rgba\(var\(--draft-line-rgb\), \1\)\), var\(--draft-ground\);/.exec(body);
        expect(m, `WorkshopCards.astro's .cmd is not a tint on var(--draft-ground): ${body}`).not.toBeNull();
        expect(onGround(tk['--ochre'], over(rgbToken(tk['--draft-line-rgb']), Number(m![1]), rgbOf(t.ground)))).toBeGreaterThanOrEqual(AA_BODY);
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
