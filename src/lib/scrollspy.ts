// Shared scrollspy core. Both the homepage TOC (Toc.astro) and the /art rail
// (artGallery.ts) need the same "which section is active?" rule, so the math
// lives here once, pure and unit-tested. Each call site keeps its own thin DOM
// wrapper (reading element tops, toggling classes) — only the decision is shared.

const REFERENCE_LINE_RATIO = 0.4; // active = last stop whose top crossed 40% down the viewport
const BOTTOM_EPSILON = 2;         // px slack for "scrolled to the very bottom"

/**
 * Index of the active scroll stop: the last one whose top has crossed the
 * reference line near the top of the viewport. Robust to wildly different
 * section heights. When the page is scrolled to the bottom, the final stop is
 * forced active so a short last section (e.g. a footer) can still light up.
 *
 * @param stopTops      each stop's viewport-relative top (getBoundingClientRect().top), in document order
 * @param viewportHeight  window.innerHeight
 * @param scrollY         window.scrollY
 * @param documentHeight  document.documentElement.scrollHeight
 */
export function activeStopIndex(
  stopTops: number[],
  viewportHeight: number,
  scrollY: number,
  documentHeight: number,
): number {
  if (stopTops.length === 0) return -1;

  const referenceLine = viewportHeight * REFERENCE_LINE_RATIO;
  let active = 0;
  stopTops.forEach((top, i) => {
    if (top <= referenceLine) active = i;
  });

  const atBottom = scrollY + viewportHeight >= documentHeight - BOTTOM_EPSILON;
  if (atBottom) active = stopTops.length - 1;

  return active;
}
