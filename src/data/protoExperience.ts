// PROTOTYPE (throwaway) data for /proto-experience: one panel per organisation, drafted from profile.ts's timeline.
// Every detail paragraph is the timeline's own text; the new fields (tagline, area, website) are drafts for the
// owner to correct. A fact is given only when it is on record: no location is guessed.
import { awards, timeline } from './profile';
import { REPRO } from './papers/rl-bhrp';

export interface Fact { label: string; value: string; href?: string }
export interface Role { title: string; period: string; detail: string }
export interface Panel {
  key: string; name: string; rail: string; tagline: string; period: string; facts: Fact[]; roles: Role[];
}

const detail = (title: string): string => {
  const t = timeline.find((x) => x.title.startsWith(title));
  if (!t) throw new Error(`protoExperience: no timeline entry titled ${title}…`);
  return t.detail;
};

export const PANELS: Panel[] = [
  { key: 'uoft', name: 'University of Toronto', rail: 'U of T', tagline: 'Operations research', period: 'Fall 2027 —',
    facts: [
      { label: 'Position', value: 'Incoming PhD, Operations Research' },
      { label: 'Advisor', value: 'Prof. Roy H. Kwon' },
      { label: 'Field', value: 'Portfolio optimization' },
      { label: 'Location', value: 'Toronto' },
      { label: 'Website', value: 'utoronto.ca', href: 'https://www.utoronto.ca' },
    ],
    roles: [{ title: 'Incoming PhD', period: 'Fall 2027 —', detail: detail('Incoming PhD') }] },
  { key: 'independent', name: 'Independent', rail: 'Independent', tagline: 'Systematic trading research', period: '2023 —',
    facts: [
      { label: 'Position', value: 'Freelance Quantitative Researcher' },
      { label: 'Markets', value: 'Forex, commodities, indices' },
      { label: 'Paper', value: 'arXiv:2508.11856', href: 'https://arxiv.org/abs/2508.11856v1' },
    ],
    roles: [{ title: 'Freelance Quantitative Researcher', period: '2023 —', detail: detail('Freelance Quantitative Researcher') }] },
  { key: 'ea', name: 'Electronic Arts', rail: 'EA', tagline: 'Interactive entertainment', period: '2026 —',
    facts: [
      { label: 'Position', value: 'Software Engineer' },
      { label: 'Contract', value: 'via Hatch Innovations Canada' },
      { label: 'Area', value: 'Recommendation systems' },
      { label: 'Website', value: 'ea.com', href: 'https://www.ea.com' },
    ],
    roles: [{ title: 'Software Engineer', period: '2026 —', detail: detail('Software Engineer · Electronic Arts') }] },
  { key: 'tiktok', name: 'TikTok', rail: 'TikTok', tagline: 'Short-form video', period: '2021 — 2025',
    facts: [
      { label: 'Position', value: 'Senior Software Engineer, 2023 — 25' },
      { label: 'Earlier', value: 'SDE Intern, 2021, Shanghai' },
      { label: 'Area', value: 'ML systems for ads' },
      { label: 'Website', value: 'tiktok.com', href: 'https://www.tiktok.com' },
    ],
    roles: [
      { title: 'Senior Software Engineer', period: '2023 — 25', detail: detail('Senior Software Engineer · TikTok') },
      { title: 'SDE Intern', period: '2021', detail: detail('SDE Intern · TikTok') },
    ] },
  { key: 'ericsson', name: 'Ericsson', rail: 'Ericsson', tagline: 'Telecommunications', period: '2022 — 23',
    facts: [
      { label: 'Position', value: 'SWE Co-op' },
      { label: 'Team', value: 'AI Lab (GAIA)' },
      { label: 'Website', value: 'ericsson.com', href: 'https://www.ericsson.com' },
    ],
    roles: [{ title: 'SWE Co-op', period: '2022 — 23', detail: detail('SWE Co-op · Ericsson') }] },
  { key: 'amazon', name: 'Amazon', rail: 'Amazon', tagline: 'E-commerce and cloud', period: '2022',
    facts: [
      { label: 'Position', value: 'SDE Intern' },
      { label: 'Area', value: 'Fulfillment data' },
      { label: 'Website', value: 'amazon.com', href: 'https://www.amazon.com' },
    ],
    roles: [{ title: 'SDE Intern', period: '2022', detail: detail('SDE Intern · Amazon') }] },
  { key: 'mcgill', name: 'McGill University', rail: 'McGill', tagline: 'Computer engineering', period: '2019 — 23',
    facts: [
      { label: 'Degree', value: 'B.Eng, Computer Engineering' },
      { label: 'Research', value: 'Research Assistant, 2021 — 23' },
      { label: 'Location', value: 'Montreal' },
      { label: 'Website', value: 'mcgill.ca', href: 'https://www.mcgill.ca' },
    ],
    roles: [
      { title: 'B.Eng, Computer Engineering', period: '2019 — 23', detail: detail('B.Eng, Computer Engineering') },
      { title: 'Research Assistant', period: '2021 — 23', detail: detail('Research Assistant · McGill') },
    ] },
];

