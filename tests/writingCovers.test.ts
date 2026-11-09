// tests/writingCovers.test.ts
// The writing covers (lib/writingCovers.ts): computed pictures, held to the class contract the page colours them by.
import { describe, expect, it } from 'vitest';
import { COVER_SIZES, FIGURES, coverSvg, figureFor } from '../src/lib/writingCovers';

// The three sizes the pages draw (a card, the index's lead, a piece's banner), as Cover.astro reads them.
const SIZES = Object.values(COVER_SIZES);
const SEEDS = ['favourite-quotes', 'risk-parity-is-not-equal-weights', 'a', 'lookahead-three-ways', 'x-'.repeat(40)];

const elements = (svg: string): string[] => [...svg.matchAll(/<(\w+)\b[^>]*>/g)].map((m) => m[0]);

describe('coverSvg', () => {
  it('draws the same picture for the same seed, and another for another seed', () => {
    for (const f of FIGURES) {
      expect(coverSvg(f, 'one', 400, 250), f).toBe(coverSvg(f, 'one', 400, 250));
      expect(coverSvg(f, 'one', 400, 250), f).not.toBe(coverSvg(f, 'two', 400, 250));
    }
  });

  it('draws every figure at every size, with its point in seal, in a viewBox of that size', () => {
    for (const f of FIGURES) {
      for (const [w, h] of SIZES) {
        const svg = coverSvg(f, 'seed', w, h);
        expect(svg.startsWith(`<svg class="cover" viewBox="0 0 ${w} ${h}" `), `${f} ${w}x${h}`).toBe(true);
        expect(svg, `${f} ${w}x${h} draws no seal`).toMatch(/class="cv-seal cv-[sf]"/);
        expect(elements(svg).length, `${f} ${w}x${h} draws almost nothing`).toBeGreaterThan(5);
      }
    }
  });

  it('draws only with the contract: one role and one type class, strokes unfilled and 1.25 to 2 wide, no colour of its own', () => {
    const bad: string[] = [];
    for (const f of FIGURES) {
      for (const [w, h] of SIZES) {
        for (const seed of SEEDS) {
          const svg = coverSvg(f, seed, w, h);
          const [root, ...drawn] = elements(svg);
          if (!/^<svg class="cover" [^>]*aria-hidden="true"/.test(root)) bad.push(`${f}: root ${root}`);
          for (const el of drawn) {
            const m = /^<(polyline|polygon|circle|rect|path) class="cv-(ink|mid|seal|faint) cv-([sf])"/.exec(el);
            if (!m) { bad.push(`${f} ${seed}: ${el.slice(0, 80)}`); continue; }
            if (m[3] === 's') {
              const width = Number(/stroke-width="([\d.]+)"/.exec(el)?.[1]);
              if (!/fill="none"/.test(el) || !(width >= 1.25 && width <= 2)) {
                bad.push(`${f} ${seed}: stroke ${el.slice(0, 80)}`);
              }
            } else if (/stroke-width=/.test(el)) bad.push(`${f} ${seed}: a fill with a stroke`);
          }
          if (/#[0-9a-f]{3,8}\b|rgb\(|style=|<text|Gradient|<filter/i.test(svg)) bad.push(`${f} ${seed}: a colour, text, gradient or filter`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('writes no NaN or Infinity, and no coordinate past a tenth of a unit', () => {
    for (const f of FIGURES) {
      for (const [w, h] of SIZES) {
        for (const seed of SEEDS) {
          const svg = coverSvg(f, seed, w, h);
          expect(svg, `${f} ${seed} ${w}x${h}`).not.toMatch(/NaN|Infinity/);
          const coords = svg.replace(/stroke-width="[^"]*"/g, '');
          expect(coords.match(/\d\.\d{2,}/)?.[0], `${f} ${seed} ${w}x${h}`).toBeUndefined();
        }
      }
    }
  });

  // Every cover is inline (the file header's ponytail note): a card's is the index's weight per piece, a banner's
  // is one per piece page.
  it("keeps a card's and the lead's cover under 20 KB, and a banner's under 30 KB", () => {
    for (const f of FIGURES) {
      for (const [size, [w, h]] of Object.entries(COVER_SIZES)) {
        for (const seed of SEEDS) {
          expect(coverSvg(f, seed, w, h).length, `${f} ${seed} ${size}`).toBeLessThan(size === 'banner' ? 30_000 : 20_000);
        }
      }
    }
  });
});

describe('figureFor', () => {
  it("is the frontmatter's figure when it names one", () => {
    for (const f of FIGURES) expect(figureFor('any-slug', f)).toBe(f);
  });

  it('picks a computed figure for any slug, the same one each time, every one for some slug, and never quote', () => {
    const picked = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const slug = `piece-${i}`;
      expect(FIGURES).toContain(figureFor(slug));
      expect(figureFor(slug)).toBe(figureFor(slug));
      picked.add(figureFor(slug));
    }
    expect(figureFor('')).toBeDefined();
    // quote is the commonplace book's emblem, a piece's only by naming it (the quotes do)
    expect([...picked].sort()).toEqual(FIGURES.filter((f) => f !== 'quote').sort());
  });
});
