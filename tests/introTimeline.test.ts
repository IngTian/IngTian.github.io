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
  INTRO_DURATION_MS, INTRO_PHASES, INTRO_SURVEY_STAGGER, introFrame, surveyProgress,
} from '../src/lib/introTimeline';
// The clamp bounds are NOT asserted here any more. They are enforced by the `is:inline` decider in
// index.astro, which cannot import, so `tests/distSmoke.test.ts` checks them against the built HTML
// instead — see the note at the bottom of lib/introTimeline.ts.

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
    // Sampled at 1/400 of the animation. At 5200ms that is a 13ms slice, so a step here is a step a
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
        // The SKY counts. Beat 1 is the background resolving on its own — no line, no dot — so
        // omitting it made this test report dead air through the one phase that is only background.
        Math.abs(b.sky - a.sky),
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

  it('runs its four beats in order — ground, lines, relief, substance', () => {
    // The structure the owner asked for: "give it a clear phase to draw the background. then we draw
    // the line, and so on." Each beat must START after the previous one started, and the background
    // must be essentially DONE before the survey is really underway, or beat 1 is not a beat.
    expect(INTRO_PHASES.skyEnd).toBeLessThan(INTRO_PHASES.surveyEnd);
    expect(INTRO_PHASES.surveyStart).toBeLessThan(INTRO_PHASES.liftStart);
    expect(INTRO_PHASES.liftStart).toBeLessThan(INTRO_PHASES.dotsStart);
    expect(INTRO_PHASES.dotsStart).toBeLessThan(INTRO_PHASES.fadeStart);
    // the ground has resolved by the time the map is a quarter drawn
    expect(introFrame(INTRO_PHASES.skyEnd).sky).toBeCloseTo(0, 6);
    expect(drawn(INTRO_PHASES.skyEnd)).toBeLessThan(0.35);
  });

  it('never un-resolves the sky — `sky` is monotonically non-increasing', () => {
    // THE SKY MAY ONLY RESOLVE, NEVER FLATTEN AGAIN, and this is pinned because a headless capture
    // appeared to show otherwise: a recording of `--intro-flatten` read 1 -> 0.000 -> **1.000** -> 0.000
    // across two frames 5ms apart near t=0.97, and the hero's legibility halos flashed out with it.
    //
    // It was an instrument artifact, and the shape of the artifact is worth knowing. A CDP target created
    // with `Target.createTarget` and never brought to front has `document.hidden === true`, and FluidSky's
    // `start()` bails on exactly that — so the sky's rAF loop never ran and the only draws were the
    // init/settle/MutationObserver ones, forced out of order by `Page.captureScreenshot`. With a running
    // loop `nowMs` is monotonic, so `sky` is too.
    //
    // This assertion is the honest version of that check: it tests the property the browser trace was
    // trying to observe, in-process, where no composite can lie about it. If a future change makes the
    // sky's channel depend on anything other than elapsed time, this is what goes red.
    let prev = Infinity;
    for (let i = 0; i <= 2000; i++) {
      const s = introFrame(i / 2000).sky;
      expect(s).toBeLessThanOrEqual(prev + 1e-12);
      prev = s;
    }
    expect(introFrame(0).sky).toBeCloseTo(1, 6);
    expect(introFrame(1).sky).toBeCloseTo(0, 6);
  });

  it('gives the survey substantially more time than it used to have', () => {
    // "the lines animation is a little bit too fast." Was 0.40 of 3600ms = 1440ms; now 0.45 of 5200ms
    // = 2340ms, i.e. 1.63x — which is what "a little bit" asks for, not the "roughly twice" an earlier
    // version of this assertion claimed before measuring it. Threshold set from the real value with
    // headroom, so retuning the pace does not redden this unless the lines get FASTER than they were.
    const span = (INTRO_PHASES.surveyEnd - INTRO_PHASES.surveyStart) * INTRO_DURATION_MS;
    expect(span).toBeGreaterThan(2000);
  });

  it('overlaps its beat HANDOFFS, so distinct does not mean dead air', () => {
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

