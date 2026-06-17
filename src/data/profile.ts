export interface TimelineEntry {
  period: string;
  title: string;
  detail: string;
  kind: 'work' | 'education';
}

export interface Publication {
  authors: string;
  title: string;
  venue: string;
  year: string;
  href?: string;
}

export interface Award {
  year: string;
  title: string;
}

export const name = { first: 'Ing', last: 'Tian' } as const;

export const roles = 'Quant Researcher · Full-stack Developer';

export const timeline: TimelineEntry[] = [
  { period: '2023 — 25', title: 'Senior Software Engineer · TikTok', detail: 'ML systems for ads. Built a dual-tower vision pipeline with billion-scale vector search (Faiss) that enabled quarterly tracking of $200M in creative spend, and a C++ / gRPC ad-signature service sustaining 50k QPS for real-time delivery.', kind: 'work' },
  { period: '2022', title: 'SWE Intern · Amazon', detail: 'Built a fulfillment-data archival & visual-analytics service — SNS → Lambda → S3/Firehose, queried with Athena, surfaced in QuickSight.', kind: 'work' },
  { period: '2021 — 23', title: 'Research Assistant · McGill', detail: 'Compiler research on JAMScript under Prof. Maheswaran — Ohm-based parser translating to C/JS, CFG grammar for ES6, side-effect & control-flow analysis.', kind: 'work' },
  { period: '2019 — 23', title: 'B.Eng, Computer Engineering · McGill', detail: "CGPA 3.99 · Dean's Honour List · Full Scholarship.", kind: 'education' },
];

export const publications: Publication[] = [
  {
    authors: 'S. Kang, Z. Tian',
    title: 'Optimal Portfolio Construction — A Reinforcement-Learning-Embedded Bayesian Hierarchical Risk Parity (RL-BHRP) Approach',
    venue: 'arXiv preprint',
    year: '2025',
    href: 'https://arxiv.org/abs/2508.11856',
  },
  {
    authors: 'D. Li, Z. Tian, Y. Duan',
    title: 'Self-Attention on RNN-based Text Classification',
    venue: 'CNSSE / SPIE, vol. 12290',
    year: '2022',
  },
];

export const awards: Award[] = [
  { year: '2021', title: 'IEEExtreme — Top 4 teams in Canada' },
  { year: "'20–'22", title: 'Hatch Scholarships ($10k ×3) · McGill' },
  { year: '2020', title: 'J. B. Woodyatt Prize · McGill' },
];

export const links: { label: string; href: string; primary?: boolean }[] = [
  { label: 'Download CV', href: '/cv.pdf', primary: true },
  { label: 'Email', href: 'mailto:zeying.tian@mail.mcgill.ca' },
  { label: 'GitHub', href: 'https://github.com/IngTian' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/ing-tian-1b2610149/' },
];
