// What each pod monitor displays. Pure data generators — no canvas, no DOM — so
// every screen's content is unit-testable and the painter stays dumb.

import type { TimelineEntry } from '../data/profile';

// ── Monitor 3: a Gantt of tenures, from the REAL timeline ───────────────────

export interface GanttBar {
  label: string;
  /** fractional year */
  start: number;
  end: number;
  kind: 'work' | 'education';
}

/** Where an open-ended range is drawn to. Beyond the incoming PhD's 2027 start so
 *  a present-tense role visibly runs off the right edge of the chart. */
const OPEN_END = 2029;

/**
 * Parse a profile.ts period string to a year span.
 *
 * The real strings are irregular, which is why this is parsed rather than
 * hand-maintained: '2023 — 25' (two-digit end), '2026 —' (open ended),
 * 'Fall 2027 —' (leading word), '2021' (single year), and the awards use
 * typographic apostrophes like ''21–'22'.
 *
 * @returns null when no 4-digit year is present (e.g. the 'Elsewhere' tail label).
 */
export function parsePeriod(period: string): { start: number; end: number } | null {
  const first = period.match(/(\d{4})/);
  if (!first) return null;
  const start = Number(first[1]);

  // Anything after the first year: an en/em dash means a range.
  const rest = period.slice(first.index! + 4);
  const hasDash = /[—–-]/.test(rest);
  if (!hasDash) return { start, end: start + 1 };

  const endMatch = rest.match(/(\d{2,4})/);
  if (!endMatch) return { start, end: OPEN_END };   // open-ended: '2026 —'

  const raw = Number(endMatch[1]);
  // Two-digit end years are within the same century as the start.
  const end = raw < 100 ? Math.floor(start / 100) * 100 + raw : raw;
  return { start, end: end > start ? end : start + 1 };
}

/** Shorten a timeline title to something that fits a screen: keep the employer or
 *  institution, which is the part a reader scans for. */
function shortLabel(title: string): string {
  const afterDot = title.includes(' · ') ? title.split(' · ').pop()! : title;
  const cleaned = afterDot.replace(/^(Incoming\s+)?/, '').trim();
  const short = cleaned.length <= 18 ? cleaned : cleaned.slice(0, 17) + '…';
  // The PhD row is the identity headline — label it as such, not as the university.
  return /University of Toronto/.test(title) ? 'UofT PhD' : short;
}

/**
 * Bars for the Gantt screen: the PhD first (identity headline), then longest-
 * running, capped at 6 so the screen stays readable. No duplicate labels.
 */
export function ganttBars(entries: readonly TimelineEntry[], nowYear: number): GanttBar[] {
  const bars: GanttBar[] = [];
  const seen = new Set<string>();

  for (const e of entries) {
    const span = parsePeriod(e.period);
    if (!span) continue;
    const label = shortLabel(e.title);

    // When an institution appears twice, keep only the longer-running entry
    if (seen.has(label)) {
      const existing = bars.find(b => b.label === label);
      if (existing && (span.end - span.start) > (existing.end - existing.start)) {
        // Replace with the longer run
        bars.splice(bars.indexOf(existing), 1);
      } else {
        // Keep the existing one, skip this
        continue;
      }
    }

    seen.add(label);
    bars.push({ label, start: span.start, end: span.end, kind: e.kind });
  }

  // Sort: PhD first, then by duration descending
  bars.sort((a, b) => {
    const aIsPhd = /phd/i.test(a.label);
    const bIsPhd = /phd/i.test(b.label);
    if (aIsPhd && !bIsPhd) return -1;
    if (!aIsPhd && bIsPhd) return 1;
    return (b.end - b.start) - (a.end - a.start) || b.start - a.start;
  });

  return bars.slice(0, 6);
}

// ── Monitor 1: an IDE ───────────────────────────────────────────────────────
// Plausible portfolio-optimization Python. Hand-written rather than generated:
// a quant reads this screen, so the code has to be sane.

export interface CodeLine {
  indent: number;
  tokens: { text: string; kind: 'kw' | 'fn' | 'str' | 'num' | 'plain' | 'comment' }[];
}

const K = (text: string) => ({ text, kind: 'kw' as const });
const F = (text: string) => ({ text, kind: 'fn' as const });
const S = (text: string) => ({ text, kind: 'str' as const });
const N = (text: string) => ({ text, kind: 'num' as const });
const P = (text: string) => ({ text, kind: 'plain' as const });
const C = (text: string) => ({ text, kind: 'comment' as const });

