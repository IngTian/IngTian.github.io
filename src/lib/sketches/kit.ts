// src/lib/sketches/kit.ts
// THE PROTOTYPE HARNESS. Adding a showpiece candidate should cost one function, not one page.
//
// WHY THIS EXISTS: five showpiece attempts have been rejected, and each one cost a hand-built
// component, its own CSS, its own lifecycle wiring and its own screenshot loop. That is why the
// process was slow enough to be painful, and slow processes push you toward defending a bad idea
// instead of discarding it. The next round is expected to produce MANY candidates, most of which
// will die. So the cost of a candidate has to approach the cost of an idea.
//
// A sketch is a pure function: (ctx) -> SVG string. It gets the real corpus, the palette, and a
// fixed frame. It returns markup. No canvas lifecycle, no theme wiring, no scroll handling, no
// accessibility contract to re-implement — the gallery page owns all of that.
//
// THE RULE THAT MADE /proto-showpiece WORK, and which this formalises: a STILL FRAME FIRST, in
// SVG, judged in one look. three.js only after a frame survives being looked at. Four of the five
// rejections were only judgeable after they were finished; the one cheap gate saved days.

import { timeline, publications, projects, awards, researchInterests } from '../../data/profile';
import { photoNotes } from '../../data/photoNotes';
import { SIGNAL_WEIGHTS } from '../../data/signalWeights';
import { loadings, FACTORS } from '../factorModel';
import { WAYPOINTS, trajectoryFacts } from '../trajectory';

/** The frame every sketch draws into. Fixed so candidates are comparable at a glance — a sketch
 *  that only works at its own aspect ratio is not comparable to one that works at the real one. */
export const FRAME = { w: 1600, h: 900 } as const;

/** Palette handed to a sketch. Values are CSS custom properties, NOT literals: a sketch that
 *  hardcodes a hex cannot re-theme, and both themes must work. */
export const PAL = {
  paper: 'var(--paper)',
  ink1: 'var(--ink-1)',
  ink2: 'var(--ink-2)',
  ink3: 'var(--ink-3)',
  ink4: 'var(--ink-4)',
  ink5: 'var(--ink-5)',
  ochre: 'var(--ochre)',
  indigo: 'var(--indigo)',
  seal: 'var(--seal)',
  bg: 'var(--bg)',
  /** Hairline rgb triple, for rgba() with an alpha. */
  hair: 'var(--hairline-rgb)',
} as const;

/** Everything a sketch may draw from. Assembled once, passed in — so no sketch reaches into
 *  profile.ts directly and every candidate is drawing the same real corpus. */
export interface SketchData {
  /** 9 roles and degrees, 2019-2027, some overlapping. */
  timeline: typeof timeline;
  publications: typeof publications;
  projects: typeof projects;
  awards: typeof awards;
  interests: typeof researchInterests;
  /** 42 photographs, each with a real written title and note (mean 82 chars). The only material
   *  on the site with a VOICE in it. */
  photos: { file: string; title: string; note: string }[];
  /** 20 signals scored 1-5 against a published rubric, with justifications. */
  signals: typeof SIGNAL_WEIGHTS.signals;
  /** Six factors with their loadings. */
  loadings: ReturnType<typeof loadings>;
  factors: typeof FACTORS;
  /** The declared career path over the hero's loss field. */
  waypoints: typeof WAYPOINTS;
  /** Measured basin/barrier facts — two real minima, a real barrier, provable entrapment. */
  facts: ReturnType<typeof trajectoryFacts>;
}

export function sketchData(): SketchData {
  return {
    timeline,
    publications,
    projects,
    awards,
    interests: researchInterests,
    photos: Object.entries(photoNotes).map(([file, n]) => ({
      file, title: n.title, note: n.note,
    })),
    signals: SIGNAL_WEIGHTS.signals,
    loadings: loadings(SIGNAL_WEIGHTS.signals),
    factors: FACTORS,
    waypoints: WAYPOINTS,
    facts: trajectoryFacts(),
  };
}

/** What a sketch is handed. */
export interface SketchCtx {
  w: number;
  h: number;
  pal: typeof PAL;
  data: SketchData;
}

/** A candidate. `verdict` is filled in AFTER it has been looked at — the file becomes the record
 *  of what was tried and why it died, which the commit history carries at the prose level. */
