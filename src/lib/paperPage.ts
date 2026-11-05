// src/lib/paperPage.ts
// The paper page's pure half (pages/research/[slug].astro): the prose its frontmatter writes round the file (the
// owner's place among the authors, a reference's names, the note on the references), where its script puts the
// margin notes, and what Figure 2's readout reads, says and tells a reader it does. The page measures, paints and
// prints; this decides. Pure.
import { longDate, monthYear } from './dates';

const NUMBER = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];
/** A count as prose writes it: in words to twelve, in figures past. */
const count = (n: number) => NUMBER[n] ?? String(n);
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** "A", "A and B", "A, B and C". */
export function listed(xs: readonly string[]): string {
  return xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : xs[0];
}

/** An author written "Family, Given", as a reference list reads it: "Given Family". */
export function givenFirst(author: string): string {
  const [family, given] = author.split(', ');
  return `${given} ${family}`;
}

/** Who the owner is to the paper, for "written by …, the second author": his place among several, or its author. */
export function authorRole(authors: readonly { name: string }[], owner: string): string {
  const i = authors.findIndex((a) => a.name === owner);
  if (i < 0 || !ORDINAL[i]) throw new Error(`"${owner}" is not one of the paper's first ${ORDINAL.length} authors`);
  return authors.length > 1 ? `the ${ORDINAL[i]} author` : 'its author';
}

/** The note above the page's references: how its list stands to the paper's bibliography. `fromPaper` of the
 *  references are works in the bibliography, `omits` describes each work of it the page does not draw on, and
 *  `added` are works the paper names in its text without citing. */
export function referenceNote(fromPaper: number, omits: readonly string[], added: number): string {
  const total = fromPaper + omits.length;
  const named = `${count(added)} ${added === 1 ? 'work' : 'works'} it names in its text without citing`;
  if (!fromPaper) {
    const bibliography = total ? `None of the paper’s bibliography is drawn on here (${omits.join('; ')})` : 'The paper has no bibliography';
    return `${bibliography}${added ? `; listed here, ${named}` : ''}.`;
  }
  const of = fromPaper === total
    ? (total === 1 ? 'The one work' : `All ${count(total)} works`)
    : `${cap(count(fromPaper))} of the ${count(total)} works`;
  const left = omits.length > 1 ? ` (the others, ${omits.join('; ')}, are not drawn on here)`
    : omits.length ? ` (the ${ORDINAL[fromPaper] ?? 'other'}, ${omits[0]}, is not drawn on here)` : '';
  return `${of} in the paper’s bibliography${left}${added ? `, plus ${count(added)} it names in its text without citing` : ''}.`;
}

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
