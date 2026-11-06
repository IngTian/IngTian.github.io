// src/lib/introSession.ts
//
// THE PER-PAGE INTRO CLOCK — read once here, shared by every surface that participates.
//
// THIS MODULE DOES NOT DECIDE ANYTHING. The decision lives in the `is:inline` script at the top of
// src/pages/index.astro, which runs before first paint; this reads what it published on `<html>`, so there
// is one decider. On every other route, on a repeat visit and under reduced motion the attributes are
// absent and everything here returns null, which makes each participating surface inert.
//
// A module, so the answer is shared: TerrainHero and FluidSky both import it, and module evaluation runs
// before either init body (FluidSky draws during its own init, so per-component DOM reads raced). It
// touches the DOM despite living in lib/, as being shared is its point; the pure part is lib/introTimeline.ts.

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
 * Mark the intro finished early: an unseen intro is consumed, not deferred (the why is at TerrainHero's
 * IntersectionObserver, its caller). Every other surface goes inert on the same call.
 */
export function endIntroSession(): void {
  session = null;
}
