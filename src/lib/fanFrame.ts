// src/lib/fanFrame.ts
// The factor exposure fan, as a build-time SVG still.
//
// This is the owner's two-stage idea rendered: the expression r = α + Σ β_k f_k + ε, and the
// same terms expanded into a fan of beams. One asset at the origin, one beam per factor,
// beam AREA proportional to that factor's beta.
//
// WHY SVG BEFORE WebGL: the numbers are already locked and tested (factorModel.ts, 284
// tests), so the only open question is whether the picture is worth building in 3D. An SVG
// still answers that for the cost of one function, which is the same kill gate that let
// seriation and the simplex be judged cheaply instead of after five sessions.
//
// The projection here is the SAME maths a WebGL build would use — a perspective divide over
// the beam quads from factorModel.beamQuad — so the composition is representative rather
// than a mood board.

import { fanBeams, beamQuad, loadings, type Beam, type Vec3 } from './factorModel';

const W = 1600;
const H = 880;

/** Camera: back along −z, looking at the origin, slight downward pitch so the fan's dome
 *  reads. Same shape as podCamera's projection, kept local so this file has no dependency on
 *  the pod work that is being replaced. */
// MEASURED, not chosen. The first pass used z −4.6 / focal 1.02 / pitch 0.10, which squashed
// the whole fan into the middle third of the frame and stacked the tip labels on top of each
// other. Pulling the camera IN (−2.5) and lifting it (1.15) with a longer focal spreads the
// beams across the frame and separates the tips vertically as well as horizontally.
const CAM = { z: -2.5, y: 1.15, focal: 1.25, pitch: 0.30 } as const;

function project(p: Vec3): [number, number, number] {
  const yc = p.y - CAM.y;
  const zc = p.z - CAM.z;
  const cosP = Math.cos(CAM.pitch);
  const sinP = Math.sin(CAM.pitch);
  const y1 = yc * cosP + zc * sinP;
  const z1 = zc * cosP - yc * sinP;
  const z = Math.max(0.05, z1);
  const s = (CAM.focal * W) / z;
  return [W * 0.5 + p.x * s, H * 0.52 - y1 * s, z];
}

const f2 = (n: number) => (Math.round(n * 10) / 10).toString();
const pt = (p: Vec3) => { const [x, y] = project(p); return `${f2(x)} ${f2(y)}`; };

/** A beam's wedge as an SVG path. */
function beamPath(b: Beam): string {
  const [r0, t0, t1, r1] = beamQuad(b);
  return `M${pt(r0)}L${pt(t0)}L${pt(t1)}L${pt(r1)}Z`;
}

/** A ground shadow for a beam — the flattened wedge at y = 0. It is what stops the fan
 *  floating in a void, and it is honest: a real light would cast exactly this. */
function beamShadow(b: Beam): string {
  const [r0, t0, t1, r1] = beamQuad(b);
  const flat = (p: Vec3): Vec3 => ({ x: p.x, y: 0, z: p.z });
  return `M${pt(flat(r0))}L${pt(flat(t0))}L${pt(flat(t1))}L${pt(flat(r1))}Z`;
}

