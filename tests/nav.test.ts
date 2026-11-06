import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { PAGES } from '../src/data/nav';

// The corner nav is the site's only always-visible navigation, and the only link to /experience anywhere. That every
// href it renders reaches a built page is tests/distSmoke.test.ts's link check, on every page; this file holds the
// list itself, and the converse: no page in src/pages is left out of it.
const pagesDir = resolve(import.meta.dirname, '../src/pages');
// A page file's route: `writing.astro` is /writing, and a folder's `index.astro` is the folder (`research/index.astro`
// is /research). A dynamic route (`[slug]`) is no page a nav link could name.
const routes = new Set(
  readdirSync(pagesDir, { recursive: true }).map(String)
    .filter((f) => f.endsWith('.astro') && !f.includes('['))
    .map((f) => '/' + f.replace(/\/?index\.astro$|\.astro$/, '')),
);

describe('the corner nav page set', () => {
  // A page left out of PAGES can be orphaned with every other check green. The homepage, the 404 and a /proto-
  // route are not nav doors.
  it('names every page the site has', () => {
    expect(routes.size, 'no page files read from src/pages').toBeGreaterThanOrEqual(PAGES.length);
    const hrefs = new Set(PAGES.map((p) => p.href));
    for (const r of routes) {
      if (r === '/' || r === '/404' || r.startsWith('/proto-')) continue;
      expect(hrefs.has(r), `${r} is in src/pages but not in PAGES`).toBe(true);
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
  // decision should be a deliberate one rather than an accident of editing. It also keeps both destinations of the
  // hero tagline, an easter egg, in the real navigation.
  it('leads with research and ends with art, matching the identity hierarchy', () => {
    expect(PAGES[0].href).toBe('/research');
    expect(PAGES[PAGES.length - 1].href).toBe('/art');
  });
});
