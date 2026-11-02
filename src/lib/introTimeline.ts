// src/lib/introTimeline.ts
//
// THE HOMEPAGE INTRO'S SCHEDULE — "the map becomes the territory".
//
// On a first open of `/`, true isolines of the terrain field stroke themselves onto a flat plane; the
// surface then rises out of that map, carrying the lines up with it so they deform into the terrain they
// were describing; the dots resolve as the lines fade. It ends on exactly the frame the hero already
// paints at rest.
//
// Everything here is a pure function of normalised time, which is the only reason it can be tested: the
// drawing lives in TerrainHero's `<script>` and this project has no jsdom. The component's job is to call
// `introFrame(t)` and paint; every decision about WHEN anything happens is in this file.
//
// Design doc: docs/superpowers/specs/2026-11-01-intro-animation-design.md

// ── Duration ─────────────────────────────────────────────────────────────────────────────────────
//
// 5200ms, JUDGED ON THE REAL PAGE AT FULL VIEWPORT — the owner's verdict on this version was "just
// perfect". It arrived there in two steps, and both are worth keeping because they point opposite ways.
// 3600ms was chosen first, from 320px-tall prototypes in a browser panel, with a note that a full-bleed
// hero is a much larger object and large objects read as slower, so it might want to come DOWN toward
// 3000ms. Seen at full size the answer was the other direction: once the beats were separated (see
// Phases) each one needed room, and 1.44x the duration is what let the background, the lines, the relief
// and the dots each read as its own event. The mockup's instinct was backwards, which is the case for
// judging this on the page rather than in a panel.
//
// A duration this long is affordable for one specific reason: the hero text is NOT part of this
// animation. It keeps its own tuned 1.4s arrival and is untouched, so the intro adds zero milliseconds
// to the first thing a visitor came to read — and the H1 is this page's measured LCP element. A `?seq=1`
// spike that held the text until the landing was built and deleted for exactly that reason. If the text
// is ever folded in, this number must come down with it.
export const INTRO_DURATION_MS = 5200;

/** Clamp bounds for the URL override. Below the floor the animation is a flicker; above the ceiling the
 *  hero sits visibly flat for long enough to look broken. Both exist so a typo cannot do either. */
export const INTRO_DUR_MIN_MS = 400;
export const INTRO_DUR_MAX_MS = 20000;

// ── Phases ───────────────────────────────────────────────────────────────────────────────────────
//
// FRACTIONS OF THE TOTAL, NOT MILLISECONDS. Changing `INTRO_DURATION_MS` alone then rescales the whole
// animation coherently and the phases keep their relationships — which is what makes the owner's tuning
// pass one number instead of seven.
//
// FOUR BEATS, IN ORDER — ground, then lines, then relief, then substance.
//
// This replaced a structure where everything overlapped heavily. That was the right answer when the
// risk was a plateau (a strict sequence had read as three disconnected events, and an earlier schedule
// left a measured 620ms frozen frame), but the owner asked for the opposite once it was on the real
// page: "give it a clear phase to draw the background. then we draw the line, and so on." So the beats
// are now legible in sequence rather than fused into one gesture.
//
// Each handoff still OVERLAPS by a few hundredths, which is not a contradiction: distinct beats must
// not mean dead air between them. `tests/introTimeline.test.ts` enforces both ends of that — the
// no-plateau test fails if any 150ms window goes quiet, and the ordering tests fail if a beat starts
// before the one it should follow.
//
// EXPORTED FOR TWO READERS, neither of which is production code outside this file: whoever retunes the
// pace, and the spec that asserts the beats are still in order. `introFrame` below is the only consumer.
export const INTRO_PHASES = {
  /**
   * BEAT 1 — the ground. The sky resolves from one flat tone to its full gradient, ALONE: no line, no
   * dot, nothing else moving. This is the phase the owner asked to exist; previously the background's
   * resolve ran underneath everything else and so read as no beat at all.
   */
  skyEnd: 0.20,
  /** BEAT 2 — the survey. Lines begin as the ground settles, and get ~2x the time they had. */
  surveyStart: 0.17,
  /**
   * The contour map finishes drawing. Was 0.40 of 3600ms (1440ms); now 0.62 of 5200ms (3224ms), which
   * is the "lines animation is a little bit too fast" note — slightly over double.
   */
  surveyEnd: 0.62,
  /** BEAT 3 — the relief. The surface rises out of the map, carrying the lines with it. */
  liftStart: 0.52,
  /** Full elevation. */
  liftEnd: 0.90,
  /** BEAT 4 — the substance. Dots resolve as the lines hand over. */
  dotsStart: 0.62,
  /** Full dot opacity. */
  dotsEnd: 0.96,
  /** The isolines begin to leave, once the relief they describe is mostly up. */
  fadeStart: 0.74,
  /** The isolines are gone — before t=1, so the last frame is clean. */
  fadeEnd: 0.97,
} as const;

/**
 * How far apart consecutive contour levels start, as a fraction of the survey phase.
 *
 * The map draws as a sequence of passes rather than nine lines appearing together, which is what reads
 * as "surveyed". With nine levels at 0.05 the last one starts at 0.40 of the phase and gets the
 * remaining 0.60 to finish, so every level lands exactly at `surveyEnd` — see `surveyProgress`.
 *
 * THIS USED TO BE THREE INLINE LITERALS IN TerrainHero'S DRAW CALL (0.05, 0.45 and a 1.6 alpha ramp),
 * which broke two project rules at once and shipped a visible bug. It put phase boundaries somewhere
 * the spec's tunability requirement forbids ("no phase boundary is an inline literal buried in a draw
 * call") and somewhere no test could reach — so when the schedule made the survey finish at t≈0.19
 * instead of 0.40, leaving a ~620ms frozen frame before the lift became perceptible, this module's own
 * `survey` channel went on rising innocently and the suite saw nothing. The no-plateau test now
 * measures what is actually drawn.
 */
