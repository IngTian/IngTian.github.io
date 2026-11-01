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
/**
 * VERSIONED, so changing the gate is visible to someone who already opened the site this session.
 *
 * It was `'descent.gate.seen'`. During a run of design iterations that is actively misleading: the owner
 * reloads, the flag is already set, the gate does not raise, and the change appears not to have shipped. Bump
 * the suffix whenever the gate changes enough to want a second look.
 */
export const GATE_SEEN_KEY = 'descent.gate.seen.v2';

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

/**
 * ONE FRAME OF THE STROKE ANIMATION, as fractions — and the reason this is a tested function rather than three
 * lines inside the component's inline script.
 *
 * The owner approved this motion ("oh yeah perfect") and then reported one defect against it: *"there are lines
 * that vanish suddenly which is not good. entire lines go dark immediately."* The cause is a single interaction
 * between two of the three curves below, and it is the kind of thing a comment cannot hold:
 *
 *   - `drawnFrac` is a SAWTOOTH. It climbs 0.3 -> 1 and resets, so at the cycle boundary the drawn window
 *     collapses from the whole arc to a 30% fragment sitting at the curve's start — which is off-screen, since
 *     the viewBox shows only about a quarter of each curve.
 *   - the source's opacity envelope is [0.3, 0.6, 0.3], i.e. NONZERO at that boundary. So the collapse happens
 *     in full view and a line that spanned the frame is gone in the next frame.
 *
 * The fix is to take the envelope to zero exactly where the sawtooth breaks, so the discontinuity has nothing
 * visible to disrupt. `opacityAt` therefore shares the triangle with `offsetFrac`, which is already 0 at both
 * ends of the cycle. `tests/gate.test.ts` asserts that pairing directly — the envelope must vanish at the one t
 * where the drawn length is discontinuous — because the two are only correct TOGETHER and nothing else in the
 * codebase would notice if one of them were retuned alone.
 *
 * The component's inline script restates this arithmetic, for the same reason it restates the session policy
 * above: an inline script cannot import, and it has to run before first paint.
 *
 * Two alternatives were built and rejected, so they are not options: a faint full-length stroke under the dash
 * also removes the vanishing, but its uncovered stretch reads as *"the line leaves a trail behind"*; and
 * dropping the dash entirely leaves a static drawing.
 */
export const GATE_DRAWN_MIN = 0.3;
/**
 * The envelope's plateau value, and how much of the offset triangle it takes to reach it.
 *
 * 0.45 is chosen to MATCH the brightness of the build the owner approved, not to improve on it. That build used
 * `0.3 + 0.3 * tri` and opened at t ~= 0.16, which is 0.40; the source's own peak is 0.60. Landing between them
 * keeps this commit's only visible change the one that was asked for.
 *
 * GATE_OPACITY_RAMP is why the envelope PLATEAUS instead of peaking. A bare `PEAK * tri` is zero at the cycle
 * boundary — which is the fix — but it is also near zero for a long stretch either side of it, so the strokes
 * spend much of the cycle dimmer than the approved build. Worse, `tri` peaks at the one moment nothing is
 * painted at all (see the note on `offsetFrac`). Ramping over the first 0.3 of the triangle and holding gives
 * full brightness across almost the whole cycle while still passing through zero exactly where the drawn length
 * resets.
 */
export const GATE_OPACITY_PEAK = 0.45;
export const GATE_OPACITY_RAMP = 0.3;

/** The drawn length as a fraction of the arc: the source's `pathLength` 0.3 -> 1, linear, resetting each cycle. */
export function drawnFrac(t: number): number {
  return GATE_DRAWN_MIN + (1 - GATE_DRAWN_MIN) * t;
}

/**
 * The source's `pathOffset` [0, 1, 0] — a triangle, so it returns to its starting value and the dash's POSITION
 * is already continuous across the wrap. Only the length and the opacity were not.
 *
 * WORTH KNOWING, because it is counter-intuitive and it cost a wrong fix: the dash pattern here is
 * `dasharray = "drawn len"` with `dashoffset = -tri * len`, so a point p is painted when
 * `((p - tri*len) mod (drawn + len)) < drawn`. Evaluate that across the cycle and the painted fraction of each
 * arc runs 0.30 -> 0.48 (t ~= 0.25) -> **0.00 at t = 0.5** -> 1.00 at t -> 1. The triangle's peak is therefore
 * the one instant when the dash has slid entirely off the path and the stroke paints NOTHING. An opening phase
 * of 0.5 looks like an empty screen, which is exactly what it rendered as when tried.
 */
