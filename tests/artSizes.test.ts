import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { justifyRows } from '../src/lib/justify';

/**
 * /art's `sizes` hint has to describe /art's actual layout, and the layout is decided in a different file
 * from the hint.
 *
 * The photo grid is not a fluid grid: `scripts/artGallery.ts` calls justifyRows() with a CONSTANT target row
 * height, and justifyRows solves each row's height so the row fills the container, closing a row as soon as
 * that height would fall to or below the target. So a tile's width is `aspectRatio * rowHeight` with
 * rowHeight capped by the target (and by target * slack on the final, unfilled row) — a bound that does not
 * move with the viewport. `art.astro` computes its per-photo `sizes` from those same two numbers.
 *
 * That makes them a hand-synced pair across two files, which the project only tolerates when a test fails on
 * the drift (the other one is PHONE_MAX_WIDTH's 640 — see viewport.test.ts). The hint being wrong is not
 * cosmetic: it previously said `30vw`, which at 1440/DPR2 selected the 900w variant for all 42 photographs
 * and fetched 6,007,600 bytes where 3,128,936 was enough.
 *
 * Both files are read as TEXT on purpose. artGallery.ts touches `document` at module scope and art.astro is
 * an Astro component, so neither can be imported here; the literals are what has to agree, so the literals
 * are what is asserted.
 */

const gallery = readFileSync(new URL('../src/scripts/artGallery.ts', import.meta.url), 'utf8');
const artPage = readFileSync(new URL('../src/pages/art.astro', import.meta.url), 'utf8');

/** The `justifyRows(ars, W, 340, 14)` call that lays the grid out. */
const layoutCall = /justifyRows\(\s*ars\s*,\s*W\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*\)/.exec(gallery);

/** The two constants art.astro derives its hint from. */
const hintTarget = /PHOTO_ROW_TARGET_H\s*=\s*(\d+(?:\.\d+)?)/.exec(artPage);
const hintSlack = /PHOTO_LAST_ROW_SLACK\s*=\s*(\d+(?:\.\d+)?)/.exec(artPage);

describe('/art photo `sizes` hint', () => {
  it('finds the layout call and the hint constants at all', () => {
    // If either regex stops matching, the rest of this spec would pass vacuously — which is exactly the
    // failure mode a text-based test has to rule out first.
    expect(layoutCall, 'justifyRows(ars, W, …) call in src/scripts/artGallery.ts').not.toBeNull();
    expect(hintTarget, 'PHOTO_ROW_TARGET_H in src/pages/art.astro').not.toBeNull();
    expect(hintSlack, 'PHOTO_LAST_ROW_SLACK in src/pages/art.astro').not.toBeNull();
  });

  it('computes the hint from the SAME target row height the grid is laid out with', () => {
    // If this fails: artGallery.ts's justifyRows target and art.astro's PHOTO_ROW_TARGET_H have drifted.
    // Change both, in the same commit.
    expect(Number(hintTarget![1])).toBe(Number(layoutCall![1]));
  });

  it('uses justifyRows\' own final-row slack, not an invented number', () => {
    // 1.16 is the `targetHeight * 1.16` clamp inside justifyRows' flush(last) — the one path that can make a
    // row TALLER than the target, and therefore the one that sets the real upper bound on a tile's width.
    const justify = readFileSync(new URL('../src/lib/justify.ts', import.meta.url), 'utf8');
    expect(justify).toContain(`targetHeight * ${hintSlack![1]}`);
  });

  it('keeps the hint an upper bound on the rendered tile width at every container width', () => {
    // The claim the hint makes is `tileWidth <= ar * target * slack`, for every photo, at every width. It is
    // provable from justifyRows (non-final rows close at or below the target; the final row is clamped), but
    // the layout is the thing that must hold, so run the real function over the real aspect ratios.
    //
    // The ratios are the six the gallery actually ships (9:16, 3:4, 1807:2400 and their transposes), listed
    // here rather than read from src/assets so adding a photograph cannot fail this test.
    const ars = [0.5625, 0.75, 1807 / 2400, 2400 / 1807, 4 / 3, 16 / 9];
    const target = Number(layoutCall![1]);
    const gap = Number(layoutCall![2]);
    const slack = Number(hintSlack![1]);
    const repeated = Array.from({ length: 42 }, (_, i) => ars[i % ars.length]);

    let worst = 0;
    for (let W = 260; W <= 3000; W += 7) {
      for (const row of justifyRows(repeated, W, target, gap)) {
        for (const i of row.indices) {
          const rendered = repeated[i] * row.height;
          const hinted = Math.ceil(repeated[i] * target * slack);
          worst = Math.max(worst, rendered / hinted);
        }
      }
    }
    // <= 1 means the hint never asks for a smaller variant than the tile is painted at, so this can only
    // ever cost bytes, never sharpness.
    expect(worst).toBeLessThanOrEqual(1);
  });

  it('still leaves the <=1024px branch fluid, where the px bound goes loose', () => {
    // Below 1024px .art-wrap is a centred max-width:900px column, narrow enough that a row can no longer
    // reach the target height, so the structural bound over-states a phone tile by ~35% and quantises up a
    // variant. Deliberately unchanged — see the note above photoSizes() in art.astro.
    expect(artPage).toContain('(max-width:1024px) 45vw,');
  });
});

