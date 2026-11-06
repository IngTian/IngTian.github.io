import { describe, it, expect } from 'vitest';
import { arrowBeat } from '../src/lib/beats';

describe('arrowBeat', () => {
  it('steps forward on Right and Down and back on Left and Up, wrapping at both ends', () => {
    expect(arrowBeat('ArrowRight', 0, 4)).toBe(1);
    expect(arrowBeat('ArrowDown', 3, 4)).toBe(0);
    expect(arrowBeat('ArrowLeft', 0, 4)).toBe(3);
    expect(arrowBeat('ArrowUp', 2, 4)).toBe(1);
  });

  it('leaves every other key to the page', () => {
    for (const key of ['Enter', ' ', 'Tab', 'Home', 'End', 'PageDown', 'a']) expect(arrowBeat(key, 1, 4)).toBeNull();
  });
});
