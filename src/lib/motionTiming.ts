// The pure half of the motion module (scripts/motion.ts): the curves and the durations every move on the rail, the
// research routes, /art and /experience is made of, the one stagger formula and the paper page's batches made with
// it, and the arithmetic of a sweep laid along a run of text.
// Pure so it can be specified; the DOM half only measures and plays. CSS cannot import these, so
// tests/motionTiming.test.ts holds every curve and duration the rail's, the research routes', /art's and
// /experience's CSS states to them.

/** Every move: a quick start and a long settle. */
export const EASE = 'cubic-bezier(.2,.7,.2,1)';
/** A figure drawing itself: a gentle start, then the same long settle. */
export const DRAW = 'cubic-bezier(.33,.08,.24,1)';
/** A sweep along a run of lines: nearly linear, so it does not stall at each break. A sweep of one line takes EASE. */
export const SWEEP = 'cubic-bezier(.3,.2,.4,1)';
/** A fade: an opacity easing out. */
export const FADE = 'ease-out';
/** A withdrawal: a card's underline leaving, gathering speed as it goes. */
export const WITHDRAW = 'ease-in';

// ── The durations, in ms. ──

/** The longest any one move runs, and any batch of them seen together, from its first start to its last end. */
export const MOVE_MAX = 2000;

/** The research routes' reveal (riseOnceSeen): a block rises over `rise`; a margin note beside the text slides in
 *  over `beside`, `noteAfter` after its block; several seen together go `step` apart, the last at most `max` late. */
export const REVEAL = { rise: 340, beside: 380, noteAfter: 120, step: 60, max: 120 } as const;

/** The rail (SideRail.astro). Its entrance, in CSS: each row `row` long and `rowStep` after the one before, closer on
 *  a long rail, so that every row is in by `enter`. Between marks, its script: the lead's dash slides for `slide` and
 *  grows for `grow`, or grows in place over `growIn`, and a quiet mark fades over `fade`, as a label's inks
 *  cross-fade. A hovered or focused row's preview dash fades over `preview` and its label nudges over `nudge`. */
export const RAIL = { enter: 500, row: 180, rowStep: 40, slide: 280, grow: 160, growIn: 240, fade: 200, preview: 160, nudge: 160 } as const;

/** A paper page (pages/research/[slug].astro). A highlight sweeps in over `highlight`, `highlightAfter` after its
 *  block has risen and `highlightStep` after the one before it; a linked term's rule draws over `term`. Figure 2
 *  draws over `draw`, its end labels fading in over `labels`; Figure 1's arrows fade in over `arrow`, `arrowStep`
 *  apart. A margin note dims over `noteFade` and shifts toward its term over `noteShift`; a tip fades over `tip`. */
export const PAPER_PAGE = {
  highlight: 640, highlightAfter: 260, highlightStep: 200, term: 220, draw: 1600, labels: 360, arrow: 360, arrowStep: 120,
  noteFade: 200, noteShift: 240, tip: 120,
} as const;

/** When highlight `k` of `n` seen together starts to sweep, once its block has risen: `highlightAfter`, then
 *  `highlightStep` after the one before, closer on a long batch, so the last has swept within MOVE_MAX. */
export function highlightDelay(k: number, n: number): number {
  const { highlight, highlightAfter, highlightStep } = PAPER_PAGE;
  return highlightAfter + stagger(k, n, { step: highlightStep, total: MOVE_MAX - highlightAfter - highlight });
}

/** When arrow `k` of a figure's `n` starts to fade in: `arrowStep` after the one before, closer on a figure with
 *  many, so the last is in within MOVE_MAX. */
export function arrowDelay(k: number, n: number): number {
  return stagger(k, n, { step: PAPER_PAGE.arrowStep, total: MOVE_MAX - PAPER_PAGE.arrow });
}

/** The /research cards (pages/research/index.astro): a card lifts over `lift` and its frame fades in over `frame`;
 *  its title's underline draws in over `underline`, a line `underlineStep` after the one above, and withdraws over
 *  `underlineOut`; its miniature redraws over `redraw`. */
export const CARD = { lift: 260, frame: 200, underline: 320, underlineStep: 110, underlineOut: 200, redraw: 750 } as const;

/** /art (pages/art.astro): a phrase's work cross-fades onto the mat over `swap`, once it has decoded, as a sentence
 *  does into its turn; a photograph not yet loaded when the page's script starts fades in once over `tileFade`. */
export const ART = { swap: 300, tileFade: 600 } as const;

/** /experience (pages/experience.astro): on a panel's hover or focus its mark cross-fades from ink into its logo's
 *  colours over `mark`, and its enlarged mark fades in behind the panel over `ground`. */
export const EXPERIENCE = { mark: 320, ground: 420 } as const;

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

interface LineRect { left: number; right: number; top: number; bottom: number }

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
