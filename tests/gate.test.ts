// tests/gate.test.ts
// The gate's POLICY, which is where every way this feature can lock a visitor out of the site lives. These
// are unit tests rather than DOM tests on purpose: this repo has no jsdom (distSmoke reads built HTML with
// regexes) and driving a browser is forbidden, so anything that must be proven has to be a pure function.
import { describe, expect, it, vi } from 'vitest';
import {
  GATE_DISMISS_MS, GATE_SEEN_KEY, type GateStore,
  dismissMs, hasSeenGate, markGateSeen, shouldRaiseGate,
} from '../src/lib/gate';

const okStore = (seed: Record<string, string> = {}): GateStore => {
  const m = new Map(Object.entries(seed));
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => { m.set(k, v); },
  };
};

const throwingStore = (): GateStore => ({
  getItem: () => { throw new Error('denied'); },
  setItem: () => { throw new Error('denied'); },
});

describe('shouldRaiseGate — the lockout-safety decision', () => {
  it('raises on a first visit', () => {
    expect(shouldRaiseGate(okStore())).toBe(true);
  });

  it('does not raise once the session has seen it', () => {
    expect(shouldRaiseGate(okStore({ [GATE_SEEN_KEY]: '1' }))).toBe(false);
  });

  it('FAILS CLOSED when storage throws', () => {
    // Private mode and disabled storage both throw on access. Raising a gate we cannot remember
    // dismissing risks showing it on every navigation; worse, a throw mid-raise could leave the page
    // scroll-locked with nothing to dismiss. Not raising costs an animation; raising costs the site.
    expect(shouldRaiseGate(throwingStore())).toBe(false);
  });

  it('FAILS CLOSED when there is no storage at all', () => {
    expect(shouldRaiseGate(null)).toBe(false);
  });
});

describe('hasSeenGate / markGateSeen never throw', () => {
  it('reports seen when storage is broken, so callers take the safe branch', () => {
    expect(hasSeenGate(throwingStore())).toBe(true);
    expect(hasSeenGate(null)).toBe(true);
  });

  it('swallows a failing write rather than breaking the dismissal', () => {
    // The write happens during dismissal. If it threw, the gate would stay up.
    expect(() => markGateSeen(throwingStore())).not.toThrow();
    expect(() => markGateSeen(null)).not.toThrow();
  });

  it('round-trips through a working store', () => {
    const s = okStore();
    expect(hasSeenGate(s)).toBe(false);
    markGateSeen(s);
    expect(hasSeenGate(s)).toBe(true);
  });
});

describe('dismissMs — why dismissal is a timer and not a transitionend', () => {
  it('is zero under reduced motion', () => {
    // Under reduced motion there is no transition, so transitionend never fires. Anything waiting on
    // it to unlock scroll and clear `inert` would hang forever and the page would stay locked.
    expect(dismissMs(true)).toBe(0);
  });

  it('matches the CSS duration otherwise', () => {
    expect(dismissMs(false)).toBe(GATE_DISMISS_MS);
  });
});

describe('the dismissal is idempotent', () => {
  it('marking twice leaves one value and does not throw', () => {
    const set = vi.fn();
    const store: GateStore = { getItem: () => '1', setItem: set };
    markGateSeen(store);
    markGateSeen(store);
    expect(set).toHaveBeenCalledTimes(2);
    expect(hasSeenGate(store)).toBe(true);
  });
});
