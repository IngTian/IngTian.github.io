import { describe, it, expect } from 'vitest';
import { deckStops, nextStop, currentStop, type DeckSlide } from '../src/lib/deck';

// The real homepage geometry, measured in Chrome at 1700x1050. These numbers are the reason the deck
// is not CSS scroll-snap: every gap between slides is 1.8x-7.3x a single ~320px wheel gesture, so
// mandatory snap re-snapped backwards and the page froze at y=84.
const VH = 1050;
const HOME: DeckSlide[] = [
  { top: 0, height: 1134 },     // heights   — 1.08vh, just over one screen
  { top: 1134, height: 819 },   // interlude — fits
  { top: 1953, height: 2279 },  // story     — 2.17vh, needs interior stops
  { top: 4232, height: 2346 },  // mountains — 2.23vh, needs interior stops
  { top: 6578, height: 581 },   // ground    — fits
  { top: 7159, height: 193 },   // signature — fits
];
const MAX_Y = 7352 - VH;

describe('deckStops', () => {
  it('gives a slide that fits the viewport exactly one stop — its top', () => {
    const stops = deckStops([{ top: 0, height: 800 }], 1000, 5000);
    expect(stops).toEqual([0]);
  });

  it('never returns a stop past the maximum scroll offset', () => {
    const stops = deckStops(HOME, VH, MAX_Y);
    for (const s of stops) expect(s).toBeLessThanOrEqual(MAX_Y);
  });

  it('never returns a negative stop', () => {
    const stops = deckStops([{ top: -50, height: 400 }], 1000, 5000);
    for (const s of stops) expect(s).toBeGreaterThanOrEqual(0);
  });

  it('is sorted ascending with no duplicates', () => {
    const stops = deckStops(HOME, VH, MAX_Y);
    for (let i = 1; i < stops.length; i++) expect(stops[i]).toBeGreaterThan(stops[i - 1]);
  });

  it('includes every slide top (no slide is unreachable)', () => {
    const stops = deckStops(HOME, VH, MAX_Y);
    for (const s of HOME) {
      const reachable = Math.min(s.top, MAX_Y);
      expect(stops).toContain(reachable);
    }
  });

  // THE POINT OF THE INTERIOR STOPS: a 2.17-viewport slide of prose must be readable a screen at a
  // time. Without these, one gesture would jump from the story's top to Mountains and skip the text.
  it('pages through a slide taller than the viewport', () => {
    const stops = deckStops([{ top: 0, height: 2279 }], 1000, 4000);
    expect(stops.length).toBeGreaterThan(1);
    // Consecutive stops inside the slide are about a viewport apart — never a tiny nudge, never a
    // jump that skips a screen of content.
    for (let i = 1; i < stops.length; i++) {
      const d = stops[i] - stops[i - 1];
      expect(d).toBeGreaterThan(100);
      expect(d).toBeLessThanOrEqual(1000);
    }
  });

  it('ends a tall slide with its bottom edge aligned to the viewport bottom', () => {
    const stops = deckStops([{ top: 0, height: 2279 }], 1000, 4000);
    expect(stops).toContain(2279 - 1000);
  });

  it('leaves no gap larger than a viewport between consecutive stops inside a tall slide', () => {
    // Otherwise a single advance would skip content — the failure mode this module exists to prevent.
    const stops = deckStops([{ top: 0, height: 3000 }], 1000, 5000);
    for (let i = 1; i < stops.length; i++) {
      expect(stops[i] - stops[i - 1]).toBeLessThanOrEqual(1000);
    }
  });

  it('pages a tall slide with overlap so no line falls between two stops', () => {
    const H = 3000, VP = 1000;
    const stops = deckStops([{ top: 0, height: H }], VP, 5000);
    // Every pixel of the slide must be visible at some stop: consecutive stops overlap, and the last
    // one reaches the slide's bottom.
    for (let i = 1; i < stops.length; i++) {
      expect(stops[i]).toBeLessThan(stops[i - 1] + VP);
    }
    expect(stops[stops.length - 1] + VP).toBeGreaterThanOrEqual(H);
  });

  it('keeps some overlap between interior stops, so a broken paragraph stays readable', () => {
    const stops = deckStops([{ top: 0, height: 2500 }], 1000, 5000, 0.1);
    expect(stops[1] - stops[0]).toBeLessThan(1000);
  });

  it('honours overlap = 0 as exact viewport paging', () => {
    const stops = deckStops([{ top: 0, height: 3000 }], 1000, 5000, 0);
    expect(stops[1] - stops[0]).toBe(1000);
  });

  it('handles a slide exactly one viewport tall without inventing interior stops', () => {
    expect(deckStops([{ top: 0, height: 1000 }], 1000, 5000)).toEqual([0]);
  });

  // The hero overflows by 84px of 1050. A bottom-align stop there would advance the page by 84px on a
  // full gesture, which feels like the free scroll the deck replaces.
  it('does not page through a slide that only barely overflows the viewport', () => {
    expect(deckStops([{ top: 0, height: 1134 }], 1050, 5000)).toEqual([0]);
  });

  it('still pages through a slide that overflows by more than the slack', () => {
    const stops = deckStops([{ top: 0, height: 1600 }], 1000, 5000);
    expect(stops.length).toBeGreaterThan(1);
  });

  it('never emits two stops closer together than the slack', () => {
    const stops = deckStops(HOME, VH, MAX_Y);
    for (let i = 1; i < stops.length; i++) {
      expect(stops[i] - stops[i - 1]).toBeGreaterThanOrEqual(VH * 0.25);
    }
  });

  it('handles an empty slide list', () => {
    expect(deckStops([], 1000, 5000)).toEqual([]);
  });

  it('degrades safely when the viewport height is nonsense', () => {
    expect(deckStops(HOME, 0, MAX_Y)).toEqual([0]);
  });

  it('collapses slides that round to the same stop', () => {
    const stops = deckStops([{ top: 100, height: 200 }, { top: 100.4, height: 200 }], 1000, 5000);
    expect(stops).toEqual([100]);
  });
});

