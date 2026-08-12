// tests/perfDiag.test.ts
// A PRINTER for the per-frame cost of the descent draw. The animation measured 0.6 fps in the browser
// (mean 1758ms per frame) — "like a powerpoint" — and contour caching was already in place, so the
// cost is elsewhere. Count the actual work instead of guessing.
//   npx vitest run tests/perfDiag.test.ts

import { it, expect } from 'vitest';
import { contours, contourLevels, trail } from '../src/lib/descentPath';
import { walkerKnownness, walkerKnowledge } from '../src/lib/knowledge';

it('prints where a frame\'s time goes', () => {
  const lines: string[] = [];

  const levels = contourLevels(11);
  const t0 = performance.now();
  const runs = levels.map((lv) => contours(lv, 150));
  const tContours = performance.now() - t0;
  const totalPts = runs.flat().reduce((s, r) => s + r.length, 0);
  lines.push(`contours (11 levels, res 150)   ${tContours.toFixed(0)}ms   ${runs.flat().length} runs, ${totalPts} points`);

  const pts = trail();
  const pathAt = (t: number) => {
    const i = Math.min(pts.length - 1, Math.max(0, Math.round(t * (pts.length - 1))));
    return { x: pts[i].x, y: pts[i].y };
  };

  // How many discs does the frontier hold at full reveal, and how big is one knownness call?
  const discs = walkerKnowledge(1, pathAt);
  lines.push(`frontier discs at full reveal   ${discs.length}`);

  const t1 = performance.now();
  let n = 0;
  for (const run of runs.flat()) {
    for (const p of run) {
      walkerKnownness(p[0], p[1], 1, pathAt);
      n++;
    }
  }
  const tKnown = performance.now() - t1;
  lines.push(`walkerKnownness over all pts    ${tKnown.toFixed(0)}ms   ${n} calls`);
  lines.push(`  => per call                   ${(tKnown / Math.max(1, n) * 1000).toFixed(1)}us`);
  lines.push(`  => distance checks per frame  ${(n * discs.length).toLocaleString()}`);
  lines.push('');
  lines.push(`ESTIMATED FRAME COST            ${tKnown.toFixed(0)}ms  (contours are cached after frame 1)`);

  // eslint-disable-next-line no-console
  console.log('\n' + lines.join('\n') + '\n');
  expect(runs.length).toBe(11);
});
