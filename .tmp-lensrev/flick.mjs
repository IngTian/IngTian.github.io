import { smoothingAlpha } from '../src/lib/skyInteraction.ts';
const VW = 1440;

function sim({ vPx, dt = 1 / 60, dur = 0.5, tauPos = 0.055 }) {
  let presence = 1, x = 0.5, vx = 0, rawX = 0.5, t = 0;
  const rows = [];
  while (t < dur) {
    rawX += (vPx / VW) * dt;
    const aPos = smoothingAlpha(dt, tauPos);
    const nx = x + (rawX - x) * aPos;
    const ivx = (nx - x) / dt;
    vx += (ivx - vx) * smoothingAlpha(dt, 0.12);
    x = nx;
    const speed = Math.abs(vx);
    const Aeff = 0.16 * presence * (1 - 0.85 * Math.min(1, speed / 1.10));
    rows.push({ t, speed, Aeff, lagPx: (rawX - x) * VW, sweptPx: 0 });
    t += dt;
  }
  return rows;
}

console.log('FLICK ONSET at 2600 px/s — steady-state A_eff should be 0.024.');
console.log('t(ms)  speed(su/s)  A_eff   lag(px)  lag/R  (R=122px)');
for (const r of sim({ vPx: 2600 })) {
  const ms = Math.round(r.t * 1000);
  if (ms <= 200 && ms % 16 < 17 && ms % 33 < 17) {
    console.log(`${String(ms).padStart(4)}    ${r.speed.toFixed(3)}      ${r.Aeff.toFixed(4)}   ${r.lagPx.toFixed(0)}     ${(r.lagPx / 122).toFixed(2)}`);
  }
}
const f = sim({ vPx: 2600 });
// how long is A_eff above half of its resting value (0.08) during a flick?
const above = f.filter((r) => r.Aeff > 0.08);
console.log(`\nA_eff > 0.08 (half of rest) for the first ${(above.length / 60 * 1000).toFixed(0)}ms of the flick`);
console.log(`during which the cursor travels ${(2600 * above.length / 60).toFixed(0)}px = ${(2600 * above.length / 60 / 122).toFixed(1)}R`);
const a50 = f.find((r) => r.Aeff < 0.048);
console.log(`A_eff drops below 0.048 (2x rest floor) at t = ${(a50.t * 1000).toFixed(0)}ms`);

console.log('\nSTEADY-STATE A_eff vs pointer speed (perceptibility window):');
for (const v of [0, 25, 50, 100, 200, 430, 700, 900, 1200, 1580, 2600]) {
  const su = v / VW;
  const A = 0.16 * (1 - 0.85 * Math.min(1, su / 1.10));
  console.log(`  ${String(v).padStart(4)} px/s -> speed ${su.toFixed(3)} su/s, A_eff ${A.toFixed(4)} (${(A / 0.16 * 100).toFixed(0)}% of nominal)`);
}