/**
 * THE CALLIGRAPHY HINT IS THE SAME KIND OF PAIR, and it got the same kind of wrong.
 *
 * The first pass at /art's LCP capped `widths` at 1200 — which removed the 1342 KB native candidate and was
 * real — but left `sizes` at `40vw`, a fluid hint for an element whose width is a constant. `.cal :global(img)`
 * is `width: auto; max-width: 100%; max-height: min(82vh, 820px)`, so for a tall work the HEIGHT cap binds and
 * the width is `cap * aspectRatio`, bounded by `820 * ar` at any window height — 414 CSS px for the
 * 1727x3422 stele against the 512–1536 that `40vw` declares. At DPR 2 that still selected the 1200w variant
 * (396,030 B) where 900w (142,128 B) covers it: 253,902 B of a `fetchpriority="high"` resource.
 *
 * So CAL_MAX_H in art.astro's frontmatter and the `820px` in its own <style> block are a hand-synced pair,
 * and this is the test that makes the drift fail rather than quietly re-inflate the LCP.
 */
describe('/art calligraphy `sizes` hint', () => {
  const calMaxH = /CAL_MAX_H\s*=\s*(\d+(?:\.\d+)?)/.exec(artPage);
  /** The CSS cap the constant mirrors: `max-height: min(82vh, 820px)`. */
  const cssCap = /max-height:\s*min\(\s*\d+(?:\.\d+)?vh\s*,\s*(\d+(?:\.\d+)?)px\s*\)/.exec(artPage);

  it('finds both halves of the pair at all', () => {
    // Same guard as above: if either regex stops matching, every assertion below would pass vacuously.
    expect(calMaxH, 'CAL_MAX_H in src/pages/art.astro').not.toBeNull();
    expect(cssCap, '`max-height: min(..vh, ..px)` in art.astro\'s <style>').not.toBeNull();
  });

  it('derives the hint from the SAME px cap the CSS applies', () => {
    // If this fails: CAL_MAX_H and `.cal :global(img)`'s max-height have drifted. Change both, same commit.
    expect(Number(calMaxH![1])).toBe(Number(cssCap![1]));
  });

  it('hints a px bound, not a viewport fraction, on the desktop branch', () => {
    // The specific regression this file now blocks. `40vw` must never come back: it describes a fluid width
    // this element does not have, and it is the reason the LCP stayed 2.8x heavier than it needed to be
    // through the release that "fixed" it.
    expect(artPage).toContain('calSizes(w.src.width / w.src.height)');
    expect(artPage).not.toContain('(max-width:1024px) 80vw, 40vw');
  });

  it('never under-declares, at any viewport or window height', () => {
    // The hint's claim is `renderedWidth <= ceil(ar * CAL_MAX_H)`. The rendered width is
    // `min(containerWidth, min(0.82 * vh, CAL_MAX_H) * ar)`, so the cap arm alone is a structural ceiling —
    // but the arithmetic is asserted over a real sweep rather than argued, because the argued version is what
    // was wrong last time.
    const cap = Number(calMaxH![1]);
    const ars = [1727 / 3422, 2400 / 1807]; // the two works that ship: the tall stele and the wider poem
    let worst = 0;
    for (const ar of ars) {
      const hinted = Math.ceil(ar * cap);
      for (let vh = 560; vh <= 2160; vh += 11) {
        for (let container = 300; container <= 3000; container += 13) {
          const rendered = Math.min(container, Math.min(0.82 * vh, cap) * ar);
          worst = Math.max(worst, rendered / hinted);
        }
      }
    }
    // <= 1 means the hint can only ever cost bytes, never sharpness — the same bar the photo grid is held to.
    expect(worst).toBeLessThanOrEqual(1);
  });

  it('keeps 1200 in widths, because a DPR-3 phone really does need it', () => {
    // The mobile branch stays fluid (80vw), and on a 390px phone at DPR 3 the stele asks for ~1038 device px.
    // Dropping the 1200w candidate to "match" the desktop bound would make the phone the blurry one.
    expect(artPage).toContain('widths={[480, 900, 1200]}');
  });
});
