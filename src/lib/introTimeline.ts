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
// 3600ms is the pace the owner judged, having watched three candidates at a range of speeds and asked
// for the slower end. EXPECT TO RETUNE IT: the prototypes were 320px tall in a browser panel, and a
// full-bleed hero is a much larger object — large objects read as slower at the same duration — so this
// may want to come down toward 3000ms once it is seen on the real page at full viewport.
//
// A long duration is affordable here for one specific reason: the hero text is NOT part of this
// animation. It keeps its own tuned 1.4s arrival and is untouched, so the intro adds zero milliseconds
// to the first thing a visitor came to read. If that ever changes, this number must come down with it.
export const INTRO_DURATION_MS = 3600;

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
// THE PHASES DELIBERATELY OVERLAP. A strict sequence — survey, stop, lift, stop, resolve — read as three
// separate events when prototyped rather than as one gesture. `liftStart` sits before `surveyEnd` and
// `dotsStart` before `liftEnd` on purpose, and a test asserts both so a future tidy-up cannot
// accidentally serialise them.
export const INTRO_PHASES = {
  /** The contour map finishes drawing. */
  surveyEnd: 0.40,
  /**
   * The surface begins to rise out of the map — WELL before the survey finishes, which is the point.
   *
   * This was 0.36, giving a 0.04 overlap, and that was too little: the survey's eased-out tail and the
   * lift's eased-in toe were both at their flattest in the same window, so the animation came to a
   * near-stop around t=0.33. Measured, the quietest 150ms window moved **0.00005** — a frozen frame for
   * a fifth of the animation. 0.28 puts the lift's toe against a part of the survey that is still
   * moving, and the quietest window becomes 0.017.
   */
  liftStart: 0.28,
  /** Full elevation. */
  liftEnd: 0.88,
  /** The dots begin to resolve. */
  dotsStart: 0.44,
  /** Full dot opacity. */
  dotsEnd: 0.94,
  /** The isolines begin to leave. */
  fadeStart: 0.62,
  /** The isolines are gone — before t=1, so the last frame is clean. */
  fadeEnd: 0.96,
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
    survey: phase(u, 0, INTRO_PHASES.surveyEnd),
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

/**
 * Is an intro that began at `startedAt` still in flight?
 *
 * `TerrainHero` re-inits on `theme:change`, which can land mid-animation. Without this the re-init
 * asked `shouldPlayIntro`, found the flag already set (it is set at START), and painted the FINISHED
 * terrain instantly over a half-risen surface — a snap. With `?intro=1` present it was worse: the flag
 * no longer applied, so the intro restarted from the flat plane, a backwards collapse into the spec's
 * own "second discontinuity" anti-goal, during the owner's tuning loop. Carrying the clock across the
 * re-init resumes the animation instead, in both cases.
 *
 * A negative elapsed reads as NOT running: `performance.now()` is monotonic per document, but a re-init
 * after a View Transition swap reads a fresh one, and a backwards clock must not mean "running forever".
 */
export function introStillRunning(
  startedAt: number | null,
  now: number,
  durationMs: number,
): boolean {
  if (startedAt === null) return false;
  const elapsed = now - startedAt;
  return elapsed >= 0 && elapsed < durationMs;
}

/**
 * Read a duration override out of a query string, for tuning on the real page.
 *
 * Hostile input is the point of this function, not an afterthought. `t = elapsed / dur` with a `dur` of
 * 0 is `Infinity` and with `NaN` is `NaN`; either propagates through `lift` into every dot's elevation
 * and paints a blank canvas. So anything unparseable falls back to the shipped default, and anything
 * parseable is clamped. There is no input for which this returns a value the animation cannot use.
 */
export function introDurationFrom(search: string): number {
  let raw: string | null = null;
  try {
    raw = new URLSearchParams(search).get('dur');
  } catch {
    return INTRO_DURATION_MS;
  }
  if (raw === null || raw.trim() === '') return INTRO_DURATION_MS;
  // Number() rather than parseFloat(): parseFloat('1,2') is 1 and parseFloat('0x10') is 0, both of which
  // silently accept nonsense. Number() rejects them outright, which is the behaviour wanted here.
  const n = Number(raw);
  if (!Number.isFinite(n)) return INTRO_DURATION_MS;
  return Math.min(INTRO_DUR_MAX_MS, Math.max(INTRO_DUR_MIN_MS, n));
}

/** The storage seam, so the decision below is testable without a DOM. */
export interface IntroFlagStore { get(): string | null }

/**
 * Should the intro play?
 *
 * Two things make this a function rather than two lines in the component.
 *
 * **Storage can throw.** Private mode and disabled storage raise on *access*, not merely on write. A
 * throw here must mean "play the intro" — the alternative is an exception during hero init and a blank
 * first screen for every Safari private-browsing visitor. Tested explicitly.
 *
 * **`?intro=1` must win over the flag.** Without that override, iterating on the timing means clearing
 * sessionStorage or opening a fresh tab on every single reload, which is exactly the friction that led
 * the retired gate to invent a versioned storage key to paper over.
 */
export function shouldPlayIntro(store: IntroFlagStore, search: string): boolean {
  try {
    if (new URLSearchParams(search).get('intro') === '1') return true;
  } catch {
    // a malformed query string is not a reason to skip the intro; fall through to the flag
  }
  try {
    return store.get() === null;
  } catch {
    return true;
  }
}
