// src/lib/deck.ts
// THE DECK — where the homepage's scroll is allowed to rest.
//
// The owner's brief: "like a PPT, one scroll guides you to the next slide. It's not a free scroll."
//
// WHY THIS IS NOT CSS SCROLL-SNAP. That was tried first and MEASURED, because it is the cheap answer
// and it looked like it should work. It cannot, at this page's proportions (measured at 1700x1050 on an
// earlier slide order; the arithmetic, not the order, is the point):
//
//   slide gaps:          581px to 2346px
//   one wheel gesture:   ~320px  — i.e. every gap is 1.8x to 7.3x a single scroll
//
// With `scroll-snap-type: y mandatory`, one gesture proposes a destination ~320px away, and the
// nearest snap position to that destination is the slide it just left — so the browser snaps back and
// the page does not move. Measured: the scroll sat at y=84 through eight consecutive gestures, and
// through a 12-event burst shaped like a trackpad flick. `proximity` and `scroll-snap-stop: always`
// made no difference (identical walks), and neither did shrinking the hero to exactly one viewport —
// that still refused to leave y=0, because the arithmetic is about gesture size versus slide spacing,
// not about the snap type. Only gestures of 640px+ advanced.
//
// So the deck is driven explicitly: one gesture = one stop. This module is the pure part — WHERE the
// stops are and WHICH one comes next — kept separate from the event plumbing so it can be unit-tested
// (the project's rule: anything non-trivial in lib/ gets a spec).
//
// TALL SLIDES ARE THE HARD CASE and the reason a naive "scroll to the next section" fails. A slide can
// hold more than a viewport of text (Story does). Jumping straight from its top to the next section
// would skip most of the writing unread. Instead a tall slide gets INTERIOR
// stops, one viewport apart, so the deck pages through it — the reader always advances by exactly one
// screen, and never lands somewhere that hides content.

export interface DeckSlide {
  /** Document offset of the slide's top edge, in px. */
  top: number;
  /** Slide height in px. */
  height: number;
}

/**
 * Every position the deck may rest at, in ascending order.
 *
 * A slide that fits the viewport contributes ONE stop: its top.
 * A taller slide contributes its top plus interior stops a viewport apart, and finally a stop that
 * aligns its BOTTOM to the viewport bottom — so the last screen of a long section is full of text
 * rather than showing a sliver plus the next slide.
 *
 * A slide only barely taller than the viewport is treated as fitting. #heights is 1134px against a
 * 1050px viewport: its bottom-align stop would sit just 84px below its top, so one gesture would
 * crawl 84px instead of advancing a slide — exactly the "free scroll" feel being replaced. `slack`
 * is how much overflow is tolerated before a slide is considered worth paging through.
 *
 * @param slides   slide boxes in document order
 * @param vh       viewport height
 * @param maxY     largest legal scroll offset (scrollHeight - vh); stops are clamped to it
 * @param overlap  fraction of a viewport to keep as context when paging inside a tall slide
 * @param slack    overflow tolerated before a slide gets interior stops, as a fraction of a viewport
 */
export function deckStops(
  slides: readonly DeckSlide[],
  vh: number,
  maxY: number,
  overlap = 0.08,
  slack = 0.25,
): number[] {
  if (vh <= 0) return [0];
  const step = Math.max(1, vh * (1 - overlap));
  const minAdvance = vh * slack;
  const out: number[] = [];

  for (const s of slides) {
    out.push(s.top);
    // Slightly-too-tall slides are left as a single stop: the sliver below the fold costs less than a
    // stop that advances by a sliver.
    if (s.height <= vh + minAdvance) continue;
    // Interior stops, a (slightly overlapped) viewport apart. The overlap keeps a couple of lines of
    // the previous screen visible, so a paragraph broken across two stops stays readable.
    //
    // The stride is chosen so the interior stops land EVENLY between the top and the bottom-align
    // position, rather than marching at a fixed `step` and leaving an odd remainder before the last
    // stop. A fixed stride broke the coverage guarantee: for a 3000px slide in a 1000px viewport it
    // produced 0, 920, 2000 — a 1080px jump across which 80px of content is visible at no stop at all.
    const lastUseful = s.top + s.height - vh;
    const span = lastUseful - s.top;
    const legs = Math.max(1, Math.ceil(span / step));
    const stride = span / legs;
    for (let k = 1; k < legs; k++) out.push(s.top + stride * k);
    // Align the slide's bottom edge to the viewport bottom.
    out.push(lastUseful);
  }

  // Clamp into range, dedupe (rounded, so sub-pixel duplicates collapse), and sort. Then drop any stop
  // that sits within minAdvance of the one before it: such a pair would make one gesture travel a
  // sliver. This can arise between ADJACENT slides too (a short slide following a tall one), which is
  // why it is a final pass over the merged list rather than a per-slide check.
  const clamped = out
    .map((y) => Math.round(Math.min(Math.max(0, y), Math.max(0, maxY))))
    .sort((a, b) => a - b);
  const deduped = clamped.filter((y, i) => i === 0 || y !== clamped[i - 1]);

  const spaced: number[] = [];
  for (const y of deduped) {
    if (!spaced.length || y - spaced[spaced.length - 1] >= minAdvance) spaced.push(y);
    // A too-close stop is dropped — EXCEPT the page bottom, which must stay reachable or the last
    // screen can never be rested on. Replace the previous stop with it instead.
    else if (y === maxY) spaced[spaced.length - 1] = y;
  }
  return spaced;
}

