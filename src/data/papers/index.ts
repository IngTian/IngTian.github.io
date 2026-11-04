// src/data/papers/index.ts
// Each paper's computed data, keyed by its publication slug: `values`, the figures its prose quotes; `figures`,
// the drawings and tables made from its data, which its file places by name in a :::figure; and `thumb`, the
// picture its index card shows, for a paper that has one.
import { TABLE2, PAPER, REPRO, REPRO_NOTES } from './rl-bhrp';
import { metricsTable } from '../../lib/paperFigures/metricsTable';
import { pipelineFigure } from '../../lib/paperFigures/pipelineFigure';
import { wealthFigure } from '../../lib/paperFigures/wealthFigure';
import { rlBhrpValues } from '../../lib/paperNumbers';

export const PAPER_DATA: Record<string, { values: Record<string, string>; figures: Record<string, string>; thumb?: string }> = {
  'rl-bhrp': {
    values: rlBhrpValues(TABLE2, PAPER, REPRO, REPRO_NOTES),
    figures: { wealth: wealthFigure(REPRO, 'full'), pipeline: pipelineFigure(), metrics: metricsTable(TABLE2) },
    thumb: wealthFigure(REPRO, 'mini'),
  },
};
