import { describe, it, expect } from 'vitest';
import { deckStops, nextStop, wheelAction, wheelStep, WHEEL_THRESHOLD, QUIET_STREAM, easeInOutCubic, DECK_TWEEN_MS, type DeckSlide, type WheelStream } from '../src/lib/deck';

// A REPRESENTATIVE mixed-height page, not today's: the homepage's geometry as measured in Chrome at 1700x1050
// when the deck was built, six slides in an earlier order (the labels name them). What it holds is the mix of
// slides that fit and slides that need interior stops, and gaps 1.8x-7.3x a single ~320px wheel gesture,
// which is why the deck is not CSS scroll-snap.
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

describe('a mixed-height page (HOME)', () => {
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
    // The two tall prose slides (HOME[2], HOME[3]) are paged, so their internal steps stay under a screen.
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

/**
 * THE TRANSITION CURVE. The deck stopped using `behavior: 'smooth'` because the browser's curve is
 * front-loaded — measured on the owner's own screen recording (578 frames at 55.8fps), a slide reached
 * near-peak velocity within ~35ms of standstill, which is what he described as "the sudden change of slides
 * instead of a smooth transition". These assert the properties that make the replacement feel deliberate,
 * rather than restating the formula back to itself.
 */
describe('deck transition easing', () => {
  it('starts and ends exactly at the endpoints, so a slide lands on its stop', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
  });

  it('clamps out-of-range progress instead of overshooting', () => {
    // A frame can arrive late, making elapsed/duration exceed 1. Unclamped, the page would scroll PAST the
    // stop and snap back — the exact artefact this change exists to remove.
    expect(easeInOutCubic(1.4)).toBe(1);
    expect(easeInOutCubic(-0.2)).toBe(0);
  });

  it('is symmetric — the departure and the arrival are the same gesture', () => {
    for (const t of [0.1, 0.25, 0.4, 0.49]) {
      expect(easeInOutCubic(t) + easeInOutCubic(1 - t)).toBeCloseTo(1, 10);
    }
  });

  it('EASES IN: the opening tenth of the time covers only a few percent of the distance', () => {
    // This is the whole point of the change. The native curve spent its velocity ramp in the first ~7% of the
    // duration; this covers under 5% of the DISTANCE in the first 10% of the time, so the slide leaves gently.
    expect(easeInOutCubic(0.1)).toBeLessThan(0.05);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 10);
  });

  it('never moves backwards', () => {
    let prev = -1;
    for (let i = 0; i <= 100; i++) {
      const v = easeInOutCubic(i / 100);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('keeps the duration long enough to read as motion and short enough not to feel slow', () => {
    // 650ms: a little longer than the ~500ms native scroll it replaced, because an ease-in spends the opening
    // frames at low velocity and the same distance has to be covered in the middle.
    expect(DECK_TWEEN_MS).toBeGreaterThanOrEqual(450);
    expect(DECK_TWEEN_MS).toBeLessThanOrEqual(900);
  });
});

/**
 * ONE GESTURE'S TRAVEL, once nothing holds the deck. The wiring (popstate and hashchange set the deck yielding; the
 * tween is cancelled) can only be seen in a browser; wheelStep, below, is the whole rule over a stream.
 */
describe('wheelAction', () => {
  const STOPS = [0, 1000, 2000];

  it('swallows a gesture under the threshold rather than passing it, so the rest of it stays cancelable', () => {
    expect(wheelAction(6, STOPS, 1000)).toBe('swallow');
    expect(wheelAction(-6, STOPS, 1000)).toBe('swallow');
    expect(wheelAction(WHEEL_THRESHOLD - 0.1, STOPS, 1000)).toBe('swallow');
    expect(wheelAction(WHEEL_THRESHOLD, STOPS, 1000)).toBe('start');
    expect(wheelAction(-WHEEL_THRESHOLD, STOPS, 1000)).toBe('start');
  });

  it("passes at an end, small or not, so the page's ends never feel locked", () => {
    for (const travel of [6, 40]) expect(wheelAction(travel, STOPS, 2000)).toBe('pass');
    for (const travel of [-6, -40]) expect(wheelAction(travel, STOPS, 0)).toBe('pass');
  });
});

// THE STREAM, replayed in event time. A flick is the measured opener [6.2, 70, 43.1, 30.7] at 120 Hz and then macOS's
// inertia: events once an interval, decaying exponentially (450ms) from the opener's last, for ~1.8s; at 60 Hz the
// same motion arrives as events of twice the size. Chrome's merges are modelled as it makes them: the events it
// queued while the page was busy, summed into one stamped with the last one's time. These are models of a trackpad,
// not recordings; what they hold is the deck's contract: one gesture moves one slide, and the next one is heard.
describe('wheelStep', () => {
  const STOPS = [0, 1000, 2000, 3000, 4000];
  type Ev = [at: number, dy: number];

  const flick = (t0: number, { sign = 1, hz = 120, strength = 1 } = {}): Ev[] => {
    const dt = 1000 / hz, k = strength * (120 / hz);
    const evs: Ev[] = [6.2, 70, 43.1, 30.7].map((dy, i) => [t0 + i * dt, sign * dy * k]);
    for (let i = 1; ; i++) {
      const dy = 30.7 * k * Math.exp(-(i * dt) / 450);
      if (dy < 0.5) break;
      evs.push([t0 + (3 + i) * dt, sign * dy]);
    }
    return evs;
  };

  /** The `n` events from `from` on, summed into one at the last one's time: what Chrome sends after a stall. */
  const merged = (evs: Ev[], from: number, n: number): Ev[] => {
    const i = evs.findIndex(([at]) => at >= from);
    if (i < 0 || i + n > evs.length) return evs;
    const part = evs.slice(i, i + n);
    return [...evs.slice(0, i), [part[n - 1][0], part.reduce((a, [, dy]) => a + dy, 0)], ...evs.slice(i + n)];
  };

  /** Each event's time when it started a slide; the deck is busy for the tween after each. */
  const starts = (evs: Ev[]): number[] => {
    let s: WheelStream = QUIET_STREAM;
    let busyUntil = -Infinity;
    const out: number[] = [];
    for (const [at, dy] of [...evs].sort((a, b) => a[0] - b[0])) {
      const r = wheelStep(s, dy, at, at < busyUntil, STOPS, 2000);
      s = r.next;
      if (r.action === 'start') { out.push(at); busyUntil = at + DECK_TWEEN_MS; }
    }
    return out;
  };

  it('starts one slide per flick, however long and hard its momentum runs', () => {
    for (const hz of [120, 60]) for (const strength of [1, 2]) for (const sign of [1, -1]) {
      expect(starts(flick(0, { sign, hz, strength })), `${hz} Hz, ${strength}x, ${sign}`).toHaveLength(1);
    }
  });

  it("starts no slide from a tail Chrome merged while the page was busy", () => {
    for (const hz of [120, 60]) for (const strength of [1, 2]) for (const n of [2, 3, 4, 6]) {
      for (let from = 600; from <= 1400; from += 100) {
        expect(starts(merged(flick(0, { hz, strength }), from, n)), `${hz} Hz, ${strength}x, ${n} merged at ${from}`).toHaveLength(1);
      }
    }
  });

  it('moves one slide for one long drag, however its speed wanders', () => {
    const drag = (hz: number, f: (i: number) => number): Ev[] =>
      Array.from({ length: Math.round((1.5 * hz)) }, (_, i) => [i * (1000 / hz), f(i)] as Ev);
    expect(starts(drag(120, (i) => 14 + 8 * Math.sin(i / 7)))).toHaveLength(1);
    expect(starts(drag(60, (i) => 16 + 6 * Math.sin(i / 4)))).toHaveLength(1);
    // A drag whose events wander ±50% from one to the next (7, 21, 7, …): 3x apart, never a jump.
    expect(starts(drag(120, (i) => (i % 2 ? 21 : 7)))).toHaveLength(1);
    // Lifting off after a long drag: its last finger event, a gap (Chromium waits up to 100ms for momentum), then
    // inertia. The first inertia event reads slow by rate; the next is its normal size, not a jump.
    const finger: Ev[] = drag(120, (i) => (i < 102 ? 12 : 22)).slice(0, 120);
    const t = finger[finger.length - 1][0] + 33;
    const inertia: Ev[] = Array.from({ length: 200 }, (_, i) => [t + i * (1000 / 120), 22 * Math.exp(-(i * 1000 / 120) / 450)] as Ev);
    expect(starts([...finger, ...inertia])).toHaveLength(1);
  });

  it("honours a second flick made as the slide lands, while the first one's momentum is still arriving", () => {
    // Touching the pad stops the inertia. Holding the deck until the inertia stopped swallowed these flicks whole,
    // and a firm first flick's inertia is still at threshold rate after the slide lands.
    for (const strength of [1, 2, 3]) for (const [hz, second] of [[120, 700], [120, 800], [120, 900], [60, 900], [60, 1200]]) {
      const evs = [...flick(0, { hz, strength }).filter(([at]) => at < second), ...flick(second, { hz })];
      expect(starts(evs), `${hz} Hz, ${strength}x first, second at ${second}`).toHaveLength(2);
    }
  });

  it('still lets a slow drag add up from quiet, and a mouse notch start at once', () => {
    const slow: Ev[] = [3, 4, 4, 3, 4, 4].map((dy, i) => [i * 16, dy]);
    expect(starts(slow)).toEqual([64]);   // 3 + 4 + 4 + 3 + 4 = 18
    // Notches 300ms apart: the second lands mid-tween and is swallowed; one after the tween starts again.
    expect(starts([[0, 100], [300, 100], [1000, 100]])).toEqual([0, 1000]);
  });

  it('reads a jump in rate and in size, so neither a merge nor a gap fakes one, and passes at an end', () => {
    const F = 1000 / 120;
    const tail = (rate: number, delta: number): WheelStream => ({ travel: 0, lastAt: 0, rate, delta, tail: true });
    // Chrome summed three 8px events into one: its size jumps, its rate does not.
    expect(wheelStep(tail(8, 8), 24, 3 * F, false, STOPS, 2000).action).toBe('swallow');
    // The event after a 33ms gap read 5.5 by rate; the next, its normal 22px, jumps by rate alone.
    expect(wheelStep(tail(5.5, 22), 22, F, false, STOPS, 2000).action).toBe('swallow');
    // A new flick's opener jumps in both.
    expect(wheelStep(tail(6.2, 6.2), 70, F, false, STOPS, 2000).action).toBe('start');
    const atEnd = wheelStep(QUIET_STREAM, 40, 0, false, STOPS, 4000);
    expect(atEnd.action).toBe('pass');
    expect(atEnd.next).toEqual(QUIET_STREAM);
  });
});
