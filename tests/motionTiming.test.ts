// tests/motionTiming.test.ts — the motion module's pure half (lib/motionTiming.ts): its curves and durations, and
// that the code which moves things states none of its own; then the arithmetic of a stagger and of a sweep.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MOTION_LIMIT_MS } from '../src/lib/motion';
import {
  ART, CARD, DRAW, EASE, FADE, MOVE_MAX, PAPER_PAGE, RAIL, REVEAL, SWEEP, WITHDRAW, arrowDelay, highlightDelay, mergeLines,
  stagger, sweepDurations,
} from '../src/lib/motionTiming';

describe('the curves', () => {
  it('are the prototype’s: EASE for every move, DRAW for a figure drawing itself, SWEEP for a run of lines', () => {
    expect(EASE).toBe('cubic-bezier(.2,.7,.2,1)');
    expect(DRAW).toBe('cubic-bezier(.33,.08,.24,1)');
    expect(SWEEP).toBe('cubic-bezier(.3,.2,.4,1)');
    expect(FADE).toBe('ease-out');
    expect(WITHDRAW).toBe('ease-in');
  });
});

describe('the durations', () => {
  it('end every move within 2s, the longest a figure drawing itself', () => {
    const all = [REVEAL, RAIL, PAPER_PAGE, CARD, ART].flatMap((g) => Object.values(g));
    expect(Math.max(...all)).toBe(PAPER_PAGE.draw);
    expect(MOVE_MAX).toBe(2000);
    expect(PAPER_PAGE.draw).toBeLessThanOrEqual(MOVE_MAX);
  });
});

// A batch seen together ends within MOVE_MAX however long it is: a paper with many highlights on one screen, or a
// figure with many arrows, closes the gaps rather than running past 2s. While it fits, the prototype's spacing.
describe("a paper page's batches", () => {
  it('end within MOVE_MAX however many there are: the highlights, and a figure’s arrows', () => {
    for (const n of [1, 2, 6, 7, 15, 40, 200]) {
      expect(highlightDelay(n - 1, n) + PAPER_PAGE.highlight, `${n} highlights`).toBeLessThanOrEqual(MOVE_MAX);
      expect(arrowDelay(n - 1, n) + PAPER_PAGE.arrow, `${n} arrows`).toBeLessThanOrEqual(MOVE_MAX);
    }
  });

  it('keep the prototype’s spacing while it fits', () => {
    for (const k of [0, 1, 2, 5]) {
      expect(highlightDelay(k, 6)).toBe(PAPER_PAGE.highlightAfter + k * PAPER_PAGE.highlightStep);
      expect(arrowDelay(k, 6)).toBe(k * PAPER_PAGE.arrowStep);
    }
  });
});

