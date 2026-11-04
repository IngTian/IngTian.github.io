// src/data/papers/index.ts
// Each paper's computed data, keyed by its publication slug: `values`, the figures its prose quotes, and
// `figures`, the pictures drawn from its vendored data.
import { TABLE2, PAPER } from './rl-bhrp';
import { rlBhrpValues } from '../../lib/paperNumbers';

export const PAPER_DATA: Record<string, { values: Record<string, string>; figures: Record<string, string> }> = {
  'rl-bhrp': { values: rlBhrpValues(TABLE2, PAPER), figures: {} },
};
