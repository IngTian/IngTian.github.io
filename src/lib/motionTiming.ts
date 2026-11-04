// The pure half of the motion module (scripts/motion.ts): the curves, the one stagger formula, and the arithmetic of
// a sweep laid along a run of text. Pure so it can be specified; the DOM half only measures and plays.

/** Every move: a quick start and a long settle. */
export const EASE = 'cubic-bezier(.2,.7,.2,1)';
/** A figure drawing itself: a gentle start, then the same long settle. */
export const DRAW = 'cubic-bezier(.33,.08,.24,1)';

/** The rail's entrance: every row in within this. It is also how long the rail waits hidden for its script before it
 *  shows at rest instead, since an entrance that started later would end after it was meant to. */
export const RAIL_ENTER_MS = 500;

/**
 * The delay of item `i` of `n` entering together: `step` apart; closer when that would start the last item after
 * `total` (so everything starts within `total`, whatever `n` is); and never more than `max` late.
 */
export function stagger(i: number, n: number, opts: { step: number; total?: number; max?: number }): number {
  const { step, total = Infinity, max = Infinity } = opts;
  const gap = n > 1 ? Math.min(step, total / (n - 1)) : 0;
  return Math.min(i * gap, max);
}

/** Durations for a sweep along lines of these widths, played one after another: each line's share of `total` is its
 *  share of the width, so the sweep moves at one speed across a line break. Sums to `total` exactly. */
export function sweepDurations(widths: readonly number[], total: number): number[] {
  if (!widths.length) return [];
  const sum = widths.reduce((s, w) => s + w, 0);
  const d = widths.map((w) => (sum > 0 ? (total * w) / sum : total / widths.length));
  d[d.length - 1] = total - d.slice(0, -1).reduce((s, x) => s + x, 0);
  return d;
}

export interface LineRect { left: number; right: number; top: number; bottom: number }

/** One box per line of a run of inline text. getClientRects() returns a rect per fragment, and a line breaks into
 *  several around an inline child (a nowrap span, an equation), so fragments sharing a baseline merge; slivers of
 *  half a pixel or less are dropped. Top to bottom, as given. */
export function mergeLines(rects: readonly LineRect[]): { left: number; top: number; width: number; height: number }[] {
  const lines: LineRect[] = [];
  for (const r of rects) {
    if (r.right - r.left <= 0.5) continue;
    const l = lines.find((q) => Math.abs(q.bottom - r.bottom) < (r.bottom - r.top) / 2);
    if (l) {
      l.left = Math.min(l.left, r.left); l.right = Math.max(l.right, r.right);
      l.top = Math.min(l.top, r.top); l.bottom = Math.max(l.bottom, r.bottom);
    } else {
      // Named, not spread: a DOMRect's edges are getters on its prototype, and a spread copies none of them.
      lines.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom });
    }
  }
  return lines.map((l) => ({ left: l.left, top: l.top, width: l.right - l.left, height: l.bottom - l.top }));
}
