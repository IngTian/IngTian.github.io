// tests/descentFade.test.ts
// THE DESCENT GRAPH'S WAYPOINT FADE, which has produced two bugs and had no spec either time.
//
// Reported: *"the descent's last tag, the PhD, jumped out a few hundred milliseconds after the path ends."*
// The first fix for it shipped as DEAD CODE — the clamp it added sat below an early return that bailed on
// the un-clamped arrival, so for the one waypoint it existed for the function returned before the fade was
// evaluated. Both bugs were pure arithmetic inside a canvas draw loop, where nothing could see them, and a
// pixel probe that A/B'd the region measured no change and was read as "the band is too coarse" rather than
// as "the fix is not running". The null result was the signal.
//
// So the rule is in `lib/` now and this is its spec. The assertions are about the SHAPE of the window, not
// about pixels.
import { describe, expect, it } from 'vitest';
import { waypointFade } from '../src/lib/descentPath';
import { WAYPOINTS } from '../src/lib/trajectory';

/** What the component passes. Kept here so a change there has to come past this file. */
const WP_FADE = 0.055;
const N = WAYPOINTS.length;

describe('waypointFade — the last waypoint must fade, not pop', () => {
  it('the last waypoint IS the PhD, so this is the tag the owner reported', () => {
    // If the career data ever reorders, the bug this file is about moves with it — better to know.
    expect(WAYPOINTS[N - 1].label).toMatch(/PhD/);
    expect(N).toBeGreaterThan(2);
  });

  it('is drawn before reveal reaches 1 — the bug was that it was not', () => {
    // The whole defect in one assertion. Pre-fix this was 0 for every reveal < 1.
    const mid = 1 - WP_FADE / 2;
    expect(waypointFade(N - 1, N, mid, WP_FADE)).toBeGreaterThan(0);
    expect(waypointFade(N - 1, N, mid, WP_FADE)).toBeLessThan(1);
  });

  it('rises monotonically from 0 to 1 across its window, with no step', () => {
    const start = 1 - WP_FADE;
    expect(waypointFade(N - 1, N, start - 1e-4, WP_FADE)).toBe(0);

    let prev = -1;
    let maxStep = 0;
    for (let r = start; r <= 1.00001; r += WP_FADE / 40) {
      const f = waypointFade(N - 1, N, Math.min(1, r), WP_FADE);
      expect(f).toBeGreaterThanOrEqual(prev);
      if (prev >= 0) maxStep = Math.max(maxStep, f - prev);
      prev = f;
    }
    expect(prev).toBe(1);
    // A pop is a single step of 1.0. Sampled at 1/40 of the window, no step may approach that.
    expect(maxStep, 'the fade still contains a step — that is the pop').toBeLessThan(0.1);
  });

  it('completes exactly AT reveal 1, so it lands with the trail rather than after it', () => {
    // The alternative — arrivals that stop short of 1 — makes the dot appear BEFORE the trail reaches it,
    // which is the "label catching up with a dot" problem the component's own note exists to prevent.
    expect(waypointFade(N - 1, N, 1, WP_FADE)).toBe(1);
  });
});

describe('waypointFade — no other waypoint moved', () => {
  it('every earlier waypoint still starts at its own arrival', () => {
    // The clamp must be a no-op for them: the last-but-one arrives at (n-2)/(n-1) = 0.857, well below
    // 1 - 0.055 = 0.945. If someone widens WP_FADE past (1 - 0.857) this silently starts retiming the
    // second-to-last name too, so it is asserted rather than assumed.
    for (let i = 0; i < N - 1; i++) {
      const arrival = i / (N - 1);
      expect(arrival, `widening WP_FADE has started clamping waypoint ${i}`).toBeLessThan(1 - WP_FADE);
      expect(waypointFade(i, N, arrival - 1e-4, WP_FADE), `waypoint ${i} appears early`).toBe(0);
      expect(waypointFade(i, N, arrival + 1e-9, WP_FADE), `waypoint ${i} does not start at its arrival`)
        .toBeCloseTo(0, 4);
      // toBeCloseTo, not toBe: `(arrival + WP_FADE - arrival) / WP_FADE` is 0.9999999999999999 for
      // waypoint 1 in IEEE-754. The function clamps the top, so it can never exceed 1 — only fall a
      // thousandth of a pixel's worth short, which is invisible and not worth chasing with exact arithmetic.
      expect(waypointFade(i, N, arrival + WP_FADE, WP_FADE), `waypoint ${i} does not reach full opacity`)
        .toBeCloseTo(1, 10);
    }
  });

  it('the first waypoint is present from the very first frame', () => {
    expect(waypointFade(0, N, 0, WP_FADE)).toBeGreaterThanOrEqual(0);
    expect(waypointFade(0, N, WP_FADE, WP_FADE)).toBe(1);
  });

  it('two names never fade at once, which is what WP_FADE is sized for', () => {
    // Arrivals are 1/(n-1) apart; the fade must finish inside that gap or the graph reads as a wash of
    // type arriving rather than as one stop at a time.
    expect(WP_FADE).toBeLessThan(1 / (N - 1));
  });
});

describe('waypointFade — the states the component actually calls it in', () => {
  it('reveal 1 draws every waypoint at full opacity — the reduced-motion frame', () => {
    // `animate()` short-circuits to `reveal = 1` and draws one finished frame. Every name must be there.
    for (let i = 0; i < N; i++) expect(waypointFade(i, N, 1, WP_FADE)).toBe(1);
  });

  it('reveal 0 draws nothing but the first', () => {
    for (let i = 1; i < N; i++) expect(waypointFade(i, N, 0, WP_FADE)).toBe(0);
  });

  it('clamps outside [0,1], because reveal is eased and driven by a wall clock', () => {
    expect(waypointFade(N - 1, N, -0.5, WP_FADE)).toBe(0);
    expect(waypointFade(N - 1, N, 2, WP_FADE)).toBe(1);
  });

  it('a single-waypoint path does not divide by zero', () => {
    expect(waypointFade(0, 1, 0, WP_FADE)).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(waypointFade(0, 1, 1, WP_FADE))).toBe(true);
  });
});