export const INTRO_SURVEY_STAGGER = 0.05;

/** The four channels the painter needs for one frame. */
export interface IntroFrame {
  /** 0..1 — how much of each isoline is stroked. */
  survey: number;
  /** 0..1 — elevation scale. 0 = a flat plane, 1 = the hero's terrain. */
  lift: number;
  /** 0..1 — dot alpha multiplier. */
  dots: number;
  /** 0..1 — isoline alpha. */
  contourAlpha: number;
  /** 1..0 — how flat the SKY still is. Beat 1: 1 at t=0, 0 once the ground has resolved. */
  sky: number;
}

const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

/** Normalise t into a phase's own 0..1, clamped. */
const phase = (t: number, from: number, to: number): number => clamp01((t - from) / (to - from));

/** Smootherstep: zero velocity at BOTH ends. What makes the landing invisible rather than a stop. */
const smoother = (t: number): number => {
  const u = clamp01(t);
  return u * u * u * (u * (6 * u - 15) + 10);
};

/** Out-quad: fast start, gently eased finish — a pen drawing a line, not a surface settling. */
const outQuad = (t: number): number => {
  const u = clamp01(t);
  return 1 - (1 - u) ** 2;
};

/**
 * The whole animation, as a pure function of normalised time.
 *
 * **At t=1 this returns exactly the hero's resting state** — `lift: 1, dots: 1, contourAlpha: 0` — and
 * that is load-bearing, not incidental. `TerrainHero` paints the intro and then falls through to its
 * live loop, which ramps breath up from the static frame over `BREATH_IN_MS`. That ramp is only the
 * right continuation if the intro finished where the static frame is. Getting an analogous handoff
 * wrong has already shipped a ±8.8px jump in this component once.
 */
export function introFrame(t: number): IntroFrame {
  const u = clamp01(t);
  return {
    // LINEAR phase progress, not eased. The easing belongs to `surveyProgress`, applied per level —
    // easing here and clamping again there is what produced the plateau.
    survey: phase(u, INTRO_PHASES.surveyStart, INTRO_PHASES.surveyEnd),
    // The ground's own beat: 1 = fully flat, 0 = the sky's real gradient. FluidSky multiplies its
    // flatten by this, so the background finishes resolving before the survey is really underway.
    sky: 1 - smoother(phase(u, 0, INTRO_PHASES.skyEnd)),
    lift: smoother(phase(u, INTRO_PHASES.liftStart, INTRO_PHASES.liftEnd)),
    dots: smoother(phase(u, INTRO_PHASES.dotsStart, INTRO_PHASES.dotsEnd)),
    // smootherstep, not out-cubic. Out-cubic's maximum velocity is exactly AT the join, so the lines
    // went from perfectly steady to shedding opacity fast in a single frame — a derivative
    // discontinuity, invisible to a step test and inconsistent with the zero-velocity-at-both-ends
    // reasoning that governs `lift` and `dots`.
    contourAlpha: 1 - smoother(phase(u, INTRO_PHASES.fadeStart, INTRO_PHASES.fadeEnd)),
  };
}

/**
 * How much of one contour level is stroked, given the frame's linear `survey` progress.
 *
 * Levels start `INTRO_SURVEY_STAGGER` apart and each gets whatever is left, so the LAST level finishes
 * exactly at `surveyEnd` and `surveyEnd` means what its name says. The easing is applied here, per
 * level, to that level's own window — not to the phase as a whole before this clamp, which is the
 * mistake that made the whole map finish in the first fifth of its phase.
 */
export function surveyProgress(survey: number, levelIndex: number, levelCount: number): number {
  const start = levelCount > 1 ? levelIndex * INTRO_SURVEY_STAGGER : 0;
  const width = 1 - (levelCount > 1 ? (levelCount - 1) * INTRO_SURVEY_STAGGER : 0);
  if (width <= 0) return clamp01(survey) >= 1 ? 1 : 0;   // degenerate stagger; fail visible, not NaN
  // outQuad, not outCubic. A pen finishing a stroke may decelerate, but out-cubic's tail is flat
  // enough that combined with the lift's smootherstep toe it produced a dead patch between the two
  // phases. Quadratic keeps the line moving into its own finish.
  return outQuad((clamp01(survey) - start) / width);
}

// THREE EXPORTS USED TO LIVE HERE — `introStillRunning`, `introDurationFrom`, `shouldPlayIntro` — and
// their deletion is worth recording, because the suite was quietly lying about them.
//
// The intro's decision moved into an `is:inline` script at the top of index.astro, which must run before
// first paint and therefore cannot `import`. So it re-implements the parse and the clamp in raw JS, and
// these three stopped having any production caller: a grep over comment-stripped `src` found one hit
// each, their own declaration. Their 97 lines of tests went on passing, so the suite looked like it
// covered the intro decision while the code that actually runs it was untested.
//
// Keeping them "for the tests" would have been the worse trade — a parallel implementation kept alive to
// host assertions about behaviour it no longer provides. The clamp is instead asserted where it ships:
// `tests/distSmoke.test.ts` reads the built index.html. If the decision ever moves back into a module,
// bring them back with it.
