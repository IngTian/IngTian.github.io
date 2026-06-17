export interface TimelineEntry {
  period: string;
  title: string;
  detail: string;
  kind: 'work' | 'education';
}

export const name = { first: 'Ing', last: 'Tian' } as const;

export const roles = 'Quant Researcher · Full-stack Developer';

export const timeline: TimelineEntry[] = [
  { period: '2023 — 25', title: 'Senior Software Engineer · TikTok', detail: 'ML systems for ads — dual-tower vision embeddings, billion-scale vector search (Faiss), and C++ gRPC services at 50k QPS.', kind: 'work' },
  { period: '2020 — 23', title: 'Engineering Internships & Research', detail: 'Amazon, TikTok, and Ericsson; compiler research (JAMScript) at McGill under Prof. Maheswaran.', kind: 'work' },
  { period: '2019 — 23', title: 'B.Eng, Computer Engineering · McGill', detail: "CGPA 3.99 · Dean's Honour List · Full Scholarship.", kind: 'education' },
];

export const links: { label: string; href: string; primary?: boolean }[] = [
  { label: 'Download CV', href: '/cv.pdf', primary: true },
  { label: 'Email', href: 'mailto:zeying.tian@mail.mcgill.ca' },
  { label: 'GitHub', href: 'https://github.com/IngTian' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/ing-tian-1b2610149/' },
];
