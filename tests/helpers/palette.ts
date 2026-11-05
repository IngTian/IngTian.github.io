// tests/helpers/palette.ts
// What the palette specs (draftingPalette, paperPalette) share: tokens.css read as TEXT, and WCAG contrast on it.
// Not a spec itself — vitest collects only tests/**/*.test.ts.
//
// tokens.css is read as text (comments stripped) because the values live in a stylesheet, not a module. `tokens()`
// matches a rule by its EXACT selector, so each page block in tokens.css has to stay a rule of its own: a combined
// selector list would make it throw rather than read the wrong block.
import { readFileSync } from 'node:fs';
import { expect } from 'vitest';
import { contrastRatio, wcagLuminance } from '../../src/lib/skyLegibility';

const css = readFileSync(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** The role tokens a page's register overrides (CLAUDE.md, Themes): what the shared components read, so a register
 *  that declares them all reskins the nav, the rail and the cow without an edit to any of them. */
export const ROLE_TOKENS = ['--paper', '--ink-1', '--ink-2', '--ink-3', '--ink-4', '--ink-5', '--ochre', '--on-accent',
  '--hairline-rgb', '--bg'] as const;

/** The custom properties declared in the rule whose selector is exactly `sel`. */
export function tokens(sel: string): Record<string, string> {
  const at = css.indexOf(`${sel} {`);
  if (at < 0) throw new Error(`tokens.css has no "${sel} {" rule`);
  const body = css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at));
  return Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

export type RGB = [number, number, number];

export const rgbOf = (hex: string): RGB => {
  expect(hex, `${hex} is not a #rrggbb literal`).toMatch(/^#[0-9a-f]{6}$/i);
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;
};

/** An `rgba(r, g, b, a)` literal as its colour and its alpha. */
export function rgbaOf(v: string): [RGB, number] {
  const m = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(v);
  expect(m, `${v} is not an rgba() literal`).not.toBeNull();
  return [m!.slice(1, 4).map(Number) as RGB, Number(m![4])];
}

const lum = (hex: string): number => wcagLuminance(rgbOf(hex));
/** The contrast of two #rrggbb literals. */
export const ratio = (fg: string, bg: string): number => contrastRatio(lum(fg), lum(bg));
/** `top` at alpha `a` composited over `under`. */
export const over = (top: readonly number[], a: number, under: RGB): RGB =>
  under.map((u, i) => top[i] * a + u * (1 - a)) as RGB;
/** The contrast of a #rrggbb ink on a ground given as channels (a composite, typically). */
export const onGround = (ink: string, ground: RGB): number => contrastRatio(lum(ink), wcagLuminance(ground));
/** The contrast of two colours given as channels (a mark composited on what lies under it, against what lies beside it). */
export const between = (a: RGB, b: RGB): number => contrastRatio(wcagLuminance(a), wcagLuminance(b));

/** The rail dash's strength: the alpha of ink-1 in its colour, read from SideRail.astro along with the rule that
 *  paints it, so the number measured is the one drawn. */
export function railMark(): number {
  const src = readFileSync(new URL('../../src/components/SideRail.astro', import.meta.url), 'utf8');
  expect(src, "SideRail.astro's dash is not ink-1 at --mk").toContain('.side-rail .rule { background: color-mix(in srgb, var(--ink-1) var(--mk), transparent);');
  const m = /--mk:\s*([\d.]+)%;/.exec(src);
  expect(m, 'SideRail.astro declares no --mk: N%').not.toBeNull();
  return Number(m![1]) / 100;
}
