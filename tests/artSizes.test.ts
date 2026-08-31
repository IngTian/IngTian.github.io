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
