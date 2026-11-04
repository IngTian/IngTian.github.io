// THE ONE MOTION MODULE: the DOM half of every animation the rail and the research pages play. The timing and
// geometry it needs are pure and specified in lib/motionTiming.ts; this half measures and plays. It lives in
// scripts/, as scripts/artGallery.ts does, because it touches the DOM.
//
// The rules it keeps for every caller (CLAUDE.md, Motion): only transform and opacity animate; everything runs once
// and lands on the element's own finished style; under reduced motion nothing plays and nothing waits, because the
// gate is here and not in the callers: `play` lands on its last frame at once, and `onceSeen` holds nothing back.
import { MOTION_LIMIT_MS, prefersReducedMotion } from '../lib/motion';
import { EASE, mergeLines, sweepDurations } from '../lib/motionTiming';

/** Whether anything may move: the reduced-motion gate, asked once per call. */
export function motionAllowed(): boolean {
  return !prefersReducedMotion();
}

/**
 * Play an animation that hands back to the element's own style. `fill: 'both'` holds the first frame through any
 * delay (so a from-state set now is what paints) and the last until the animation finishes; then it is cancelled, so
 * nothing stays composited and what remains is the CSS — the finished state. It sits in `live` while it runs, so a
 * teardown can end every animation at once (`live.forEach((a) => a.finish())`). Under reduced motion it takes no
 * time: the last frame at once, then the CSS.
 */
export function play(el: Element, frames: Keyframe[], opts: KeyframeAnimationOptions, live: Set<Animation>): Animation {
  const still = motionAllowed() ? {} : { duration: 0, delay: 0, endDelay: 0 };
  const a = el.animate(frames, { easing: EASE, fill: 'both', ...opts, ...still });
  live.add(a);
  a.finished.then(() => { live.delete(a); a.cancel(); }, () => live.delete(a));
  return a;
}

/**
 * The bottom of the lowest screen the reader may be landing on, in viewport coordinates. A script started at parse
 * on a full load runs before the browser scrolls to a fragment (/research/rl-bhrp#results); on a reload or a Back,
 * the router (ClientRouter) has already restored history.state's position, and the URL keeps the fragment it was
 * left with — Back to `#results` lands wherever the reader had read on to, far below it. So the reader may land
 * where the window is, at the restored position or at the fragment's target (less its scroll margin), and nothing
 * on any of those screens is held back.
 */
function landingBottom(): number {
  const id = decodeURIComponent(window.location.hash.slice(1));
  const target = id ? document.getElementById(id) : null;
  const restored = (history.state as { scrollY?: unknown } | null)?.scrollY;
  const targetTop = target ? target.getBoundingClientRect().top - (parseFloat(getComputedStyle(target).scrollMarginTop) || 0) : 0;
  const restoredTop = typeof restored === 'number' ? restored - window.scrollY : 0;
  return Math.max(0, targetTop, restoredTop) + window.innerHeight;
}

/**
 * Run `run(el)` once for each element, the first time it is seen (`threshold` of it on screen), and only for what
 * is still below the screen the reader lands on: anything on that screen or above it — the reader is there, or a
 * deep link or a restored scroll carried them past it — is left alone, finished. So is anything a LATER jump carries
 * them past (End, a rail click): the moment its top is above the screen it is settled,
 * finished and not run, rather than kept waiting until the reader scrolls back up to it. Each element that waits
 * carries `data-pending` until then, so its hold-back state is CSS on that attribute, set by script and never served
 * (a hold-back rule on an element with a transition must say `transition: none`, or it animates into hiding).
 * Under reduced motion nothing is held back and nothing runs: the CSS finished state stands.
 *
 * The root reaches far above the screen, so that a jump from below an element to past it crosses an edge (not
 * intersecting, then intersecting) and is reported: against the bare viewport both ends of that jump are "not
 * intersecting", and no entry would ever come. No negative rootMargin: an instant scroll can land an element inside
 * a shrunken root without ever crossing its edge. And nothing waits forever: an element on screen for
 * MOTION_LIMIT_MS without reaching the threshold runs then, and when `signal` aborts (the page ends) every element
 * still waiting runs at once. A teardown aborts the signal before it finishes its live animations, so what that
 * last run starts is finished with the rest.
 */
