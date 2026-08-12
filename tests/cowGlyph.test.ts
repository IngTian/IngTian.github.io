import { describe, it, expect } from 'vitest';
import {
  COW_BODY, COW_PATCH, COW_MUZZLE, COW_HORN, COW_OUTLINE, COW_W, COW_H,
  COW_MOO, COW_TAIL_FILL, COW_TAIL_INK, COW_TAIL_W, COW_TAIL_H,
  COW_LINES, COW_LINES_404, COW_LINES_WRITING,
} from '../src/data/cowGlyph';
import { inBounds } from '../src/lib/pixels';

// FIVE ATTEMPTS FAILED before the owner supplied a grid — "looks like a dragon", then a robot, then "doesn't read
// like a cow", then "horribly wrong ... they are monsters not cows". The cow is now a TRANSCRIPTION of his
// reference, so these tests pin the properties that separate that reference from everything I got wrong. Chiefly:
// it FACES THE VIEWER — two eyes, a central muzzle, horns on top — where every version I invented was in profile.
//
// Shape assertions rather than a pixel snapshot: a snapshot breaks on any touch-up and tells you nothing about
// whether the thing still reads as a cow.

const key = (c: { x: number; y: number }) => `${c.x},${c.y}`;
const rowOf = (g: { cells: { x: number; y: number }[] }, y: number) => g.cells.filter((c) => c.y === y);
const runs = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  let n = s.length ? 1 : 0;
  for (let i = 1; i < s.length; i++) if (s[i] - s[i - 1] > 1) n++;
  return n;
};
const animal = [...COW_BODY.cells, ...COW_PATCH.cells, ...COW_MUZZLE.cells, ...COW_HORN.cells];

describe('the cow, structurally', () => {
  it('compiled every layer on one grid', () => {
    for (const g of [COW_BODY, COW_PATCH, COW_MUZZLE, COW_HORN, COW_OUTLINE]) {
      expect(g.w).toBe(COW_W);
      expect(g.h).toBe(COW_H);
      expect(g.cells.length).toBeGreaterThan(0);
      expect(inBounds(g)).toBe(true);
    }
  });

  // THE POSE — the error that took five tries. A front-facing chibi cow is TALLER than wide; every profile
  // version was wider than tall. This fails the moment anyone reverts to a side view.
  it('faces the viewer — taller than wide, not a profile', () => {
    expect(COW_H).toBeGreaterThan(COW_W);
  });

  it('has a wide muzzle in the middle of the face', () => {
    const xs = COW_MUZZLE.cells.map((c) => c.x);
    const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
    expect(Math.abs(mid - (COW_W - 1) / 2), 'the muzzle is off-centre').toBeLessThan(2.5);
    expect(Math.max(...xs) - Math.min(...xs), 'the muzzle should dominate the face').toBeGreaterThan(COW_W / 2);
  });

  it('has TWO eyes, side by side above the muzzle', () => {
    const muzzleTop = Math.min(...COW_MUZZLE.cells.map((c) => c.y));
    const xs = rowOf(COW_PATCH, muzzleTop - 2).map((c) => c.x);
    expect(xs.length, 'no eyes found above the muzzle').toBeGreaterThan(0);
    expect(runs(xs), 'a front-facing cow has two eyes').toBe(2);
  });

  it('has two horns at the top of the head, one each side', () => {
    expect(COW_HORN.cells.length).toBeGreaterThan(6);
    expect(runs(COW_HORN.cells.map((c) => c.x)), 'expected a horn on each side').toBe(2);
    expect(Math.max(...COW_HORN.cells.map((c) => c.y)), 'horns belong on top').toBeLessThan(COW_H / 2);
  });

  it('paints white underneath the muzzle so the pink mixes with paper', () => {
    // The muzzle is drawn over the body at partial opacity. Without the body covering those cells the seal red
    // mixes with the PAGE and comes out brick — measured on the 404 before this was fixed.
    const body = new Set(COW_BODY.cells.map(key));
    for (const c of COW_MUZZLE.cells) {
      expect(body.has(key(c)), `no white under the muzzle at ${key(c)}`).toBe(true);
    }
  });

  it('stands on hooves', () => {
    const xs = rowOf(COW_PATCH, COW_H - 2).map((c) => c.x);
    expect(xs.length, 'no hooves').toBeGreaterThan(0);
    expect(runs(xs), 'expected two hooves from the front').toBe(2);
  });

  // The outline is DERIVED, so this asserts the derivation rather than a drawing.
  it('has an outline that hugs the cow and never overlaps it', () => {
    const inked = new Set(animal.map(key));
    expect(COW_OUTLINE.cells.length).toBeGreaterThan(40);
    for (const c of COW_OUTLINE.cells) {
      expect(inked.has(key(c)), `outline overlaps the cow at ${key(c)}`).toBe(false);
      const touches =
        inked.has(`${c.x - 1},${c.y}`) || inked.has(`${c.x + 1},${c.y}`) ||
        inked.has(`${c.x},${c.y - 1}`) || inked.has(`${c.x},${c.y + 1}`);
      expect(touches, `stray outline cell at ${key(c)}`).toBe(true);
    }
  });

  it('never runs off the grid, so the outline is never clipped', () => {
    expect(Math.min(...animal.map((c) => c.x))).toBeGreaterThan(0);
    expect(Math.min(...animal.map((c) => c.y))).toBeGreaterThan(0);
    expect(Math.max(...animal.map((c) => c.x))).toBeLessThan(COW_W - 1);
    expect(Math.max(...animal.map((c) => c.y))).toBeLessThan(COW_H - 1);
  });
});

