// tests/cssVars.test.ts
// EVERY `var(--x)` THE SITE SHIPS MUST RESOLVE TO SOMETHING.
//
// An undeclared one voids its whole declaration at computed-value time (an undeclared `--rule` once left every
// /experience divider at border-style none), and nothing else sees it: the build accepts it, `astro check` and
// `tsc` do not read CSS, and a missing border looks like a design choice. So it is asserted against the BUILT
// css, the one place with every declaration and every reference.
//
// LIMITS: a name declared SOMEWHERE passes even if it is out of scope where it is used (that needs the cascade,
// i.e. a browser); `var(--x, fallback)` is skipped; Tailwind's `--tw-*` are declared in the same output.
//
// THREE PLACES DECLARE ONE, and all three are collected: stylesheets and <style> blocks; inline `style="--l:0"`
// attributes; and `el.style.setProperty()` at runtime (`sections/Rules.astro` sets `--len` and `--i` from
// measured geometry, and an unset `--len` leaving its line solid is a state it chose).
import { describe, expect, it } from 'vitest';
import { bundled, inlineCss, pages } from './helpers/dist';

/** Every byte of CSS the site ships, by where it ships: the bundled sheets, then each page's inline <style> blocks
 *  (skipping the HTML would skip exactly the scoped component styles this is meant to police). */
const shipped = (): { source: string; css: string }[] => [
  ...bundled('.css').map((f) => ({ source: `_astro/${f.file}`, css: f.text })),
  ...pages().map((p) => ({ source: p.file, css: inlineCss(p.html) })).filter((s) => s.css),
];

/**
 * Names declared somewhere other than a stylesheet: inline `style="--x:…"` attributes, and runtime
 * `style.setProperty('--x', …)` calls in the shipped scripts. Both are real declarations as far as the
 * browser is concerned; neither is visible to a CSS-only scan.
 */
function dynamicallyDeclared(): Set<string> {
  const names = new Set<string>();
  for (const text of [...pages().map((p) => p.html), ...bundled('.js').map((f) => f.text)]) {
    // style="--l:0" / style="--i: 3; --len: 90"
    for (const m of text.matchAll(/style\s*=\s*"([^"]*)"/g)) {
      for (const d of m[1].matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)) names.add(d[1]);
    }
    // el.style.setProperty('--len', …) — the only way Rules.astro's measured geometry can reach CSS
    for (const m of text.matchAll(/setProperty\(\s*['"`](--[A-Za-z0-9_-]+)['"`]/g)) names.add(m[1]);
  }
  return names;
}

/** `var(--name)` with NO fallback. A fallback makes an undeclared name legal, so those are not our business. */
const REFERENCE = /var\(\s*(--[A-Za-z0-9_-]+)\s*\)/g;
/** `--name:` in a declaration position. */
const DECLARATION = /(--[A-Za-z0-9_-]+)\s*:/g;

describe('every var() the site ships resolves to a declared custom property', () => {
  const sheets = shipped();

  it('reads a real build', () => {
    // Guards the harness: if the collector ever returns nothing, every assertion below would vacuously pass —
    // the `passWithNoTests: false` footgun in another costume.
    expect(sheets.length, 'no CSS found in dist/').toBeGreaterThan(0);
    const total = sheets.reduce((n, s) => n + s.css.length, 0);
    expect(total, 'the CSS collected from dist/ is implausibly small').toBeGreaterThan(20_000);
  });

  it('declares every name it references', () => {
    const declared = dynamicallyDeclared();
    for (const { css } of sheets) {
      for (const m of css.matchAll(DECLARATION)) declared.add(m[1]);
    }

    const missing = new Map<string, Set<string>>();
    for (const { source, css } of sheets) {
      for (const m of css.matchAll(REFERENCE)) {
        const name = m[1];
        if (declared.has(name)) continue;
        if (!missing.has(name)) missing.set(name, new Set());
        missing.get(name)!.add(source);
      }
    }

    const report = [...missing.entries()]
      .map(([name, where]) => `  ${name}  — referenced in ${[...where].join(', ')}`)
      .join('\n');

    expect(
      missing.size,
      missing.size === 0 ? '' : [
        `${missing.size} custom propert${missing.size === 1 ? 'y is' : 'ies are'} referenced but never declared.`,
        'A var() with no fallback that resolves to nothing makes the WHOLE declaration invalid at',
        'computed-value time, so every longhand silently falls back to its initial value — which for',
        'border-style is `none`. Either declare it in src/styles/tokens.css or give the var() a fallback.',
        report,
      ].join('\n'),
    ).toBe(0);
  });
});