export function fanFrame(scored: readonly { id: string; label: string; score: number }[] | null = null): string {
  const beams = fanBeams();
  const ls = loadings(scored);
  const betaFor = new Map(ls.map((l) => [l.factor.key, l.beta]));

  // Painter's order: furthest first, so nearer beams overlap correctly.
  const ordered = [...beams].sort((a, b) => project(b.tip)[2] - project(a.tip)[2]);

  const shadows = ordered
    .map((b) => `<path d="${beamShadow(b)}" fill="var(--fan-shadow)" opacity="0.5"/>`)
    .join('');

  // Beams: a filled wedge plus a brighter leading edge, which is what gives a flat shape
  // the read of a solid object under light.
  const wedges = ordered.map((b) => {
    const zero = b.beta === 0;
    const [r0, t0, t1] = beamQuad(b);
    return [
      `<path d="${beamPath(b)}" fill="${zero ? 'var(--fan-zero)' : 'var(--fan-beam)'}"`,
      ` opacity="${zero ? 0.28 : 0.9}"/>`,
      `<path d="M${pt(r0)}L${pt(t0)}" stroke="var(--fan-edge)" stroke-width="1.4" fill="none" opacity="${zero ? 0.4 : 1}"/>`,
      `<path d="M${pt(t0)}L${pt(t1)}" stroke="var(--fan-tip)" stroke-width="${zero ? 1.4 : 2.6}" fill="none"/>`,
    ].join('');
  }).join('');

  // A ground ruling, so the plane the shadows fall on exists.
  const rules: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const r = i * 0.62;
    const seg: string[] = [];
    for (let k = 0; k <= 40; k++) {
      const a = -Math.PI * 0.62 + (k / 40) * Math.PI * 1.24;
      seg.push(`${k === 0 ? 'M' : 'L'}${pt({ x: Math.sin(a) * r, y: 0, z: Math.cos(a) * r })}`);
    }
    rules.push(`<path d="${seg.join('')}" stroke="var(--fan-rule)" stroke-width="1" fill="none" opacity="${0.5 - i * 0.06}"/>`);
  }

  // The asset: one mark at the origin. This is the ticker every beam loads onto.
  const [ox, oy] = project({ x: 0, y: 0, z: 0 });
  const origin =
    `<circle cx="${f2(ox)}" cy="${f2(oy)}" r="9" fill="var(--fan-asset)"/>` +
    `<circle cx="${f2(ox)}" cy="${f2(oy)}" r="17" stroke="var(--fan-asset)" stroke-width="1.2" fill="none" opacity="0.5"/>`;

  // Labels at each tip: the factor name and its beta. The number is the whole point — it is
  // what makes this a model rather than a decoration.
  const labels = beams.map((b) => {
    const [tx, ty] = project({ x: b.tip.x * 1.10, y: b.tip.y * 1.10 + 0.06, z: b.tip.z * 1.10 });
    const anchor = tx < W * 0.42 ? 'end' : tx > W * 0.58 ? 'start' : 'middle';
    const beta = betaFor.get(b.factor.key) ?? 0;
    return [
      `<text x="${f2(tx)}" y="${f2(ty)}" text-anchor="${anchor}" class="fan-label"`,
      ` opacity="${b.beta === 0 ? 0.55 : 1}">${b.factor.label}</text>`,
      `<text x="${f2(tx)}" y="${f2(ty + 26)}" text-anchor="${anchor}" class="fan-beta">`,
      `β = ${beta.toFixed(3)}${b.beta === 0 ? ' · coming' : ''}</text>`,
    ].join('');
  }).join('');

  // The expression, laid out so its terms read left to right in the fan's own order.
  const terms = [...beams]
    .sort((a, b) => a.azimuth - b.azimuth)
    .map((b) => {
      const beta = betaFor.get(b.factor.key) ?? 0;
      return `${beta.toFixed(2)}·f<tspan baseline-shift="sub" font-size="0.7em">${b.factor.symbol}</tspan>`;
    })
    .join(' + ');

  return `
<svg viewBox="0 0 ${W} ${H}" class="proto-svg" role="img" aria-label="Factor exposure fan: one asset at the origin with six factor beams, each sized by its loading">
  <text x="${W / 2}" y="76" text-anchor="middle" class="fan-expr">r<tspan baseline-shift="sub" font-size="0.7em">TIAN</tspan> = α + ${terms} + ε</text>
  <g>${rules.join('')}</g>
  <g>${shadows}</g>
  <g>${wedges}</g>
  ${origin}
  ${labels}
  <text x="${W / 2}" y="${H - 28}" text-anchor="middle" class="fan-caption">β = summed evidence score of a factor’s signals ÷ total · scored against a published rubric</text>
</svg>`.trim();
}
