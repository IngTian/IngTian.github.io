import { describe, it, expect } from 'vitest';
import { mulberry32, gauss } from '../src/lib/scenario';

// WHAT THIS FILE USED TO COVER, AND WHY IT IS SHORT NOW.
//
// It tested a 48-trader Monte Carlo — an invented year, six news shocks, a fan of PnL curves, and the
// dispersion/landmark helpers that read it. That model was never rendered: the shipped slide runs
// data/define.ts's five named policies through lib/policyPnl.ts, which tests/policyPnl.test.ts covers. So the
// suite was guarding a second, unrendered model of the same argument, and green tests on an unused model are
// worse than no tests — they make it look maintained.
//
// The two functions left are the ones live code imports (lib/complexity.ts, lib/policyPnl.ts), and their
// contract is the load-bearing one: reproducibility. The project bans Math.random() at paint time, so a
// generator that drifted between repaints would break every generated figure on the site at once.

describe('determinism — every generated figure on the site depends on it', () => {
  it('the PRNG is reproducible from its seed', () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    for (let i = 0; i < 50; i++) expect(a()).toBe(b());
  });

  it('different seeds give different streams', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it('stays in [0,1) across a long run, so callers can scale it safely', () => {
    const rand = mulberry32(20260830);
    for (let i = 0; i < 5000; i++) {
      const x = rand();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
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
    // The log guard at u=0 is what this is really checking: without it Box–Muller returns -Infinity on an
    // exact zero draw, and one Infinity poisons a whole declared return table.
    const rand = mulberry32(99);
    for (let i = 0; i < 2000; i++) expect(Number.isFinite(gauss(rand))).toBe(true);
  });

  it('is reproducible, since the tables built from it are baked at module load', () => {
    const a = mulberry32(5);
    const b = mulberry32(5);
    for (let i = 0; i < 100; i++) expect(gauss(a)).toBe(gauss(b));
  });
});
