import { describe, it, expect } from 'vitest';
import { RULE_GLYPHS, RULE_TAGS, type RuleGlyphKey } from '../src/data/ruleGlyphs';
import { coverage, inBounds } from '../src/lib/pixels';
import { CONSTRAINTS } from '../src/data/desk';

// THE POINT OF THIS FILE. A glyph is a character matrix compiled to cells, so it is data — and data can be
// wrong in ways nobody notices by looking at a 33px mark. These tests catch the failures that actually happen:
// a ragged matrix, a mark so sparse it reads as noise or so solid it reads as a block, and — the one that
// matters most — a glyph keyed to a rule category the page does not have.

const keys = Object.keys(RULE_GLYPHS) as RuleGlyphKey[];

describe('the rule marks', () => {
  it('has one mark per rule category the page renders', () => {
    // The page pairs marks with data/desk.ts's `group` field, so a key that is not a real group would silently
    // render nothing — the exact bug this asserts away.
    const groups = new Set(CONSTRAINTS.map((c) => c.group));
    for (const k of keys) expect(groups.has(k), `${k} is not a real constraint group`).toBe(true);
  });

  it('covers every group that appears in the constraint data', () => {
    const groups = new Set(CONSTRAINTS.map((c) => c.group));
    for (const g of groups) expect(keys, `no mark for ${g}`).toContain(g);
  });

  it('is an 11x11 grid throughout, so the marks sit on one baseline', () => {
    for (const k of keys) {
      expect(RULE_GLYPHS[k].w, k).toBe(11);
      expect(RULE_GLYPHS[k].h, k).toBe(11);
    }
  });

  it('keeps every filled cell inside its grid', () => {
    for (const k of keys) expect(inBounds(RULE_GLYPHS[k]), k).toBe(true);
  });

  // A mark below about 15% ink reads as scattered dots; above about 60% it reads as a filled block. Both fail
  // at 33px, and neither is obvious in source.
  it('has ink coverage in the legible band', () => {
    for (const k of keys) {
      const c = coverage(RULE_GLYPHS[k]);
      expect(c, `${k} is too sparse`).toBeGreaterThan(0.15);
      expect(c, `${k} is too solid`).toBeLessThan(0.6);
    }
  });

  it('is not accidentally the same shape twice', () => {
    const sigs = keys.map((k) => RULE_GLYPHS[k].cells.map((c) => `${c.x},${c.y}`).join('|'));
    expect(new Set(sigs).size).toBe(keys.length);
  });

  it('uses some of every row band, so no mark is bunched in one corner', () => {
    for (const k of keys) {
      const g = RULE_GLYPHS[k];
      const rows = new Set(g.cells.map((c) => c.y));
      expect(rows.size, k).toBeGreaterThanOrEqual(6);
      const cols = new Set(g.cells.map((c) => c.x));
      expect(cols.size, k).toBeGreaterThanOrEqual(6);
    }
  });
});

describe('the tags under the marks', () => {
  it('has a tag for every mark', () => {
    for (const k of keys) expect(RULE_TAGS[k], k).toBeTruthy();
  });

  it('keeps them to three or four characters, which is all the column holds', () => {
    for (const k of keys) {
      expect(RULE_TAGS[k].length, `${k}: ${RULE_TAGS[k]}`).toBeLessThanOrEqual(4);
      expect(RULE_TAGS[k]).toBe(RULE_TAGS[k].trim());
    }
  });

  it('has no duplicate tags — two rules labelled the same would read as one', () => {
    const tags = keys.map((k) => RULE_TAGS[k]);
    expect(new Set(tags).size).toBe(tags.length);
  });
});
