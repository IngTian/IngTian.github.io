// Faithful JS port of skyShader.ts fragment pipeline (light theme, both variants).
const fract = (x) => x - Math.floor(x);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const mix = (a, b, t) => a + (b - a) * t;
function smoothstep(e0, e1, x) { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }

// GLSL: p = fract(p * vec2(443.897,441.423)); p += dot(p, p + 19.19); return fract(p.x*p.y);
function hash(pxi, pyi) {
  let x = fract(pxi * 443.897), y = fract(pyi * 441.423);
  const d = x * (x + 19.19) + y * (y + 19.19);
  x += d; y += d;
  return fract(x * y);
}
function noise(px, py) {
  const ix = Math.floor(px), iy = Math.floor(py);
  const fx = px - ix, fy = py - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return mix(mix(hash(ix, iy), hash(ix + 1, iy), ux), mix(hash(ix, iy + 1), hash(ix + 1, iy + 1), ux), uy);
}
function fbm(px, py) { let v = 0, a = 0.5; for (let i = 0; i < 5; i++) { v += a * noise(px, py); px *= 2.02; py *= 2.02; a *= 0.5; } return v; }

const DESCENT_LIGHT = [[0, '#f4efe4'], [0.08, '#f0eadf'], [0.15, '#efe6d4'], [0.23, '#e2d2c2'], [0.3, '#ccc4b6'], [0.37, '#a6a8ad'], [0.44, '#7d7e88'], [0.52, '#565660'], [0.62, '#3a3833'], [0.78, '#2a2720'], [0.9, '#1d1b16'], [1.0, '#16140f']];
const READING_LIGHT = [[0, '#f4efe4'], [0.24, '#f1ebe0'], [0.48, '#efe6d4'], [0.74, '#e7ddce'], [1.0, '#dcd5cf']];
const DESCENT_DARK = [[0.0, '#16191d'], [0.2, '#131619'], [0.4, '#111417'], [0.6, '#0e1013'], [0.8, '#0b0d0f'], [1.0, '#08090b']];
const hx = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function buildRamp(stops, N = 512) {
  const out = new Float64Array(N * 3);
  for (let i = 0; i < N; i++) {
    const t = (i + 0.5) / N;
    let k = 0; while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
    const [p0, c0] = stops[k], [p1, c1] = stops[k + 1];
    const u = clamp((t - p0) / (p1 - p0), 0, 1);
    const a = hx(c0), b = hx(c1);
    for (let c = 0; c < 3; c++) out[i * 3 + c] = mix(a[c], b[c], u) / 255;
  }
  return out;
}
function sampleRamp(ramp, y, N = 512) {
  const x = clamp(y, 0, 1) * N - 0.5;
  const i0 = clamp(Math.floor(x), 0, N - 1), i1 = clamp(i0 + 1, 0, N - 1);
  const f = clamp(x - Math.floor(x), 0, 1);
  return [0, 1, 2].map((c) => mix(ramp[i0 * 3 + c], ramp[i1 * 3 + c], f));
}
const RAMP_D = buildRamp(DESCENT_LIGHT), RAMP_R = buildRamp(READING_LIGHT), RAMP_DK = buildRamp(DESCENT_DARK);

// ---- the PROPOSED lens ----
export function lensOffset(uvx, syNow, P) {
  if (!P.on || P.presence < 0.001) return [0, 0];
  const dx = uvx - P.px, dy = syNow - P.py;
  const dist = Math.hypot(dx, dy) + 1e-6;
  const R = (P.R ?? 0.085) * mix(1, 0.62, P.reading);
  let A = (P.A ?? 0.16) * mix(1, 0.85, P.reading);
  A *= P.presence * (1 - (P.fade ?? 0.85) * Math.min(1, P.speed / (P.sat ?? 1.10)));
  const u = dist / R;
  if (u >= 1) return [0, 0];
  const s = 1 - u * u, w = s * s * s;
  return [-dx * (A * w), -dy * (A * w)];
}
// ---- the SHIPPED (today's) lens, mode 1 ----
export function lensOffsetOld(uvx, syNow, P) {
  if (!P.on || P.presence < 0.001) return [0, 0];
  const dx = uvx - P.px, dy = syNow - P.py;
  const dist = Math.hypot(dx, dy) + 1e-6;
  const R = 0.115;
  const k = 1 - smoothstep(0, R, dist);
  const s = k * k * 1.45 * P.presence;
  return [-(dx / dist) * dist * s, -(dy / dist) * dist * s];
}

