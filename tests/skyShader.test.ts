import { describe, it, expect } from 'vitest';
import { fragmentShader, SKY_UNIFORMS } from '../src/lib/skyShader';

// The shader cannot be executed in vitest (no WebGL), so these are structural
// guards on the shader source. They assert properties that a mutation would break:
// uniform list completeness, the archetype guard's presence, the reading tint's
// direction. They do NOT prove the shader's numerical correctness — that requires
// a GPU and sampled output.

describe('SKY_UNIFORMS completeness', () => {
  it('declares exactly the uniforms in the list, and no others', () => {
    const source = fragmentShader();

    // Extract uniform declarations from the shader source.
    // `(\w+)` then an OPTIONAL array suffix: the interaction's ripple nodes are
    // declared as `uniform vec4 uNodes[8];`, and without the suffix the name reads
    // as undeclared — which made this guard fail on a correctly-wired uniform.
    const declaredRaw = [...source.matchAll(/^\s*uniform\s+\S+\s+(\w+)\s*(?:\[\s*\d+\s*\])?\s*;/gm)].map(m => m[1]);
    const declared = new Set(declaredRaw);
    const listed = new Set(SKY_UNIFORMS);

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

describe('Archetype guard — reading vs descent inversion', () => {
  it('is present in the form that inverts on uReading', () => {
    const source = fragmentShader();

    // The guard is the min/max mix construct that inverts the hard floor direction
    // by archetype. On a descent page (uReading=0), y may never sit lighter than depth;
    // on a reading page (uReading=1), y may never sit darker than a bounded amount below depth.
    // Assert the source contains the mix(max(y, depth), min(y, depth), uReading) pattern.
    // Deleting or flattening it would break the archetype-dependent legibility guarantee.
    expect(source).toMatch(/mix\(\s*max\(\s*y\s*,\s*depth\s*\)\s*,\s*min\(\s*y\s*,\s*depth\s*\)\s*,\s*uReading\s*\)/);
  });
});

describe('Reading tint is SUBTRACTIVE', () => {
  it('composites the tint with -= or equivalent, never +=', () => {
    const source = fragmentShader();

    // The reading-page tint is applied in the `if (uReading > 0.5)` block.
    // Find that block and verify it subtracts from col, never adds. On a pale
    // reading page, an additive tint would brighten the paper toward the ink and
    // destroy contrast.
    const readingBlock = source.match(/if\s*\(\s*uReading\s*>\s*0\.5\s*\)\s*\{[\s\S]*?\n\s*\}/);
    expect(readingBlock).toBeTruthy();

    if (readingBlock) {
      const block = readingBlock[0];
      // The tint is composed via `col -= mix(warmTint, coolTint, pick) * amt`.
      // Assert the subtraction is present.
      expect(block).toMatch(/col\s*-=/);
      // Assert there is NO addition in this block (would invert the direction).
      expect(block).not.toMatch(/col\s*\+=/);
    }
  });
});
