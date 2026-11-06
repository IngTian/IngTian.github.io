// tests/descentFade.test.ts
// THE DESCENT GRAPH'S WAYPOINT FADE: the last tag, the PhD, must not jump out after the path ends. It is pure
// arithmetic that once lived inside a canvas draw loop, where a fix shipped as dead code (below an early
// return) and a pixel probe could not tell; so the rule is in `lib/`, and these assertions are about the SHAPE
// of the window, not about pixels.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { waypointFade } from '../src/lib/descentPath';
import { WAYPOINTS } from '../src/lib/trajectory';

/**
 * WP_FADE IS READ OUT OF THE COMPONENT, not re-typed here: a local copy would let the component's value drift
 * while every assertion below passed against the stale number.
 *
 * Read as TEXT because DescentPath.astro is an Astro component whose `<script>` touches `document` at module
 * scope, so it cannot be imported here — the same arrangement, for the same reason, as artSizes.test.ts. The
 * regex not matching is itself a failure (asserted first, below), or every spec here would pass vacuously.
 */
const component = readFileSync(new URL('../src/components/DescentPath.astro', import.meta.url), 'utf8');
const wpFadeMatch = /const\s+WP_FADE\s*=\s*(\d*\.?\d+)\s*;/.exec(component);
const WP_FADE = Number(wpFadeMatch?.[1]);
const N = WAYPOINTS.length;

describe('the fade width this spec is written against', () => {
  it('is the one the component actually passes', () => {
    expect(wpFadeMatch, 'WP_FADE declaration in src/components/DescentPath.astro').not.toBeNull();
    expect(Number.isFinite(WP_FADE), 'WP_FADE did not parse as a number').toBe(true);
    // A sanity band, not a pin: the point is that the value is REAL, not that it is 0.055. If the owner
    // retunes the fade, this spec retunes with it — but a fade wider than the gap between two arrivals, or
    // narrower than a couple of frames, breaks assumptions the assertions below do rely on.
    expect(WP_FADE).toBeGreaterThan(0.001);
    expect(WP_FADE).toBeLessThan(1 / (N - 1));
  });
});

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

  it('the first waypoint starts its fade at frame zero and finishes one window later', () => {
    // The first assertion here used to be `toBeGreaterThanOrEqual(0)`, which the function's own final
    // `Math.max(0, …)` makes true for every input — it could not fail and so was not a test. What is
    // actually claimed about waypoint 0 is that its arrival is 0, so at reveal 0 it is exactly at the
    // START of its fade (not yet visible, but not gated out either) and it reaches full opacity after one
    // window rather than after 1/(n-1).
    expect(waypointFade(0, N, 0, WP_FADE)).toBe(0);
    expect(waypointFade(0, N, WP_FADE / 2, WP_FADE)).toBeCloseTo(0.5, 6);
    expect(waypointFade(0, N, WP_FADE, WP_FADE)).toBe(1);
  });

  it('two names never fade at once, which is what WP_FADE is sized for', () => {
    // Arrivals are 1/(n-1) apart; the fade must finish inside that gap or the graph reads as a wash of
    // type arriving rather than as one stop at a time. Meaningful only because WP_FADE is now read out of
    // the component — against a local copy this asserted a property of this file's own constant.
    expect(WP_FADE).toBeLessThan(1 / (N - 1));
    // And the consequence, on the function rather than on the constant: when waypoint i is mid-fade, i+1
    // must be dark. Checked at the worst point, the instant i reaches full opacity.
    for (let i = 0; i < N - 1; i++) {
      const arrival = i / (N - 1);
      expect(waypointFade(i + 1, N, arrival + WP_FADE, WP_FADE), `waypoint ${i + 1} fades alongside ${i}`)
        .toBe(0);
    }
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
