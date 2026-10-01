// tests/gate.test.ts
// The gate's POLICY, which is where every way this feature can lock a visitor out of the site lives. These
// are unit tests rather than DOM tests on purpose: this repo has no jsdom (distSmoke reads built HTML with
// regexes) and driving a browser is forbidden, so anything that must be proven has to be a pure function.
import { describe, expect, it, vi } from 'vitest';
import {
  GATE_DISMISS_MS, GATE_SEEN_KEY, type GateStore,
  GATE_REVEAL_EVENT, GATE_UP_ATTR,
  dismissMs, hasSeenGate, isCovered, isFreshLoad, markGateSeen, shouldRaiseGate,
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
    expect(shouldRaiseGate(okStore(), true)).toBe(true);
  });

  it('does not raise once the session has seen it', () => {
    expect(shouldRaiseGate(okStore({ [GATE_SEEN_KEY]: '1' }), true)).toBe(false);
  });

  it('FAILS CLOSED when storage throws', () => {
    // Private mode and disabled storage both throw on access. Raising a gate we cannot remember
    // dismissing risks showing it on every navigation; worse, a throw mid-raise could leave the page
    // scroll-locked with nothing to dismiss. Not raising costs an animation; raising costs the site.
    expect(shouldRaiseGate(throwingStore(), true)).toBe(false);
  });

  it('FAILS CLOSED when there is no storage at all', () => {
    expect(shouldRaiseGate(null, true)).toBe(false);
  });

  it('DOES NOT RAISE on a client-side navigation, even with the flag unset', () => {
    // THE RULE WAS INCOMPLETE AND THE SITE PAID FOR IT. The gate's inline script lives only in /'s HTML,
    // so for a visitor whose entry page is something else — arriving on /research from a search result,
    // which is the indexed entry — Astro's ClientRouter does not find it in `scriptsAlreadyRan` and
    // EXECUTES it when they click "home". sessionStorage is unset at that moment, so the old rule raised
    // a full-screen interstitial over a homepage the visitor was already navigating to. BaseLayout's veil
    // script has carried a `__descentVeilInit` "first load only" guard for exactly this reason.
    //
    // "Fresh load" is therefore part of the policy, not an implementation detail of the script.
    expect(shouldRaiseGate(okStore(), false)).toBe(false);
  });

  it('is false when neither condition holds', () => {
    expect(shouldRaiseGate(okStore({ [GATE_SEEN_KEY]: '1' }), false)).toBe(false);
  });
});

describe('isFreshLoad — how the script tells a parse from a re-run', () => {
  it('is true only while the document is still parsing', () => {
    // An inline script runs during parse on a real load (readyState 'loading'); when ClientRouter
    // re-executes it after a swap the document is already 'complete'. That difference is the whole test.
    expect(isFreshLoad('loading')).toBe(true);
    expect(isFreshLoad('interactive')).toBe(false);
    expect(isFreshLoad('complete')).toBe(false);
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

describe('isCovered — do not animate what nobody can see', () => {
  // MEASURED WASTE, not a theory. While the gate is up, two full-screen workloads run behind an opaque
  // layer and produce zero visible pixels: TerrainHero's 2D canvas loop (its IntersectionObserver reports
  // the hero as visible, because the gate is a separate position:fixed element, not an ancestor) and
  // FluidSky's WebGL shader (which only pauses on visibilitychange, i.e. the tab being hidden). And because
  // this is a CLICK gate rather than a timed one, the waste is unbounded — reading the title card for ten
  // seconds buys ten seconds of invisible WebGL.
  //
  // Deferring is safe because TerrainHero paints its static frame at line 186, unconditionally, BEFORE the
  // loop block. So a deferred hero is not cold at the reveal: it is the finished static frame, which is also
  // exactly what the site already ships under reduced motion.
  const el = (attrs: string[]) => ({ hasAttribute: (n: string) => attrs.includes(n) });

  it('reports covered when the root carries the gate attribute', () => {
    expect(isCovered(el([GATE_UP_ATTR]))).toBe(true);
  });

  it('reports clear when it does not', () => {
    expect(isCovered(el([]))).toBe(false);
  });

  it('FAILS OPEN on a missing root, so animation never gets stuck off', () => {
    // The opposite asymmetry to hasSeenGate. There, failing closed avoids a lockout. Here, "covered"
    // suppresses motion — so an unknown state must read as CLEAR, or a page with no gate at all (every
    // route except /) could sit frozen.
    expect(isCovered(null)).toBe(false);
    expect(isCovered(undefined)).toBe(false);
  });

  it('pins the cross-file contract', () => {
    // These two strings are a seam between four files: Gate.astro sets and clears the attribute and fires
    // the event; TerrainHero and FluidSky read them. A typo in any one of them would silently leave the
    // animation paused forever, which looks like a broken hero rather than a missing optimisation.
    expect(GATE_UP_ATTR).toBe('data-gate-up');
    expect(GATE_REVEAL_EVENT).toBe('descent:revealed');
  });
});
