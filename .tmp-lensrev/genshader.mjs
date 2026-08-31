// Build the REAL fragment shader with the proposed Lens block substituted for mode 1,
// exactly as written in the proposal, then emit an HTML page that compiles it in WebGL1.
import { fragmentShader, VERTEX_SHADER } from '../src/lib/skyShader.ts';
import { writeFileSync } from 'node:fs';

const base = fragmentShader();

// The proposal's mode-1 block, verbatim (comments stripped of the prose that is not code).
const PROPOSED = `
      if (uMode < 1.5) {
        float R = 0.085 * mix(1.0, 0.62, uReading);
        float A = 0.16 * mix(1.0, 0.85, uReading);
        A *= presence * (1.0 - 0.85 * min(1.0, uPtr.w / 1.10));
        float u = dist / R;
        if (u < 1.0) {
          float s = 1.0 - u * u;
          float w = s * s * s;
          pOffset = -d * (A * w);
        }
      }
`;

// Replace the existing mode-1 body.
const startMark = 'if (uMode < 1.5) {';
const i = base.indexOf(startMark);
if (i < 0) throw new Error('mode-1 block not found');
// find the matching close brace
let depth = 0, j = i + startMark.length - 1;
for (; j < base.length; j++) {
  if (base[j] === '{') depth++;
  else if (base[j] === '}') { depth--; if (depth === 0) break; }
}
const patched = base.slice(0, i) + PROPOSED.trim() + base.slice(j + 1);

const html = `<!doctype html><html><body><pre id="out">running</pre><script>
const VERT = ${JSON.stringify(VERTEX_SHADER)};
const FRAGS = { shipped: ${JSON.stringify(base)}, proposed: ${JSON.stringify(patched)} };
const log = [];
const c = document.createElement('canvas');
const gl = c.getContext('webgl', { antialias: false, alpha: false, depth: false });
if (!gl) { log.push('NO GL CONTEXT'); }
else {
  log.push('GL: ' + gl.getParameter(gl.VERSION) + ' | ' + gl.getParameter(gl.SHADING_LANGUAGE_VERSION));
  log.push('RENDERER: ' + gl.getParameter(gl.RENDERER));
  for (const [name, src] of Object.entries(FRAGS)) {
    const vs = gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(vs, VERT); gl.compileShader(vs);
    const fs = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(fs, src); gl.compileShader(fs);
    const vok = gl.getShaderParameter(vs, gl.COMPILE_STATUS);
    const fok = gl.getShaderParameter(fs, gl.COMPILE_STATUS);
    log.push('--- ' + name + ' --- vert ' + (vok ? 'OK' : 'FAIL') + ' frag ' + (fok ? 'OK' : 'FAIL'));
    if (!vok) log.push('VERT LOG: ' + gl.getShaderInfoLog(vs));
    if (!fok) log.push('FRAG LOG: ' + gl.getShaderInfoLog(fs));
    if (vok && fok) {
      const p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
      const lok = gl.getProgramParameter(p, gl.LINK_STATUS);
      log.push('  link ' + (lok ? 'OK' : 'FAIL') + (lok ? '' : ' :: ' + gl.getProgramInfoLog(p)));
      if (lok) {
        for (const u of ['uMode','uPtr','uPtrVel','uNodes','uReading','uRamp','uAmp']) {
          log.push('  loc ' + u + ' = ' + (gl.getUniformLocation(p, u) === null ? 'NULL (optimised out or absent)' : 'present'));
        }
      }
    }
  }
}
document.getElementById('out').textContent = log.join('\\n');
</script></body></html>`;

writeFileSync(new URL('./compile.html', import.meta.url), html);
writeFileSync(new URL('./patched.frag', import.meta.url), patched);
console.log('wrote compile.html, patched.frag');
