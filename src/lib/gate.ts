// src/lib/gate.ts
//
// THE GATE'S POLICY, separated from its plumbing for one reason: every way a full-screen gate can break a
// website is a decision, and decisions can be unit-tested while DOM wiring cannot. This repo has no jsdom —
// distSmoke reads built HTML with regexes, and driving a browser is off the table — so anything that matters
// has to be expressible as a pure function. Three things matter here, and all three end with a visitor
// locked out of the site if they are wrong.
//
//   1. Storage can throw. Private mode and disabled storage both raise on access.
//   2. Reduced motion means no transition, so `transitionend` never fires.
//   3. Dismissal can be triggered twice (Escape, then the button).
//
// Gate.astro restates this logic inline rather than importing it, because a module script cannot run before
// first paint and the gate's no-flash behaviour depends on running early. The constants below are injected
// into that script via `define:vars` so the two cannot drift on the values; these tests are what pin the
// semantics. Change the rule here first.

/** The session flag. Namespaced so it cannot collide with the theme key BaseLayout's resolver reads. */
export const GATE_SEEN_KEY = 'descent.gate.seen';

/** Must match the CSS dismissal duration in Gate.astro. */
export const GATE_DISMISS_MS = 600;

/**
 * Set on `<html>` while the gate covers the page, and the event fired when it stops.
 *
 * These exist because of a measured waste, not a theory. While the gate is up, two full-screen workloads run
 * behind an opaque layer and paint nothing a visitor can see:
 *
 *   • TerrainHero's 2D canvas loop at ~30fps — its IntersectionObserver reports the hero as VISIBLE, because
 *     the gate is a sibling `position: fixed` element rather than an ancestor, so occlusion is invisible to it.
 *   • FluidSky's full-viewport WebGL shader — it pauses on `visibilitychange` (the tab being hidden) and has
 *     no notion of being covered.
 *
 * And this is a CLICK gate, so the waste is unbounded: a visitor who reads the title card for ten seconds
 * buys ten seconds of invisible WebGL on top of a paint-bound 36-stroke draw-in.
 *
 * DEFERRING IS SAFE, which the spec doubted — it worried about "a cold hero at the reveal". TerrainHero paints
 * its static frame unconditionally at `frame(0, false)` BEFORE the loop block, so a paused hero is not cold,
 * it is the finished static frame — exactly what the site already ships under reduced motion. Only the motion
 * waits.
 *
 * The attribute goes on `<html>` rather than `<body>` because `ClientRouter` replaces `<body>` on a View
 * Transition, and Astro's `swapRootAttributes` strips root attributes on swap — so a stale flag cannot
 * survive a navigation and leave the hero frozen.
 */
export const GATE_UP_ATTR = 'data-gate-up';
export const GATE_REVEAL_EVENT = 'descent:revealed';

/**
 * Is the page currently covered by the gate?
 *
 * FAILS OPEN — the opposite asymmetry to `hasSeenGate`. There, an unknown state must not raise a gate, because
 * the cost is a lockout. Here, "covered" SUPPRESSES motion, so an unknown state must read as clear: every
 * route except `/` has no gate at all, and a wrong answer would freeze their hero permanently. Asked rather
 * than re-derived, the same way `prefersReducedMotion()` and `isPhone()` are.
 */
export function isCovered(root: { hasAttribute(n: string): boolean } | null | undefined): boolean {
  return !!root && root.hasAttribute(GATE_UP_ATTR);
}

/** The slice of Storage this module needs. Narrow on purpose, so a test can hand it a hostile fake. */
export interface GateStore {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

/**
 * Has this session already seen the gate?
 *
 * FAILS CLOSED: a broken or absent store reports TRUE — "already seen" — so every caller takes the branch
 * that does not raise a gate. The asymmetry is deliberate. Not raising costs one animation nobody sees;
 * raising a gate whose dismissal cannot be remembered, or throwing partway through raising it, costs the
 * visitor the site.
 */
export function hasSeenGate(store: GateStore | null): boolean {
  if (!store) return true;
  try {
    return store.getItem(GATE_SEEN_KEY) !== null;
  } catch {
    return true;
  }
}

/** Record the dismissal. Never throws: this runs DURING dismissal, and a throw would strand the gate up. */
export function markGateSeen(store: GateStore | null): void {
  if (!store) return;
  try {
    store.setItem(GATE_SEEN_KEY, '1');
  } catch {
    /* storage denied — the gate still dismisses, it just reappears on the next fresh load */
  }
}

/**
 * Is this a real page load, as opposed to ClientRouter re-executing the script after a swap?
 *
 * An inline script runs DURING parse on a genuine load, so `document.readyState` is 'loading'. When
 * Astro's router re-runs it after a View Transition the document is already 'complete'. That one
 * difference is the whole discriminator, and it needs no flag on `window`.
 */
export function isFreshLoad(readyState: string): boolean {
  return readyState === 'loading';
}

/**
 * Raise the gate?
 *
 * BOTH TERMS ARE LOAD-BEARING, and the second one was missing at first — the gate shipped able to appear
 * mid-session. The gate's inline script exists only in the homepage's HTML, so Astro's ClientRouter does not
 * find it in `scriptsAlreadyRan` for a visitor whose entry page was something else, and EXECUTES it on the
 * navigation into `/`. A reader arriving on /research from a search result and clicking "home" got a
 * full-screen interstitial over a page they were already going to, concurrently with the veil.
 *
 * BaseLayout's veil script has guarded the same hazard since it was written (`__descentVeilInit`, commented
 * "first load only"), which is the precedent: an inline script in this codebase must assume it will be
 * re-executed. Expressed here rather than only in the script so it is the tested rule and not a trick.
 */
export function shouldRaiseGate(store: GateStore | null, freshLoad: boolean): boolean {
  return freshLoad && !hasSeenGate(store);
}

/**
 * How long dismissal takes before the scroll lock and `inert` come off.
 *
 * A TIMER, NOT `transitionend`. Under reduced motion the CSS has no transition, so a transitionend listener
 * would never fire and the page would stay scroll-locked and inert forever — the worst available bug, since
 * the visitor cannot even scroll to see that something went wrong. Zero under reduced motion also gives that
 * reader the finished state the motion rule requires, immediately.
 */
export function dismissMs(reducedMotion: boolean): number {
  return reducedMotion ? 0 : GATE_DISMISS_MS;
}
