import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { PAGES } from '../src/data/nav';

// THE POINT OF THIS FILE. The corner nav is now the site's only always-visible navigation, so a broken href
// there is not a cosmetic slip — it is a dead end on every page at once. The site has already shipped one: a
// pod panel linked to /experience before that page existed. A list plus this check is what stops the next one.
const pagesDir = resolve(import.meta.dirname, '../src/pages');
const routes = new Set(
  readdirSync(pagesDir)
    .filter((f) => f.endsWith('.astro'))
    .map((f) => '/' + f.replace(/\.astro$/, '')),
);

describe('the corner nav page set', () => {
  it('points only at routes that actually exist', () => {
    for (const p of PAGES) {
      expect(routes.has(p.href), `${p.href} has no page in src/pages`).toBe(true);
    }
  });

  it('has no duplicate destinations or labels', () => {
    expect(new Set(PAGES.map((p) => p.href)).size).toBe(PAGES.length);
    expect(new Set(PAGES.map((p) => p.label)).size).toBe(PAGES.length);
  });

  it('uses root-relative hrefs, since the site is served at the domain root', () => {
    for (const p of PAGES) {
      expect(p.href.startsWith('/'), p.href).toBe(true);
      expect(p.href.endsWith('/'), p.href).toBe(false);
    }
  });

  it('keeps labels short enough to sit in one capsule', () => {
    for (const p of PAGES) {
      expect(p.label.length, p.label).toBeLessThanOrEqual(11);
      expect(p.label.trim()).toBe(p.label);
    }
  });

  // The site's stated hierarchy is quant first, avocation last. If someone reorders this list, that ordering
  // decision should be a deliberate one rather than an accident of editing.
  it('leads with research and ends with art, matching the identity hierarchy', () => {
    expect(PAGES[0].href).toBe('/research');
    expect(PAGES[PAGES.length - 1].href).toBe('/art');
  });

  // Both hero tagline links are meant to be an easter egg ON TOP OF real navigation — so whatever they point
  // at must also be reachable from the nav, or the easter egg is load-bearing again.
  it('covers both destinations the hero tagline links to', () => {
    const hrefs = new Set(PAGES.map((p) => p.href));
    expect(hrefs.has('/research')).toBe(true);
    expect(hrefs.has('/art')).toBe(true);
  });
});
