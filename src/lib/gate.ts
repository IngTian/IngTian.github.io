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
 * The waste is BOUNDED now and was not always. This was a click gate, so a visitor who read the title card for
 * ten seconds bought ten seconds of invisible WebGL; the entrance ends on its own at ENTRANCE_MS. The deferral
 * is still worth keeping — the entrance paints a terrain of its own, and running the hero's identical loop
 * underneath it doubles the only expensive thing on the screen.
 *
 * THE ATTRIBUTE HAS A SECOND JOB, which is why it is also read by CSS: `html[data-gate-up]` hides the hero's
 * own name while the entrance's stand-in copy is flying to it (see Heights.astro). Both jobs want exactly the
 * same lifetime — "the overlay is on screen" — so they share one flag rather than racing two.
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
 * Fired when the entrance's camera reaches the hero's, by whichever of the two scripts gets there first.
 *
 * It is the ONLY channel between them, and it has to be, because they cannot share a module: the policy script
 * is `is:inline` (it must run before first paint) and the painter is bundled (it must import the renderer). So
 * the painter dispatches this at the landing frame and the policy script dismisses; and the policy script
 * dispatches it when a gesture or the backstop timer lands early, so the painter can snap its camera to the
 * hero's and stop rather than keep tweening under a dismissed overlay.
 *
 * Exported rather than written twice. It was the literal string `'descent:gate-land'` in both scripts for one
 * build — a typo in either would have silently broken the handshake in the direction that leaves an overlay on
 * screen, and no test would have caught it because each half would still have been internally consistent.
 */
export const GATE_LAND_EVENT = 'descent:gate-land';

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
 * How long the whole entrance lasts, in ms, from the gate being raised to the overlay being gone.
 *
 * THE BUDGET IS THE DESIGN. An automatic overlay a reader cannot dismiss is a toll booth, and the research is
 * unambiguous that the failure mode is "looks broken, closed the tab" rather than "too short". Studio intros
 * that land run 2-3.5s; this sits at the bottom of that band because the audience here is a technical reader
 * following a link, not someone browsing a showreel.
 *
 * It is also why there is no progress indicator: a counter is the right device when the wait is REAL and of
 * unknown length (assets loading). This wait is a fixed 2.1s of choreography on a static page — a percentage
 * would be theatre, and the surveyed sites that ship fake counters say so themselves.
 */
export const ENTRANCE_MS = 2100;

/** When the name starts travelling to its hero position, and how long it takes. */
export const NAME_TRAVEL_START_MS = 1150;
export const NAME_TRAVEL_MS = 800;

/**
 * Where the camera starts, as a multiple of the hero's own zoom.
 *
 * Below 1 means pulled BACK — more of the loss field in frame, the surface further away — so the entrance is a
 * descent toward the hero's camera. That is the site's own motif rather than a generic zoom: "The Descent" made
 * literal, arriving at exactly the frame the hero holds.
 *
 * 0.5 is as far as this can usefully go. The camera is a single uniform scale about a fixed centre (see
 * `project` in lib/terrain.ts — there is no pan and no rotate), so pulling back further just makes the field a
 * small object in the middle of a large empty screen, which reads as a logo rather than as terrain.
 */
export const ENTRANCE_ZOOM_FROM = 0.62;

/**
 * Eased progress of the entrance at time `ms`, in [0, 1].
 *
 * Ease-OUT, deliberately: the camera should cover most of its distance early and settle, which reads as
 * arriving. An ease-in-out would make the first third look like nothing is happening, which is the exact
 * impression ("still seems a little bit dull") this entrance exists to replace.
 */
export function entranceProgress(ms: number, total = ENTRANCE_MS): number {
  const t = Math.min(1, Math.max(0, ms / total));
  return 1 - Math.pow(1 - t, 3);
}

/**
 * The camera at time `ms`, as a multiple of the hero's zoom.
 *
 * MUST REACH EXACTLY 1 AT THE END, and that is the entrance's load-bearing property rather than a nicety: the
 * overlay is removed when this lands, and if it landed at 0.98 the removal would be a visible jump of the whole
 * field. A test asserts it.
 */
export function entranceZoom(ms: number, total = ENTRANCE_MS): number {
  return ENTRANCE_ZOOM_FROM + (1 - ENTRANCE_ZOOM_FROM) * entranceProgress(ms, total);
}

/**
 * How far the name has travelled toward its hero position at time `ms`, in [0, 1].
 *
 * It starts PART-WAY THROUGH the camera move, not at the same instant. Two things moving from t=0 read as one
 * composite slide; staggering them makes the name read as settling into a place the camera has already found.
 * It finishes slightly before the camera lands so the last thing that happens is the field coming to rest.
 */
export function nameTravel(ms: number): number {
  const t = Math.min(1, Math.max(0, (ms - NAME_TRAVEL_START_MS) / NAME_TRAVEL_MS));
  return 1 - Math.pow(1 - t, 3);
}

