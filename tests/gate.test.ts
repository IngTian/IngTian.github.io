// tests/gate.test.ts
// The gate's POLICY, which is where every way this feature can lock a visitor out of the site lives. These
// are unit tests rather than DOM tests on purpose: this repo has no jsdom (distSmoke reads built HTML with
// regexes) and driving a browser is forbidden, so anything that must be proven has to be a pure function.
import { describe, expect, it, vi } from 'vitest';
import {
  GATE_DISMISS_MS,
  GATE_OPACITY_PEAK,
  GATE_OPACITY_RAMP,
  GATE_OPEN_PHASE,
  GATE_REVEAL_EVENT,
  GATE_SEEN_KEY,
  GATE_UP_ATTR,
  dismissMs,
  drawnFrac,
  hasSeenGate,
  isCovered,
  isFreshLoad,
  markGateSeen,
  offsetFrac,
  opacityAt,
  shouldRaiseGate,
  type GateStore,
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

describe('the stroke animation, and the pairing that stops lines vanishing', () => {
  it('reproduces the source: drawn length 0.3 -> 1, offset a 0 -> 1 -> 0 triangle', () => {
    expect(drawnFrac(0)).toBeCloseTo(0.3, 6);
    expect(drawnFrac(1)).toBeCloseTo(1, 6);
    expect(offsetFrac(0)).toBeCloseTo(0, 6);
    expect(offsetFrac(0.5)).toBeCloseTo(1, 6);
    expect(offsetFrac(1)).toBeCloseTo(0, 6);
    // Monotone between the ends, so a stroke never stutters or reverses mid-sweep.
    for (let i = 1; i <= 50; i++) expect(drawnFrac(i / 50)).toBeGreaterThan(drawnFrac((i - 1) / 50));
  });

  it('TAKES THE ENVELOPE TO ZERO EXACTLY WHERE THE DRAWN LENGTH JUMPS', () => {
    // THE DEFECT THIS PINS, in the owner's words: "there are lines that vanish suddenly which is not good.
    // entire lines go dark immediately."
    //
    // drawnFrac is a sawtooth — it ends the cycle at 1 and begins the next at 0.3, with that fragment sitting
    // at the curve's off-screen start. That discontinuity is unavoidable and is in the reference too. What made
    // it VISIBLE was the source's envelope being 0.3 rather than 0 at the boundary. So the invariant is not
    // "opacity is a triangle", nor the peak's value — either could be retuned — it is that the envelope is zero
    // at the one t where the drawn length is discontinuous. The two are only correct together, and nothing else
    // in the codebase would notice if one were changed alone.
    const jump = Math.abs(drawnFrac(1) - drawnFrac(0));
    expect(jump, 'the sawtooth is gone; this test is now asserting nothing').toBeGreaterThan(0.5);
    expect(opacityAt(0), 'a stroke is visible at the instant its length snaps').toBeCloseTo(0, 6);
    expect(opacityAt(1), 'a stroke is visible at the instant its length snaps').toBeCloseTo(0, 6);
  });

  it('PLATEAUS rather than peaking, so the fix costs no brightness', () => {
    // The zero-crossing above is only half of it — an envelope that is zero everywhere also satisfies it. But
    // the naive `PEAK * tri` that satisfies both is still wrong here, and this is the assertion that says why:
    // it is near zero for a long stretch either side of the boundary, so most of the cycle would be dimmer than
    // the build the owner approved. Worse, `tri` peaks at t = 0.5, which is the ONE moment the dash has slid
    // entirely off the path and nothing is painted at all (see offsetFrac). So the envelope has to be flat
    // across the cycle's middle, not pointed at it.
    const mid = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8].map(opacityAt);
    for (const v of mid) expect(v).toBeCloseTo(GATE_OPACITY_PEAK, 6);
    // Flat over roughly the middle 85%: zero only in a narrow band at each end.
    expect(opacityAt(GATE_OPACITY_RAMP / 2)).toBeCloseTo(GATE_OPACITY_PEAK, 6);
    expect(opacityAt(0.02)).toBeLessThan(GATE_OPACITY_PEAK * 0.5);

    // The plateau is pinned to the approved build's brightness, NOT to a number I liked. That build used
    // `0.3 + 0.3 * tri` and opened at t ~= 0.16, which evaluates to 0.40; the source's own peak is 0.60. An
    // envelope outside that bracket is a brightness change the owner did not ask for.
    expect(GATE_OPACITY_PEAK).toBeGreaterThanOrEqual(0.4);
    expect(GATE_OPACITY_PEAK).toBeLessThanOrEqual(0.6);

    // And it must approach zero smoothly rather than stepping, or the fade reads as a blink.
    for (let i = 1; i <= 20; i++) {
      expect(Math.abs(opacityAt(i / 400) - opacityAt((i - 1) / 400))).toBeLessThan(0.02);
    }
  });

  it('opens where the arc is actually painted across the visible frame', () => {
    // The painted fraction is NOT the drawn fraction: with dasharray "drawn len" and dashoffset -tri*len, a
    // point p is painted when ((p - tri*len) mod (drawn+len)) < drawn. Integrating that across the cycle gives
    // 0.30 at t=0, a maximum near t=0.25, ZERO at t=0.5, and 1.00 as t -> 1. So two otherwise-reasonable
    // opening phases are both wrong: 0 paints only the curve's first 30%, which is off the top-left corner, and
    // 0.5 paints nothing — it rendered as an empty screen when tried.
    const paintedFrac = (t: number): number => {
      const drawn = drawnFrac(t);
      const period = drawn + 1;
      const tri = offsetFrac(t);
      let hit = 0;
      const N = 2000;
      for (let i = 0; i < N; i++) {
        let ph = ((i / N) - tri) % period;
        if (ph < 0) ph += period;
        if (ph < drawn) hit++;
      }
      return hit / N;
    };
    expect(paintedFrac(0.5), 'the triangle peak paints nothing — never open there').toBeCloseTo(0, 2);
    expect(paintedFrac(GATE_OPEN_PHASE), 'the opening phase paints too little of the arc').toBeGreaterThan(0.35);
    // ...and the opening must land on the envelope's plateau, or the gate opens dimmer than it runs.
    expect(opacityAt(GATE_OPEN_PHASE)).toBeCloseTo(GATE_OPACITY_PEAK, 6);
  });
});
