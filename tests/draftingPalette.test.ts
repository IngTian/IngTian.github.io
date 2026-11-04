// tests/draftingPalette.test.ts
// THE DRAFTING PALETTE — /projects' own register, scoped by `html[data-page='drafting']` in tokens.css.
//
// It overrides the site's ROLE tokens (the ink ramp, --ochre, --paper, --bg …) rather than adding a parallel set,
// so every shared component on the page — the corner nav, the rail, the cow — reskins with no edit. That is also
// why it needs a test: a shared component chose its ink assuming the site's grounds, and here it lands on a
// different one. The numbers below are the ones a reader actually gets.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AA_BODY } from '../src/lib/skyLegibility';
import { between, onGround, over, railMark, ratio, rgbaOf, rgbOf, tokens, type RGB } from './helpers/palette';

const src = (f: string): string => readFileSync(new URL(`../src/components/projects/${f}`, import.meta.url), 'utf8');
const fieldSrc = src('DraftingField.astro');
const rowsSrc = src('SelectedRows.astro');
const cardsSrc = src('WorkshopCards.astro');

/** The field's stroke alphas, read from DraftingField.astro: minor and major per theme, and a lit ping's peak. */
function strokeAlphas(theme: 'light' | 'dark'): { minor: number; major: number; lit: number } {
  const m = /const \[minorA, majorA\] = light \? \[([\d.]+), ([\d.]+)\] : \[([\d.]+), ([\d.]+)\];/.exec(fieldSrc);
  const p = /rgba\(\$\{hi\},\$\{([\d.]+) \+ ([\d.]+) \* fade\}\)/.exec(fieldSrc);
  expect(m, "DraftingField.astro's minor/major alphas moved").not.toBeNull();
  expect(p, "DraftingField.astro's lit-line alpha moved").not.toBeNull();
  const [lm, lM, dm, dM] = m!.slice(1).map(Number);
  return { ...(theme === 'light' ? { minor: lm, major: lM } : { minor: dm, major: dM }), lit: Number(p![1]) + Number(p![2]) };
}

const rgbToken = (v: string): number[] => v.split(',').map(Number);

/** The ground at the darkest point of the edge vignette: a corner, the farthest point of the box from the gradient's
 *  centre. The geometry is read from the component that ships it, so the two cannot drift apart. */
function vignetteCorner(tk: Record<string, string>, ground: string): RGB {
  const g = /radial-gradient\((\d+)% (\d+)% at (\d+)% (\d+)%, transparent (\d+)%, var\(--draft-vig\)\)/.exec(fieldSrc);
  expect(g, 'DraftingField.astro has no radial-gradient(… var(--draft-vig)) vignette').not.toBeNull();
  const [rx, ry, cx, cy, stop] = g!.slice(1).map((n) => Number(n) / 100);
  const d = Math.hypot(Math.max(cx, 1 - cx) / rx, Math.max(cy, 1 - cy) / ry);
  const share = Math.min(1, Math.max(0, (d - stop) / (1 - stop)));
  const [vig, alpha] = rgbaOf(tk['--draft-vig']);
  return over(vig, alpha * share, rgbOf(ground));
}

/** The two ends of the vignette's ramp: the bare ground at its transparent centre, and its darkest corner. */
const vignetteRamp = (tk: Record<string, string>, ground: string): [RGB, RGB] => [rgbOf(ground), vignetteCorner(tk, ground)];