// Every curve and duration the rail, the research routes and /art move by is lib/motionTiming's. Their scripts import
// it; their CSS cannot, so each motion declaration in it, shorthand or longhand, is held here to the constant it
// carries, in source order, and a literal added without one fails by name. The research routes' shared sheet
// (styles/paper.css) moves nothing.
describe('the code that moves things', () => {
  const src = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
  // the blocks open at the start of a line, so a comment that names a <script> or a <style> opens none
  const css = (path: string) => [...src(path).matchAll(/^<style\b[^>]*>([\s\S]*?)<\/style>/gm)].map((m) => m[1]).join('\n');
  const scripts = (path: string) => [...src(path).matchAll(/^<script\b[^>]*>([\s\S]*?)<\/script>/gm)].map((m) => m[1]).join('\n');
  /** Each transition and animation declaration that states a duration, a delay or a curve, as written. */
  const moves = (style: string) => [...style.replace(/\/\*[\s\S]*?\*\//g, '')
    .matchAll(/(?:transition|animation)(?:-(?:duration|delay|timing-function))?\s*:\s*([^;]*);/g)]
    .map((m) => m[1].trim()).filter((d) => /\d+m?s\b|cubic-bezier|ease|var\(/.test(d));

  it("holds the rail's CSS to RAIL, EASE and FADE, and its entrance to the frontmatter's --row and --gap", () => {
    expect(moves(css('components/SideRail.astro'))).toEqual([
      `opacity ${RAIL.fade}ms ${FADE}`,
      `opacity ${RAIL.preview}ms ${FADE}`,
      `transform ${RAIL.nudge}ms ${EASE}`,
      `side-rail-enter var(--row) ${EASE} backwards`,
      'calc(var(--i) * var(--gap))',
    ]);
    expect(src('components/SideRail.astro')).toContain('style={`--gap:${gap}ms;--row:${RAIL.row}ms`}');
  });

  it("holds a paper page's CSS to PAPER_PAGE, EASE, FADE and MOTION_LIMIT_MS", () => {
    expect(moves(css('pages/research/[slug].astro'))).toEqual([
      `mn-unheld 0s ${MOTION_LIMIT_MS}ms forwards`,
      `opacity ${PAPER_PAGE.noteFade}ms ${FADE}, transform ${PAPER_PAGE.noteShift}ms ${EASE}`,
      `opacity ${PAPER_PAGE.tip}ms ${FADE}`,
    ]);
    expect(moves(src('styles/paper.css'))).toEqual([]);
  });

  it("holds the /research cards' CSS to CARD, EASE, FADE and WITHDRAW", () => {
    expect(moves(css('pages/research/index.astro'))).toEqual([
      `transform ${CARD.lift}ms ${EASE}`,
      `opacity ${CARD.frame}ms ${FADE}`,
      `transform ${CARD.underlineOut}ms ${WITHDRAW}`,
      `transform ${CARD.underline}ms ${EASE} calc(var(--k) * ${CARD.underlineStep}ms)`,
      `transform ${CARD.underline}ms ${EASE} calc(var(--k) * ${CARD.underlineStep}ms)`,
    ]);
  });

  it("holds /art's CSS to ART and FADE: the mat's swap, then a photograph's one fade", () => {
    expect(moves(css('pages/art.astro'))).toEqual([
      `opacity ${ART.swap}ms ${FADE}`,
      `opacity ${ART.tileFade}ms ${FADE}`,
    ]);
  });

  // A curve by name counts as a curve; `linear` is none, and on an animation whose keyframes carry their own easing
  // it leaves them theirs. A number of ms is a number of ms however it is written: in a sum, a choice, a timer.
  it('states no curve or duration in a script: each reads one from lib/motionTiming', () => {
    const sources = {
      'scripts/motion.ts': src('scripts/motion.ts'),
      'components/SideRail.astro': scripts('components/SideRail.astro'),
      'pages/research/[slug].astro': scripts('pages/research/[slug].astro'),
      'pages/research/index.astro': scripts('pages/research/index.astro'),
      'pages/art.astro': scripts('pages/art.astro'),
    };
    const own = new RegExp([
      String.raw`cubic-bezier\(`,
      String.raw`\beasing\s*:\s*['"\x60](?!linear['"\x60])`,
      String.raw`\b(?:duration|delay|step|max|total)\s*:[^,}\n]*?\b\d{2,}`,
      String.raw`\b\d+\s*\+\s*k\s*\*`,
      String.raw`\b(?:later|setTimeout)\((?:[^()]|\([^()]*\))*,\s*\d{2,}\s*\)`,
    ].join('|'), 'g');
    for (const [path, code] of Object.entries(sources)) {
      expect(code.length, path).toBeGreaterThan(500);
      // (a zero is no motion: `play` under reduced motion takes no time)
      expect(code.replace(/\/\/.*$/gm, '').match(own), path).toBeNull();
    }
    // the shapes it catches, each as the scripts once wrote it
    for (const shape of ["easing: 'ease-out'", 'duration: side ? 380 : 340', 'delay: k * 120', 'later(() => go(), 260)']) {
      expect(shape.match(own), shape).not.toBeNull();
    }
  });
});

describe('stagger', () => {
  it('starts the first item at once', () => {
    expect(stagger(0, 10, { step: 40, total: 320 })).toBe(0);
    expect(stagger(0, 1, { step: 40 })).toBe(0);
  });

  it('spaces items by step while they fit', () => {
    expect([0, 1, 2, 3].map((i) => stagger(i, 4, { step: 40, total: 320 }))).toEqual([0, 40, 80, 120]);
  });

  it('closes the gaps so the last item starts by total, however many there are', () => {
    // the rail's entrance (SideRail's frontmatter): each row RAIL.row long, every one in by RAIL.enter
    for (const n of [2, 9, 10, 23, 60]) {
      const last = stagger(n - 1, n, { step: RAIL.rowStep, total: RAIL.enter - RAIL.row });
      expect(last + RAIL.row, `n=${n}`).toBeLessThanOrEqual(RAIL.enter);
    }
    expect(stagger(9, 10, { step: 40, total: 500, max: 40 })).toBeLessThanOrEqual(500 - 180);
  });

  it('caps any one delay at max', () => {
    // the prototype's reveal: 60ms apart, never more than 120ms late
    expect([0, 1, 2, 3, 4].map((i) => stagger(i, 5, { step: 60, max: 120 }))).toEqual([0, 60, 120, 120, 120]);
  });

  it('is plain step × i with neither bound', () => {
    expect(stagger(5, 6, { step: 120 })).toBe(600);
  });
});

describe('sweepDurations', () => {
  it('shares the total in proportion to each line’s width', () => {
    expect(sweepDurations([100, 300], 640)).toEqual([160, 480]);
  });

  it('sums to the total exactly', () => {
    const d = sweepDurations([137.3, 412.9, 61.04], 640);
    expect(d.reduce((s, x) => s + x, 0)).toBe(640);
  });

  it('splits evenly when no line has width, and gives nothing for no lines', () => {
    expect(sweepDurations([0, 0], 640)).toEqual([320, 320]);
    expect(sweepDurations([], 640)).toEqual([]);
  });
});

describe('mergeLines', () => {
  const r = (left: number, right: number, top: number, bottom: number) => ({ left, right, top, bottom });

  it('merges the rects one line breaks into (around an inline child) into one box', () => {
    expect(mergeLines([r(10, 80, 100, 124), r(80, 140, 98, 124)]))
      .toEqual([{ left: 10, top: 98, width: 130, height: 26 }]);
  });

  it('keeps lines apart, top to bottom, and drops slivers', () => {
    expect(mergeLines([r(10, 300, 100, 124), r(300, 300.4, 100, 124), r(0, 120, 130, 154)]))
      .toEqual([{ left: 10, top: 100, width: 290, height: 24 }, { left: 0, top: 130, width: 120, height: 24 }]);
  });

  // What getClientRects() really returns: a DOMRect keeps its edges as getters on its prototype, so an object
  // spread of one copies nothing. Measured in Chrome, that gave every sweep span NaN geometry (no width, no place).
  it('reads a DOMRect, whose edges are prototype getters, not own properties', () => {
    class Rect {
      constructor(private readonly e: [number, number, number, number]) {}
      get left(): number { return this.e[0]; }
      get right(): number { return this.e[1]; }
      get top(): number { return this.e[2]; }
      get bottom(): number { return this.e[3]; }
    }
    expect(mergeLines([new Rect([10, 80, 100, 124]), new Rect([80, 140, 98, 124]), new Rect([0, 120, 130, 154])]))
      .toEqual([{ left: 10, top: 98, width: 130, height: 26 }, { left: 0, top: 130, width: 120, height: 24 }]);
  });
});
