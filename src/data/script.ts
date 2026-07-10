import type { Script } from '../components/terminal/terminal.types';

export const script: Script = {
  start: 'now',
  pairs: {
    now: {
      id: 'now',
      question: 'what are you working on?',
      answer: {
        lines: [
          { kind: 'tool', label: 'Searched memory (research-log.md)', result: '3 notes · 412 tokens' },
          { kind: 'text', content: 'My research thread is multi-period portfolio optimization — I co-authored RL-BHRP, a reinforcement-learning-embedded Bayesian Hierarchical Risk Parity method for adaptive allocation (arXiv:2508.11856). The pull is allocation that learns instead of assuming.' },
          { kind: 'text', content: 'By day I build large-scale recommendation systems as a software engineer at EA — retrieval and ranking that has to hold up in production, in real time.' },
        ],
      },
      followups: [
        { label: 'tech stack?', goto: 'stack' },
        { label: 'why quant?', goto: 'why' },
        { label: 'tell me something fun', goto: 'fun' },
      ],
    },
    stack: {
      id: 'stack',
      question: 'tech stack?',
      answer: {
        lines: [
          { kind: 'tool', label: 'Read skills.toml' },
          { kind: 'text', content: 'Systems: C/C++, Go, Java, gRPC — the 50k-QPS services. ML & quant: Python with PyTorch, TensorFlow, scikit-learn, numpy/pandas. Retrieval: Faiss and friends.' },
          { kind: 'text', content: 'Web: TypeScript, React, Astro. This site is Astro + React with no backend — so the answers here are scripted, for now.' },
        ],
      },
      followups: [
        { label: 'what are you working on?', goto: 'now' },
        { label: 'tell me something fun', goto: 'fun' },
      ],
    },
    why: {
      id: 'why',
      question: 'why quant?',
      answer: {
        lines: [
          { kind: 'thinking' },
          { kind: 'text', content: "I'm a mathematician at heart — optimization under uncertainty is the problem I actually want to think about. Markets are an honest test of it: a clean idea, rigorously formulated, meets reality the next morning and tells you — without mercy or flattery — whether you were right." },
        ],
      },
      followups: [
        { label: 'tech stack?', goto: 'stack' },
        { label: 'tell me something fun', goto: 'fun' },
      ],
    },
    fun: {
      id: 'fun',
      question: 'tell me something fun',
      answer: {
        lines: [
          { kind: 'text', content: 'I play guqin and practice calligraphy — Chinese and English. And I like cows: the one on the mountain above is a water buffalo, not a bull — the quant who rides the humble ox, not the bull market.' },
          { kind: 'text', content: "If you spot a stuffed cow in my profiles, that's a Cows.ca cow — arguably the best ice cream in Canada. And who says cows aren't good at music?", href: 'https://www.youtube.com/watch?v=lXKDu6cdXLI' },
        ],
      },
      followups: [
        { label: 'why quant?', goto: 'why' },
        { label: 'what are you working on?', goto: 'now' },
      ],
    },
  },
};