/** Each mark's colours on hover, by role, on the light sheet and the dark one: the logo's own colours, read from its
 *  file by the transcription run (protoExperienceIcons' `brand` wins where it gives one). The independent panel's
 *  chart, which has no logo, takes a gain green. */
export type Brand = { light: Partial<Record<'k' | 'm' | 's', string>>; dark: Partial<Record<'k' | 'm' | 's', string>> };
export const BRAND: Record<string, Brand> = {
  uoft: { light: { k: '#1e3765' }, dark: { k: '#ffffff' } },
  independent: { light: { k: '#1a7f4b', m: '#8fd1aa' }, dark: { k: '#5fd394', m: '#2c6b48' } },
  ea: { light: { s: '#ff4747' }, dark: { s: '#ff4747' } },
  tiktok: { light: { k: '#000000', m: '#25f4ee', s: '#fe2c55' }, dark: { k: '#ffffff', m: '#25f4ee', s: '#fe2c55' } },
  ericsson: { light: { k: '#0082f0' }, dark: { k: '#0082f0' } },
  amazon: { light: { k: '#221f1f', s: '#ff9900' }, dark: { k: '#ffffff', s: '#ff9900' } },
  mcgill: { light: { s: '#ed1b2f' }, dark: { s: '#ed1b2f' } },
};

/** Recognition, the record's awards and then the competitions the owner named (COMC, CCC, AIME), whose years and
 *  results are his to give: a field is printed only when it is known. */
export const RECOGNITION: { year?: string; title: string; note?: string }[] = [
  ...awards,
  { title: 'COMC', note: 'Canadian Open Mathematics Challenge' },
  { title: 'CCC', note: 'Canadian Computing Competition' },
  { title: 'AIME', note: 'American Invitational Mathematics Examination' },
];

/** The independent panel's mark, which has no logo: RL-BHRP's own wealth path (the paper's reproduction, the
 *  median run), as an area chart in n x n cells with one empty cell of margin, the line in ink, the area mid-ink. */
export function chartRows(n: number, series: readonly number[] = REPRO.rl): string[] {
  const inner = n - 2;
  const lo = Math.min(...series), hi = Math.max(...series);
  const grid = Array.from({ length: n }, () => Array<string>(n).fill('.'));
  for (let i = 0; i < inner; i++) {
    const v = series[Math.round((i * (series.length - 1)) / (inner - 1))];
    const top = n - 2 - Math.round(((v - lo) / (hi - lo)) * (inner - 1));
    grid[top][i + 1] = 'k';
    for (let y = top + 1; y <= n - 2; y++) grid[y][i + 1] = 'm';
  }
  return grid.map((r) => r.join(''));
}
