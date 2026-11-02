// src/lib/introSession.ts
//
// THE PER-PAGE INTRO CLOCK — read once here, shared by every surface that participates.
//
// THIS MODULE DOES NOT DECIDE ANYTHING. The decision (has it been seen, reduced motion, the `?dur=`
// clamp) lives in the `is:inline` script at the top of src/pages/index.astro, which parses before first
// paint — the only place that can set the flat backdrop without a frame of the finished sky showing
// first. This reads what that script published on `<html>`, so there is exactly one decider and the two
// cannot disagree. On every other route, on a repeat visit, and under reduced motion the attributes are
// simply absent and everything here returns null, which is what makes each participating surface inert.
//
// It is still a module rather than per-component code because the ANSWER has to be shared and identical:
// TerrainHero and FluidSky both import it, Vite gives them one instance, and module evaluation happens
// before either init body runs. An earlier version had each component read the DOM itself, and that
// raced — FluidSky draws synchronously during its own init, so when it initialised first it rendered the
// finished sky and then snapped flat. The owner's report was exact: *"the background renders to our
// normal stuff and suddenly goes blank and then goes your animation."*
//
// It touches the DOM despite living in lib/, which is a deliberate exception to this project's
// pure-logic-in-lib rule: being shared is the entire point, and a component cannot import a component.
// The pure part — what each channel does at time t — is lib/introTimeline.ts, and that is what is tested.

/**
 * The session flag, read and written by index.astro's inline decider. Versioned: bump the suffix when the
 * animation changes enough to want a second look mid-session, or a reload during a design pass shows
 * nothing and the change looks unshipped.
 */
export const INTRO_SEEN_KEY = 'descent.intro.seen.v1';

export interface IntroSession {
  /** `performance.now()` at the moment the intro was decided — its t=0. */
  at: number;
  /** Total duration in ms, after the `?dur=` override and its clamp. */
  ms: number;
}

/** `undefined` = not yet read; `null` = read, no intro running. */
let session: IntroSession | null | undefined;

/**
 * The intro's clock, or `null` when no intro is running on this page view.
 *
 * Safe to call from anywhere, on any route, as many times as you like — it reads once and then returns
 * the same object.
 */
export function introSession(): IntroSession | null {
  if (session !== undefined) return session;
  const root = typeof document === 'undefined' ? null : document.documentElement;
  const at = Number(root?.dataset.introAt);
  const ms = Number(root?.dataset.introMs);
  session = Number.isFinite(at) && Number.isFinite(ms) && ms > 0 ? { at, ms } : null;
  return session;
}

/** Progress through the intro at `now`, or `null` when none is running or it has finished. */
export function introProgress(now: number): number | null {
  const s = introSession();
  if (!s) return null;
  const t = (now - s.at) / s.ms;
  return t >= 0 && t < 1 ? t : null;
}

/**
 * Mark the intro finished early — an unseen intro is consumed, not deferred.
 *
 * TerrainHero calls this when the hero is scrolled out of view before the intro has run. Keeping it
 * pending would play a 5.2s construction animation on a scroll-back minutes later, in front of someone
 * already reading, which is not an intro. Every other surface goes inert on the same call.
 */
export function endIntroSession(): void {
  session = null;
}
