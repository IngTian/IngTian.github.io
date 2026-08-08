// tests/factorInspect.test.ts
// Not an assertion suite — a PRINTER. The betas are claims about a real record that will be
// rendered on the page, so they get looked at before anything is drawn. Run with
// `npx vitest run tests/factorInspect.test.ts --reporter=basic` to read them.
//
// Kept as a test rather than a script because it needs the same TS/vite resolution as the
// module under inspection, and because a stale scratch script in /tmp is how numbers drift
// away from the code that produced them.

import { it, expect } from 'vitest';
import { loadings, fanBeams, signals, expressionTerms } from '../src/lib/factorModel';

it('prints the model the page would render', () => {
  const ls = loadings();
  const lines: string[] = [];

  lines.push('=== LOADINGS (beta = factor weight / total weight) ===');
  for (const l of ls) {
    const bar = '#'.repeat(Math.round(l.beta * 56));
    lines.push(
      `  ${l.factor.label.padEnd(16)} beta ${l.beta.toFixed(3)}  n=${String(l.count).padStart(2)}` +
      `  raw=${String(l.raw).padStart(3)}  ${bar}`,
    );
  }
  lines.push(`  sum = ${ls.reduce((s, l) => s + l.beta, 0).toFixed(6)}`);

  lines.push('');
  lines.push('=== FAN LAYOUT (left to right) ===');
  for (const b of [...fanBeams()].sort((a, c) => a.azimuth - c.azimuth)) {
    lines.push(
      `  ${b.factor.label.padEnd(16)} az ${(b.azimuth * 180 / Math.PI).toFixed(0).padStart(4)}deg` +
      `  el ${(b.elevation * 180 / Math.PI).toFixed(0).padStart(2)}deg` +
      `  len ${b.length.toFixed(2)}  halfW ${b.halfWidth.toFixed(3)}  tipZ ${b.tip.z.toFixed(2)}`,
    );
  }

  lines.push('');
  lines.push('=== THE EXPRESSION, in fan order ===');
  const terms = expressionTerms();
  lines.push(
    '  r = a + ' + terms.map((t) => `${t.beta.toFixed(2)}f_${t.symbol}`).join(' + ') + ' + e',
  );

  lines.push('');
  const byF: Record<string, number> = {};
  for (const s of signals()) byF[s.factor] = (byF[s.factor] ?? 0) + 1;
  lines.push(`=== SIGNALS PER FACTOR === ${JSON.stringify(byF)}`);

  // eslint-disable-next-line no-console
  console.log('\n' + lines.join('\n') + '\n');
  expect(ls).toHaveLength(6);
});
