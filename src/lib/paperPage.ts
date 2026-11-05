// src/lib/paperPage.ts
// The pure half of the paper page's script (pages/research/[slug].astro): where the margin notes go, and what
// Figure 2's readout reads, says and tells a reader it does. The script measures and paints; this decides. Pure.
import { longDate, monthYear } from './dates';

/**
 * Margin notes, each at its anchor's top unless the note above it has not ended: then a `gap` below that one, so
 * no two overlap. They stack in the order their anchors appear on the page, which is not always the document's (an
 * equation's note is written after its where's notes, for a phone to read them in that order, but sits above them,
 * beside the display). Placed tops, in the order given.
 */
export function stackNotes(items: readonly { top: number; height: number }[], gap: number): number[] {
  const out = new Array<number>(items.length);
  let floor = -Infinity;
  for (const k of items.map((_, i) => i).sort((a, b) => items[a].top - items[b].top)) {
    out[k] = Math.max(items[k].top, floor);
    floor = out[k] + items[k].height + gap;
  }
  return out;
}

/** The point nearest `x` in a plot whose `points` run evenly from x0 to x1. */
export function readoutIndex(x: number, x0: number, x1: number, points: number): number {
  return Math.max(0, Math.min(points - 1, Math.round(((x - x0) / (x1 - x0)) * (points - 1))));
}

/** What the plot tells a reader who reaches it, set by the script that makes the readout work: every way it reads,
 *  each key as readoutStep handles it. */
export const READOUT_LABEL = 'Plot of Figure 2. Hover or tap it to read the values at a month; with the keyboard, the left '
  + 'and right arrow keys step a month, a year with Shift, and Home and End go to the first and the last.';

/** Where a key moves the readout from `at`: a month an arrow, a year with Shift, an end Home or End; null for any
 *  other key, which the readout leaves to the page. */
export function readoutStep(at: number, key: string, shift: boolean, points: number): number | null {
  const step = { ArrowLeft: -1, ArrowRight: 1, Home: -points, End: points }[key];
  if (step === undefined) return null;
  return Math.max(0, Math.min(points - 1, at + (shift && Math.abs(step) === 1 ? step * 12 : step)));
}

/** What point `i` is: the start of the first month, a month's end, or (the last, a partial month) the day the data
 *  end. `dates` are the month-ends; point i > 0 is dates[i - 1]. Figure 2's table of values heads each row with it
 *  (lib/paperFigures/wealthFigure), and the readout prints the row. */
export function readoutWhen(i: number, dates: readonly string[], dataEnd: string): string {
  if (i === 0) return `Start of ${monthYear(dates[0])}`;
  if (i === dates.length) return `${longDate(dataEnd)}, where the data end`;
  return `End of ${monthYear(dates[i - 1])}`;
}

/** What the readout says at a point, for a reader who hears it rather than sees the tip: the same reading, and
 *  whose it is, as the tip's date line says, since each value alone would pass for the paper's. `v` is each value
 *  as the tip prints it. */
export function readoutSays(when: string, runs: string, v: Record<'rl' | 'lo' | 'hi' | 'bhrp' | 'bench', string>): string {
  return `${when}, reproduction: RL-BHRP, ${runs}, ${v.rl} (the runs ${v.lo} to ${v.hi}); BHRP ${v.bhrp}; Benchmark ${v.bench}.`;
}

/** The readout's tip, `tw` wide, centred on `px` and kept inside a plot `width` wide: floored, so a fraction can
 *  never carry it past the right edge. */
export function tipLeft(px: number, tw: number, width: number): number {
  return Math.floor(Math.max(0, Math.min(width - tw, px - tw / 2)));
}
