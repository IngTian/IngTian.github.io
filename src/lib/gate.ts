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
export const GATE_SEEN_KEY = 'descent.gate.seen.v3';

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
 * THE ENTRANCE — a fluid terrain field that settles into the hero.
 *
 * Every curve below exists to answer one question: at the landing frame, is the overlay painting EXACTLY the
 * picture the hero's next frame will paint? If any axis misses, the handover is a visible jump of the whole
 * field, because `zoom` is simultaneously position and dot radius and `breathAmp` displaces every dot by up
 * to ±8.8 CSS px at the hero's measured box.
 *
 * WHY THE FIELD AND NOT A DRAWING. Two previous designs lost here. A ported line field was approved on sight
 * and then rejected as "a little bit dull" after ten rounds of tuning, because it was a borrowed picture
 * cross-fading into an unrelated hero — no dial inside it could fix that. The replacement cross-faded less but
 * still staged a name flying across the screen, and the verdict was "that's horrible". The owner's own brief is
 * the design: *"a fluid field moving using the terrain we have. and then this terrain transforms into the
 * terrain location we have then seamlessly into the hero. the name and other stuff just fades in."*
 *
 * So there is no drawing and no text on this screen at all — the overlay paints the hero's own
 * Gaussian-mixture field through the same renderer, and the hero's OWN name fades in underneath. That is what
 * removes the whole class of defects the previous attempt generated: no stand-in copy, no FLIP, no
 * ivory-to-ink colour crossover, no two-names-on-screen.
 */
export const ENTRANCE_MS = 2600;

/**
 * Eased progress, 0..1. Ease-OUT with a zero landing derivative, which both of the obvious curves lack.
 *
 * The derivative matters as much as the value: every axis below is `open + (hero - open) * progress`, so
 * `progress'(1) = 0` is what makes each one *arrive* rather than still be moving when the overlay is removed.
 * A linear ramp lands at full speed and the handover reads as a cut.
 */
export function entranceProgress(ms: number, total = ENTRANCE_MS): number {
  const t = Math.min(1, Math.max(0, ms / total));
  return 1 - Math.pow(1 - t, 3);
}

/**
 * HOW FAR BACK THE CAMERA STARTS, as a multiple of the hero's zoom.
 *
 * Below 1 is pulled back — more of the field in frame, the surface further away — so the intro descends
 * toward the hero's camera, which is the site's own motif rather than a generic zoom. The camera is a single
 * uniform scale about a fixed centre (`project` in lib/terrain.ts has no pan and no rotate), so there is
 * nothing to look at further out than about 0.5: the field just becomes a small object in a large empty
 * screen, which reads as a logo.
 */
export const ENTRANCE_ZOOM_FROM = 0.70;

/**
 * THE BREATH STARTS AS A SWELL AND CALMS TO THE HERO'S BREATH.
 *
 * `breathAmp` is the single biggest "is it alive" dial: the hero's 0.04 is ±8.8 CSS px of per-dot
 * displacement, and the parameter survey's note is that 0.1+ reads as a swell rather than a breath. 0.30 is a
 * deep heave; it lands on exactly `BREATH_AMP_LIVE`.
 */
export const ENTRANCE_BREATH_FROM = 0.16;

/**
 * HOW MANY WHOLE BREATH PERIODS OF EXTRA PHASE THE INTRO BURNS THROUGH — and why it must be a whole number.
 *
 * This is the one piece of arithmetic in the entrance that is not obvious, and it is what makes the field
 * read as FLOWING rather than merely drifting.
 *
 * The breath is `sin(tsec * BREATH_OMEGA + x*0.7 + y*0.6)` with omega = 0.4 **radians per second** — so the
 * period is 15.71s, not the 2.5s the old `breathHz` name suggested. Over a 2.6s intro the field would advance
 * through 17% of one cycle: the dots would slide one way and stop. Not fluid, just drifting.
 *
 * So the intro runs the clock fast and lets it decelerate. But `tsec` must ALSO equal the hero's own
 * `rAF timestamp / 1000` at the landing frame, or every dot is displaced differently than the hero's next
 * frame. Those two requirements are only compatible if the extra phase is a WHOLE number of breath periods,
 * because `sin` is periodic: burn exactly one period and the phase you land on is the phase you would have
 * had without the detour.
 *
 * The spatial term spans about 2π across the painted footprint, so one temporal period also walks the wave
 * one full wavelength across the field — a swell that crosses the landscape once and settles.
 */
export const ENTRANCE_BREATH_CYCLES = 1;

/**
 * The extra breath phase still owed at progress `p`, in seconds, as a quantity to SUBTRACT from the clock.
 *
 * `(1-p)^2` rather than `(1-p)`: both land at zero, but the squared form also has zero derivative there, so
 * the clock's rate returns smoothly to 1x instead of stepping down from ~7x at the final frame.
 *
 * Subtracted, not added, so the clock runs FAST FORWARD and decelerates. Adding it would make the intro's
 * clock run slower than real time — and with an offset this large, backwards.
 */
export function breathPhaseOffset(p: number, periodS: number): number {
  const q = Math.min(1, Math.max(0, p));
  return ENTRANCE_BREATH_CYCLES * periodS * (1 - q) * (1 - q);
}

/**
 * HOW FAR THE SUN SWINGS, in radians, before it lands on the hero's azimuth.
 *
 * `ndl` is recomputed every frame from the grid's stored normals, so the sun is free to move — it is the
 * cheapest flow available, and unlike the breath it has no periodicity to respect: it just has to arrive.
 * A swing of this size slides the warm/cool terminator across the relief, which is light travelling over the
 * landscape rather than the landscape moving.
 */
export const ENTRANCE_AZ_SWING = -1.15;

/**
 * THE SILHOUETTE RESOLVES, rather than being there from the first frame.
 *
 * `edlSizeRange` is the dot-area spread (lit dots grow, shadowed shrink) and `elevEmphasis` makes the ridge
 * carry the form while the valley recedes. Opening both low and raising them to the hero's values means the
 * field arrives as a flattish scatter and *acquires* its relief — the shape emerges out of the fluid.
 *
 * Both land on `TERRAIN_CONFIG_DEFAULTS`' values (0.75 / 0.20), which is what the hero paints.
 */
export const ENTRANCE_EDL_SIZE_FROM = 0.34;
export const ENTRANCE_ELEV_EMPHASIS_FROM = 0.07;

/**
 * The event the two scripts hand the landing over with.
 *
 * It is the ONLY channel between them and it has to be, because they cannot share a module: the policy script
 * is `is:inline` (it must run before first paint) and the painter is bundled (it must import the renderer).
 * The painter fires it when its clock reaches the end; the policy script fires it when a gesture or the
 * backstop timer lands early, so the painter can snap to the hero's frame and stop rather than keep tweening
 * under a dismissed overlay.
 *
 * Distinct from `GATE_REVEAL_EVENT`, which is the hero's cue to resume painting. Ordering between the two is
 * load-bearing — see Gate.astro's `land()`.
 */
export const GATE_LAND_EVENT = 'descent:gate-land';
