import { describe, it, expect } from 'vitest';
import { activeStopIndex, BAND, markStops } from '../src/lib/scrollspy';

// Viewport 1000px tall => reference line at 400px. A stop is "active" once its
// top has scrolled to/above that line; the last such stop wins.
const VH = 1000;
const DOC = 5000;

describe('activeStopIndex', () => {
  it('returns -1 when there are no stops', () => {
    expect(activeStopIndex([], VH, 0, DOC)).toBe(-1);
  });

  it('selects the first stop before anything crosses the reference line', () => {
    // all stops still below the 400px line
    expect(activeStopIndex([450, 900, 1500], VH, 0, DOC)).toBe(0);
  });

  it('selects the last stop whose top has crossed the reference line', () => {
    // tops at 100 and 300 are above 400 (crossed); 700 is not
    expect(activeStopIndex([100, 300, 700], VH, 600, DOC)).toBe(1);
  });

  it('treats a stop exactly on the reference line as crossed', () => {
    expect(activeStopIndex([400, 900], VH, 0, DOC)).toBe(0);
  });

  it('forces the final stop active when scrolled to the document bottom', () => {
    // none of the tops crossed the line, but we are at the very bottom, so the
    // short final section (e.g. a footer) still lights up
    expect(activeStopIndex([500, 600, 700], VH, DOC - VH, DOC)).toBe(2);
  });

  it('honors the 2px bottom epsilon', () => {
    // 1px short of the bottom still counts as "at bottom"
    expect(activeStopIndex([500, 600], VH, DOC - VH - 1, DOC)).toBe(1);
  });
});

// The rail's marking rule. VH = 1000 puts the reading band at 100–620px.
// Boxes are viewport-relative and in the rail's tree order; `parent` is a tree index.
const box = (top: number, bottom: number, parent: number | null = null, visible = true) =>
  ({ top, bottom, visible, parent });

describe('markStops', () => {
  it('reads the band SideRail has always used: 10% to 62% down the viewport', () => {
    expect(BAND).toEqual({ top: 0.10, bottom: 0.62 });
  });

  it('marks a stop whose box is inside the band as current, and it leads', () => {
    expect(markStops([box(-900, 50), box(200, 400), box(800, 1400)], VH, 900, DOC))
      .toEqual({ current: [1], ancestors: [], lead: 1 });
  });

  it('marks BOTH stops straddling a band edge as current', () => {
    // 0 runs out through the band's top, 1 in through its bottom: a reader at a section boundary sees two
    expect(markStops([box(-500, 300), box(300, 1200)], VH, 500, DOC).current).toEqual([0, 1]);
  });

  it('lights a parent whose own box misses the band as an ancestor of its current child', () => {
    // /experience: "Roles" points at its heading, scrolled past; one of its entries is in the band
    expect(markStops([box(-300, -250), box(150, 500, 0)], VH, 900, DOC))
      .toEqual({ current: [1], ancestors: [0], lead: 1 });
  });

  it('never lets a parent whose box CONTAINS a current child lead, however much of the band it fills', () => {
    // /writing: a kind's section holds its pieces, so both overlap the band and both are current
    const m = markStops([box(-400, 3000), box(500, 900, 0)], VH, 900, DOC);
    expect(m.current).toEqual([0, 1]);
    expect(m.ancestors).toEqual([]);
    expect(m.lead).toBe(1);
  });

  it('lights every ancestor up the chain once', () => {
    const m = markStops([box(-900, -800), box(-700, -600, 0), box(200, 400, 1), box(450, 600, 1)], VH, 900, DOC);
    expect(m.current).toEqual([2, 3]);
    expect(m.ancestors).toEqual([0, 1]);
  });

  it('falls back to activeStopIndex, on position-sorted tops, when nothing is in the band', () => {
    // above the first section: nothing overlaps, so the first stop is current
    expect(markStops([box(700, 900), box(1200, 1600)], VH, 0, DOC)).toEqual({ current: [0], ancestors: [], lead: 0 });
    // tree order is not screen order: stop 1 sits higher, has crossed 40%, and is the one the fallback picks
    expect(markStops([box(700, 800), box(30, 90)], VH, 600, DOC).current).toEqual([1]);
  });

  it('marks the last stop current at the page bottom when it is too short to reach the band', () => {
    expect(markStops([box(-800, 60), box(700, 900)], VH, DOC - VH, DOC).current).toEqual([1]);
  });

  it('never marks a hidden stop: not by the band, not by the fallback, not as an ancestor', () => {
    expect(markStops([box(200, 400, null, false), box(700, 900)], VH, 0, DOC).current).toEqual([1]);
    expect(markStops([box(700, 800), box(900, 950, null, false)], VH, DOC - VH, DOC).current).toEqual([0]);
    expect(markStops([box(-900, -800, null, false), box(200, 400, 0)], VH, 900, DOC).ancestors).toEqual([]);
    expect(markStops([box(0, 0, null, false)], VH, 0, DOC)).toEqual({ current: [], ancestors: [], lead: null });
  });

  describe('the lead, one key at a time', () => {
    it('1. a stop that is an ancestor of another current stop loses, even with more of the band', () => {
      expect(markStops([box(0, 1000), box(550, 700, 0)], VH, 900, DOC).lead).toBe(1);
    });
    it('2. then the larger band overlap wins', () => {
      expect(markStops([box(-200, 200), box(200, 2000)], VH, 900, DOC).lead).toBe(1);
    });
    it('3. then, at equal overlap, the higher box wins', () => {
      expect(markStops([box(-100, 2000), box(-200, 2000)], VH, 900, DOC).lead).toBe(1);
    });
    it('4. then, at equal overlap and top, tree order wins', () => {
      expect(markStops([box(-100, 2000), box(-100, 2000)], VH, 900, DOC).lead).toBe(0);
    });
  });
});
