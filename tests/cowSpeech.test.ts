import { describe, it, expect } from 'vitest';
import { splitTwoLines, splitAll, widestHalf } from '../src/lib/cowSpeech';
import { COW_LINES, COW_LINES_404, COW_LINES_WRITING } from '../src/data/cowGlyph';

// The owner: "try to let the bubble grow horizontally instead of vertically, still two lines. as such, we dont
// trigger a vertical rerender. the current rendering ... abruptly pushes the content up and down."
//
// That bug came from letting the BROWSER decide where to wrap: the messages run 24 to 51 characters, so at the
// small size one wrapped to two lines and another to four, the bubble's height changed on every press, and the
// panel reflowed. These tests pin the property that fixes it — every message renders as exactly two lines — plus
// the balance that keeps the resulting box as narrow as it can be.

const ALL = [...COW_LINES, ...COW_LINES_404, ...COW_LINES_WRITING];

describe('splitting what the cow says', () => {
  it('returns exactly two parts for every real message', () => {
    for (const line of ALL) {
      const pair = splitTwoLines(line);
      expect(pair.length, line).toBe(2);
    }
  });

  it('loses no words and invents none', () => {
    for (const line of ALL) {
      const [a, b] = splitTwoLines(line);
      expect([a, b].filter(Boolean).join(' '), line).toBe(line.trim().replace(/\s+/g, ' '));
    }
  });

  it('never breaks a word across the two lines', () => {
    for (const line of ALL) {
      const [a, b] = splitTwoLines(line);
      const words = line.trim().split(/\s+/);
      for (const half of [a, b]) {
        for (const w of half.split(' ').filter(Boolean)) {
          expect(words, `${line} -> ${half}`).toContain(w);
        }
      }
    }
  });

  // The point of balancing: the bubble's width is the WIDER half, so an unbalanced split makes the box nearly as
  // wide as the whole sentence and the two-line layout buys nothing.
  it('balances the halves, so the wider one is well under the whole sentence', () => {
    for (const line of ALL) {
      const [a, b] = splitTwoLines(line);
      const wider = Math.max(a.length, b.length);
      // A perfectly balanced split is ceil(n/2); allow slack for long single words, but never let one half carry
      // more than ~70% of the sentence.
      expect(wider / line.length, `${line} split ${a} | ${b}`).toBeLessThan(0.72);
    }
  });

  it('puts the shorter half first on a tie, so the tail hangs under the longer line', () => {
    // "aa bb" -> both halves are 2 chars; the earlier split wins, giving one word per line.
    expect(splitTwoLines('aa bb')).toEqual(['aa', 'bb']);
  });

  it('handles a single word and empty input without collapsing the second row', () => {
    expect(splitTwoLines('Moo.')).toEqual(['Moo.', '']);
    expect(splitTwoLines('')).toEqual(['', '']);
    expect(splitTwoLines('   ')).toEqual(['', '']);
  });

  it('normalises runs of whitespace rather than emitting empty words', () => {
    expect(splitTwoLines('a   b')).toEqual(['a', 'b']);
  });

  it('splitAll keeps one pair per message, in order', () => {
    const pairs = splitAll(COW_LINES);
    expect(pairs.length).toBe(COW_LINES.length);
    expect(pairs[0][0] + ' ' + pairs[0][1]).toBe(COW_LINES[0]);
  });

  // This is the number the bubble's build-time width comes from, so it must describe the wider half and not the
  // whole sentence — otherwise the box ships too wide and visibly shrinks on the first press.
  it('widestHalf measures a half, not a whole line', () => {
    const longest = ALL.reduce((a, b) => (b.length > a.length ? b : a));
    expect(widestHalf(ALL)).toBeLessThan(longest.length);
    expect(widestHalf(ALL)).toBeGreaterThan(0);
  });

  it('widestHalf of one message is that message\'s own wider half', () => {
    const [a, b] = splitTwoLines(COW_LINES[0]);
    expect(widestHalf([COW_LINES[0]])).toBe(Math.max(a.length, b.length));
  });
});
