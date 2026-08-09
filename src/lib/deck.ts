// src/lib/deck.ts
// THE DECK — where the homepage's scroll is allowed to rest.
//
// The owner's brief: "like a PPT, one scroll guides you to the next slide. It's not a free scroll."
//
// WHY THIS IS NOT CSS SCROLL-SNAP. That was tried first and MEASURED, because it is the cheap answer
// and it looked like it should work. It cannot, at this page's proportions:
//
//   slide gaps (1700x1050):  heights→interlude 1134px   interlude→story 819px
//                            story→mountains  2279px   mountains→ground 2346px
//   one wheel gesture:       ~320px  — i.e. every gap is 1.8x to 7.3x a single scroll
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
// TALL SLIDES ARE THE HARD CASE and the reason a naive "scroll to the next section" fails. Two slides
// are more than two viewports of text (story 2.17vh, mountains 2.23vh). Jumping straight from their
// top to the next section would skip most of the writing unread. Instead a tall slide gets INTERIOR
// stops, one viewport apart, so the deck pages through it — the reader always advances by exactly one
// screen, and never lands somewhere that hides content.

export interface DeckSlide {
  /** Document offset of the slide's top edge, in px. */
  top: number;
  /** Slide height in px. */
  height: number;
  /**
   * Breathing air above the slide when the deck rests on it, in px. The stop is placed this far ABOVE
   * the slide's top edge, so the content opens with space rather than flush against the browser chrome.
   *
   * This lives here rather than in CSS because `scroll-margin-top` is only honoured by
   * scrollIntoView(), and the deck moves with window.scrollTo() — so a CSS rule looked correct, did
   * nothing, and the panel title came to rest hard against the top of the window.
   */
  lead?: number;
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
    // The stop sits `lead` px above the slide's top, so the slide opens with air. The interior paging
    // below is measured from this same lifted origin, which keeps the last stop's bottom-alignment
    // honest — otherwise the lead would eat a strip of the final screen.
    const lead = s.lead ?? 0;
    const origin = s.top - lead;
    out.push(origin);
    // Slightly-too-tall slides are left as a single stop: the sliver below the fold costs less than a
    // stop that advances by a sliver. The lead counts toward the height, since it occupies screen too.
    if (s.height + lead <= vh + minAdvance) continue;
    // Interior stops, a (slightly overlapped) viewport apart. The overlap keeps a couple of lines of
    // the previous screen visible, so a paragraph broken across two stops stays readable.
    //
    // The stride is chosen so the interior stops land EVENLY between the top and the bottom-align
    // position, rather than marching at a fixed `step` and leaving an odd remainder before the last
    // stop. A fixed stride broke the coverage guarantee: for a 3000px slide in a 1000px viewport it
    // produced 0, 920, 2000 — a 1080px jump across which 80px of content is visible at no stop at all.
    const lastUseful = s.top + s.height - vh;
    const span = lastUseful - origin;
    const legs = Math.max(1, Math.ceil(span / step));
    const stride = span / legs;
    for (let k = 1; k < legs; k++) out.push(origin + stride * k);
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

/** The stop the page is currently resting on (or closest to). Used to report position, not to move. */
export function currentStop(stops: readonly number[], y: number): number | null {
  if (!stops.length) return null;
  let best = stops[0];
  for (const s of stops) if (Math.abs(s - y) < Math.abs(best - y)) best = s;
  return best;
}