export function renderFrame(cfg) {
  const { W, H, uTime, uYOffset, uYSpan, uDepth0, uDepthSpan, uGateTop, uGateDark, uGateLight,
    uReading, uAmp, uTintCap, uViscousFloor, uDark = 0, ptr, lens = lensOffset } = cfg;
  const ramp = uReading > 0.5 ? RAMP_R : (uDark > 0.5 ? RAMP_DK : RAMP_D);
  const img = new Float64Array(W * H * 3);
  const t = uTime * 0.55 * mix(1, 1.35, uReading);
  const freqK = mix(1, 1.9, uReading), yStretch = mix(1, 1.35, uReading);
  for (let j = 0; j < H; j++) {
    const vuy = (j + 0.5) / H;
    const sy = uYOffset + (1 - vuy) * uYSpan;
    const depth = clamp(uDepth0 + (1 - vuy) * uDepthSpan, 0, 1);
    const zone = mix(smoothstep(uGateTop, uGateTop + 0.10, depth), 1, uReading);
    const gateDark = mix(1, uGateDark, zone), gateLight = mix(1, uGateLight, zone);
    const topLift = 1 - smoothstep(0.02, 0.30, depth);
    for (let i = 0; i < W; i++) {
      const vux = (i + 0.5) / W;
      let px = vux * 6.2 * freqK, py = sy * 12.7 * freqK * yStretch;
      const [ox, oy] = lens(vux, sy, { ...ptr, reading: uReading });
      px += ox * 6.2 * freqK; py += oy * 12.7 * freqK * yStretch;
      const qx = fbm(px + 0.09 * t, py + 0.09 * t);
      const qy = fbm(px + 5.2 - 0.07 * t, py + 1.3 - 0.07 * t);
      const rx = fbm(px + 3.4 * qx + 1.7 + 0.055 * t, py + 3.4 * qy + 9.2 + 0.055 * t);
      const ry = fbm(px + 3.4 * qx + 8.3 - 0.048 * t, py + 3.4 * qy + 2.8 - 0.048 * t);
      const f = fbm(px + 3.2 * rx, py + 3.2 * ry);
      const raw = (f - 0.5) * 0.34 * uAmp;
      let disp = raw > 0 ? raw * gateDark : raw * gateLight;
      disp += 0.5 * Math.abs(raw) * topLift;
      let y = clamp(depth + disp, 0, 1);
      const guarded = mix(Math.max(y, depth), Math.min(y, depth), uReading);
      y = mix(y, guarded, zone);
      let col = sampleRamp(ramp, y);
      const lum = 0.90 + 0.20 * f;
      const lumR = mix(lum, 0.86 + 0.14 * f, zone);
      const m = mix(lumR, Math.max(lumR, uViscousFloor), uReading);
      col = col.map((c) => c * m);
      const rlen = Math.hypot(rx, ry);
      const bl = 0.045 * smoothstep(0.55, 1.0, rlen) * (1 - zone) * (1 - uReading);
      col[0] += bl * 0.784; col[1] += bl * 0.639; col[2] += bl * 0.416;
      if (uReading > 0.5) {
        const ink = smoothstep(0.40, 0.60, f), veins = smoothstep(0.50, 0.78, rlen);
        const amt = Math.min(uTintCap, (ink * 0.30 + veins * 0.16) * uAmp);
        const pick = smoothstep(0.30, 0.70, rx);
        const wt = [0.055, 0.042, 0.024], ct = [0.030, 0.033, 0.039];
        for (let c = 0; c < 3; c++) col[c] -= mix(wt[c], ct[c], pick) * amt;
      }
      for (let c = 0; c < 3; c++) img[(j * W + i) * 3 + c] = clamp(col[c], 0, 1) * 255;
    }
  }
  return img;
}
export { fbm, noise, hash, smoothstep, buildRamp, sampleRamp, RAMP_D, RAMP_R, RAMP_DK };