export function ideLines(): CodeLine[] {
  return [
    { indent: 0, tokens: [K('from'), P(' risk '), K('import'), P(' hrp, sector_cov, within, dispersion')] },
    { indent: 0, tokens: [C('# two-level weights: sector share x within-sector share')] },
    { indent: 0, tokens: [K('def'), P(' '), F('allocate'), P('(returns, sectors):')] },
    { indent: 1, tokens: [P('cov = '), F('sector_cov'), P('(returns, sectors)')] },
    { indent: 1, tokens: [P('w_sector = '), F('hrp'), P('(cov, method='), S("'ward'"), P(')')] },
    { indent: 1, tokens: [P('w = w_sector[sectors] * '), F('within'), P('(returns)')] },
    { indent: 1, tokens: [K('return'), P(' w / w.'), F('sum'), P('()')] },
    { indent: 0, tokens: [C('# reward: return - turnover cost - dispersion penalty')] },
    { indent: 0, tokens: [K('def'), P(' '), F('reward'), P('(w, w_prev, r, lam='), N('0.35'), P('):')] },
    { indent: 1, tokens: [P('turn = '), N('12e-4'), P(' * np.'), F('abs'), P('(w - w_prev).'), F('sum'), P('()'), C('  # 12 bps')] },
    { indent: 1, tokens: [K('return'), P(' w @ r - turn - lam * '), F('dispersion'), P('(w)')] },
  ];
}

// ── Monitor 2: a backtest equity curve ─────────────────────────────────────
// Deterministic: a seeded hash, never Math.random(), so the static first frame
// matches the animated one and screenshots are reproducible.

function seeded(i: number): number {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function backtestCurve(n: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  let v = 0.18;
  for (let i = 0; i < n; i++) {
    // upward drift plus mean-reverting noise, with two engineered drawdowns so it
    // reads as a real equity curve rather than a rising line
    const shock = (i > n * 0.32 && i < n * 0.40) || (i > n * 0.66 && i < n * 0.71) ? -0.035 : 0;
    v += 0.011 + (seeded(i) - 0.5) * 0.022 + shock;
    v = Math.max(0.02, Math.min(0.98, v));
    out.push({ x: i / (n - 1), y: v });
  }
  return out;
}

// ── Monitor 4: a LaTeX page mid-typeset ────────────────────────────────────

export function latexLines(): { indent: number; text: string; kind: 'head' | 'body' | 'math' }[] {
  return [
    { indent: 0, text: 'Hierarchical Risk Parity, revisited', kind: 'head' },
    { indent: 0, text: 'Notes on allocation under regime change.', kind: 'body' },
    { indent: 0, text: 'w = W g(i) eta i | g(i)', kind: 'math' },
    { indent: 0, text: 'The two-level map keeps sector risk', kind: 'body' },
    { indent: 0, text: 'separable from within-sector dispersion,', kind: 'body' },
    { indent: 0, text: 'which is what makes the parity claim hold.', kind: 'body' },
    { indent: 0, text: 'sum RC i (w) = sigma^2 p (w)', kind: 'math' },
  ];
}

// ── Monitor 5: a Bloomberg-style panel ─────────────────────────────────────
// Rendered in --ochre, NOT amber: CLAUDE.md permits only the seal as a saturated
// colour in light theme, and ochre is already the accent and reads amber-adjacent.

export function bloombergRows(): { ticker: string; last: string; chg: string; up: boolean }[] {
  return [
    { ticker: 'SPX', last: '5,410', chg: '+0.42%', up: true },
    { ticker: 'NDX', last: '19,205', chg: '+0.71%', up: true },
    { ticker: 'RTY', last: '2,088', chg: '-0.19%', up: false },
    { ticker: 'VIX', last: '13.62', chg: '-2.10%', up: false },
    { ticker: 'UST10', last: '4.21', chg: '+1.8bp', up: true },
    { ticker: 'DXY', last: '104.9', chg: '-0.08%', up: false },
    { ticker: 'XAU', last: '2,391', chg: '+0.55%', up: true },
    { ticker: 'CL1', last: '78.2', chg: '-1.24%', up: false },
  ];
}

// ── The slot binding: content, label, destination ───────────────────────────
// Single source of truth. The component reads this to build the overlay controls,
// so a screen's picture and its link can never disagree.

export const SCREEN_CONTENT: {
  slot: number;
  kind: 'ide' | 'backtest' | 'gantt' | 'latex' | 'bloomberg';
  label: string;
  href?: string;
  announce?: string;
}[] = [
  { slot: 0, kind: 'ide', label: 'Projects', href: '/projects' },
  { slot: 1, kind: 'backtest', label: 'Research', href: '/research' },
  { slot: 2, kind: 'gantt', label: 'Experience', href: '/experience' },
  { slot: 3, kind: 'latex', label: 'Writing', announce: 'Writing · coming' },
  { slot: 4, kind: 'bloomberg', label: 'Market reports', announce: 'Market reports · coming' },
];