/**
 * The stop one step from `y` in `dir`.
 *
 * `tolerance` absorbs the difference between where a smooth scroll finished and the exact stop it
 * aimed at: without it, a rest 2px short of a stop would count as "before" it and the next gesture
 * would travel 2px instead of advancing a slide.
 *
 * Returns null when there is nothing further in that direction, which the caller treats as "let the
 * browser scroll normally" — that is what keeps the page's ends from feeling locked.
 */
export function nextStop(
  stops: readonly number[],
  y: number,
  dir: 1 | -1,
  tolerance = 8,
): number | null {
  if (dir === 1) {
    for (const s of stops) if (s > y + tolerance) return s;
    return null;
  }
  for (let i = stops.length - 1; i >= 0; i--) if (stops[i] < y - tolerance) return stops[i];
  return null;
}

/**
 * How long one slide transition takes, in ms.
 *
 * 650, and the number came from the owner's own screen recording rather than taste. Measured on that clip
 * (578 frames at 55.8fps), the browser's native smooth scroll finished a slide in about 500ms — but spent the
 * first ~35ms going from a standstill to nearly peak velocity. A launch that fast is what he described as "the
 * sudden change of slides instead of a smooth transition": the eye reads an instant departure and a soft
 * arrival, which is the opposite shape from the one that feels deliberate.
 * A little longer than native, because an ease-IN spends time at low velocity at the start; at 500ms with this
 * curve the middle has to move faster than the native scroll did to cover the same distance.
 */
export const DECK_TWEEN_MS = 650;

/**
 * Symmetric ease for the deck's scroll — slow, fast, slow.
 *
 * WHY WE OWN THE ANIMATION AT ALL. `window.scrollTo({ behavior: 'smooth' })` hands the curve to the browser,
 * and the browser's curve is front-loaded (see DECK_TWEEN_MS). It is also uncancellable: there is no API to
 * stop an in-flight native smooth scroll, which is why two overlapping transitions showed up in the recording
 * as a double lurch — the second scroll began while the first was still running and the position jumped.
 * A rAF tween fixes both: the shape is ours, and cancelling is one cancelAnimationFrame.
 *
 * easeInOutCubic, deliberately, not a spring or a bezier with overshoot: this is a page moving to a resting
 * position that the reader chose, and overshoot on a full-viewport scroll reads as sloppiness rather than
 * bounce. Symmetric so departure and arrival feel like the same gesture.
 *
 * Pure and clamped, so it is unit-testable and cannot be handed a progress value outside [0, 1] by a frame
 * that arrives late.
 */
export function easeInOutCubic(t: number): number {
  const p = t <= 0 ? 0 : t >= 1 ? 1 : t;
  return p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2;
}

/** CSS's cubic-bezier(x1, y1, x2, y2) as a function of progress, clamped to [0, 1]; x is solved by bisection. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const at = (a: number, b: number, s: number) => 3 * (1 - s) ** 2 * s * a + 3 * (1 - s) * s * s * b + s ** 3;
  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let lo = 0, hi = 1, s = t;
    for (let i = 0; i < 40; i++) { s = (lo + hi) / 2; if (at(x1, x2, s) < t) lo = s; else hi = s; }
    return at(y1, y2, s);
  };
}

/**
 * PROTOTYPE, 2026-11-10, retired when the owner picks one: `?deck=` on / chooses the tween's curve and length, so
 * they are judged by feel on his trackpad. His recording measured today's curve exactly (a 650ms fit, no frame off
 * it by more than one 144 Hz frame's travel) and showed what reads as sluggish: 1.5% of the slide by 100ms, full
 * speed only at 324ms. The other end, native smooth scroll at full speed within ~35ms, was "sudden" (DECK_TWEEN_MS).
 * By 100ms / full speed at: a 1.5% / 324ms, b 13% / 150ms, c 18% / 131ms, d 25% / 115ms.
 */
export const DECK_TRIALS: Record<string, { ms: number; ease: (t: number) => number }> = {
  a: { ms: DECK_TWEEN_MS, ease: easeInOutCubic },
  b: { ms: 500, ease: cubicBezier(0.4, 0, 0.2, 1) },
  c: { ms: 550, ease: cubicBezier(0.3, 0, 0.2, 1) },
  d: { ms: 550, ease: cubicBezier(0.25, 0.1, 0.25, 1) },
};

/** Wheel travel, in px, a gesture must cover before it moves a slide: less is a brush of the trackpad. */
export const WHEEL_THRESHOLD = 18;

