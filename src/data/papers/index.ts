// src/data/papers/index.ts
// Each paper's computed data, keyed by its publication slug: `values`, the figures its prose quotes; `figures`,
// the pictures drawn from its vendored data, which its file inlines by name; and `thumb`, the picture its index
// card shows, for a paper that has one.
import { TABLE2, PAPER, REPRO } from './rl-bhrp';
import { pipelineFigure } from '../../lib/paperFigures/pipelineFigure';
import { wealthFigure } from '../../lib/paperFigures/wealthFigure';
import { rlBhrpValues } from '../../lib/paperNumbers';

export const PAPER_DATA: Record<string, { values: Record<string, string>; figures: Record<string, string>; thumb?: string }> = {
  'rl-bhrp': {
    values: rlBhrpValues(TABLE2, PAPER, REPRO),
    figures: { wealth: wealthFigure(REPRO, 'full'), pipeline: pipelineFigure() },
    thumb: wealthFigure(REPRO, 'mini'),
  },
};
