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
  INTRO_SURVEY_STAGGER,
  introFrame, introDurationFrom, shouldPlayIntro, surveyProgress, introStillRunning,
} from '../src/lib/introTimeline';

/** How much of the contour map is stroked overall — the mean of the per-level schedules. */
const drawn = (t: number, n = 9): number => {
  const s = introFrame(t).survey;
  let total = 0;
  for (let i = 0; i < n; i++) total += surveyProgress(s, i, n);
  return total / n;
};

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
    //
    // ASSERTED ON WHAT IS DRAWN, not on the linear phase progress. The first version of this test read
    // `introFrame(liftStart).survey > 0.8` — the phase clock — which measures how far through the
    // survey's ALLOTTED TIME we are, not how much map is on screen. Those differ by the per-level
    // schedule, which is the whole mechanism. When `liftStart` moved from 0.36 to 0.28 to kill a dead
    // patch, the phase reading dropped to 0.70 and the test failed while the thing it cares about got
    // slightly stronger: 93% of the map is stroked when the ground starts to move.
    expect(drawn(INTRO_PHASES.liftStart)).toBeGreaterThan(0.85);
    // and the ground really has not moved yet
    expect(introFrame(INTRO_PHASES.liftStart).lift).toBe(0);
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

  it('NEVER PLATEAUS — no 150ms window where nothing visible moves', () => {
    // THE BUG THIS EXISTS FOR, found by review and not by this suite's first version. The per-level
    // survey schedule used to live as three inline literals in TerrainHero's draw call, re-clamping the
    // already-eased `survey` through its own 0.45-wide window. The last level therefore finished at
    // t≈0.19 while `lift` did not become perceptible until t≈0.42 — a ~620ms FROZEN FRAME in the middle
    // of a 3600ms animation, roughly a fifth of it. The spec's stated reason for overlapping the phases
    // is "so there is no beat of stillness between them"; the shipped version had exactly that beat.
    //
    // The module's own `survey` channel kept moving (0.855 → 0.999) across the plateau, so nothing here
    // could see it. This assertion measures what is actually DRAWN — the mean per-level progress — plus
    // the other three channels, which is the quantity a viewer perceives.
    //
    // This is the mirror of the no-step test above: a step is motion with no time, a plateau is time
    // with no motion, and both read as broken.
    const WINDOW = 150 / INTRO_DURATION_MS;   // 150ms expressed in normalised time
    const EPS = 0.004;
    let worst = 1, worstAt = '';
    for (let t = 0; t + WINDOW <= INTRO_PHASES.fadeEnd; t += WINDOW / 3) {
      const a = introFrame(t), b = introFrame(t + WINDOW);
      const moved = Math.max(
        Math.abs(drawn(t + WINDOW) - drawn(t)),
        Math.abs(b.lift - a.lift),
        Math.abs(b.dots - a.dots),
        Math.abs(b.contourAlpha - a.contourAlpha),
      );
      if (moved < worst) { worst = moved; worstAt = `t=${t.toFixed(3)}`; }
    }
    expect(worst, `quietest 150ms window moved only ${worst.toFixed(5)} at ${worstAt}`)
      .toBeGreaterThan(EPS);
  });

  it('finishes the contour map exactly at surveyEnd, not a fifth of the way in', () => {
    // `surveyEnd` is documented as "the contour map finishes drawing" and must mean it, or the owner
    // tuning that constant gets a confusing response. The last level is the one that decides.
    const n = 9;
    expect(surveyProgress(introFrame(INTRO_PHASES.surveyEnd).survey, n - 1, n)).toBe(1);
    expect(surveyProgress(introFrame(INTRO_PHASES.surveyEnd * 0.9).survey, n - 1, n)).toBeLessThan(1);
    expect(drawn(INTRO_PHASES.surveyEnd)).toBe(1);
  });

  it('staggers the levels so the map draws as passes, not all at once', () => {
    const n = 9;
    const mid = introFrame(INTRO_PHASES.surveyEnd * 0.5).survey;
    const first = surveyProgress(mid, 0, n);
    const last = surveyProgress(mid, n - 1, n);
    expect(first).toBeGreaterThan(last);
    expect(INTRO_SURVEY_STAGGER).toBeGreaterThan(0);
    // and the stagger must leave room for a window: (n-1)*stagger < 1
    expect((n - 1) * INTRO_SURVEY_STAGGER).toBeLessThan(1);
  });

  it('gives every level a monotone 0→1 schedule', () => {
    const n = 9;
    for (let i = 0; i < n; i++) {
      let prev = -1;
      for (let k = 0; k <= 200; k++) {
        const v = surveyProgress(k / 200, i, n);
        expect(v).toBeGreaterThanOrEqual(prev);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
        prev = v;
      }
      expect(surveyProgress(0, i, n)).toBe(i === 0 ? 0 : 0);
      expect(surveyProgress(1, i, n)).toBe(1);
    }
  });

  it('is safe for a single level', () => {
    expect(surveyProgress(0, 0, 1)).toBe(0);
    expect(surveyProgress(1, 0, 1)).toBe(1);
    expect(Number.isFinite(surveyProgress(0.5, 0, 1))).toBe(true);
  });

  it('eases the contour fade out with zero velocity at BOTH ends', () => {
    // The lines went from perfectly steady to losing ~1.2% opacity per millisecond in one frame,
    // because the fade used out-cubic — maximum velocity exactly AT the join. Not a step, so the
    // no-step test could not see it; a derivative discontinuity in opacity. Inconsistent with the
    // reason smootherstep is used for lift and dots ("zero velocity at both ends"), so it now matches.
    const d = (t: number) => {
      const h = 1e-4;
      return (introFrame(t + h).contourAlpha - introFrame(t - h).contourAlpha) / (2 * h);
    };
    expect(Math.abs(d(INTRO_PHASES.fadeStart + 1e-3))).toBeLessThan(0.35);
    expect(Math.abs(d(INTRO_PHASES.fadeEnd - 1e-3))).toBeLessThan(0.35);
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

describe('introStillRunning — surviving a re-init', () => {
  it('is false before anything has started', () => {
    expect(introStillRunning(null, 1000, 3600)).toBe(false);
  });

  it('is true while an intro is mid-flight', () => {
    // THE BUG THIS EXISTS FOR: `theme:change` re-inits the whole component, and it can land mid-intro.
    // The session flag is set at START, so the re-init asked `shouldPlayIntro`, got false, and painted
    // the FINISHED terrain instantly over a half-risen surface — a snap, which Review Focus 3 said must
    // not happen. With `?intro=1` present it was worse: the flag no longer applied, so the intro
    // RESTARTED from the flat plane, a backwards collapse. Carrying the clock across the re-init makes
    // the animation resume where it was in both cases.
    expect(introStillRunning(1000, 2500, 3600)).toBe(true);
  });

  it('is false once the duration has elapsed', () => {
    expect(introStillRunning(1000, 4600, 3600)).toBe(false);
    expect(introStillRunning(1000, 1000 + 3600, 3600)).toBe(false);
  });

  it('is false for a clock that has gone backwards', () => {
    // performance.now() is monotonic per document, but a re-init reads a fresh document after a View
    // Transition swap. A negative elapsed must not read as "still running forever".
    expect(introStillRunning(5000, 1000, 3600)).toBe(false);
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
