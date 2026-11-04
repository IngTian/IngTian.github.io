// src/data/papers/index.ts
// Each paper's computed data, keyed by its publication slug: `values`, the figures its prose quotes; `figures`,
// the drawings and tables made from its data, which its file places by name in a :::figure; and `thumb`, the
// picture its /research card shows, for a paper that has one: the drawing, its caption, and the short tag a phone
// card shows in the caption's place.
import { TABLE2, PAPER, REPRO, REPRO_NOTES } from './rl-bhrp';
import { metricsTable } from '../../lib/paperFigures/metricsTable';
import { pipelineFigure } from '../../lib/paperFigures/pipelineFigure';
import { wealthFigure } from '../../lib/paperFigures/wealthFigure';
import { rlBhrpValues } from '../../lib/paperNumbers';
import type { PaperData } from '../../lib/paperMarkdown';

export const PAPER_DATA: Record<string, PaperData & { thumb?: { svg: string; caption: string; tag: string } }> = {
  'rl-bhrp': {
    values: rlBhrpValues(TABLE2, PAPER, REPRO, REPRO_NOTES),
    figures: { wealth: wealthFigure(REPRO, 'full'), pipeline: pipelineFigure(), metrics: metricsTable(TABLE2) },
    thumb: {
      svg: wealthFigure(REPRO, 'mini'),
      caption: 'Growth of $1 in the second author’s reproduction, not the paper’s run',
      tag: 'Growth of $1 · reproduction',
    },
  },
};
