import { afterEach, describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { isPhone, PHONE_MAX_WIDTH, PHONE_QUERY, WIDE_QUERY } from '../src/lib/viewport';

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

  it('builds its one media query from that number', () => {
    // isPhone(), /projects' inline boot decider and the dist smoke test's stand-in all read this string, so the
    // width is never retyped into a query.
    expect(PHONE_QUERY).toBe('(max-width: 640px)');
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

// The one-column breakpoint: at 1100px and below the rail hides and the reading pages fall to one column. A pair of
// bounds (max 1100 / min 1101) leaves the widths between them, which a zoomed or OS-scaled window reaches (1100.8 CSS px
// is a 1321px window at 120%), to neither layout: there the rail shows and the paper's two columns stand, while its
// script, asking the other bound, leaves every note unplaced at its block's top.
describe('the wide layout', () => {
  it('is the exact negation of the one-column query, so no width falls between the two', () => {
    expect(WIDE_QUERY).toBe('not all and (max-width: 1100px)');
  });

  // Not only this breakpoint: any (min-width: N) beside a (max-width: M) with N - 1 <= M < N leaves the widths between
  // them to neither side (/projects' cow at 1179/1180 fell into the flow as a 156px row at 1179.2 CSS px).
  it('is never written as a second bound beside it, nor is any breakpoint in src', () => {
    const src = new URL('../src/', import.meta.url);
    const files = readdirSync(src, { recursive: true, encoding: 'utf8' }).filter((f) => /\.(astro|css|ts)$/.test(f));
    expect(files.length).toBeGreaterThan(50);
    const bounds = (re: RegExp) => files.flatMap((f) =>
      [...readFileSync(new URL(f, src), 'utf8').matchAll(re)].map((m) => ({ f, px: Number(m[1]) })));
    const lows = bounds(/\((?:min-width:|width\s*>=?)\s*([\d.]+)px\)/g), highs = bounds(/\(max-width:\s*([\d.]+)px\)/g);
    expect(lows.length).toBeGreaterThan(0);
    const pairs = lows.flatMap((lo) => highs.filter((hi) => hi.px < lo.px && hi.px >= lo.px - 1)
      .map((hi) => `${lo.f}: (min-width: ${lo.px}px) beside (max-width: ${hi.px}px)`));
    expect([...new Set(pairs)]).toEqual([]);
  });
});