export interface Sketch {
  id: string;
  title: string;
  /** One line: what a stranger would see. */
  pitch: string;
  /** The curiosity mechanism in one line — why anyone would want to touch it. If this is hard to
   *  write, that is itself a signal about the idea. */
  hook: string;
  /** What this still frame CANNOT show (motion, interaction, material). Stated so a frame is
   *  never judged for something it was never able to convey. */
  cannotShow?: string;
  /** Set once judged: 'keep' | 'kill' | 'unjudged', plus why. */
  verdict?: { call: 'keep' | 'kill' | 'unjudged'; why: string };
  draw(ctx: SketchCtx): string;
}

// ── Drawing helpers ─────────────────────────────────────────────────────────
// Deliberately small. A sketch is meant to be readable in one screen, so the helpers cover the
// tedium (number formatting, paths, text) and nothing else.

export const f2 = (n: number) => (Math.round(n * 100) / 100).toString();

export const line = (x1: number, y1: number, x2: number, y2: number, stroke: string, w = 1, extra = '') =>
  `<path d="M${f2(x1)} ${f2(y1)}L${f2(x2)} ${f2(y2)}" stroke="${stroke}" stroke-width="${w}" fill="none" ${extra}/>`;

export const poly = (pts: [number, number][], fill: string, extra = '') =>
  `<path d="M${pts.map((p) => `${f2(p[0])} ${f2(p[1])}`).join('L')}Z" fill="${fill}" ${extra}/>`;

export const path = (pts: [number, number][], stroke: string, w = 1.4, extra = '') =>
  `<path d="M${pts.map((p) => `${f2(p[0])} ${f2(p[1])}`).join('L')}" stroke="${stroke}" stroke-width="${w}" fill="none" ${extra}/>`;

export const dot = (x: number, y: number, r: number, fill: string, extra = '') =>
  `<circle cx="${f2(x)}" cy="${f2(y)}" r="${f2(r)}" fill="${fill}" ${extra}/>`;

/** Mono label. `anchor` follows SVG text-anchor. */
export const label = (
  x: number, y: number, text: string,
  opts: { size?: number; fill?: string; anchor?: 'start' | 'middle' | 'end'; track?: number; upper?: boolean } = {},
) => {
  const { size = 15, fill = PAL.ink3, anchor = 'start', track = 0.08, upper = false } = opts;
  return `<text x="${f2(x)}" y="${f2(y)}" text-anchor="${anchor}" ` +
    `font-family="var(--font-mono)" font-size="${size}" letter-spacing="${track}em" ` +
    `fill="${fill}"${upper ? ' style="text-transform:uppercase"' : ''}>${escapeText(text)}</text>`;
};

/** Serif/display text, for anything that should read as prose rather than as data. */
export const prose = (
  x: number, y: number, text: string,
  opts: { size?: number; fill?: string; anchor?: 'start' | 'middle' | 'end'; italic?: boolean } = {},
) => {
  const { size = 20, fill = PAL.ink2, anchor = 'start', italic = false } = opts;
  return `<text x="${f2(x)}" y="${f2(y)}" text-anchor="${anchor}" ` +
    `font-family="var(--font-display), Georgia, serif" font-size="${size}" ` +
    `${italic ? 'font-style="italic" ' : ''}fill="${fill}">${escapeText(text)}</text>`;
};

/** SVG-safe text. Sketches draw real corpus strings, which contain apostrophes and ampersands. */
export function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Wrap a string to a width in characters, for multi-line prose in SVG (which has no wrapping). */
export function wrap(text: string, cols: number): string[] {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let cur = '';
  for (const word of words) {
    if (!cur.length) { cur = word; continue; }
    if (cur.length + 1 + word.length <= cols) cur += ' ' + word;
    else { out.push(cur); cur = word; }
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Deterministic pseudo-random in [0,1). Never Math.random(): a sketch is baked at build time and
 *  two builds must be byte-identical, or comparing frames is meaningless. */
export function rnd(i: number): number {
  const h = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return h - Math.floor(h);
}

/** Wrap a sketch's body in the frame's <svg>. */
export function svg(body: string, aria: string): string {
  return `<svg viewBox="0 0 ${FRAME.w} ${FRAME.h}" role="img" aria-label="${escapeText(aria)}" ` +
    `preserveAspectRatio="xMidYMid meet">${body}</svg>`;
}
