// src/data/papers/index.ts
// Each paper's computed data, keyed by its publication slug: `values`, the figures its prose quotes; `figures`,
// the drawings and tables made from its data, which its file places by name in a :::figure; `line`, what the
// homepage appendix says of it, for a paper whose line quotes its numbers; and `thumb`, the picture its /research
// card shows, for a paper that has one: the drawing, its caption, and the short tag a phone card shows in the
// caption's place.
import { TABLE2, PAPER, REPRO, VALUES, paperValue } from './rl-bhrp';
import { authorName, publications } from '../profile';
import { monthYear } from '../../lib/dates';
import { metricsTable } from '../../lib/paperFigures/metricsTable';
import { pipelineFigure } from '../../lib/paperFigures/pipelineFigure';
import { wealthFigure } from '../../lib/paperFigures/wealthFigure';
import { FIGURE_NAME } from '../../lib/paperMarkdown/names';
import type { PaperData } from '../../lib/paperMarkdown';
import { authorRole } from '../../lib/paperPage';

/** The owner's place among a record's authors, as its page's "written by" line says it: whose reproduction it is. */
const reproducedBy = (slug: string) => authorRole(publications.find((p) => p.slug === slug)!.authors, authorName);

export const PAPER_DATA: Record<string, PaperData & { line?: string; thumb?: { svg: string; caption: string; tag: string } }> = {
  'rl-bhrp': {
    values: VALUES,
    // Figure 2 is named by the :::figure that places it (FIGURE_NAME)
    figures: {
      wealth: wealthFigure(REPRO, 'full', { name: FIGURE_NAME, author: reproducedBy('rl-bhrp') }),
      pipeline: pipelineFigure(),
      metrics: metricsTable(TABLE2),
    },
    // The homepage's only numbers, and on a quant's site the most checkable claim on it: what $1 became over the
    // stated window, and the Sharpe against the static comparator. Both are the paper's Table 2, as VALUES prints
    // them, so the line cannot drift from the table.
    line: `$1 → ${paperValue('usd.rl')}, ${monthYear(PAPER.start, 'short')} – ${monthYear(PAPER.end, 'short')}`
      + ` · Sharpe ${paperValue('sharpe.rl')} vs ${paperValue('sharpe.bhrp')} BHRP`,
    thumb: {
      svg: wealthFigure(REPRO, 'mini'),
      caption: `Growth of $1 in ${reproducedBy('rl-bhrp')}’s reproduction, not the paper’s run`,
      tag: 'Growth of $1 · reproduction',
    },
  },
};
