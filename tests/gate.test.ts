// tests/gate.test.ts
// The gate's POLICY, which is where every way this feature can lock a visitor out of the site lives. These
// are unit tests rather than DOM tests on purpose: this repo has no jsdom (distSmoke reads built HTML with
// regexes) and driving a browser is forbidden, so anything that must be proven has to be a pure function.
import { describe, expect, it } from 'vitest';
import {
  CROSSOVER_MS,
  CROSSOVER_START_MS,
  ENTRANCE_MS,
  ENTRANCE_ZOOM_FROM,
  GATE_DISMISS_MS,
  HALO_PEAK,
  HALO_PEAK_AT,
  GATE_LAND_EVENT,
  GATE_REVEAL_EVENT,
  GATE_SEEN_KEY,
  GATE_UP_ATTR,
  NAME_TRAVEL_MS,
  NAME_TRAVEL_START_MS,
  crossover,
  dismissMs,
  entranceProgress,
  entranceZoom,
  haloAt,
  haloScale,
  hasSeenGate,
  lightness,
  isCovered,
  isFreshLoad,
  markGateSeen,
  nameTravel,
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

describe('the entrance camera lands EXACTLY on the hero\'s', () => {
  // THE ONE ASSERTION THIS WHOLE FILE EXISTS FOR, now that the entrance is a continuation rather than a
  // crossfade. The overlay is removed at ENTRANCE_MS and the hero is underneath it painting the same field
  // through the same renderer; if the overlay's camera is at 0.98 of the hero's at that instant, the removal
  // is a visible jump of the entire picture -- the single frame the design exists to make invisible.
  it('reaches 1 at the landing frame, not merely close to it', () => {
    expect(entranceZoom(ENTRANCE_MS)).toBe(1);
    expect(entranceProgress(ENTRANCE_MS)).toBe(1);
  });

  it('starts pulled BACK, so the entrance descends toward the hero rather than pushing past it', () => {
    expect(entranceZoom(0)).toBe(ENTRANCE_ZOOM_FROM);
    expect(ENTRANCE_ZOOM_FROM).toBeLessThan(1);
    // Not so far back that the terrain reads as a logo in the middle of an empty screen -- the camera is a
    // single uniform scale about a fixed centre, so there is nothing else to look at out there.
    expect(ENTRANCE_ZOOM_FROM).toBeGreaterThanOrEqual(0.5);
  });

  it('is monotonic, and covers most of its distance EARLY (ease-out, not ease-in-out)', () => {
    let prev = -Infinity;
    for (let ms = 0; ms <= ENTRANCE_MS; ms += 25) {
      const z = entranceZoom(ms);
      expect(z).toBeGreaterThanOrEqual(prev);
      prev = z;
    }
    // Half the clock must buy well over half the distance. An ease-in-out would put ~0.5 here, which is the
    // "first third looks like nothing is happening" impression this entrance replaced.
    expect(entranceProgress(ENTRANCE_MS / 2)).toBeGreaterThan(0.8);
  });

  it('clamps outside its window, because the painter is driven by a wall clock it does not control', () => {
    // A dropped frame, a backgrounded tab or the gesture-skip path can all hand it a time past the end.
    expect(entranceZoom(-500)).toBe(ENTRANCE_ZOOM_FROM);
    expect(entranceZoom(ENTRANCE_MS * 3)).toBe(1);
    expect(nameTravel(-1)).toBe(0);
    expect(nameTravel(ENTRANCE_MS * 3)).toBe(1);
  });
});

describe('the name finishes travelling before the overlay is removed', () => {
  // The name is a FLIP: a stand-in flies to the hero's own name and the hero's copy is hidden until it lands.
  // If the travel were still running at ENTRANCE_MS the stand-in would be deleted mid-flight and the real name
  // would appear somewhere else -- a visible jump of the one element a reader is looking at.
  it('lands at or before the landing frame', () => {
    expect(NAME_TRAVEL_START_MS + NAME_TRAVEL_MS).toBeLessThanOrEqual(ENTRANCE_MS);
    expect(nameTravel(NAME_TRAVEL_START_MS + NAME_TRAVEL_MS)).toBe(1);
    expect(nameTravel(ENTRANCE_MS)).toBe(1);
  });

  it('does not start until the camera has established the field', () => {
    // Both moving from frame 0 reads as one slide rather than as an arrival. The name holds centre while the
    // terrain pulls in, THEN goes to its place.
    expect(nameTravel(0)).toBe(0);
    expect(nameTravel(NAME_TRAVEL_START_MS)).toBe(0);
    expect(NAME_TRAVEL_START_MS).toBeGreaterThan(ENTRANCE_MS * 0.4);
  });

  it('is monotonic', () => {
    let prev = -Infinity;
    for (let ms = 0; ms <= ENTRANCE_MS; ms += 25) {
      const t = nameTravel(ms);
      expect(t).toBeGreaterThanOrEqual(prev);
      prev = t;
    }
  });
});

describe('the crossover: the ground and the ink move together, late and fast', () => {
  // THE DEFECT THIS PINS WAS MEASURED, NOT GUESSED. The name's lightness ramp (ivory -> ink) and its
  // background's (opaque dark -> luminous sky) have to cross. Run on separate wide clocks they crossed slowly
  // at nearly the same rate and HUGGED: composited, the moving name measured dL* 6 against what was behind it
  // at ~1450ms — the just-noticeable difference, i.e. invisible, right where the eye was tracking it.
  it('does not begin until the name has nearly finished travelling', () => {
    // The whole journey therefore happens at the entrance's highest-contrast state: ivory on the opaque ground.
    expect(crossover(NAME_TRAVEL_START_MS)).toBe(0);
    expect(crossover(CROSSOVER_START_MS - 1)).toBe(0);
    expect(nameTravel(CROSSOVER_START_MS)).toBeGreaterThan(0.9);
  });

  it('finishes BEFORE the overlay is removed', () => {
    // The stand-in must already be the hero's colour at the landing frame, or the removal is a colour pop on
    // the one element the reader is looking at.
    expect(CROSSOVER_START_MS + CROSSOVER_MS).toBeLessThanOrEqual(ENTRANCE_MS);
    expect(crossover(ENTRANCE_MS)).toBe(1);
  });

  it('is short enough that the two ramps pass each other in a couple of frames', () => {
    // At 1050ms (the first build's ground fade) the crossing was slow enough to read as the name dissolving.
    expect(CROSSOVER_MS).toBeLessThanOrEqual(600);
  });

  it('is monotonic and clamped', () => {
    expect(crossover(-1000)).toBe(0);
    expect(crossover(ENTRANCE_MS * 3)).toBe(1);
    let prev = -Infinity;
    for (let ms = 0; ms <= ENTRANCE_MS; ms += 10) {
      const p = crossover(ms);
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
  });
});

describe('the legibility halo is alive ONLY while the ramps pass', () => {
  it('is exactly zero at both ends', () => {
    // At p=0 the ground is fully opaque and an ivory name needs no help — a glow there would be the one soft
    // thing on an otherwise clean title card. At p=1 the stand-in sits exactly on the hero's own name one frame
    // before the overlay is removed, so ANY halo is a difference between the two: the single frame this design
    // exists to make invisible. Both are assertions about the design, not about the arithmetic.
    expect(haloAt(0)).toBe(0);
    expect(haloAt(1)).toBe(0);
    expect(haloAt(-5)).toBe(0);
    expect(haloAt(99)).toBe(0);
  });

  it('peaks where the crossing is, and only there', () => {
    expect(haloAt(HALO_PEAK_AT)).toBeCloseTo(HALO_PEAK, 6);
    for (let p = 0; p <= 1.0001; p += 0.02) {
      expect(haloAt(p)).toBeLessThanOrEqual(HALO_PEAK + 1e-9);
      expect(haloAt(p)).toBeGreaterThanOrEqual(0);
    }
  });

  it('stays moderate, because a strong glow reads THROUGH the italic surname', () => {
    // "Tian" is italic at weight 500, so its strokes are thin, and a 28px paper glow behind thin strokes washes
    // their antialiased edges out — the heavy roman "Ing" gained contrast while the italic lost it. This bound
    // is the measured ceiling, so a later "make it pop" retune has to come past this comment.
    expect(HALO_PEAK).toBeLessThanOrEqual(0.6);
  });

  it('rises and falls without a jump', () => {
    let prevSlopeSign = 0;
    let flips = 0;
    let prev = haloAt(0);
    for (let p = 0.01; p <= 1.0001; p += 0.01) {
      const v = haloAt(p);
      expect(Math.abs(v - prev)).toBeLessThan(0.06); // no step discontinuity anywhere
      const s = Math.sign(v - prev);
      if (s !== 0 && s !== prevSlopeSign) { flips += 1; prevSlopeSign = s; }
      prev = v;
    }
    expect(flips, 'the halo should rise once and fall once, not oscillate').toBeLessThanOrEqual(2);
  });
});

describe('the halo is a LIGHT-theme fix and must switch itself off in dark', () => {
  // The themes rule: "verify BOTH — regressions hide in the theme you didn't look at." This one did. The halo
  // covers the name's ivory -> ink crossing, and in dark there is no crossing: both role tokens are cool
  // near-whites, so the name stays near-white over a dark ground and a dark sky. Firing it anyway put a
  // near-white glow behind near-white glyphs and only washed their edges out.
  const PAPER_LIGHT = [0xef, 0xe9, 0xdd] as const;
  const INK1_LIGHT = [0x16, 0x14, 0x0f] as const;
  const PAPER_DARK = [0xdf, 0xe3, 0xdf] as const;
  const INK1_DARK = [0xdc, 0xe1, 0xdc] as const;

  it('reads the tokens as the measurements the doc comment quotes', () => {
    // Pinned so the comment and the code cannot drift: if a token is retuned, this says so.
    expect(lightness(PAPER_LIGHT)).toBeCloseTo(92.5, 0);
    expect(lightness(INK1_LIGHT)).toBeCloseTo(6.4, 0);
    expect(lightness(PAPER_DARK)).toBeCloseTo(89.4, 0);
    expect(lightness(INK1_DARK)).toBeCloseTo(89.0, 0);
  });

  it('is full strength in light and off in dark', () => {
    expect(haloScale(PAPER_LIGHT, INK1_LIGHT)).toBe(1);
    expect(haloScale(PAPER_DARK, INK1_DARK)).toBeLessThan(0.05);
  });

  it('is driven by the travel, not by a theme branch', () => {
    // Identical endpoints mean nothing to cover, whatever the theme is called.
    expect(haloScale(PAPER_LIGHT, PAPER_LIGHT)).toBe(0);
    // And it saturates rather than exceeding 1, so a bigger palette cannot push the glow past its cap.
    expect(haloScale([0, 0, 0], [255, 255, 255])).toBe(1);
  });
});

describe('the two scripts agree on their one channel', () => {
  // The policy script is `is:inline` (it must beat first paint) and the painter is bundled (it must import the
  // renderer), so they cannot share a module -- they share an EVENT NAME, handed to the inline half through
  // define:vars. It was a literal string in both halves for one build; a typo in either would have broken the
  // handshake in the direction that leaves an overlay on screen, with each half still internally consistent.
  it('exports the land event rather than leaving it to be written twice', () => {
    expect(GATE_LAND_EVENT).toMatch(/^descent:/);
    expect(GATE_LAND_EVENT).not.toBe(GATE_REVEAL_EVENT);
  });
});
