// Does a CSS 3D transform reproduce lib/terrain.ts's project() EXACTLY?
// terrain.ts: YAW = PI*0.18, TILT = 0.92; orthographic (no perspective divide).
const YAW = Math.PI * 0.18, TILT = 0.92;
const cosY = Math.cos(YAW), sinY = Math.sin(YAW), cosT = Math.cos(TILT), sinT = Math.sin(TILT);

// verbatim from src/lib/terrain.ts projectRaw()
function projectRaw(x, y, z) {
  const rx = x * cosY - y * sinY;
  const ry = x * sinY + y * cosY;
  return { ix: rx, uy: ry * cosT - z * sinT, depth: ry * sinT + z * cosT };
}

// CSS: rotateX(a) rotateZ(b) applied to (u,v,w) = (x, -y, z), orthographic.
// CSS y is DOWN, so screen-up = -y''.
function cssProject(x, y, z, a, b) {
  const u = x, v = -y, w = z;
  const x1 = u * Math.cos(b) - v * Math.sin(b);
  const y1 = u * Math.sin(b) + v * Math.cos(b);
  const z1 = w;
  const x2 = x1;
  const y2 = y1 * Math.cos(a) - z1 * Math.sin(a);
  const z2 = y1 * Math.sin(a) + z1 * Math.cos(a);
  return { sx: x2, up: -y2, depth: z2 };
}

const a = -TILT, b = -YAW;
let maxErrX = 0, maxErrY = 0, maxErrD = 0;
for (let i = 0; i < 4000; i++) {
  const x = (Math.random() * 2 - 1) * 2.6, y = (Math.random() * 2 - 1) * 2.6, z = (Math.random() * 2 - 1) * 1.7;
  const t = projectRaw(x, y, z);
  const c = cssProject(x, y, z, a, b);
  maxErrX = Math.max(maxErrX, Math.abs(t.ix - c.sx));
  maxErrY = Math.max(maxErrY, Math.abs(t.uy - c.up));
  maxErrD = Math.max(maxErrD, Math.abs(t.depth - c.depth));
}
console.log('CSS rotateX(%s deg) rotateZ(%s deg), orthographic', (a * 180 / Math.PI).toFixed(4), (b * 180 / Math.PI).toFixed(4));
console.log('max |err| screenX=%s  screenUp=%s  depth=%s', maxErrX.toExponential(2), maxErrY.toExponential(2), maxErrD.toExponential(2));

// How much does adding CSS perspective(P) deviate from the orthographic match?
// A point at depth d (px, toward viewer) is magnified by P/(P-d).
for (const P of [800, 1200, 2000, 4000]) {
  const dmax = 260; // px of Z travel we would actually use
  console.log(`perspective ${P}px, +/-${dmax}px Z: magnification ${(P/(P-dmax)).toFixed(3)}x near, ${(P/(P+dmax)).toFixed(3)}x far`);
}
