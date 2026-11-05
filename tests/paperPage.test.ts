// tests/paperPage.test.ts — the paper page's pure half (lib/paperPage.ts): the prose it writes round the file,
// where the margin notes go, and what Figure 2's readout reads and says.
import { describe, expect, it } from 'vitest';
import {
  authorRole, givenFirst, listed, readoutIndex, readoutLabel, readoutSays, readoutStep, readoutWhen, referenceNote, stackNotes, tipLeft,
} from '../src/lib/paperPage';

describe('stackNotes', () => {
  it('puts each note at its anchor while the one above has ended', () => {
    expect(stackNotes([{ top: 0, height: 50 }, { top: 100, height: 40 }], 16)).toEqual([0, 100]);
  });

  it('pushes a note down below the one above it, a gap apart, so none overlap', () => {
    expect(stackNotes([{ top: 0, height: 90 }, { top: 40, height: 40 }, { top: 60, height: 10 }], 16)).toEqual([0, 106, 162]);
  });

  it('stacks by where the anchors are, not by the order given, and answers in the order given', () => {
    // an equation's note is written after its where's notes, but belongs above them, beside the display
    expect(stackNotes([{ top: 200, height: 30 }, { top: 100, height: 120 }], 16)).toEqual([236, 100]);
  });
});

describe('the readout', () => {
  it('reads the month nearest the pointer, and never off the ends', () => {
    expect(readoutIndex(34, 34, 512, 68)).toBe(0);
    expect(readoutIndex(512, 34, 512, 68)).toBe(67);
    expect(readoutIndex(34 + (478 * 10.4) / 67, 34, 512, 68)).toBe(10);
    expect(readoutIndex(-50, 34, 512, 68)).toBe(0);
    expect(readoutIndex(900, 34, 512, 68)).toBe(67);
  });

  it('steps a month with an arrow, a year with Shift, and jumps to the ends with Home and End', () => {
    expect(readoutStep(10, 'ArrowRight', false, 68)).toBe(11);
    expect(readoutStep(10, 'ArrowLeft', true, 68)).toBe(0);
    expect(readoutStep(60, 'ArrowRight', true, 68)).toBe(67);
    expect(readoutStep(30, 'Home', false, 68)).toBe(0);
    expect(readoutStep(30, 'End', true, 68)).toBe(67);
    expect(readoutStep(30, 'Enter', false, 68)).toBeNull();
  });

  // What the plot tells a reader who reaches it names its figure, as the explainer numbers it, and says each way it
  // reads, and no key it does not handle.
  it('names its figure and, in its instructions, every way to read it, and only those', () => {
    const label = readoutLabel('Figure 5');
    expect(label).toMatch(/^Plot of Figure 5\. /);
    for (const way of ['Hover', 'tap', 'left and right arrow keys', 'Shift', 'Home', 'End']) expect(label).toContain(way);
    for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) expect(readoutStep(30, key, false, 68), key).not.toBeNull();
    for (const key of ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown']) expect(readoutStep(30, key, false, 68), key).toBeNull();
    expect(label).not.toMatch(/\bup\b|\bdown\b|page/i);
  });

  it('names a point: the start, a month-end, and the day the data end', () => {
    const dates = ['2020-02-29', '2020-03-31', '2025-08-31'];
    expect(readoutWhen(0, dates, '2025-08-13')).toBe('Start of February 2020');
    expect(readoutWhen(2, dates, '2025-08-13')).toBe('End of March 2020');
    expect(readoutWhen(3, dates, '2025-08-13')).toBe('13 August 2025, where the data end');
  });

  // Spoken, as the tip's date line shows it: each value alone would pass for the paper's.
  it("says a reading as the reproduction's", () => {
    expect(readoutSays('End of March 2020', 'median of 10 runs', { rl: '$0.91', lo: '$0.90', hi: '$0.93', bhrp: '$0.92', bench: '$0.88' }))
      .toBe('End of March 2020, reproduction: RL-BHRP, median of 10 runs, $0.91 (the runs $0.90 to $0.93); BHRP $0.92; Benchmark $0.88.');
  });

  it('centres its tip on the month, inside the plot, never past its right edge', () => {
    expect(tipLeft(300, 100, 600)).toBe(250);
    expect(tipLeft(20, 100, 600)).toBe(0);
    expect(tipLeft(590, 100, 600.5)).toBe(500);
  });
});

// The prose the page writes round the file, from the record and the frontmatter: every case a second paper could bring.
describe("the page's own prose", () => {
  it('lists names as a sentence does', () => {
    expect(listed(['A'])).toBe('A');
    expect(listed(['A', 'B'])).toBe('A and B');
    expect(listed(['A', 'B', 'C'])).toBe('A, B and C');
  });

  it('writes a reference author given name first', () => {
    expect(givenFirst('López de Prado, Marcos')).toBe('Marcos López de Prado');
  });

  it("names the owner's place among the authors, or says he is the only one", () => {
    const authors = [{ name: 'Kwon, Roy' }, { name: 'Tian, Zeying' }];
    expect(authorRole(authors, 'Tian, Zeying')).toBe('the second author');
    expect(authorRole([{ name: 'Tian, Zeying' }], 'Tian, Zeying')).toBe('its author');
    expect(() => authorRole(authors, 'Nobody')).toThrow(/Nobody/);
  });

  describe('the note on the references', () => {
    it("says how many of the bibliography's works it draws on, which it leaves out, and what it adds", () => {
      expect(referenceNote(5, ['a work by Ninsin listed with no venue or year'], 3)).toBe('Five of the six works in the paper’s '
        + 'bibliography (the sixth, a work by Ninsin listed with no venue or year, is not drawn on here), plus three it names in its text without citing.');
      expect(referenceNote(4, ['A', 'B'], 0)).toBe('Four of the six works in the paper’s bibliography (the others, A; B, are not drawn on here).');
      expect(referenceNote(1, ['A'], 1)).toBe('One of the two works in the paper’s bibliography (the second, A, is not drawn on here), '
        + 'plus one it names in its text without citing.');
    });

    it('draws on every work, or on the only one', () => {
      expect(referenceNote(3, [], 0)).toBe('All three works in the paper’s bibliography.');
      expect(referenceNote(1, [], 2)).toBe('The one work in the paper’s bibliography, plus two it names in its text without citing.');
    });

    it('draws on none of them', () => {
      expect(referenceNote(0, ['A'], 0)).toBe('None of the paper’s bibliography is drawn on here (A).');
      expect(referenceNote(0, ['A', 'B'], 1)).toBe('None of the paper’s bibliography is drawn on here (A; B); listed here, one work it names in its text without citing.');
    });

    // `references: []`, which the schema allows
    it('has no bibliography to draw on', () => {
      expect(referenceNote(0, [], 0)).toBe('The paper has no bibliography.');
      expect(referenceNote(0, [], 2)).toBe('The paper has no bibliography; listed here, two works it names in its text without citing.');
    });

    // (Tailwind reads this file's text for class names, so the word for "first, second …" is not written here.)
    it('counts in figures past twelve, and calls a work past the twelfth "the other"', () => {
      expect(referenceNote(13, [], 0)).toBe('All 13 works in the paper’s bibliography.');
      expect(referenceNote(13, ['A'], 0)).toBe('13 of the 14 works in the paper’s bibliography (the other, A, is not drawn on here).');
    });
  });
});
