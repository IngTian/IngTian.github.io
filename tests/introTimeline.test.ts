// tests/introTimeline.test.ts
// THE HOMEPAGE INTRO'S TIMELINE, and the two decisions around it.
//
// The intro surveys the terrain as a contour map on a flat plane, lifts the surface out of that map, and
// resolves the dots as the lines fade. This module is the whole schedule, as a pure function of
// normalised time — which is the only reason any of it is testable, since the drawing lives in a
// component `<script>` and this project has no jsdom.
//
// THE ASSERTION THAT MATTERS MOST IS THE t=1 LANDING. The intro has to end on exactly the frame the hero
// already paints at rest, because the handoff to the live breath loop depends on it: `TerrainHero` ramps
// breath 0 → 0.04 from the static frame, and that ramp is only the right continuation if the intro
// finished where the static frame is. A ±8.8px version of getting that wrong has already shipped once.
import { describe, expect, it } from 'vitest';
import {
  INTRO_DURATION_MS, INTRO_DUR_MIN_MS, INTRO_DUR_MAX_MS, INTRO_PHASES,
  introFrame, introDurationFrom, shouldPlayIntro,
} from '../src/lib/introTimeline';

describe('introFrame — the landing', () => {
  it('lands EXACTLY on the hero at t=1', () => {
    // lift 1 = full elevation, dots 1 = full alpha, contourAlpha 0 = the survey is gone. That IS
    // `frame(0, false)`. Anything else and the handoff to the breath ramp is a visible step.
    const f = introFrame(1);
    expect(f.lift).toBe(1);
    expect(f.dots).toBe(1);
    expect(f.contourAlpha).toBe(0);
  });

  it('starts on a flat plane with nothing yet drawn at t=0', () => {
    const f = introFrame(0);
    expect(f.lift).toBe(0);
    expect(f.survey).toBe(0);
    expect(f.dots).toBe(0);
  });

  it('clamps outside [0,1] — t is driven by a wall clock', () => {
    expect(introFrame(-0.5)).toEqual(introFrame(0));
    expect(introFrame(2)).toEqual(introFrame(1));
  });

  it('never returns a non-finite channel, for any t', () => {
    for (let i = -20; i <= 120; i++) {
      const f = introFrame(i / 100);
      for (const [k, v] of Object.entries(f)) {
        expect(Number.isFinite(v), `${k} is ${v} at t=${i / 100}`).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('introFrame — the shape of the motion', () => {
  const SAMPLES = 400;

  it('rises monotonically in lift and dots', () => {
    let prevLift = -1, prevDots = -1;
    for (let i = 0; i <= SAMPLES; i++) {
      const f = introFrame(i / SAMPLES);
      expect(f.lift).toBeGreaterThanOrEqual(prevLift);
      expect(f.dots).toBeGreaterThanOrEqual(prevDots);
      prevLift = f.lift; prevDots = f.dots;
    }
  });

  it('surveys monotonically', () => {
    let prev = -1;
    for (let i = 0; i <= SAMPLES; i++) {
      const f = introFrame(i / SAMPLES);
      expect(f.survey).toBeGreaterThanOrEqual(prev);
      prev = f.survey;
    }
  });

  it('contains no step — a pop is a single jump of 1.0', () => {
    // Sampled at 1/400 of the animation. At 3600ms that is a 9ms slice, so a step here is a step a
    // viewer would see. This is the same assertion shape as tests/descentFade.test.ts, which exists
    // because a fade bug in this codebase shipped twice.
    let prev = introFrame(0);
    let worst = 0, worstAt = '';
    for (let i = 1; i <= SAMPLES; i++) {
      const f = introFrame(i / SAMPLES);
      for (const k of ['survey', 'lift', 'dots', 'contourAlpha'] as const) {
        const step = Math.abs(f[k] - prev[k]);
        if (step > worst) { worst = step; worstAt = `${k} at t=${(i / SAMPLES).toFixed(3)}`; }
      }
      prev = f;
    }
    expect(worst, `largest step was ${worst.toFixed(4)} in ${worstAt}`).toBeLessThan(0.1);
  });

  it('surveys before it lifts', () => {
    // The design's sequence: a map is drawn, THEN the ground rises out of it. If the lift leads, the
    // lines are deforming a surface the viewer never saw flat, and the idea is lost.
    const atLift = introFrame(INTRO_PHASES.liftStart);
    expect(atLift.survey).toBeGreaterThan(0.8);
  });

  it('lifts at least halfway before the lines begin to fade', () => {
    // The lines have to ride the surface up for long enough to be SEEN doing it — that is the whole
    // "the map becomes the territory" idea, and if the fade leads the lift the lines just disappear off
    // a flat plane.
    //
    // `toBeGreaterThanOrEqual`, not `toBeGreaterThan`: with the judged phase values the lift at
    // fadeStart is smoother((0.62 - 0.36) / (0.88 - 0.36)) = smoother(0.5), which is EXACTLY 0.5. The
    // original assertion said `> 0.5` and failed on that exact midpoint. The phases are the values the
    // owner judged, so the boundary is what moved, not the animation.
    const atFade = introFrame(INTRO_PHASES.fadeStart);
    expect(atFade.lift).toBeGreaterThanOrEqual(0.5);
    // and the lift has genuinely been underway for a while by then, not just started
    expect(INTRO_PHASES.fadeStart - INTRO_PHASES.liftStart).toBeGreaterThan(0.2);
  });

  it('finishes the fade before the end, so the final frame is clean', () => {
    expect(INTRO_PHASES.fadeEnd).toBeLessThanOrEqual(1);
    expect(introFrame(INTRO_PHASES.fadeEnd).contourAlpha).toBe(0);
  });

  it('overlaps its phases rather than running them in strict sequence', () => {
    // A strict sequence read as three separate events when prototyped. The overlap is deliberate.
    expect(INTRO_PHASES.liftStart).toBeLessThan(INTRO_PHASES.surveyEnd);
    expect(INTRO_PHASES.dotsStart).toBeLessThan(INTRO_PHASES.liftEnd);
  });

  it('keeps every phase boundary a fraction in (0, 1], ascending within its channel', () => {
    // Fractions, not milliseconds, so changing the duration alone rescales the whole thing coherently —
    // which is what makes the owner's tuning pass one number instead of seven.
    for (const [k, v] of Object.entries(INTRO_PHASES)) {
      expect(v, `${k} is not a fraction`).toBeGreaterThan(0);
      expect(v, `${k} is not a fraction`).toBeLessThanOrEqual(1);
    }
    expect(INTRO_PHASES.liftStart).toBeLessThan(INTRO_PHASES.liftEnd);
    expect(INTRO_PHASES.dotsStart).toBeLessThan(INTRO_PHASES.dotsEnd);
    expect(INTRO_PHASES.fadeStart).toBeLessThan(INTRO_PHASES.fadeEnd);
  });
});

describe('introDurationFrom', () => {
  it('reads a valid duration', () => {
    expect(introDurationFrom('?intro=1&dur=3000')).toBe(3000);
    expect(introDurationFrom('?dur=2500')).toBe(2500);
  });

  it('falls back to the shipped default when no override is present', () => {
    for (const s of ['', '?', '?intro=1', '?foo=bar']) {
      expect(introDurationFrom(s)).toBe(INTRO_DURATION_MS);
    }
  });

  it('falls back to the default on garbage rather than producing NaN', () => {
    // `t = elapsed / NaN` is NaN, which propagates into every dot's elevation and paints a blank canvas.
    for (const s of ['?dur=abc', '?dur=', '?dur=NaN', '?dur=null', '?dur=%20', '?dur=1,2']) {
      expect(introDurationFrom(s), s).toBe(INTRO_DURATION_MS);
    }
  });

  it('clamps zero and negatives — t = elapsed/0 is Infinity', () => {
    expect(introDurationFrom('?dur=0')).toBe(INTRO_DUR_MIN_MS);
    expect(introDurationFrom('?dur=-5')).toBe(INTRO_DUR_MIN_MS);
    expect(introDurationFrom('?dur=-99999')).toBe(INTRO_DUR_MIN_MS);
  });

  it('clamps absurdly large values, so a typo cannot freeze the hero flat', () => {
    expect(introDurationFrom('?dur=1e9')).toBe(INTRO_DUR_MAX_MS);
    expect(introDurationFrom('?dur=99999999')).toBe(INTRO_DUR_MAX_MS);
  });

  it('never returns a non-finite number for any input', () => {
    const hostile = ['?dur=Infinity', '?dur=-Infinity', '?dur=1e999', '?dur=0x10', '?dur=1e-999',
                     '?dur=' + '9'.repeat(400), '?dur=.', '?dur=-', '?dur=+'];
    for (const s of hostile) {
      const v = introDurationFrom(s);
      expect(Number.isFinite(v), `${s} → ${v}`).toBe(true);
      expect(v).toBeGreaterThanOrEqual(INTRO_DUR_MIN_MS);
      expect(v).toBeLessThanOrEqual(INTRO_DUR_MAX_MS);
    }
  });

  it('defaults to 3600ms — the pace the owner judged', () => {
    expect(INTRO_DURATION_MS).toBe(3600);
  });
});

describe('shouldPlayIntro', () => {
  it('plays when the flag is unset', () => {
    expect(shouldPlayIntro({ get: () => null }, '')).toBe(true);
  });

  it('does not play when the flag is set — it is a FIRST open', () => {
    expect(shouldPlayIntro({ get: () => '1' }, '')).toBe(false);
  });

  it('PLAYS when storage access THROWS', () => {
    // Private mode and disabled storage raise on ACCESS, not just on write. A throw must mean "play it"
    // and must never break the hero: the alternative is a blank first screen in Safari private browsing.
    expect(shouldPlayIntro({ get: () => { throw new Error('denied'); } }, '')).toBe(true);
  });

  it('plays regardless of the flag when ?intro=1 is present', () => {
    // The tuning affordance. Without it, iterating on the timing means clearing sessionStorage or
    // opening a fresh tab on every reload.
    expect(shouldPlayIntro({ get: () => '1' }, '?intro=1')).toBe(true);
    expect(shouldPlayIntro({ get: () => '1' }, '?intro=1&dur=1200')).toBe(true);
  });

  it('is not triggered by an unrelated query string', () => {
    expect(shouldPlayIntro({ get: () => '1' }, '?introduction=yes')).toBe(false);
    expect(shouldPlayIntro({ get: () => '1' }, '?x=intro')).toBe(false);
  });
});