export function offsetFrac(t: number): number {
  return t < 0.5 ? t * 2 : (1 - t) * 2;
}

/**
 * The envelope: ramps from zero over the first `GATE_OPACITY_RAMP` of the triangle, then holds.
 *
 * Zero at t = 0 and t = 1 — the only property that matters for the defect — and flat for roughly the middle 85%
 * of the cycle, so the fix costs no brightness.
 */
export function opacityAt(t: number): number {
  return GATE_OPACITY_PEAK * Math.min(1, offsetFrac(t) / GATE_OPACITY_RAMP);
}

/**
 * Where in its cycle a stroke starts when the gate opens.
 *
 * 0.16 is not a round number by accident: it is where the approved build happened to sit (it used a flat 4s lead
 * against the then-20-30s durations), and at that phase 41% of each arc is painted as a band across the middle of the
 * curve — which is the part of it the viewBox actually shows. Both neighbours are worse: 0 paints only the first
 * 30%, which is off the top-left corner, and 0.5 paints nothing at all.
 *
 * It is a phase FRACTION rather than a millisecond lead because the durations differ per stroke, so a fixed lead
 * lands at a different point in every stroke's cycle.
 */
export const GATE_OPEN_PHASE = 0.16;

/**
 * HOW A STROKE'S WEIGHT AND COLOUR MOVE THROUGH ITS CYCLE.
 *
 * The owner's ask: *"when you move across the screen maybe let the thickness vary"* and *"can we add a little
 * bit color variation to the lines when it moves"*.
 *
 * Both are per-element and per-frame, which SVG can do — `stroke-width` and `stroke` are plain presentation
 * properties the driver already overwrites alongside the dash. What SVG CANNOT do is vary either ALONG one
 * stroke: a path has a single width and a single colour at any instant. Tapering a line from head to tail needs
 * per-pixel control, i.e. a canvas, and that was built and rejected (see the gate's rejection list). So the
 * variation is in TIME — a stroke thickens and cools as it crosses — which from the reader's side is much the
 * same impression, because what they are watching is whichever part of the curve is inside the frame.
 *
 * Both curves are continuous and PERIODIC: they return to their starting value at the cycle boundary, where
 * `drawnFrac` resets. Anything discontinuous there would reintroduce the pop the envelope exists to hide.
 */

/** Peak-to-trough weight swing, as a fraction of the stroke's own authored width. */
export const GATE_WIDTH_SWING = 0.35;

/**
 * Weight multiplier at cycle position `t`, for a stroke carrying its own `phase`.
 *
 * TWO cycles per traverse, not one: a single cycle across a whole traverse is too slow to read as variation in
 * the few seconds a gate is on screen. Worth knowing that this reasoning was stated here while the TRAVERSE it
 * rides on was still 20-30s, which made these curves 10-15s and the dash itself a tenth-of-a-journey per dwell.
 * The traverse is 6-9s now; the principle was right and the number it applied to was not. The per-stroke phase stops the family pulsing in unison, which would read as the
 * whole drawing breathing rather than as individual strokes having their own weight.
 */
export function widthAt(t: number, phase = 0): number {
  return 1 + GATE_WIDTH_SWING * Math.sin(2 * Math.PI * (2 * t + phase));
}

/**
 * WARM/COOL MIX at cycle position `t`, in [-1, 1]: negative leans cool, positive leans warm, zero is the base
 * ink. The caller owns which tokens those are — this decides only how far and in which direction.
 *
 * Why warm/cool rather than a hue rotation: the palette rule allows only the tokens in `tokens.css`, and in the
 * light theme the seal is the one saturated colour. Leaning a near-white stroke slightly toward ochre or indigo
 * keeps it near-white and stays inside the palette — and it is the same warm/cold broken colour `SkyWash`
 * already weaves over the sky, so the gate borrows the site's own idiom rather than introducing a new one.
 *
 * Offset from `widthAt` by a quarter cycle so weight and colour do not peak together; coinciding, they read as
 * one crude pulse instead of two independent properties.
 */
export function tintAt(t: number, phase = 0): number {
  return Math.sin(2 * Math.PI * (2 * t + phase + 0.25));
}
