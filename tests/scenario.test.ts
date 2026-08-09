import { describe, it, expect } from 'vitest';
import {
  mulberry32, gauss, buildWorld, makeTraders, runTrader, runSystematic,
  statsOf, dispersion, landmarks, WEEKS, CASH_RATE,
} from '../src/lib/scenario';
import { INSTRUMENTS, NEWS, TRADER_COUNT } from '../src/data/desk';

const world = buildWorld(INSTRUMENTS, NEWS);
const traders = makeTraders(TRADER_COUNT);
const paths = traders.map((t) => runTrader(t, world, INSTRUMENTS, NEWS));
const sys = runSystematic(world, INSTRUMENTS);

describe('determinism — the whole fan must be identical on every build', () => {
  // The project bans Math.random() at paint time. Forty-eight curves that shimmered between repaints would
  // be the worst possible violation, so this is the load-bearing test of the module.
  it('the PRNG is reproducible from its seed', () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    for (let i = 0; i < 50; i++) expect(a()).toBe(b());
  });

  it('different seeds give different streams', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it('the world is identical when rebuilt', () => {
    expect(buildWorld(INSTRUMENTS, NEWS).returns).toEqual(world.returns);
  });

  it('the trader population is identical when rebuilt', () => {
    expect(makeTraders(TRADER_COUNT)).toEqual(traders);
  });

  it('a path is identical when re-run', () => {
    const again = runTrader(traders[0], world, INSTRUMENTS, NEWS);
    expect(again.values).toEqual(paths[0].values);
  });
});

describe('gauss', () => {
  it('produces a roughly standard normal', () => {
    const rand = mulberry32(7);
    const xs = Array.from({ length: 4000 }, () => gauss(rand));
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / xs.length);
    expect(Math.abs(mean)).toBeLessThan(0.08);
    expect(sd).toBeGreaterThan(0.9);
    expect(sd).toBeLessThan(1.1);
  });

  it('never returns a non-finite value', () => {
    const rand = mulberry32(99);
    for (let i = 0; i < 2000; i++) expect(Number.isFinite(gauss(rand))).toBe(true);
  });
});

describe('the invented world', () => {
  it('runs one year of weeks', () => {
    expect(world.returns).toHaveLength(WEEKS);
    expect(world.weeks).toBe(WEEKS);
  });

  it('has a column per instrument', () => {
    for (const row of world.returns) expect(row).toHaveLength(INSTRUMENTS.length);
  });

  it('records the news weeks in order', () => {
    expect(world.newsWeeks).toEqual([...world.newsWeeks].sort((a, b) => a - b));
    expect(world.newsWeeks).toHaveLength(NEWS.length);
  });

  it('applies each news shock in its own week', () => {
    // The shock must be visible: build a world with and without the news and compare that week.
    const quiet = buildWorld(INSTRUMENTS, []);
    const ev = NEWS[0];
    const idx = INSTRUMENTS.findIndex((i) => i.ticker === 'NVDA');
    const withNews = world.returns[ev.week][idx];
    const without = quiet.returns[ev.week][idx];
    expect(withNews - without).toBeCloseTo(ev.shock.NVDA, 9);
  });

  it('every return is finite and sane', () => {
    for (const row of world.returns) {
      for (const r of row) {
        expect(Number.isFinite(r)).toBe(true);
        expect(r).toBeGreaterThan(-0.6);
        expect(r).toBeLessThan(0.6);
      }
    }
  });
});

