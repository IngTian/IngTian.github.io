// src/lib/paperFigures/metricsTable.ts
// RL-BHRP's Table 1: the paper's Table 2, every row, as a booktabs table drawn at build time from TABLE2
// (data/papers/rl-bhrp.ts). Two decimals, a true minus, nothing bolded or coloured: a table that marked the rows
// one column wins would be arguing, not reporting. Its caption and its source line are prose, in the explainer.
// Pure.
//
// What the markup promises the page's CSS: table.bt, the window's rows then a tr.gap; each date twice,
// span.d-iso and span.d-short, for the CSS to show one (the phone shows the short); the undefined cell as
// "—<sup>a</sup>", which the explainer's source line explains.
import type { TABLE2 } from '../../data/papers/rl-bhrp';
import { monthYear } from '../dates';

/** Each row as the page labels it, in plain words, with its unit: the paper's own names are terse. */
const LABEL: Record<string, string> = {
  Periods: 'Periods',
  Start: 'Start',
  End: 'End',
  'Total Cumulative Return': 'Total cumulative return (%)',
  'CAGR (Geometric Ann.)': 'CAGR, geometric annualised (%)',
  'Annual Return (Mean×12)': 'Annual return, mean × 12 (%)',
  'Annual Volatility': 'Annual volatility (%)',
  Sharpe: 'Sharpe ratio',
  Sortino: 'Sortino ratio',
  'Max Drawdown': 'Maximum drawdown (%)',
  Calmar: 'Calmar ratio',
  'Tracking Error': 'Tracking error (%)',
  'Information Ratio': 'Information ratio',
  Beta: 'Beta',
  'Jensen Alpha': 'Jensen alpha (%)',
  'VaR 5% (period)': 'VaR 5%, one period (%)',
  'CVaR 5% (period)': 'CVaR 5%, one period (%)',
  'Hit Rate (>0)': 'Hit rate, months above 0 (%)',
};

const minus = (s: string) => s.replace(/^-/, '−');

function cell(kind: (typeof TABLE2)[number]['kind'], v: number | string): string {
  if (typeof v === 'string') return `<span class="d-iso">${v}</span><span class="d-short">${monthYear(v, 'short')}</span>`;
  if (Number.isNaN(v)) return '—<sup>a</sup>';
  if (kind === 'count') return String(v);
  return minus((kind === 'pct' ? v * 100 : v).toFixed(2));
}

export function metricsTable(t: typeof TABLE2): string {
  // the gap falls between the window (its count and its dates) and the first figure measured over it
  const gap = t.findIndex((r) => r.kind !== 'count' && r.kind !== 'date');
  const rows = t.map((r, k) => {
    const label = LABEL[r.metric];
    if (!label) throw new Error(`metricsTable: no label for Table 2's "${r.metric}"`);
    return `<tr${k === gap ? ' class="gap"' : ''}><th scope="row">${label}</th>${r.values.map((v) => `<td>${cell(r.kind, v)}</td>`).join('')}</tr>`;
  });
  return '<table class="bt"><thead><tr><th scope="col">Metric</th><th scope="col">RL-BHRP</th><th scope="col">BHRP</th>'
    + `<th scope="col">Benchmark</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
}