describe('nextStop', () => {
  const stops = [0, 1134, 1953, 2919, 3182, 4232, 5198, 5528, 6302];

  it('advances to the next stop below', () => {
    expect(nextStop(stops, 0, 1)).toBe(1134);
    expect(nextStop(stops, 1134, 1)).toBe(1953);
  });

  it('advances to the previous stop above', () => {
    expect(nextStop(stops, 1953, -1)).toBe(1134);
    expect(nextStop(stops, 1134, -1)).toBe(0);
  });

  it('returns null past the last stop, so the page end is not locked', () => {
    expect(nextStop(stops, 6302, 1)).toBeNull();
    expect(nextStop(stops, 9999, 1)).toBeNull();
  });

  it('returns null above the first stop', () => {
    expect(nextStop(stops, 0, -1)).toBeNull();
  });

  // Smooth scrolling rarely finishes on the exact pixel. Without tolerance, resting 3px short of a
  // stop would make the next gesture travel 3px instead of advancing a slide.
  it('treats a near-miss rest position as being AT the stop', () => {
    expect(nextStop(stops, 1131, 1)).toBe(1953);
    expect(nextStop(stops, 1137, 1)).toBe(1953);
  });

  it('does not skip a stop that is genuinely further than the tolerance', () => {
    expect(nextStop(stops, 1120, 1, 8)).toBe(1134);
  });

  it('respects a custom tolerance', () => {
    expect(nextStop(stops, 1120, 1, 20)).toBe(1953);
  });

  it('handles an empty stop list', () => {
    expect(nextStop([], 100, 1)).toBeNull();
    expect(nextStop([], 100, -1)).toBeNull();
  });

  it('always advances monotonically across the whole deck without cycling', () => {
    let y = 0;
    const seen = [y];
    for (let i = 0; i < 50; i++) {
      const n = nextStop(stops, y, 1);
      if (n === null) break;
      expect(n).toBeGreaterThan(y);
      y = n;
      seen.push(y);
    }
    expect(seen[seen.length - 1]).toBe(6302);
    expect(seen.length).toBe(stops.length);
  });

  it('walks back up through exactly the same stops', () => {
    let y = 6302;
    const back = [y];
    for (let i = 0; i < 50; i++) {
      const p = nextStop(stops, y, -1);
      if (p === null) break;
      y = p;
      back.push(y);
    }
    expect(back.reverse()).toEqual(stops);
  });
});

describe('currentStop', () => {
  const stops = [0, 1134, 1953];

  it('reports the nearest stop', () => {
    expect(currentStop(stops, 1130)).toBe(1134);
    expect(currentStop(stops, 400)).toBe(0);      // 400 from 0, 734 from 1134
    expect(currentStop(stops, 600)).toBe(1134);   // 600 from 0, 534 from 1134 — nearer the later stop
    expect(currentStop(stops, 1900)).toBe(1953);
  });

  it('returns null with no stops', () => {
    expect(currentStop([], 0)).toBeNull();
  });
});

describe('the real homepage geometry', () => {
  const stops = deckStops(HOME, VH, MAX_Y);

  it('produces more stops than slides, because two slides need paging', () => {
    expect(stops.length).toBeGreaterThan(HOME.length);
  });

  // A slide within `slack` of the viewport is not paged, so an advance can exceed one screen by up to
  // that slack — the hero's 1134px step over a 1050px viewport is the real case. That is the deliberate
  // trade: 84px of sky passes unseen, versus a stop that made a full gesture crawl 84px.
  it('never advances by more than one screen plus the slack', () => {
    for (let i = 1; i < stops.length; i++) {
      expect(stops[i] - stops[i - 1]).toBeLessThanOrEqual(VH * 1.25);
    }
  });

  it('never skips a full screen of content in one advance', () => {
    // The bound that actually protects the reading: no gesture may leap more than a screen of TEXT.
    // Slides carrying prose (story, mountains) are paged, so their internal steps stay under a screen.
    const prose = deckStops([HOME[2], HOME[3]], VH, MAX_Y);
    for (let i = 1; i < prose.length; i++) {
      expect(prose[i] - prose[i - 1]).toBeLessThanOrEqual(VH);
    }
  });

  it('reaches the bottom of the page', () => {
    expect(stops[stops.length - 1]).toBe(MAX_Y);
  });

  it('every advance moves at least a quarter screen, so no gesture crawls', () => {
    // The failure this guards: a stop 84px from its neighbour (the hero's overflow) meant one full
    // gesture moved 84px — indistinguishable from the free scroll the deck replaces.
    for (let i = 1; i < stops.length; i++) {
      expect(stops[i] - stops[i - 1]).toBeGreaterThanOrEqual(VH * 0.25);
    }
  });

  it('every slide top is still reachable after the too-close-stop filter', () => {
    // The filter drops stops, so this guards the thing that would matter most if it over-pruned:
    // a slide you can never rest at the top of.
    for (const s of HOME) {
      const target = Math.min(s.top, MAX_Y);
      const hit = stops.some((y) => Math.abs(y - target) < VH * 0.25);
      expect(hit).toBe(true);
    }
  });
});
