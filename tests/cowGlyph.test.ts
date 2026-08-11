import { describe, it, expect } from 'vitest';
import {
  COW_BODY, COW_PATCH, COW_W, COW_H, COW_LINES, COW_LINES_404, COW_LINES_WRITING,
} from '../src/data/cowGlyph';
import { inBounds } from '../src/lib/pixels';

// The owner loves cows, and the first two attempts did not look like one — "looks like a dragon", then a robot.
// So these tests pin the STRUCTURAL properties that make the side silhouette read as a cow: the things that were
// missing when it failed. Shape assertions, not a pixel snapshot — a snapshot breaks on every touch-up and tells
// you nothing about whether it still looks like an animal.

const cellSet = (g: { cells: { x: number; y: number }[] }) => new Set(g.cells.map((c) => `${c.x},${c.y}`));
const rowCells = (g: { cells: { x: number; y: number }[] }, y: number) => g.cells.filter((c) => c.y === y);
const allInk = [...COW_BODY.cells, ...COW_PATCH.cells];

describe('the cow, structurally', () => {
  it('compiled both tones on one grid', () => {
    expect(COW_W).toBe(26);
    expect(COW_H).toBe(16);
    expect(COW_BODY.w).toBe(COW_W);
    expect(COW_PATCH.w).toBe(COW_W);
    expect(COW_BODY.cells.length).toBeGreaterThan(0);
    expect(COW_PATCH.cells.length).toBeGreaterThan(0);
  });

  it('keeps every cell inside the grid', () => {
    expect(inBounds(COW_BODY)).toBe(true);
    expect(inBounds(COW_PATCH)).toBe(true);
  });

  // A cell is body OR patch, never both. The component stacks the layers, so an overlap would paint twice and the
  // patch opacity would come out wrong exactly where the markings are.
  it('never puts a body cell and a patch cell in the same place', () => {
    const body = cellSet(COW_BODY);
    const overlap = COW_PATCH.cells.filter((c) => body.has(`${c.x},${c.y}`));
    expect(overlap).toHaveLength(0);
  });

  // IS IT A COW? Wider than tall — a cow in profile is a long animal. Both failed takes were roughly square,
  // which is part of why they read as a face rather than as livestock.
  it('is a long animal in profile, not a square face', () => {
    expect(COW_W / COW_H).toBeGreaterThan(1.4);
  });

  // FOUR LEGS, which is what makes it unmistakably livestock rather than a head.
  it('stands on four legs', () => {
    const bottom = rowCells(COW_BODY, COW_H - 1).map((c) => c.x).sort((a, b) => a - b);
    expect(bottom.length).toBeGreaterThan(0);
    let runs = 1;
    for (let i = 1; i < bottom.length; i++) if (bottom[i] - bottom[i - 1] > 1) runs++;
    expect(runs, 'the cow should have four legs').toBe(4);
  });

  it('carries its head low and to the left', () => {
    const topRow = Math.min(...allInk.map((c) => c.y));
    const headInk = allInk.filter((c) => c.y >= topRow && c.y <= topRow + 1);
    expect(Math.min(...headInk.map((c) => c.x))).toBeLessThan(COW_W / 3);
  });

  it('has one eye, as a hole in the head — it is in profile', () => {
    // The eye is transparent, so the page shows through it. A gap in the BODY layer is only an eye if the PATCH
    // layer does not fill it — a patch leaves a gap in the body too, which is what made a first version of this
    // test report two eyes.
    const patch = cellSet(COW_PATCH);
    const inked = new Set(rowCells(COW_BODY, 4).map((c) => c.x));
    const span = [...inked].sort((a, b) => a - b);
    const holes = [];
    for (let x = span[0]; x < span[span.length - 1]; x++) {
      if (!inked.has(x) && !patch.has(`${x},4`)) holes.push(x);
    }
    expect(holes.length, `expected exactly one eye hole, got ${JSON.stringify(holes)}`).toBe(1);
    expect(holes[0], 'the eye belongs in the head, at the left').toBeLessThan(8);
  });

  it('has a tail at the opposite end from the head', () => {
    const tail = COW_BODY.cells.filter((c) => c.x > COW_W - 5 && c.y < 6);
    expect(tail.length, 'no tail').toBeGreaterThan(0);
  });

  // PATCHES ARE THE SIGNAL, and they must be irregular. Uniform-width rows are rectangles, which is exactly what
  // made the second attempt look like a robot.
  it('has irregular patches rather than matched rectangles', () => {
    // Reads the PATCH layer, which is the thing being asserted about — an earlier version measured the body and
    // so proved nothing about the markings at all.
    const marks = COW_PATCH.cells.filter((c) => c.y > 3 && c.y < 12);
    expect(marks.length).toBeGreaterThan(8);
    const byRow = new Map<number, number>();
    for (const c of marks) byRow.set(c.y, (byRow.get(c.y) ?? 0) + 1);
    expect(new Set(byRow.values()).size, 'every patch row the same width is a rectangle').toBeGreaterThan(1);
  });

  it('is mostly animal, with markings as a minority of it', () => {
    // If the patches outgrew the body the drawing would read as a pattern with legs.
    expect(COW_BODY.cells.length).toBeGreaterThan(COW_PATCH.cells.length * 2);
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
    // Swapping these would leave each page with a non-sequitur.
    expect(COW_LINES_404.join(' ').toLowerCase()).toMatch(/does not exist|nothing here/);
    expect(COW_LINES_WRITING.join(' ').toLowerCase()).toMatch(/nothing written|holding the space/);
  });
});
