// tests/gate.test.ts
// The gate's POLICY, which is where every way this feature can lock a visitor out of the site lives. These
// are unit tests rather than DOM tests on purpose: this repo has no jsdom (distSmoke reads built HTML with
// regexes) and driving a browser is forbidden, so anything that must be proven has to be a pure function.
import { describe, expect, it } from 'vitest';
import {
  ENTRANCE_AZ_SWING,
  ENTRANCE_BREATH_CYCLES,
  ENTRANCE_BREATH_FROM,
  ENTRANCE_EDL_SIZE_FROM,
  ENTRANCE_ELEV_EMPHASIS_FROM,
  ENTRANCE_MS,
  ENTRANCE_ZOOM_FROM,
  GATE_DISMISS_MS,
  GATE_LAND_EVENT,
  GATE_REVEAL_EVENT,
  GATE_SEEN_KEY,
  GATE_UP_ATTR,
  breathPhaseOffset,
  dismissMs,
  entranceProgress,
  hasSeenGate,
  isCovered,
  isFreshLoad,
  markGateSeen,
  shouldRaiseGate,
  type GateStore,
} from '../src/lib/gate';
import {
  BREATH_AMP_LIVE,
  BREATH_OMEGA,
  BREATH_PERIOD_S,
  TERRAIN_CONFIG_DEFAULTS,
  terrainConfig,
  terrainPalette,
} from '../src/lib/terrainRender';

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
  it('marking twice leaves one value, and reads back as seen', () => {
    // REWRITTEN BECAUSE IT ASSERTED THE OPPOSITE OF ITS OWN TITLE. The stub was
    // `{ getItem: () => '1', setItem: vi.fn() }`, so `hasSeenGate` returned true before `markGateSeen` had done
    // anything — the second assertion could not fail — and the first asserted `setItem` ran TWICE, which is
    // what idempotent would NOT mean. Both passed while testing nothing.
    //
    // A real in-memory store instead: write twice, and check the store ends up holding exactly one key with the
    // flag in it. That is the property the name promises, and it is the one that matters — a visitor who
    // dismisses the gate must not accumulate session keys.
    const mem = new Map<string, string>();
    const store: GateStore = {
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => { mem.set(k, v); },
    };
    markGateSeen(store);
    markGateSeen(store);
    expect(mem.size, 'marking twice left more than one key behind').toBe(1);
    expect(hasSeenGate(store)).toBe(true);
    // And it genuinely transitioned: a fresh store must read as unseen, or the assertion above is vacuous.
    expect(hasSeenGate({ getItem: () => null, setItem: () => {} })).toBe(false);
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

describe('the entrance lands on the HERO\'s frame, exactly', () => {
  // THE ASSERTION THIS WHOLE FILE EXISTS FOR. The overlay and the hero paint the same field through the same
  // renderer; the overlay is removed once its camera and tempo reach the hero's. `zoom` is simultaneously
  // position AND dot radius, and `breathAmp` displaces every dot by up to ±8.8 CSS px at the hero's measured
  // box — so an axis that lands at 0.98 of its target is a visible jump of the entire picture.
  const hero = terrainConfig(false);

  it('every tweened axis reaches its hero value at the landing frame', () => {
    const p = entranceProgress(ENTRANCE_MS);
    // THIS one is exact, and it is the only one that can be. See below.
    expect(p).toBe(1);

    // Each axis is `open + (hero - open) * p`, so p === 1 is what makes all of them land. Spelled out per
    // axis rather than asserted once, because the failure mode is one axis wired to a different curve.
    //
    // CLOSE, NOT EXACT, AND THAT IS NOT THE ASSERTION BEING LOOSENED TO PASS. `0.30 + (0.04 - 0.30) * 1`
    // is 0.03999999999999998 in IEEE-754 — a lerp through p=1 does not return its endpoint for most pairs.
    // The reason that never ships is that the painter does not rely on the lerp at the landing frame: its
    // `heroFrame()` assigns `cfg.zoom = HERO_ZOOM` and friends outright, so the final paint uses the hero's
    // own values by identity, not by arithmetic. What these assertions protect is the axis being wired to
    // the right endpoint at all; the exactness is protected by the snap, which the dist smoke test pins.
    const EPS = 1e-12;
    expect(ENTRANCE_ZOOM_FROM + (1 - ENTRANCE_ZOOM_FROM) * p).toBeCloseTo(1, 12);
    expect(ENTRANCE_BREATH_FROM + (BREATH_AMP_LIVE - ENTRANCE_BREATH_FROM) * p)
      .toBeCloseTo(BREATH_AMP_LIVE, 12);
    expect(Math.abs(hero.light.az + ENTRANCE_AZ_SWING * (1 - p) - hero.light.az)).toBeLessThan(EPS);
    expect(ENTRANCE_EDL_SIZE_FROM + (hero.edlSizeRange - ENTRANCE_EDL_SIZE_FROM) * p)
      .toBeCloseTo(hero.edlSizeRange, 12);
    expect(ENTRANCE_ELEV_EMPHASIS_FROM + (hero.elevEmphasis - ENTRANCE_ELEV_EMPHASIS_FROM) * p)
      .toBeCloseTo(hero.elevEmphasis, 12);
  });

  it('arrives rather than still moving — the eased landing derivative is zero', () => {
    // A linear ramp reaches the target at full speed and the handover reads as a cut. Measured as a finite
    // difference over the last millisecond of the entrance.
    const d = (entranceProgress(ENTRANCE_MS) - entranceProgress(ENTRANCE_MS - 1)) * 1000;
    expect(d).toBeLessThan(0.02);
  });

  it('opens pulled BACK, so the entrance descends toward the hero rather than pushing past it', () => {
    expect(ENTRANCE_ZOOM_FROM).toBeLessThan(1);
    // Not so far back that the field reads as a logo in an empty screen — the camera is a single uniform
    // scale about a fixed centre, so there is nothing else out there to look at.
    expect(ENTRANCE_ZOOM_FROM).toBeGreaterThanOrEqual(0.4);
  });

  it('opens as a swell and calms to the hero breath, not the other way round', () => {
    // The parameter survey's note: 0.1+ reads as a swell rather than a breath. The intro has to start above
    // that and end exactly on the hero's value.
    expect(ENTRANCE_BREATH_FROM).toBeGreaterThan(0.1);
    expect(ENTRANCE_BREATH_FROM).toBeGreaterThan(BREATH_AMP_LIVE);
  });

  it('resolves the silhouette upward — the relief is acquired, not present from frame one', () => {
    expect(ENTRANCE_EDL_SIZE_FROM).toBeLessThan(hero.edlSizeRange);
    expect(ENTRANCE_ELEV_EMPHASIS_FROM).toBeLessThan(hero.elevEmphasis);
  });

  it('is monotonic and clamped outside its window', () => {
    // The painter is driven by a wall clock it does not control: a dropped frame, a backgrounded tab, or the
    // gesture-skip path can all hand it a time outside [0, ENTRANCE_MS].
    expect(entranceProgress(-500)).toBe(0);
    expect(entranceProgress(ENTRANCE_MS * 3)).toBe(1);
    let prev = -Infinity;
    for (let ms = 0; ms <= ENTRANCE_MS; ms += 20) {
      const v = entranceProgress(ms);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe('the breath phase offset is a WHOLE number of periods', () => {
  // THE ONE NON-OBVIOUS PIECE OF ARITHMETIC IN THE ENTRANCE, and the reason it is a tested function.
  //
  // The field must read as FLOWING, which means running the breath clock fast — the real period is
  // 2π/0.4 = 15.71s, so over a 2.6s intro the unwarped field advances through only 17% of a cycle and merely
  // drifts. But `tsec` must ALSO equal the hero's `rAF timestamp / 1000` at the landing frame. Those are only
  // compatible because `sin` is periodic: burn a whole number of periods and the phase landed on is the phase
  // you would have had without the detour.
  it('is zero at the landing, so the clock equals the hero\'s exactly', () => {
    expect(breathPhaseOffset(1, BREATH_PERIOD_S)).toBe(0);
  });

  it('is a whole number of periods at the opening — any other size displaces every dot', () => {
    const open = breathPhaseOffset(0, BREATH_PERIOD_S);
    expect(open).toBeCloseTo(ENTRANCE_BREATH_CYCLES * BREATH_PERIOD_S, 10);
    expect(Number.isInteger(ENTRANCE_BREATH_CYCLES)).toBe(true);
    // The property that matters, stated directly: the breath term is unchanged by the opening offset.
    const at = (t: number) => Math.sin(t * BREATH_OMEGA);
    expect(at(1234.5 - open)).toBeCloseTo(at(1234.5), 10);
  });

  it('decays with a zero landing derivative, so the tempo returns smoothly to 1x', () => {
    // `(1-p)` would also land at zero but would step the clock's rate down from ~7x at the final frame.
    const d = (breathPhaseOffset(1, BREATH_PERIOD_S) - breathPhaseOffset(1 - 1e-4, BREATH_PERIOD_S)) / 1e-4;
    expect(Math.abs(d)).toBeLessThan(0.02);
  });

  it('runs the clock FORWARD — it is subtracted, so it must be non-negative and shrinking', () => {
    let prev = Infinity;
    for (let p = 0; p <= 1.0001; p += 0.02) {
      const v = breathPhaseOffset(p, BREATH_PERIOD_S);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(prev + 1e-12);
      prev = v;
    }
  });

  it('clamps, because progress is derived from that same uncontrolled clock', () => {
    expect(breathPhaseOffset(-1, BREATH_PERIOD_S)).toBe(ENTRANCE_BREATH_CYCLES * BREATH_PERIOD_S);
    expect(breathPhaseOffset(9, BREATH_PERIOD_S)).toBe(0);
  });
});

describe('the two scripts agree on their one channel', () => {
  // The policy script is `is:inline` (it must beat first paint) and the painter is bundled (it must import
  // the renderer), so they cannot share a module — they share two EVENT NAMES, handed to the inline half
  // through define:vars. Exported rather than written twice: a typo in either copy would break the handshake
  // in the direction that leaves an overlay on screen, with each half still internally consistent.
  it('exports both event names, and they are distinct', () => {
    expect(GATE_LAND_EVENT).toMatch(/^descent:/);
    expect(GATE_REVEAL_EVENT).toMatch(/^descent:/);
    expect(GATE_LAND_EVENT).not.toBe(GATE_REVEAL_EVENT);
  });

  it('the session key is versioned, so a redesign is visible on reload', () => {
    // During a run of design iterations an unversioned key is actively misleading: the owner reloads, the
    // flag is already set, and the change looks like it did not ship.
    expect(GATE_SEEN_KEY).toMatch(/\.v\d+$/);
  });
});

describe('the per-theme picture is shared, not copied', () => {
  // `terrainPalette`/`terrainConfig` moved out of TerrainHero's private `themePalette()` because the entrance
  // paints the same field and must land on the hero's frame. A second copy that drifted by one number would
  // turn a continuation into a visible jump.
  it('dotScale is per-theme and is NOT the config default — the easiest one to get wrong', () => {
    expect(terrainPalette(false).dotScale).toBeCloseTo(1.08, 6);
    expect(terrainPalette(true).dotScale).toBeCloseTo(1.18, 6);
    expect(TERRAIN_CONFIG_DEFAULTS.dotScale).toBe(1);
  });

  it('hands back a FRESH object per call, so two painters cannot share one camera', () => {
    // The entrance mutates zoom/light/edlSizeRange/elevEmphasis on its own copy every frame.
    const a = terrainConfig(false);
    const b = terrainConfig(false);
    expect(a).not.toBe(b);
    expect(a.light).not.toBe(b.light);
    a.zoom = 0.1;
    a.light.az = 99;
    expect(b.zoom).toBe(TERRAIN_CONFIG_DEFAULTS.zoom);
    expect(b.light.az).not.toBe(99);
  });

  it('starfield follows darkness, which is the dark theme\'s whole conceit', () => {
    expect(terrainConfig(true).starfield).toBe(true);
    expect(terrainConfig(false).starfield).toBe(false);
  });
});