export function onceSeen(
  els: Iterable<Element>, run: (el: Element) => void, opts: { threshold?: number; signal: AbortSignal },
): void {
  const { threshold = 0, signal } = opts;
  if (signal.aborted || !motionAllowed()) return;
  const waiting = new Map<Element, number | undefined>(); // element -> its on-screen backstop, while one is armed
  /** Stop waiting, so the element shows its finished state; true if it was waiting. */
  const settle = (el: Element): boolean => {
    if (!waiting.has(el)) return false;
    clearTimeout(waiting.get(el));
    waiting.delete(el);
    io.unobserve(el);
    el.removeAttribute('data-pending');
    return true;
  };
  const go = (el: Element): void => { if (settle(el)) run(el); };
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!waiting.has(e.target)) continue;
      if (e.boundingClientRect.top < 0) settle(e.target); // the reader is past its top: already read
      else if (e.isIntersecting && e.intersectionRatio >= threshold) go(e.target);
      else if (e.isIntersecting) {
        if (waiting.get(e.target) === undefined) waiting.set(e.target, window.setTimeout(() => go(e.target), MOTION_LIMIT_MS));
      } else {
        clearTimeout(waiting.get(e.target));
        waiting.set(e.target, undefined);
      }
    }
  // ponytail: 1e6px stands in for "everything above"; a page would have to run to about a thousand screens to reach it.
  }, { threshold: threshold > 0 ? [0, threshold] : 0, rootMargin: '1000000px 0px 0px 0px' });
  const landing = landingBottom();
  for (const el of els) {
    if (el.getBoundingClientRect().top < landing) continue;
    waiting.set(el, undefined);
    el.setAttribute('data-pending', '');
    io.observe(el);
  }
  signal.addEventListener('abort', () => {
    for (const el of [...waiting.keys()]) go(el);
    io.disconnect();
  }, { once: true });
}

/**
 * Sweep `target`'s text, line by line, left to right: one span of class `cls` per merged line box, laid over the
 * line and scaled in from its left edge, each line's share of `totalMs` in proportion to its width so the sweep
 * keeps one speed across a break. What a span paints (a band, a hairline at the line's foot) is `cls`'s CSS, which
 * must be global: the spans are created here. A line that has finished stays drawn (its span back at its CSS full
 * width) until the LAST one has; then every span goes at once and the promise resolves, finished or cancelled, so a
 * caller that holds its own finished state back until then hands over in one frame and no line blinks out early.
 *
 * Where the spans sit, and what they paint over, are the caller's to know:
 * - They are placed absolutely on <body>, in document coordinates, which is right while neither <html> nor <body>
 *   is positioned or transformed and <body> has no margin: true on every page (Tailwind's preflight zeroes it).
 * - Each covers its line's box, or with `foot` only the bottom `foot` px of it: a band under the words, or a
 *   hairline, measured in the target's own type (the span itself is set in <body>'s).
 * - They are appended last and carry no z-index, so they paint OVER the text. A band meant to lie under the words
 *   needs `z-index: -1` in `cls`, and that shows only where no ancestor of the text paints a background of its own.
 */
export function sweepLines(target: Element, cls: string, totalMs: number, live: Set<Animation>, foot?: number): Promise<void> {
  const lines = mergeLines([...target.getClientRects()]);
  const durations = sweepDurations(lines.map((l) => l.width), totalMs);
  // One line takes the house curve; a run of lines goes nearly linear, so a sweep does not stall at each break.
  const easing = lines.length > 1 ? 'cubic-bezier(.3,.2,.4,1)' : EASE;
  let delay = 0;
  const anims = lines.map((l, k) => {
    const s = document.createElement('span');
    s.className = cls;
    s.setAttribute('aria-hidden', 'true');
    const h = foot ?? l.height;
    s.style.cssText = `position:absolute;left:${l.left + window.scrollX}px;top:${l.top + l.height - h + window.scrollY}px;`
      + `width:${l.width}px;height:${h}px;transform-origin:0 50%;pointer-events:none`;
    document.body.append(s);
    const a = play(s, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: durations[k], delay, easing }, live);
    delay += durations[k];
    return { s, a };
  });
  return Promise.all(anims.map(({ a }) => a.finished.catch(() => undefined))).then(() => { anims.forEach(({ s }) => s.remove()); });
}