/**
 * What the deck does with a gesture's travel once nothing holds it: 'start' a slide, 'swallow' the event
 * (preventDefault, move nothing), or 'pass' it to the browser's own scroll. wheelStep decides when that is.
 *
 * - `travel`: the gesture's travel so far, this event included, signed. Under the threshold it is swallowed,
 *   NOT passed: Chrome lets a gesture's events be cancelled only if its first one was. Measured on a phased
 *   trackpad gesture when the deck passed a small opener: [6.2px cancelable, 70 not, 43.1 not, 30.7 not], so
 *   the rest of the gesture, momentum included, scrolled natively under the deck's tween.
 * - At an end (no stop in travel's direction) it passes, so the page's ends never feel locked.
 */
export function wheelAction(travel: number, stops: readonly number[], y: number): 'start' | 'swallow' | 'pass' {
  if (nextStop(stops, y, travel > 0 ? 1 : -1) === null) return 'pass';
  return Math.abs(travel) < WHEEL_THRESHOLD ? 'swallow' : 'start';
}

/** A wheel stream counts as ended after this much silence. */
export const WHEEL_QUIET_MS = 160;

/** The frame an event's rate is measured per: a 120 Hz trackpad's event interval. */
const FRAME_MS = 1000 / 120;

/** How many times the last event an event must be, in rate and in size, to read as a new gesture inside a stream.
 *  The measured opener jumps about 11x; a drag whose events wander by up to ±60% stays under 4x from one to the next. */
const JUMP = 4;

/** What the deck remembers of the wheel events before this one (times are event timeStamps, ms). */
export interface WheelStream {
  /** An opener's travel while it is still under the threshold. */
  travel: number;
  /** The last event that was not passed to the browser. */
  lastAt: number;
  /** The last event's rate (px per FRAME_MS) and its size (deltaY), signed. */
  rate: number;
  delta: number;
  /** Events have kept coming since a slide started: what arrives is that gesture's drag or momentum. */
  tail: boolean;
}

export const QUIET_STREAM: WheelStream = { travel: 0, lastAt: -Infinity, rate: 0, delta: 0, tail: false };

/**
 * One wheel event through the stream, in event time: what the deck does with it, and what the stream becomes.
 * `busy` is a slide moving, or a jump the deck did not start (a rail link, an #anchor): everything is swallowed
 * then, so leftover momentum cannot advance a slide nobody asked for and a wheel cannot cut a jump short.
 *
 * ONE GESTURE IS ONE SLIDE, AND A NEW FLICK IS HEARD. A gesture outlasts its slide: a drag keeps going, and macOS
 * sends a flick's inertia for a second or more, small events about once a frame, all swallowed (they must be:
 * wheelAction's note). Holding the deck until they stop made a second flick, made as the slide landed, read as more
 * of the first one: the deck answered late. So once the slide has landed, while events keep coming (`tail`), only
 * a JUMP starts a slide: at threshold rate, and JUMP times the last event in rate AND in size. A new flick opens
 * with one ([6.2, 70, …], about 11x in both); inertia only decays and a drag drifts. Rate is per FRAME_MS of the
 * time since the last event, because Chrome sums the events it queued while the page was busy into one, whose size
 * jumps but whose rate keeps the stream's; size, because the first event after a gap reads slow by rate, and the
 * normal one after it would jump by rate alone. From quiet, an opener's events add up, so a slow drag and a mouse
 * notch still move a slide.
 * Not heard: a swipe that builds up gradually, or a slow drag, begun while the last one's inertia is still
 * arriving. Without a phase on wheel events it cannot be told from a drag that slows; it is heard once quiet.
 * ponytail: JUMP is a heuristic on the one measured opener; if a real trackpad shows a stray or a missed slide,
 * record its wheel deltas and tune it.
 */
export function wheelStep(
  s: WheelStream,
  deltaY: number,
  at: number,
  busy: boolean,
  stops: readonly number[],
  y: number,
): { action: 'start' | 'swallow' | 'pass'; dir: 1 | -1; next: WheelStream } {
  const rate = (deltaY * FRAME_MS) / Math.max(FRAME_MS, at - s.lastAt);
  const seen = { lastAt: at, rate, delta: deltaY };
  if (busy) return { action: 'swallow', dir: deltaY > 0 ? 1 : -1, next: { ...seen, travel: 0, tail: true } };
  const quiet = at - s.lastAt >= WHEEL_QUIET_MS;
  if (s.tail && !quiet) {
    const jump = Math.abs(rate) >= WHEEL_THRESHOLD
      && Math.abs(rate) >= JUMP * Math.abs(s.rate) && Math.abs(deltaY) >= JUMP * Math.abs(s.delta);
    const action = jump ? wheelAction(rate, stops, y) : 'swallow';
    const dir = deltaY > 0 ? 1 : -1;
    if (action === 'pass') return { action, dir, next: { ...s, travel: 0 } };
    return { action, dir, next: { ...seen, travel: 0, tail: true } };
  }
  const travel = quiet ? deltaY : s.travel + deltaY;
  const action = wheelAction(travel, stops, y);
  const dir = travel > 0 ? 1 : -1;
  if (action === 'pass') return { action, dir, next: { ...s, travel: 0 } };
  return { action, dir, next: { ...seen, travel: action === 'start' ? 0 : travel, tail: action === 'start' } };
}
