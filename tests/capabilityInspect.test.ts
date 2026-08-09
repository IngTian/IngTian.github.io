// tests/capabilityInspect.test.ts
// A PRINTER, not an assertion suite. These breadth statistics would be shown on the page, so
// they get read before anything is drawn.
// Run: npx vitest run tests/capabilityInspect.test.ts

import { it, expect } from 'vitest';
import { profileConcentration, dimensionDepth } from '../src/lib/capability';
import { SIGNAL_WEIGHTS } from '../src/data/signalWeights';
import { loadings } from '../src/lib/factorModel';

it('prints the capability profile', () => {
  const p = profileConcentration(SIGNAL_WEIGHTS.signals);
  const depth = dimensionDepth(SIGNAL_WEIGHTS.signals, loadings(SIGNAL_WEIGHTS.signals));
  const out: string[] = [];

  out.push('=== BREADTH / CONCENTRATION ===');
  out.push(`  HHI                 ${p.hhi.toFixed(4)}   (1/n = ${(1 / p.total).toFixed(4)} even, 1 = all on one)`);
  out.push(`  effective dimensions ${p.effectiveN.toFixed(2)} of ${p.total}`);
  out.push(`  entropy             ${p.entropyBits.toFixed(3)} bits of ${Math.log2(p.total).toFixed(3)} max`);
  out.push(`  breadth (0..1)      ${p.breadth.toFixed(3)}`);
  out.push(`  dimensions covered  ${p.covered} of ${p.total}`);

  out.push('');
  out.push('=== SHARE vs DEPTH (the two axes a single fan hid) ===');
  out.push('  dimension        share   n   mean   peak');
  for (const d of [...depth].sort((a, b) => b.share - a.share)) {
    out.push(
      `  ${d.label.padEnd(16)} ${d.share.toFixed(3)}  ${String(d.count).padStart(2)}   ` +
      `${d.meanScore.toFixed(2)}   ${d.peakScore}`,
    );
  }

  // eslint-disable-next-line no-console
  console.log('\n' + out.join('\n') + '\n');
  expect(p.total).toBe(6);
});