/** The alpha a component's rule gives one of the drafting rgb tokens, e.g. the row wash's `rgba(var(--draft-line-rgb), .04)`. */
function alphaIn(file: string, text: string, rule: string, token: string): number {
  const body = new RegExp(`${rule.replace(/[.:()]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(text)?.[1];
  expect(body, `${file} has no "${rule} {" rule`).toBeTruthy();
  const a = new RegExp(`rgba\\(var\\(${token}\\),\\s*([\\d.]+)\\)`).exec(body!)?.[1];
  expect(a, `${file}'s ${rule} draws no rgba(var(${token}), a)`).toBeTruthy();
  return Number(a);
}

const THEMES = [
  { theme: 'light', sel: "html[data-page='drafting']", base: ':root' },
  { theme: 'dark', sel: "html[data-page='drafting'][data-theme='dark']", base: "html[data-theme='dark']" },
] as const;

const ROLE = ['--paper', '--ink-1', '--ink-2', '--ink-3', '--ink-4', '--ink-5', '--ochre', '--on-accent',
  '--hairline-rgb', '--bg'];
// No --draft-glass: it was the mockup's nav glass, and the real CornerNav keeps its own (spec §3), so nothing
// rendered it; it is gone rather than left to read as if the nav were reskinned here.
const DRAFT = ['--draft-ground', '--draft-line-rgb', '--draft-hi-rgb', '--draft-panel',
  '--draft-shadow', '--draft-ph', '--draft-tag', '--draft-vig'];
// The rail's halos: role tokens only this register declares, so the shared rail (SideRail.astro, which falls back to
// `none`) wears the label knockout here without the page restyling it.
const RAIL = ['--rail-halo', '--rail-dash-halo'];

describe('the drafting palette (tokens.css)', () => {
  it('declares the same tokens in both themes', () => {
    // NOT TIDINESS. `html[data-page='drafting']` and `html[data-theme='dark']` have EQUAL specificity, so in dark
    // theme the drafting light block beats the site's dark block by source order. A token set only in the light
    // drafting block would therefore show its LIGHT value in dark theme. Both blocks must declare every token.
    const [light, dark] = THEMES.map((t) => Object.keys(tokens(t.sel)).sort());
    expect(light).toEqual([...ROLE, ...RAIL, ...DRAFT].sort());
    expect(dark).toEqual(light);
  });

  for (const t of THEMES) {
    describe(t.theme, () => {
      const tk = tokens(t.sel);
      const ground = tk['--draft-ground'];

      it('makes the accent the seal, so seal red stays the only colour on the page', () => {
        // the seal the rest of the site declares for this theme, so the two cannot drift apart
        expect(tk['--ochre']).toBe(tokens(t.base)['--seal']);
      });

      // The vignette sits over the field and UNDER the page's text, so wherever it is drawn the ground the text reads
      // against is the ground with the vignette composited on — anywhere from the bare ground (its transparent
      // centre) to its darkest point, a corner (the farthest point of the box from the gradient's centre). The
      // geometry is read from the component that ships it, so the two cannot drift apart.
      // BOTH ENDS, because which end is the worst one depends on the theme. The vignette darkens, so in light theme
      // (dark ink) the corner costs contrast, and in dark theme (light ink) the corner is the BEST case and the bare
      // ground the worst: checked at the corner alone, dark theme was measured where it is easiest to read.
      // Compositing is linear per channel, so the luminance along the ramp is monotonic and the ends bound it.
      it('every text ink clears AA anywhere on the edge vignette', () => {
        for (const under of vignetteRamp(tk, ground)) {
          for (const ink of ['--ink-1', '--ink-3', '--ink-4', '--ochre']) {
            expect(onGround(tk[ink], under), `${ink} under the vignette`).toBeGreaterThanOrEqual(AA_BODY);
          }
        }
      });

      // THE HOVER TINTS lie over grounds the palette alone does not describe, and compound with them: the row wash
      // with the vignette under the open field, the card spotlight (the seal, at the pointer) with a card's ground —
      // and on the dashed card, which has none, with the field and the vignette as well. So a lit row or card lifts
      // its ink-3 words to ink-2, and every ink it then wears must clear AA on the tint, at both ends of the vignette.
      // The seal cannot be lifted (it is the page's one colour), so the tints are capped by it.
      it('every word a hover lights clears AA on the tint it lies under', () => {
        const line = rgbToken(tk['--draft-line-rgb']), hi = rgbToken(tk['--draft-hi-rgb']);
        const wash = alphaIn('SelectedRows.astro', rowsSrc, '.row::before', '--draft-line-rgb');
        const spot = alphaIn('WorkshopCards.astro', cardsSrc, '.card-in::before', '--draft-hi-rgb');
        // A row and the dashed card lie on the open field, so on both ends of the vignette (see above); a card's
        // inside is its own opaque ground.
        const grounds: [string, RGB, string[]][] = [
          ...vignetteRamp(tk, ground).flatMap((field, end): [string, RGB, string[]][] => [
            [`a hovered row (vignette ${end ? 'corner' : 'centre'})`, over(line, wash, field), ['--ink-1', '--ink-2', '--ochre']],
            [`the lit dashed card (vignette ${end ? 'corner' : 'centre'})`, over(hi, spot, field), ['--ink-1', '--ink-2']],
          ]),
          ['a lit card', over(hi, spot, rgbOf(ground)), ['--ink-1', '--ink-2']],
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
        expect(onGround(tk['--ochre'], over(rgbToken(tk['--draft-line-rgb']), Number(m![1]), rgbOf(ground)))).toBeGreaterThanOrEqual(AA_BODY);
      });

      // THE RAIL'S LABELS lie straight on the field, so each glyph wears the knockout <main>'s text wears: an opaque
      // 1px ring of the bare ground, eight unblurred offsets so the diagonals are closed too. The pixels touching a
      // glyph are then the ground, where the inks above clear AA.
      it("--rail-halo rings the rail's labels with the bare ground", () => {
        const offsets = tk['--rail-halo'].split(/,(?![^(]*\))/).map((s) => {
          const p = /^(-?\d+)(?:px)? (-?\d+)(?:px)? 0 var\(--draft-ground\)$/.exec(s.trim());
          expect(p, `"${s}" is not an unblurred offset in var(--draft-ground)`).not.toBeNull();
          return `${Number(p![1])},${Number(p![2])}`;
        });
        expect(offsets.sort()).toEqual(['-1,-1', '-1,0', '-1,1', '0,-1', '0,1', '1,-1', '1,0', '1,1']);
      });

      // THE RAIL'S DASH is a mark (3:1), and it lies straight on the field. Bare, a major line BESIDE it is what it
      // is read against, and in light that is 2.39:1. So it is ringed with the bare ground (--rail-dash-halo, a
      // box-shadow, since a text-shadow does not reach a painted span), and what lies beside it is always that
      // ground; what lies UNDER it can be the bare ground, any of the three strokes, and either end of the
      // vignette, and each is checked. 2px, not 1: the 1px dash sits at a fractional y and covers two pixel rows in
      // part, so a 1px ring leaves the rows next to those partly line.
      it("the rail's dash clears 3:1 wherever the field runs under it, ringed with the bare ground", () => {
        expect(tk['--rail-dash-halo']).toBe('0 0 0 2px var(--draft-ground)');
        const line = rgbToken(tk['--draft-line-rgb']), hi = rgbToken(tk['--draft-hi-rgb']);
        const a = strokeAlphas(t.theme);
        const ink = rgbOf(tk['--ink-1']), bare = rgbOf(ground);
        for (const [end, field] of vignetteRamp(tk, ground).entries()) {
          const unders: [string, RGB][] = [['the ground', field], ['a minor line', over(line, a.minor, field)],
            ['a major line', over(line, a.major, field)], ['a lit line', over(hi, a.lit, field)]];
          for (const [what, under] of unders) {
            const where = `on ${what}, vignette ${end ? 'corner' : 'centre'}`;
            expect(between(over(ink, railMark(), under), bare), where).toBeGreaterThanOrEqual(3);
          }
        }
        // and the case the ring is for: unringed, a major line beside the dash in light is under 3:1
        if (t.theme === 'light') {
          expect(between(over(ink, railMark(), bare), over(line, a.major, bare))).toBeLessThan(3);
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

// CLAUDE.md, The concept: a page reskins a shared component only through role tokens. So the halos are declared in
// the two drafting blocks and nowhere else (the key-set test above holds both blocks), SideRail reads them, and no
// page's stylesheet reaches into the rail.
describe('the rail reskins through role tokens only', () => {
  const SRC = new URL('../src/', import.meta.url);
  const files = readdirSync(SRC, { recursive: true, encoding: 'utf8' }).filter((f) => /\.(astro|css|ts)$/.test(f));
  const text = (f: string): string => readFileSync(new URL(f, SRC), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('declares the halos in tokens.css alone, once per drafting block', () => {
    for (const token of RAIL) {
      const where = files.flatMap((f) => [...text(f).matchAll(new RegExp(`${token}\\s*:`, 'g'))].map(() => f));
      expect(where, token).toEqual(['styles/tokens.css', 'styles/tokens.css']);
    }
  });

  it('SideRail reads them, falling back to none', () => {
    const rail = text('components/SideRail.astro');
    expect(rail).toMatch(/\.side-rail \.lbl \{[^}]*text-shadow: var\(--rail-halo, none\);/);
    expect(rail).toMatch(/\.side-rail \.rule \{[^}]*box-shadow: var\(--rail-dash-halo, none\);/);
  });

  it('no page styles the rail', () => {
    const styled = files.filter((f) => f.startsWith('pages/')).flatMap((f) => [...text(f).matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)]
      .filter((m) => /#projects-toc\b|\.side-rail\b/.test(m[1])).map(() => f));
    expect(styled).toEqual([]);
  });
});
