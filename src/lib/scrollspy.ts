// Shared scrollspy core: "which section is the reader in?", pure and unit-tested. Two rails ask it: the /art rail
// (scripts/artGallery.ts) uses activeStopIndex directly; SideRail, the rail of every other page that has one, uses
// railMarks, which falls back to it. Each call site keeps its own thin DOM wrapper (measuring boxes, toggling
// classes); only the decision lives here.

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

/** One rail stop's target as measured: its viewport-relative box, whether it renders at all (a target with no
 *  client rects is hidden from the rail), and its parent stop's index. Boxes come in the rail's tree order. */
export interface StopBox { top: number; bottom: number; visible: boolean; parent: number | null }

/** Indices into the boxes: every current stop (tree order), the lit ancestors that are not themselves current, and
 *  the one current stop that carries the rail's moving marker. */
export interface Marks { current: number[]; ancestors: number[]; lead: number | null }

/** The reading band, as fractions of the viewport's height. */
const BAND = { top: 0.10, bottom: 0.62 } as const;

/**
 * SideRail's marking rule. Every visible stop whose box overlaps the reading band is CURRENT, so two are current
 * wherever a section boundary sits in the band, and a parent whose section holds its child's is current with it.
 * More than one is honest rather than a coin flip: the reader is looking at both. The band is shallow so a tall
 * section does not stay lit forever. When nothing overlaps it (above the first section, or at the page bottom,
 * where a short last section can never reach the band) the one current stop is activeStopIndex's, over the visible
 * stops sorted by top — tree order is not screen order, and that rule needs the latter.
 *
 * The LEAD is the current stop the marker moves to: not an ancestor of another current stop (a parent's section
 * holds its child's, so it would always win the band), then the larger share of the band, so a link just followed
 * leads, then the higher box, then tree order.
 */
export function railMarks(boxes: readonly StopBox[], vh: number, scrollY: number, docHeight: number): Marks {
  const top = vh * BAND.top;
  const bottom = vh * BAND.bottom;
  const overlap = (i: number): number => Math.min(boxes[i].bottom, bottom) - Math.max(boxes[i].top, top);
  const shown = boxes.flatMap((b, i) => (b.visible ? [i] : []));
  let current = shown.filter((i) => overlap(i) > 0);
  if (!current.length && shown.length) {
    const byTop = [...shown].sort((p, q) => boxes[p].top - boxes[q].top || p - q);
    current = [byTop[activeStopIndex(byTop.map((i) => boxes[i].top), vh, scrollY, docHeight)]];
  }
  const lit = new Set<number>();
  for (const i of current) {
    for (let p = boxes[i].parent; p !== null; p = boxes[p].parent) if (boxes[p].visible) lit.add(p);
  }
  const ancestors = [...lit].filter((i) => !current.includes(i)).sort((p, q) => p - q);
  const lead = [...current].sort((p, q) => Number(lit.has(p)) - Number(lit.has(q))
    || overlap(q) - overlap(p) || boxes[p].top - boxes[q].top || p - q)[0] ?? null;
  return { current, ancestors, lead };
}