// THE BUBBLE. The owner asked for the cow's words in a dialogue bubble with pixel type, "way bigger", and picked
// 10px cells. These pin the two things that made earlier passes wrong on the page rather than in the file.
describe('the speech bubble', () => {
  it('spells MOO! as four separated marks', () => {
    expect(COW_MOO.h).toBe(5);
    expect(inBounds(COW_MOO)).toBe(true);
    // M, O, O, ! — four column-runs. Catches letters fused together by a lost tracking column, which is what a
    // hand-count of the first matrix got wrong.
    expect(runs(COW_MOO.cells.map((c) => c.x)), 'expected four marks: M O O !').toBe(4);
  });

  it("gives the '!' its gap, so it is not a solid bar", () => {
    const maxX = Math.max(...COW_MOO.cells.map((c) => c.x));
    const bang = COW_MOO.cells.filter((c) => c.x === maxX).map((c) => c.y).sort((a, b) => a - b);
    expect(bang.length, 'the bang lost cells').toBe(4);
    expect(runs(bang), "an exclamation mark is a stroke and a point, not one bar").toBe(2);
  });

  it('has both O glyphs closed, with a hole in the middle', () => {
    // A ring, not a block: the middle row of each O must have exactly two cells (its two sides).
    const cols = [...new Set(COW_MOO.cells.map((c) => c.x))].sort((a, b) => a - b);
    const os = [cols.slice(6, 11), cols.slice(12, 17)];
    for (const [n, o] of os.entries()) {
      const mid = COW_MOO.cells.filter((c) => c.y === 2 && o.includes(c.x));
      expect(mid.length, `O number ${n + 1} is not hollow`).toBe(2);
    }
  });

  // The tail is TWO layers on purpose. One ink-coloured tail was invisible on the homepage, whose footer is the
  // near-black end of the descent; one paper-coloured tail would vanish on the light /404 and /writing grounds.
  it('draws the tail as a paper interior inside an ink edge', () => {
    for (const g of [COW_TAIL_FILL, COW_TAIL_INK]) {
      expect(g.w).toBe(COW_TAIL_W);
      expect(g.h).toBe(COW_TAIL_H);
      expect(g.cells.length).toBeGreaterThan(0);
      expect(inBounds(g)).toBe(true);
    }
    // The two layers partition the shape — no cell is both, or the ink would paint over its own fill.
    const fill = new Set(COW_TAIL_FILL.cells.map(key));
    for (const c of COW_TAIL_INK.cells) {
      expect(fill.has(key(c)), `tail ink overlaps its fill at ${key(c)}`).toBe(false);
    }
  });

  it('opens the bubble: the tail\'s top row is all paper', () => {
    // That row is painted OVER the bubble's one-cell ink border, and the overlap is what makes the tail read as
    // a mouth rather than as a detached blob under a closed box. Any ink there re-seals it.
    const top = COW_TAIL_FILL.cells.filter((c) => c.y === 0);
    expect(top.length, 'the tail does not open the bubble').toBe(COW_TAIL_W);
    expect(COW_TAIL_INK.cells.some((c) => c.y === 0), 'ink in the mouth re-seals the bubble').toBe(false);
  });

  it('tapers to a point, so it reads as a tail', () => {
    const widthAt = (y: number) =>
      [...COW_TAIL_FILL.cells, ...COW_TAIL_INK.cells].filter((c) => c.y === y).length;
    const widths = Array.from({ length: COW_TAIL_H }, (_, y) => widthAt(y));
    for (let y = 1; y < widths.length; y++) {
      expect(widths[y], `row ${y} is wider than the row above it`).toBeLessThanOrEqual(widths[y - 1]);
    }
    expect(widths[widths.length - 1], 'the tip is as wide as the base').toBeLessThan(widths[0]);
  });
});

