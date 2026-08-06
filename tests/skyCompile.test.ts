// Does the fragment shader COMPILE?
//
// This is the one failure mode a green build cannot catch and a screenshot cannot
// distinguish: a GLSL error makes the component hide the canvas, which looks exactly
// like the effect being switched off. It has bitten this file repeatedly (a backtick
// inside a GLSL comment terminated the template literal five separate times; later an
// unevaluated `${...}` shipped as literal text into the shader source).
//
// There is no GL context in vitest, so this does what a GLSL compiler's front end
// does for the classes of error actually seen here: structural validation of the
// STRING the module really produces at runtime.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fragmentShader, VERTEX_SHADER, SKY_UNIFORMS } from '../src/lib/skyShader';

const src = fragmentShader();

/** The shader with comments removed. Needed because these files are HEAVILY
 *  commented and prose trips syntax checks — "additive texture (warm/cool…)" in a
 *  comment matched an ES3 `texture(` probe on the first run. */
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

describe('the backtick hazard is caught at test time, not at runtime', () => {
  // A backtick inside a GLSL comment closes the template literal that holds the
  // shader. It has broken this build SIX times now: five in an earlier round (a
  // comment quoting `overlay`, `sp`, and a formula), and once more here from a
  // comment quoting the name of a shader variable.
  //
  // The failure is nasty in two different ways depending on where the literal
  // re-opens: usually esbuild fails with a syntax error (loud, fine), but it can
  // also produce a STILL-VALID string that silently ships broken GLSL — and a GLSL
  // error hides the canvas, which is indistinguishable from the effect being off.
  //
  // So: assert on the SOURCE FILES, which is the only place the hazard exists.
  const files = ['src/lib/skyInteraction.ts', 'src/lib/skyShader.ts'];

  it('has no backtick inside any // comment in the shader source files', () => {
    for (const rel of files) {
      const text = readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
      const offenders = text.split('\n')
        .map((line, i) => ({ n: i + 1, line }))
        .filter(({ line }) => {
          const slash = line.indexOf('//');
          return slash >= 0 && line.slice(slash).includes('`');
        });
      expect(
        offenders.map((o) => `${rel}:${o.n}: ${o.line.trim()}`),
        'a backtick in a comment closes the shader template literal',
      ).toEqual([]);
    }
  });
});

describe('fragment shader source integrity', () => {
  it('contains no unevaluated template interpolation', () => {
    // `${Me}` shipped into the shader once, because a template literal spanning
    // imported constants was converted to a plain string by the minifier. The GL
    // compiler reported "'$' : invalid character" and the canvas silently vanished.
    expect(src).not.toMatch(/\$\{/);
    expect(src).not.toContain('$');
  });

  it('contains no backtick — the recurring template-literal hazard', () => {
    // A backtick anywhere in the produced source means a literal was closed early
    // or concatenation leaked source syntax into the shader.
    expect(src).not.toContain('`');
  });

  it('has balanced braces and parens', () => {
    const count = (re: RegExp) => (code.match(re) || []).length;
    expect(count(/\{/g)).toBe(count(/\}/g));
    expect(count(/\(/g)).toBe(count(/\)/g));
  });

  it('declares precision and writes gl_FragColor exactly once', () => {
    expect(src).toMatch(/^\s*precision\s+highp\s+float;/m);
    expect((src.match(/gl_FragColor\s*=/g) || []).length).toBe(1);
  });

  it('is WebGL1 / GLSL ES 1.00 — no ES 3.00 constructs', () => {
    // NOTE: `in`/`out` as FUNCTION PARAMETER qualifiers are valid GLSL ES 1.00 —
    // skyInteract uses `out vec2 pOffset`. Only top-level in/out DECLARATIONS are
    // ES 3.00, so anchor the check to the start of a line.
    expect(code).not.toMatch(/^\s*(in|out)\s+(vec[234]|float|int)\s+\w+\s*;/m);
    // ES3's `texture(` — but NOT `texture2D(`, the correct ES 1.00 name.
    expect(code).not.toMatch(/\btexture\s*\(/);
    expect(code).toContain('texture2D(');
    expect(code).not.toContain('#version');
    expect(code).not.toMatch(/\bswitch\s*\(/);
    expect(code).not.toContain('gl_FragData');
  });

  it('uses only CONSTANT loop bounds (WebGL1 forbids dynamic ones)', () => {
    const loops = [...code.matchAll(/for\s*\(([^)]*)\)/g)].map((m) => m[1]);
    expect(loops.length).toBeGreaterThan(0);
    for (const head of loops) {
      // the comparison must be against a literal, not a uniform/varying
      const cmp = head.split(';')[1] ?? '';
      expect(cmp, `dynamic loop bound in: for(${head})`).toMatch(/[<>]=?\s*\d+(\.\d+)?\s*$/);
    }
  });

  it('indexes the node array only with the loop counter', () => {
    // Non-constant array indexing is illegal in WebGL1 except by a loop index.
    const bad = [...code.matchAll(/uNodes\s*\[([^\]]+)\]/g)].map((m) => m[1].trim());
    for (const idx of bad) expect(idx).toMatch(/^[a-z]$|^\d+$/);
  });

  it('every uniform the JS looks up is declared, and vice versa', () => {
    const declared = new Set(
      [...src.matchAll(/^\s*uniform\s+\S+\s+(\w+)\s*(?:\[\s*\d+\s*\])?\s*;/gm)].map((m) => m[1]),
    );
    for (const name of SKY_UNIFORMS) {
      expect(declared.has(name), `${name} is in SKY_UNIFORMS but not declared`).toBe(true);
    }
    for (const name of declared) {
      expect((SKY_UNIFORMS as readonly string[]).includes(name), `${name} declared but not in SKY_UNIFORMS`).toBe(true);
    }
  });

  it('the vertex shader is intact too', () => {
    expect(VERTEX_SHADER).toContain('gl_Position');
    expect(VERTEX_SHADER).not.toContain('$');
    expect(VERTEX_SHADER).not.toContain('`');
  });

  it('the interaction block is actually present, not silently dropped', () => {
    // If composition ever breaks, the shader still compiles — it just has no
    // interaction, which is indistinguishable from "off" on screen.
    expect(src).toContain('void skyInteract(');
    expect(src).toContain('uniform float uMode');
    expect(src).toMatch(/skyInteract\(vUv,\s*sy,/);
  });
});
