// THE ONE MOTION MODULE: the DOM half of every animation the rail and the research pages play. The timing and
// geometry it needs are pure and specified in lib/motionTiming.ts; this half measures and plays. It lives in
// scripts/, as scripts/artGallery.ts does, because it touches the DOM.
//
// The rules it keeps for every caller (CLAUDE.md, Motion): only transform and opacity animate; everything runs once
// and lands on the element's own finished style; under reduced motion nothing plays and nothing waits.
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
 * teardown can end every animation at once (`live.forEach((a) => a.finish())`).
 */
export function play(el: Element, frames: Keyframe[], opts: KeyframeAnimationOptions, live: Set<Animation>): Animation {
  const a = el.animate(frames, { easing: EASE, fill: 'both', ...opts });
  live.add(a);
  a.finished.then(() => { live.delete(a); a.cancel(); }, () => live.delete(a));
  return a;
}

/**
 * Run `run(el)` once for each element, the first time it is seen (`threshold` of it on screen), and only for what
 * is still below the screen now: anything on screen or above it — the reader is there, or a deep link or a restored
 * scroll carried them past it — is left alone, finished. Each element that waits carries `data-pending` until its
 * run, so its hold-back state is CSS on that attribute, set by script and never served (a hold-back rule on an
 * element with a transition must say `transition: none`, or it animates into hiding).
 *
 * No negative rootMargin: an instant scroll can land an element inside a shrunken root without ever crossing its
 * edge. And nothing waits forever: an element on screen for MOTION_LIMIT_MS without reaching the threshold runs
 * then, and when `signal` aborts (the page ends) every element still waiting runs at once. A teardown aborts the
 * signal before it finishes its live animations, so what that last run starts is finished with the rest.
 */
export function onceSeen(
  els: Iterable<Element>, run: (el: Element) => void, opts: { threshold?: number; signal: AbortSignal },
): void {
  const { threshold = 0, signal } = opts;
  if (signal.aborted) return;
  const waiting = new Map<Element, number | undefined>(); // element -> its on-screen backstop, while one is armed
  const go = (el: Element): void => {
    if (!waiting.has(el)) return;
    clearTimeout(waiting.get(el));
    waiting.delete(el);
    io.unobserve(el);
    el.removeAttribute('data-pending');
    run(el);
  };
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!waiting.has(e.target)) continue;
      if (e.isIntersecting && e.intersectionRatio >= threshold) go(e.target);
      else if (e.isIntersecting) {
        if (waiting.get(e.target) === undefined) waiting.set(e.target, window.setTimeout(() => go(e.target), MOTION_LIMIT_MS));
      } else {
        clearTimeout(waiting.get(e.target));
        waiting.set(e.target, undefined);
      }
    }
  }, { threshold: threshold > 0 ? [0, threshold] : 0 });
  for (const el of els) {
    if (el.getBoundingClientRect().top < window.innerHeight) continue;
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
 * line in document coordinates on <body> and scaled in from its left edge, each line's share of `totalMs` in
 * proportion to its width so the sweep keeps one speed across a break. What a span paints (a band, a hairline at
 * the line's foot) is `cls`'s CSS, which must be global: the spans are created here. They are removed when the
 * sweep ends, finished or cancelled, and then the promise resolves — the caller's own finished state takes over.
 */
export function sweepLines(target: Element, cls: string, totalMs: number, live: Set<Animation>): Promise<void> {
  const lines = mergeLines([...target.getClientRects()]);
  const durations = sweepDurations(lines.map((l) => l.width), totalMs);
  // One line takes the house curve; a run of lines goes nearly linear, so a sweep does not stall at each break.
  const easing = lines.length > 1 ? 'cubic-bezier(.3,.2,.4,1)' : EASE;
  let delay = 0;
  const anims = lines.map((l, k) => {
    const s = document.createElement('span');
    s.className = cls;
    s.setAttribute('aria-hidden', 'true');
    s.style.cssText = `position:absolute;left:${l.left + window.scrollX}px;top:${l.top + window.scrollY}px;`
      + `width:${l.width}px;height:${l.height}px;transform-origin:0 50%;pointer-events:none`;
    document.body.append(s);
    const a = play(s, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: durations[k], delay, easing }, live);
    delay += durations[k];
    return { s, a };
  });
  return Promise.all(anims.map(({ s, a }) => a.finished.catch(() => undefined).then(() => s.remove()))).then(() => undefined);
}
