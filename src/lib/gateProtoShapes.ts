// src/lib/gateProtoShapes.ts
//
// PROTOTYPE MATERIAL, for /proto-gate only. Four readings of "put a black hole on the gate", which came from the
// owner looking at a potential-flow frame and seeing something nobody had designed: "literally looks like a
// blackhole in the middle".
//
// WHY THESE ARE WORTH TRYING AT ALL, in one line: the homepage already carries a terrain field, a Bellman
// lattice, a 108-trajectory fan, a conflict web, a descent graph and typeset equations. The owner — "we've
// already had way too many math functions on the page" — is right that a seventh field adds nothing. A black
// hole is an OBJECT. It reads as a picture of a thing rather than as another exhibit, and it is the one object
// that makes the site's own name, "The Descent", literal.
//
// Each shape returns raw SVG children rather than a Trail[], because three of the four need circles and
// ellipses as well as paths. That is fine for an internal route and would need rethinking before any of them
// shipped — Gate.astro renders Trail[] and nothing else.
//
// Nothing here is tested beyond "it produces finite coordinates and no NaN" (tests/gateProtoShapes.test.ts).
// These are candidates for looking at, and three of them will be deleted; a candidate that survives earns real
// tests then, which is the same bargain lib/sketches/kit.ts makes for the showpiece harness.

export const SHAPE_VIEW_W = 640;
export const SHAPE_VIEW_H = 360;

const CX = SHAPE_VIEW_W / 2;
const CY = SHAPE_VIEW_H / 2;
/** Horizon radius in viewBox px. The void is filled with the page ground, so this is the edge of an absence. */
const RH = 46;

/** The shipped ramp, so these are judged at the same weights as everything else: 0.10 -> 0.80, 0.5 -> 1.9px. */
const ramp = (t: number): { o: string; w: string } => ({
  o: (0.1 + t * 0.7).toFixed(2),
  w: (0.5 + t * 1.4).toFixed(2),
});

/** The void and its horizon ring, shared by all four. `--bg` fill, so it is a hole and not a dark circle. */
function voidDisc(extra = ''): string {
  return `<circle cx="${CX}" cy="${CY}" r="${RH}" fill="var(--bg)" stroke="none"/>`
    + `<circle cx="${CX}" cy="${CY}" r="${RH}" fill="none" stroke="var(--ochre)"`
    + ` stroke-opacity="0.5" stroke-width="0.9"/>${extra}`;
}

const stroke = (d: string, o: string, w: string): string =>
  `<path d="${d}" fill="none" stroke="var(--ochre)" stroke-linecap="round"`
  + ` stroke-opacity="${o}" stroke-width="${w}"/>`;

/**
 * A — potential flow past a disc, as streamlines of psi = y(1 - a^2/r^2).
 *
 * Harmonic away from the disc, so the streamlines never cross and never close. Each line is found by solving
 * psi(x, y) = psi0 for y at each x with a few Newton steps, which is cheaper and steadier than integrating the
 * velocity field and cannot drift off its own level set.
 */
function flow(): string {
  const a2 = RH * RH;
  const N = 9, span = 34;
  const out: string[] = [];
  for (let k = 0; k < N; k++) {
    const psi0 = (k - (N - 1) / 2) * span;
    if (Math.abs(psi0) < 1) continue;            // the dividing streamline runs into the disc; skip it
    let d = '', open = false;
    for (let i = 0; i <= 260; i++) {
      const x = -SHAPE_VIEW_W * 0.62 + (i / 260) * SHAPE_VIEW_W * 1.24;
      let y = psi0;
      for (let s = 0; s < 24; s++) {
        const r2 = x * x + y * y;
        if (r2 < 1e-6) break;
        const f = y * (1 - a2 / r2) - psi0;
        const df = 1 - a2 / r2 + (2 * a2 * y * y) / (r2 * r2);
        if (Math.abs(df) < 1e-9) break;
        y -= f / df;
      }
      if (!isFinite(y) || x * x + y * y < RH * RH * 0.98) { open = false; continue; }
      d += `${open ? 'L' : 'M'}${(CX + x).toFixed(1)},${(CY - y).toFixed(1)}`;
      open = true;
    }
    const r = ramp(1 - Math.abs(psi0) / (((N - 1) / 2) * span));
    out.push(stroke(d, r.o, r.w));
  }
  return voidDisc(out.join(''));
}

