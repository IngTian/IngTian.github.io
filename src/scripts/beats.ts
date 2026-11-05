// src/scripts/beats.ts
// THE BEAT WALK the three explainer slides share (sections/Choice, Rules and Solve): while the slide is on screen
// its beats step on their own, and a reader can take the wheel by clicking a beat or arrowing through them. Its
// pure half, the key map, is lib/beats.ts. A slide brings only what is its own: how a beat is painted, its two
// dwells, and the options on `Beats`.
//
// FROZEN ONCE CLICKED, and it stays frozen. The owner: "once i clicked it should freeze there (i dont know if it's
// wise to add a timer so it starts automatic again) i need time to read."
// It is not wise, so there is no resume timer. A timer that restarts is the original complaint in a new costume:
// it would pull the slide out from under a reader in the middle of the beat they deliberately asked for. No
// interval is both long enough to be safe for a chart that takes a while to read and short enough to feel
// automatic. The walk exists to show a reader there is something here; a click says they already know, and from
// then on the slide is theirs.
//
// Arrow keys walk the beats as a tablist does, so a keyboard reader need not tab through every beat to reach the
// last, and arrowing freezes too: it is just as deliberate as a click.
import { arrowBeat } from '../lib/beats';
import { prefersReducedMotion } from '../lib/motion';

/** Every beat but the last holds this long, on all three slides. */
const HOLD_MS = 4600;

export interface Beats {
  /** The beat buttons, in order. */
  buttons: HTMLElement[];
  /** Paint beat `i`. `animate` is false for the first paint and the reduced-motion rest, true for a pick or a step
   *  (Solve replays move one's reveal on it). */
  show: (i: number, animate: boolean) => void;
  /** Ms from the slide being seen to the walk's first step. */
  firstMs: number;
  /** Ms the last beat holds. */
  lastMs: number;
  /** Under reduced motion, paint this finished state instead of resting on the last beat, and take clicks only:
   *  the arrow keys stay the page's there. */
  still?: () => void;
  /** Runs each time the walk starts on screen, with the beat it starts from. */
  onSeen?: (step: number) => void;
  /** The slide's own teardown, run after the walk's. */
  teardown?: () => void;
}

/** On every astro:page-load, tear down the last walk, find `selector` and walk the beats `setup` hands back. Setup
 *  returns null to leave the slide to its CSS default. */
export function walkBeats(selector: string, setup: (section: HTMLElement) => Beats | null): void {
  let teardown: (() => void) | null = null;
  document.addEventListener('astro:page-load', () => {
    teardown?.();
    const section = document.querySelector<HTMLElement>(selector);
    const beats = section ? setup(section) : null;
    teardown = section && beats ? walk(section, beats) : null;
  });
}

function walk(section: HTMLElement, beats: Beats): () => void {
  const { buttons, show, firstMs, lastMs, still, onSeen } = beats;
  const n = buttons.length;
  const reduced = prefersReducedMotion();
  const ac = new AbortController();
  let step = 0;
  let timer = 0;
  let frozen = false;
  let io: IntersectionObserver | undefined;
  const stop = () => { window.clearTimeout(timer); timer = 0; };

  const freeze = (i: number) => {
    frozen = true;
    stop();
    step = i;
    show(i, true);
  };

  buttons.forEach((b, i) => {
    b.addEventListener('click', () => freeze(i), { signal: ac.signal });
    if (reduced && still) return;
    b.addEventListener('keydown', (e) => {
      const next = arrowBeat(e.key, step, n);
      if (next === null) return;
      e.preventDefault();
      freeze(next);
      buttons[step].focus();
    }, { signal: ac.signal });
  });

  if (reduced) {
    // No walk, but the buttons still work: the same control with nothing moving on its own.
    if (still) still();
    else { step = n - 1; show(step, false); }
  } else {
    show(0, false);
    const advance = () => {
      step = (step + 1) % n;
      show(step, true);
      timer = window.setTimeout(advance, step === n - 1 ? lastMs : HOLD_MS);
    };
    io = new IntersectionObserver((entries) => {
      const visible = entries.some((e) => e.isIntersecting);
      if (frozen) return;                        // a reader's choice outranks the observer
      if (visible && !timer) {
        onSeen?.(step);
        timer = window.setTimeout(advance, firstMs);
      } else if (!visible) {
        stop();
      }
    }, { threshold: 0.3 });
    io.observe(section);
  }

  return () => {
    stop();
    io?.disconnect();
    ac.abort();
    beats.teardown?.();
  };
}
