import { afterEach, describe, expect, it, vi } from 'vitest';
import { isPhone, PHONE_MAX_WIDTH } from '../src/lib/viewport';

/**
 * The phone gate decides BEHAVIOUR, not just looks: whether the slide deck attaches its listeners at all.
 * A silent drift between this number and the `@media (max-width: 640px)` blocks would ship a phone with half
 * a treatment — collapsed styling but a live deck, or the reverse — so the constant is asserted explicitly
 * rather than trusted.
 */
describe('viewport phone gate', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pins the breakpoint at 640px, matching the stylesheets', () => {
    // If this fails, the `@media (max-width: 640px)` blocks in CornerNav.astro, Heights.astro and
    // global.css must change with it — that is the whole reason the assertion exists.
    expect(PHONE_MAX_WIDTH).toBe(640);
  });

  it('asks CSS the question rather than measuring innerWidth', () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: true });
    vi.stubGlobal('window', { matchMedia, innerWidth: 9999 });
    // innerWidth says desktop; the media query says phone. The media query must win, because it is what the
    // styles are keyed off — innerWidth and matchMedia can disagree by the scrollbar's width.
    expect(isPhone()).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith('(max-width: 640px)');
  });

  it('is true below the breakpoint and false above it', () => {
    for (const [width, expected] of [
      [320, true],
      [390, true],
      [640, true],
      [641, false],
      [768, false],
      [1440, false],
    ] as const) {
      vi.stubGlobal('window', {
        matchMedia: (q: string) => {
          const max = Number(/max-width:\s*(\d+)px/.exec(q)?.[1]);
          return { matches: width <= max };
        },
      });
      expect(isPhone(), `${width}px`).toBe(expected);
    }
  });

  it('is false when there is no window at all (SSR safety)', () => {
    vi.stubGlobal('window', undefined);
    // Astro renders these modules on the server during the build. Returning false there means the shipped
    // HTML is always the full desktop markup, which is what the phone treatment layers on top of.
    expect(isPhone()).toBe(false);
  });

  it('is false when matchMedia is missing rather than throwing', () => {
    vi.stubGlobal('window', {});
    expect(isPhone()).toBe(false);
  });
});
