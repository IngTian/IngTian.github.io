import { describe, it, expect } from 'vitest';
import { fragmentShader, SKY_UNIFORMS } from '../src/lib/skyShader';

// The shader cannot be executed in vitest (no WebGL), so these are structural
// guards on the shader source. They assert properties that a mutation would break:
// uniform list completeness and the legibility guard's presence. They do NOT prove the shader's numerical correctness — that requires
// a GPU and sampled output.

describe('SKY_UNIFORMS completeness', () => {
  it('declares exactly the uniforms in the list, and no others', () => {
    const source = fragmentShader();

    // Extract uniform declarations from the shader source.
    const declaredRaw = [...source.matchAll(/^\s*uniform\s+\S+\s+(\w+);/gm)].map(m => m[1]);
    const declared = new Set(declaredRaw);
    // Set<string>, EXPLICITLY. SKY_UNIFORMS is `as const`, so `new Set(SKY_UNIFORMS)` infers
    // Set<'uRamp' | 'uAmp' | …> and its .has() then only accepts those exact literals — while the
    // names below come out of a regex over the shader source and are plain strings. That is the
    // point of the check (it asks whether an UNKNOWN name is in the list), so widening the set's
    // element type is the fix, not casting the argument. It was a real TS2345 that nothing caught:
    // both `astro build` and vitest strip types with esbuild, so the only thing that ever sees it
    // is `npm run typecheck` — added in the same pass as this fix.
    const listed = new Set<string>(SKY_UNIFORMS);

    // Both ways: no declared uniform is missing from the list (would read as 0 silently),
    // and no list entry is missing from the shader (would error at uniform location lookup).
    const missing = [...declared].filter(u => !listed.has(u));
    const extra = [...listed].filter(u => !declared.has(u));

    expect(missing).toEqual([]);
    expect(extra).toEqual([]);
  });

  it('has no duplicates and every name starts with u', () => {
    expect(new Set(SKY_UNIFORMS).size).toBe(SKY_UNIFORMS.length);
    for (const name of SKY_UNIFORMS) {
      expect(name).toMatch(/^u[A-Z]/);
    }
  });
});

describe('Legibility guard — the hard floor over the reading zone', () => {
  it('never samples lighter than the gradient over the zone', () => {
    const source = fragmentShader();

    // The text over the sky is paper-coloured, so over the zone y may never sit lighter
    // (higher on the ramp) than depth: y = mix(y, max(y, depth), zone). Deleting or
    // flattening it would let the warp lift the sky under the text.
    expect(source).toMatch(/y = mix\(\s*y\s*,\s*max\(\s*y\s*,\s*depth\s*\)\s*,\s*zone\s*\)/);
  });

  it('gates over the zone only: outside it, at zone 0, each multiplier is 1', () => {
    const source = fragmentShader();
    expect(source).toMatch(/mix\(\s*1\.0\s*,\s*uGateDark\s*,\s*zone\s*\)/);
    expect(source).toMatch(/mix\(\s*1\.0\s*,\s*uGateLight\s*,\s*zone\s*\)/);
  });
});
