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
const CAM = { z: -2.5, y: 1.15, focal: 1.05, pitch: 0.30 } as const;

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

  // Labels: a LEADER LINE out to the frame's edge, then the text on a clear margin.
  //
  // A first pass put labels at the projected tips and they collided — six tips in a 150° arc
  // are simply not far enough apart, and stacking two lines of text at each made it worse.
  // Leader lines are the standard fix in technical illustration precisely because they
  // decouple where a label POINTS from where it SITS: tips stay where the geometry says,
  // text goes on a tidy vertical ladder in the margin where nothing can overlap.
  const withScreen = beams.map((b) => {
    const [tx, ty] = project(b.tip);
    return { b, tx, ty };
  });
  const left = withScreen.filter((s) => s.tx < W * 0.5).sort((a, c) => a.ty - c.ty);
  const right = withScreen.filter((s) => s.tx >= W * 0.5).sort((a, c) => a.ty - c.ty);

  // The ladder's x must leave room for the LONGEST label at its font size, or the right-hand
  // text clips at the frame edge — "MARKET REPORTS" at 21px mono is ~290px, which is what
  // overflowed a 150px margin. Measured from the label set rather than guessed.
  const longest = Math.max(...beams.map((b) => b.factor.label.length));
  const MARGIN = Math.ceil(longest * 12.6) + 24;
  const LADDER_TOP = 210;
  const LADDER_GAP = 116;
  const ladder = (rows: typeof withScreen, side: 'l' | 'r') =>
    rows.map((s, i) => {
      const ly = LADDER_TOP + i * LADDER_GAP;
      const lx = side === 'l' ? MARGIN : W - MARGIN;
      const anchor = side === 'l' ? 'end' : 'start';
      const beta = betaFor.get(s.b.factor.key) ?? 0;
      const zero = s.b.beta === 0;
      // elbow: out from the tip horizontally, then to the ladder row
      const midX = side === 'l' ? lx + 46 : lx - 46;
      return [
        `<path d="M${f2(s.tx)} ${f2(s.ty)}L${f2(midX)} ${f2(s.ty)}L${f2(midX)} ${f2(ly)}L${f2(lx + (side === 'l' ? 14 : -14))} ${f2(ly)}"`,
        ` stroke="var(--fan-leader)" stroke-width="1" fill="none" opacity="${zero ? 0.42 : 0.72}"/>`,
        `<circle cx="${f2(s.tx)}" cy="${f2(s.ty)}" r="3.5" fill="var(--fan-tip)" opacity="${zero ? 0.5 : 1}"/>`,
        `<text x="${f2(lx)}" y="${f2(ly - 9)}" text-anchor="${anchor}" class="fan-label"`,
        ` opacity="${zero ? 0.55 : 1}">${s.b.factor.label}</text>`,
        `<text x="${f2(lx)}" y="${f2(ly + 18)}" text-anchor="${anchor}" class="fan-beta"`,
        ` opacity="${zero ? 0.7 : 1}">β ${beta.toFixed(3)}${zero ? ' · not yet' : ''}</text>`,
      ].join('');
    }).join('');

  // NOTE: the equation is NOT drawn here. It is rendered as real KaTeX→MathML in the page
  // above this frame — hand-built SVG <tspan> maths reads as monospace text pretending to be
  // an equation, which is exactly what it looked like.
  // Text styling lives INSIDE the svg, for the same reason the palette is inline on the
  // wrapper: a class referenced only from a set:html string gets tree-shaken out of Astro's
  // scoped stylesheet, and the labels then render at the browser's default 16px serif.
  // Fonts still come from the site's tokens, so nothing is hardcoded twice.
  const style = `
  <style>
    .fan-label { font-family: var(--font-mono); font-size: 21px; letter-spacing: .1em;
                 text-transform: uppercase; fill: var(--paper); }
    .fan-beta  { font-family: var(--font-mono); font-size: 17px; fill: var(--ochre); }
  </style>`;

  return `
<svg viewBox="0 0 ${W} ${H}" class="proto-svg" role="img" aria-label="Factor exposure fan: one asset at the origin with six factor beams, each sized by its loading">
  ${style}
  <g>${rules.join('')}</g>
  <g>${shadows}</g>
  <g>${wedges}</g>
  ${origin}
  ${ladder(left, 'l')}
  ${ladder(right, 'r')}
</svg>`.trim();
}
