// tests/escapeDiag.test.ts
// A PRINTER for the escape probe, kept because the rim distance was guessed wrong twice and a
// standalone script disagreed with the module. Run:
//   npx vitest run tests/escapeDiag.test.ts
// It asserts nothing about the values on purpose — the point is to READ them.

import { it, expect } from 'vitest';
import { escapeDirection } from '../src/lib/sensitivity';
import { WAYPOINTS } from '../src/lib/trajectory';

it('prints escape improvement per probe distance', () => {
  const swe = WAYPOINTS.find((w) => w.label.includes('Senior SWE'))!;
  const lines: string[] = ['climb  improvement    reached   angle'];
  for (const c of [0.2, 0.5, 0.9, 1.2, 1.35, 1.45, 1.5, 1.8, 2.2]) {
    const e = escapeDirection(swe.x, swe.y, { climbs: [c] });
    lines.push(
      `${c.toFixed(2).padStart(5)}  ${e.improvement.toFixed(6).padStart(11)}  ` +
      `${e.reachedDepth.toFixed(4).padStart(9)}  ${e.angleDeg.toFixed(0).padStart(5)}`,
    );
  }
  // eslint-disable-next-line no-console
  console.log('\n' + lines.join('\n') + '\n');
  expect(WAYPOINTS.length).toBeGreaterThan(0);
});