/**
 * B — light deflected by a point mass, integrated.
 *
 * a = -k * r_hat / r^2 with the speed renormalised each step, which is Newtonian light bending: GR doubles the
 * angle but the SHAPE is the same, and the shape is the whole point. Three things fall out of the physics
 * rather than being drawn: rays bend TOWARD the mass, they cross behind it, and the innermost ones are
 * CAPTURED — their paths end at the horizon. Crossing is fine here; the knot problem was ever only many lines
 * converging on one point.
 */
function lens(): string {
  const K = 1900, N = 11, span = 30;
  const out: string[] = [];
  for (let k = 0; k < N; k++) {
    const b = (k - (N - 1) / 2) * span;
    if (Math.abs(b) < 6) continue;
    let x = -SHAPE_VIEW_W * 0.62, y = b, vx = 1, vy = 0, d = '', captured = false;
    for (let s = 0; s < 1400; s++) {
      const r2 = x * x + y * y, r = Math.sqrt(r2);
      if (r < RH) { captured = true; break; }
      vx += (-K * x) / (r2 * r) * 1.1;
      vy += (-K * y) / (r2 * r) * 1.1;
      const vm = Math.hypot(vx, vy);
      if (vm < 1e-9) break;
      vx /= vm; vy /= vm;
      x += vx * 1.6; y += vy * 1.6;
      if (Math.abs(x) > SHAPE_VIEW_W * 0.64 || Math.abs(y) > SHAPE_VIEW_H * 0.72) break;
      d += `${d ? 'L' : 'M'}${(CX + x).toFixed(1)},${(CY - y).toFixed(1)}`;
    }
    const r = ramp(1 - Math.abs(b) / (((N - 1) / 2) * span));
    out.push(stroke(d, captured ? (Number(r.o) * 0.8).toFixed(2) : r.o, r.w));
  }
  return voidDisc(out.join(''));
}

/** C — the void and two faint halos. No field, nothing computed: the literal answer to "do we need maths". */
function bare(): string {
  const halo = (mul: number, o: string, w: string): string =>
    `<circle cx="${CX}" cy="${CY}" r="${(RH * mul).toFixed(1)}" fill="none" stroke="var(--ochre)"`
    + ` stroke-opacity="${o}" stroke-width="${w}"/>`;
  return voidDisc(halo(1.5, '0.13', '0.6') + halo(2.6, '0.07', '0.5'));
}

/**
 * D — accretion disc with the far side lensed over the top.
 *
 * The familiar silhouette, and the least defensible of the four by this site's rules: the arcs are DRAWN at
 * chosen radii, not solved from anything. It is here to be looked at and almost certainly to be rejected.
 */
function disc(): string {
  const out: string[] = [];
  for (let k = 0; k < 7; k++) {
    const r = ramp(1 - (k / 6) * 0.75);
    const rx = RH * (1.55 + k * 0.42);
    const ry = rx * 0.17;
    out.push(`<ellipse cx="${CX}" cy="${CY}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="none"`
      + ` stroke="var(--ochre)" stroke-opacity="${r.o}" stroke-width="${r.w}"/>`);
    const lift = RH * (1.08 + k * 0.05);
    out.push(stroke(
      `M${(CX - rx).toFixed(1)},${CY} A${rx.toFixed(1)},${lift.toFixed(1)} 0 0 1 ${(CX + rx).toFixed(1)},${CY}`,
      (Number(r.o) * 0.85).toFixed(2), r.w,
    ));
  }
  return voidDisc(out.join(''));
}

export interface ProtoShape {
  key: string;
  label: string;
  note: string;
  svg: string;
}

export function protoShapes(): ProtoShape[] {
  return [
    {
      key: 'flow',
      label: 'Streamlines parting',
      note: 'ψ = y(1 − a²/r²). Harmonic away from the disc, so the lines part around the void and rejoin '
        + 'behind it without ever crossing or closing. Calmest of the four.',
      svg: flow(),
    },
    {
      key: 'lens',
      label: 'Gravitational lensing',
      note: 'Light integrated through a point mass. Rays bend toward it, cross behind it, and the innermost '
        + 'are captured — those paths end at the horizon. The physics draws it; nothing is placed by hand.',
      svg: lens(),
    },
    {
      key: 'bare',
      label: 'The void alone',
      note: 'A disc, a horizon ring, two halos. No field, no contours, nothing computed — the literal answer '
        + 'to whether the gate needs a function at all.',
      svg: bare(),
    },
    {
      key: 'disc',
      label: 'Accretion disc',
      note: 'The familiar silhouette, with the far side lifted over the top. Honest caveat: these arcs are '
        + 'drawn at chosen radii, not solved — which is the thing this site rejects five showpieces for.',
      svg: disc(),
    },
  ];
}
