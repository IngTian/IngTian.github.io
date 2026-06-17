export interface TimelineEntry {
  period: string;
  title: string;
  detail: string;
  kind: 'work' | 'education';
}

export const name = { first: 'Ing', last: 'Tian' } as const;

export const roles = 'Quant Researcher · Full-stack Developer';

export const timeline: TimelineEntry[] = [
  { period: '2024 —', title: 'Quant Researcher', detail: 'Signal research, backtesting, and portfolio construction.', kind: 'work' },
  { period: '2022 — 24', title: 'Full-stack Developer', detail: 'Shipped product end to end — React, Python, infrastructure.', kind: 'work' },
  { period: '2018 — 22', title: 'BSc, Mathematics & Computer Science', detail: 'Probability and stochastic processes — the foundations.', kind: 'education' },
];

export const links: { label: string; href: string; primary?: boolean }[] = [
  { label: 'Download CV', href: '/cv.pdf', primary: true },
  { label: 'Email', href: 'mailto:hello@example.com' },
  { label: 'GitHub', href: 'https://github.com/IngTian' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/' },
];
