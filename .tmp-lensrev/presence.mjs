// Does the SHIPPED presence rule support a model that is strongest AT REST?
import { smoothingAlpha } from '../src/lib/skyInteraction.ts';

// Replicate stepInteraction's presence + speed for: move at 430px/s, then STOP.
const VW = 1440;
const pxToSample = (px) => px / VW;

function sim({ moveSpeedPx = 430, moveFor = 1.5, restFor = 6.0, dt = 1 / 60, tauPos = 0.055 }) {
  let presence = 0, x = 0.5, vx = 0, rawX = 0.5, lastMoveT = 0, t = 0;
  const out = [];
  const total = moveFor + restFor;
  while (t < total) {
    const moving = t < moveFor;
    if (moving) { rawX += pxToSample(moveSpeedPx) * dt; lastMoveT = t; }
    const idleFor = t - lastMoveT;
    const want = idleFor < 1.2 ? 1 : 0;      // havePointer stays true
    presence += (want - presence) * smoothingAlpha(dt, want ? 0.18 : 0.42);
    const aPos = smoothingAlpha(dt, tauPos);
    const nx = x + (rawX - x) * aPos;
    const ivx = (nx - x) / dt;
    vx += (ivx - vx) * smoothingAlpha(dt, 0.12);
    x = nx;
    const speed = Math.abs(vx);
    const fade = 1 - 0.85 * Math.min(1, speed / 1.10);
    const Aeff = 0.16 * presence * fade;
    out.push({ t, presence, speed, fade, Aeff, lagPx: (rawX - x) * VW });
    t += dt;
  }
  return out;
}

const s = sim({});
console.log('t(s)   presence  speed(su/s)  fade   A_eff   lag(px)   [move 430px/s for 1.5s, then rest]');
for (const row of s) {
  const k = Math.round(row.t * 1000);
  if (k % 250 === 0 || k === 1500) {
    console.log(`${row.t.toFixed(2)}   ${row.presence.toFixed(3)}     ${row.speed.toFixed(3)}      ${row.fade.toFixed(3)}  ${row.Aeff.toFixed(4)}  ${row.lagPx.toFixed(0)}`);
  }
}
const peak = s.reduce((a, b) => (b.Aeff > a.Aeff ? b : a));
console.log(`\npeak A_eff = ${peak.Aeff.toFixed(4)} at t=${peak.t.toFixed(2)}s (nominal A = 0.16)`);
const rest = s.filter((r) => r.t > 1.5);
console.log(`A_eff at rest +0.5s: ${rest.find((r) => r.t > 2.0).Aeff.toFixed(4)}`);
console.log(`A_eff at rest +1.0s: ${rest.find((r) => r.t > 2.5).Aeff.toFixed(4)}`);
console.log(`A_eff at rest +2.0s: ${rest.find((r) => r.t > 3.5).Aeff.toFixed(4)}`);
console.log(`A_eff at rest +3.0s: ${rest.find((r) => r.t > 4.5).Aeff.toFixed(4)}`);
console.log(`A_eff at rest +4.0s: ${rest.find((r) => r.t > 5.5).Aeff.toFixed(4)}`);

// lag check across speeds, tau = 0.055 vs 0.085
console.log('\nsteady-state lag (px) = v*tau, R = 122px:');
for (const v of [430, 900, 1580, 2200, 2600]) {
  console.log(`  v=${v}px/s  tau0.055 -> ${(v * 0.055).toFixed(0)}px (${(v * 0.055 / 122).toFixed(2)}R)   tau0.085 -> ${(v * 0.085).toFixed(0)}px (${(v * 0.085 / 122).toFixed(2)}R)   fade=${(1 - 0.85 * Math.min(1, (v / 1440) / 1.10)).toFixed(3)} A_eff=${(0.16 * (1 - 0.85 * Math.min(1, (v / 1440) / 1.10))).toFixed(3)}`);
}