/**
 * THE CROSSOVER: one number driving BOTH the ground clearing and the name's ink, because they are two halves of
 * one event and the whole problem was letting them run on separate clocks.
 *
 * WHY THE WINDOW IS LATE AND SHORT, measured rather than guessed. The name must go ivory -> ink (an ivory name
 * is the only legible one on the opaque dark ground; the hero's name is ink on the luminous sky), and the ground
 * must go opaque -> gone. Two lightness ramps in opposite directions MUST cross. The first build ran them wide
 * and overlapping — the ground from 945ms over 1050ms, the ink tied to the name's travel from 1150ms over
 * 800ms — so they crossed slowly and at nearly the same rate, which means they HUG. Composited and measured
 * in L*:
 *
 *     1200ms  name 92.5  bg 36.7   dL* 55.8
 *     1300ms  name ~73   bg ~46    dL* ~27
 *     1450ms  name ~51   bg ~57    dL*  ~6   <- at the just-noticeable difference: the name disappears
 *     1600ms  name 26.3  bg 65.1   dL* 38.8
 *
 * A ~140ms hole right where the eye is tracking the moving name. The fix is not to retime one ramp — they have
 * to cross — but to make the crossing SHORT and put it after the travel, so the name spends the whole of its
 * journey ivory on a dark ground (which is the highest-contrast state the entrance has) and flips at the end.
 * At 450ms the ramps pass each other within about two frames.
 *
 * It ends BEFORE `ENTRANCE_MS`: the overlay is removed at the landing frame and the name has to be the hero's
 * colour by then, or the removal is a colour pop on the one element the reader is looking at.
 */
export const CROSSOVER_START_MS = 1600;
export const CROSSOVER_MS = 450;

export function crossover(ms: number): number {
  return Math.min(1, Math.max(0, (ms - CROSSOVER_START_MS) / CROSSOVER_MS));
}

/** Where the halo reaches full strength, and how strong. Peak at the crossing — see `haloAt`. */
export const HALO_FROM = 0.1;
export const HALO_PEAK_AT = 0.5;
export const HALO_PEAK = 0.55;

/**
 * THE NAME'S LEGIBILITY HALO, ALIVE ONLY WHILE THE RAMPS PASS EACH OTHER.
 *
 * Shortening the crossing leaves a couple of frames where the name's lightness and its background's are still
 * close, so the name also carries a veil through it — the site's own idiom, since the hero already puts a
 * legibility veil behind its text over this same sky (that is what `lib/skyLegibility.ts` is for).
 *
 * ZERO AT BOTH ENDS, which is the invariant worth testing. At p=0 the ground is fully opaque and an ivory name
 * needs no help; a glow there would be the one soft thing on an otherwise clean title card. At p=1 the stand-in
 * sits exactly on the hero's own name a frame before the overlay is removed, and ANY halo is then a difference
 * between the two — the single frame this design exists to make invisible.
 *
 * It is also why the peak is moderate. At a stronger value the glow read *through* the surname: "Tian" is
 * italic at weight 500, so its strokes are thin, and a 28px paper glow behind thin strokes washes their
 * antialiased edges out — the heavy roman "Ing" gained contrast while the italic lost it. Measured at the
 * crossing with this value, the composite behind the name sits ~16 L* from the glyphs.
 */
export function haloAt(p: number): number {
  const t = Math.min(1, Math.max(0, p));
  if (t <= HALO_FROM || t >= 1) return 0;
  return t <= HALO_PEAK_AT
    ? (HALO_PEAK * (t - HALO_FROM)) / (HALO_PEAK_AT - HALO_FROM)
    : (HALO_PEAK * (1 - t)) / (1 - HALO_PEAK_AT);
}

/** CIE L* of an sRGB triple. The entrance reasons about contrast in L* because sRGB is badly nonlinear near
 *  black — a 4.5%-alpha ivory line over near-black still reads, and channel arithmetic says otherwise. */
export function lightness([r, g, b]: readonly [number, number, number]): number {
  const lin = (c: number): number => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const Y = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y;
}

/** Below this much L* of travel there is no crossing to cover, so there is no halo. */
export const HALO_FULL_AT = 40;

/**
 * HOW MUCH HALO THIS THEME NEEDS — in proportion to the lightness distance the name actually has to cross.
 *
 * THE HALO IS A LIGHT-THEME FIX AND IN DARK IT WAS PURE DAMAGE, which is exactly the asymmetry the themes rule
 * warns about ("verify BOTH — regressions hide in the theme you didn't look at"). Measured from the tokens:
 *
 *   light   --paper #efe9dd (L* 92.5) -> --ink-1 #16140f (L*  6.4)   travel 86.1   the name really does cross
 *   dark    --paper #dfe3df (L* 89.4) -> --ink-1 #dce1dc (L* 89.0)   travel  0.4   it barely changes at all
 *
 * In dark both role tokens are cool near-whites, so the name stays near-white over a dark ground and a dark
 * nebula sky and never loses contrast — there is nothing to cover. Firing the halo anyway put a near-white glow
 * behind near-white glyphs at 0.42 alpha, which only washes their edges out. Scaling by the travel turns it off
 * there without a theme branch, and keeps working if a token is ever retuned.
 */
export function haloScale(
  from: readonly [number, number, number],
  to: readonly [number, number, number],
): number {
  return Math.min(1, Math.abs(lightness(from) - lightness(to)) / HALO_FULL_AT);
}