describe('the discretionary fan — the slide\'s central claim', () => {
  it('every path starts at one unit', () => {
    for (const p of paths) expect(p.values[0]).toBe(1);
  });

  it('every path stays positive and finite', () => {
    for (const p of paths) {
      for (const v of p.values) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThan(0);
      }
    }
  });

  it('every path covers the full year', () => {
    for (const p of paths) expect(p.values).toHaveLength(WEEKS + 1);
  });

  // THE POINT OF THE SLIDE: same world, same headlines, wildly different outcomes. A first version of the
  // trader model produced a spread of 0.08 (1.15 to 1.23) — a bundle, not a fan — because everyone started
  // from the same equal-weight book and reactions could only cost money. These bounds keep it a fan.
  it('produces a WIDE spread of outcomes, not a bundle', () => {
    const d = dispersion(paths);
    expect(d.spread).toBeGreaterThan(0.25);
    expect(d.worst).toBeLessThan(1);        // somebody loses money
    expect(d.best).toBeGreaterThan(1.15);   // somebody does well
  });

  it('spans both winners and losers', () => {
    expect(paths.some((p) => p.final > 1.1)).toBe(true);
    expect(paths.some((p) => p.final < 0.95)).toBe(true);
  });

  it('produces a wide range of drawdowns, which is the risk half of the story', () => {
    const dds = paths.map((p) => p.maxDrawdown);
    expect(Math.min(...dds)).toBeLessThan(-0.2);
    expect(Math.max(...dds)).toBeGreaterThan(-0.15);
  });

  it('produces both good and bad Sharpe, since consistency is what varies', () => {
    const sh = paths.map((p) => p.sharpe);
    expect(Math.min(...sh)).toBeLessThan(0);
    expect(Math.max(...sh)).toBeGreaterThan(1);
  });

  it('charges every trader who trades', () => {
    const active = paths.filter((_, i) => Math.abs(traders[i].chase) > 0.2);
    for (const p of active) expect(p.costPaid).toBeGreaterThan(0);
  });
});

describe('the systematic comparison', () => {
  it('runs the same world and stays finite', () => {
    expect(sys.values).toHaveLength(WEEKS + 1);
    for (const v of sys.values) expect(Number.isFinite(v)).toBe(true);
  });

  // The argument is about CONSISTENCY, not about beating everyone: the best discretionary path should still
  // be allowed to end higher. If the systematic rule won on every measure, the slide would be a boast
  // rather than an explanation.
  it('beats the MEDIAN trader on Sharpe by a clear margin', () => {
    const d = dispersion(paths);
    expect(sys.sharpe).toBeGreaterThan(d.medianSharpe + 0.5);
  });

  it('has a shallower drawdown than the worst trader', () => {
    const d = dispersion(paths);
    expect(sys.maxDrawdown).toBeGreaterThan(d.worstDrawdown);
  });

  it('does NOT claim the highest return — some traders get lucky', () => {
    const best = Math.max(...paths.map((p) => p.final));
    expect(best).toBeGreaterThan(sys.final);
  });

  it('respects its own drawdown band, roughly', () => {
    // The band scales risk down rather than hard-stopping, so the realised fall can exceed it — but not by
    // a multiple, or the "controlled drawdown" claim would be empty.
    expect(sys.maxDrawdown).toBeGreaterThan(-0.2);
  });
});

describe('statsOf', () => {
  it('reports a flat path as zero vol', () => {
    const s = statsOf([1, 1, 1, 1]);
    expect(s.vol).toBe(0);
    expect(s.maxDrawdown).toBe(0);
  });

  it('computes drawdown from the running peak', () => {
    expect(statsOf([1, 1.5, 0.75]).maxDrawdown).toBeCloseTo(-0.5, 9);
  });

  it('uses the declared cash rate for Sharpe', () => {
    // A path with positive vol and a return exactly at the cash rate should score about zero.
    const weekly = CASH_RATE / 52;
    const vals = [1];
    for (let i = 0; i < 52; i++) vals.push(vals[i] * (1 + weekly + (i % 2 ? 0.01 : -0.01)));
    expect(Math.abs(statsOf(vals).sharpe)).toBeLessThan(0.5);
  });

  it('degrades safely on an empty or single-point path', () => {
    expect(statsOf([]).final).toBe(1);
    expect(statsOf([1]).vol).toBe(0);
  });
});

describe('dispersion and landmarks', () => {
  it('orders best, median and worst correctly', () => {
    const d = dispersion(paths);
    expect(d.best).toBeGreaterThanOrEqual(d.median);
    expect(d.median).toBeGreaterThanOrEqual(d.worst);
    expect(d.spread).toBeCloseTo(d.best - d.worst, 9);
  });

  it('names three landmarks that point at real paths', () => {
    const marks = landmarks(paths);
    expect(marks).toHaveLength(3);
    for (const m of marks) {
      expect(m.index).toBeGreaterThanOrEqual(0);
      expect(m.index).toBeLessThan(paths.length);
    }
    // The labelled best really is the best.
    const best = marks.find((m) => m.label.includes('lucky'))!;
    expect(paths[best.index].final).toBe(Math.max(...paths.map((p) => p.final)));
  });

  it('handles an empty population', () => {
    expect(dispersion([]).spread).toBe(0);
    expect(landmarks([])).toEqual([]);
  });
});