describe('what the cow says', () => {
  const SETS: [string, readonly string[]][] = [
    ['homepage', COW_LINES],
    ['404', COW_LINES_404],
    ['writing', COW_LINES_WRITING],
  ];

  it('has a line set for every place it appears', () => {
    for (const [where, lines] of SETS) expect(lines.length, where).toBeGreaterThanOrEqual(3);
  });

  it('keeps every line to one line of mono', () => {
    for (const [where, lines] of SETS) {
      for (const l of lines) {
        expect(l.length, `${where}: ${l}`).toBeLessThanOrEqual(56);
        expect(l).toBe(l.trim());
      }
    }
  });

  it('repeats nothing within a set', () => {
    for (const [where, lines] of SETS) expect(new Set(lines).size, where).toBe(lines.length);
  });

  it('moos somewhere in every set — it is a cow', () => {
    for (const [where, lines] of SETS) {
      expect(lines.some((l) => /moo/i.test(l)), where).toBe(true);
    }
  });

  // The bubble now says MOO! in pixel type ABOVE whichever line is showing, so a line that was only "Moo."
  // rendered the same word twice, once large and once small.
  it('never uses a bare "Moo." — the bubble already says it', () => {
    for (const [where, lines] of SETS) {
      for (const l of lines) expect(l.toLowerCase(), where).not.toBe('moo.');
    }
  });

  // The site's register does not survive whimsy, and an easter egg is not licence to break it.
  it('stays dry: no exclamation marks, no emoji, no shouting', () => {
    for (const [where, lines] of SETS) {
      for (const l of lines) {
        expect(l, `${where}: ${l}`).not.toMatch(/!/);
        expect(l, `${where}: ${l}`).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
        expect(l, `${where}: ${l}`).not.toMatch(/\b[A-Z]{4,}\b/);
      }
    }
  });

  it('makes no claim that could be read as a real result', () => {
    const all = SETS.flatMap(([, l]) => l).join(' ').toLowerCase();
    expect(all).not.toMatch(/sharpe of|returned|outperform/);
  });

  it('says the right thing in the right place', () => {
    expect(COW_LINES_404.join(' ').toLowerCase()).toMatch(/does not exist|nothing here/);
    expect(COW_LINES_WRITING.join(' ').toLowerCase()).toMatch(/nothing written|holding the space/);
  });
});
