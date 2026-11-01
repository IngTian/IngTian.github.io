// tests/cssVars.test.ts
// EVERY `var(--x)` THE SITE SHIPS MUST RESOLVE TO SOMETHING.
//
// This exists because of a defect that shipped and was invisible for the life of the page. Two rules in
// `src/pages/experience.astro` declared `border-bottom: 1px solid var(--rule)` against a custom property that
// was defined nowhere in the repo. By spec that makes the whole declaration *invalid at computed-value time*:
// every longhand falls back to its initial value, and `border-bottom-style`'s initial is `none`. Measured in a
// real engine before the fix — style `none`, width `0px` on all three `/experience` group titles and every
// award row. The page's three section dividers had simply never drawn.
//
// WHY IT IS THE WHOLE CLASS AND NOT THE ONE INSTANCE. Nothing could have caught it:
//   - `npm run build` is happy; an unresolvable `var()` is valid CSS syntax.
//   - `astro check` and `tsc` do not read CSS at all.
//   - the author's own comment two lines up named `--rule` AND `--reading-bg` as if both existed, so reading
//     the file carefully was actively misleading. (`--reading-bg` still does not exist; nothing uses it.)
//   - it is silent by design: a missing border looks like a design choice.
// A typo in a token name is a one-character edit away at all times, and the whole palette system is built on
// `var()`. So the invariant is asserted against the BUILT css, which is the only place the full set of both
// declarations and references exists.
//
// SCOPE AND ITS LIMITS, stated so nobody trusts this further than it goes:
//   - It checks that each referenced name is declared SOMEWHERE, not that it is in scope at the point of use.
//     A property declared on `.foo` and used in `.bar` would pass here and still fail in the browser.
//     Catching that needs the cascade, i.e. a browser — which is what the measurement above was for.
//   - `var(--x, fallback)` is fine by definition and is skipped.
//   - Tailwind emits a large number of its own `--tw-*` properties; they are declared in the same output, so
//     they resolve and need no special-casing.
//
// THREE PLACES DECLARE A CUSTOM PROPERTY, AND THE FIRST VERSION OF THIS TEST ONLY KNEW ABOUT ONE.
// It reported `--len`, `--i` and `--l` as undeclared, and all three were false positives:
//   1. stylesheets and <style> blocks — the obvious one;
//   2. inline `style="--l:0"` attributes — the homepage sets a per-letter index that way;
//   3. `el.style.setProperty('--len', …)` AT RUNTIME — `sections/Rules.astro` sets `--len` and `--i` per path
//      from measured geometry, which cannot be known statically at all.
// So all three are collected. Worth stating that (3) is also a case where an unresolved var() is *deliberate*:
// Rules.astro's own comment notes that an unset `--len` leaves the line solid, "which is also acceptable, just
// not animated". That is the difference between it and the `--rule` bug — not whether the var resolves, but
// whether the initial-value fallback is a state someone chose.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));

/** Every byte of CSS the site ships: the emitted stylesheets plus whatever Astro inlined into each page. */
function shippedCss(): { source: string; css: string }[] {
  if (!existsSync(DIST)) {
    throw new Error('dist/ is missing — run `npm run build` before this suite (see tests/distSmoke.test.ts)');
  }
  const out: { source: string; css: string }[] = [];

  const astro = join(DIST, '_astro');
  if (existsSync(astro)) {
    for (const f of readdirSync(astro).filter((n) => n.endsWith('.css'))) {
      out.push({ source: `_astro/${f}`, css: readFileSync(join(astro, f), 'utf8') });
    }
  }

  // Inlined <style> blocks, per page. Astro's `inlineStylesheets: 'auto'` puts small sheets in the document,
  // so skipping the HTML would skip exactly the scoped component styles this is meant to police.
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!e.name.endsWith('.html')) continue;
      const html = readFileSync(p, 'utf8');
      const blocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
      if (blocks.length) {
        out.push({ source: p.slice(DIST.length), css: blocks.join('\n') });
      }
    }
  };
  walk(DIST);

  return out;
}

/**
 * Names declared somewhere other than a stylesheet: inline `style="--x:…"` attributes, and runtime
 * `style.setProperty('--x', …)` calls in the shipped scripts. Both are real declarations as far as the
 * browser is concerned; neither is visible to a CSS-only scan.
 */
function dynamicallyDeclared(): Set<string> {
  const names = new Set<string>();
  const add = (text: string): void => {
    // style="--l:0" / style="--i: 3; --len: 90"
    for (const m of text.matchAll(/style\s*=\s*"([^"]*)"/g)) {
      for (const d of m[1].matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)) names.add(d[1]);
    }
    // el.style.setProperty('--len', …) — the only way Rules.astro's measured geometry can reach CSS
    for (const m of text.matchAll(/setProperty\(\s*['"`](--[A-Za-z0-9_-]+)['"`]/g)) names.add(m[1]);
  };

  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!/\.(html|js|mjs)$/.test(e.name)) continue;
      add(readFileSync(p, 'utf8'));
    }
  };
  walk(DIST);
  return names;
}

/** `var(--name)` with NO fallback. A fallback makes an undeclared name legal, so those are not our business. */
const REFERENCE = /var\(\s*(--[A-Za-z0-9_-]+)\s*\)/g;
/** `--name:` in a declaration position. */
const DECLARATION = /(--[A-Za-z0-9_-]+)\s*:/g;

describe('every var() the site ships resolves to a declared custom property', () => {
  const sheets = shippedCss();

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
