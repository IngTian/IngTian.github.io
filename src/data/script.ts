import type { Script } from '../components/terminal/terminal.types';

export const script: Script = {
  start: 'now',
  pairs: {
    now: {
      id: 'now',
      question: 'what are you researching right now?',
      answer: {
        lines: [
          { kind: 'tool', label: 'Searched memory (research-log.md)' },
          { kind: 'tool', label: 'Read 3 notes · 412 tokens' },
          { kind: 'text', content: 'Two threads right now: regime detection in volatility surfaces — clustering implied-vol term structures to flag when the market quietly changes character — and market-making under inventory risk, revisiting Avellaneda–Stoikov and skewing quotes with position.' },
          { kind: 'text', content: 'On the side: relearning measure-theoretic probability properly.' },
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
          { kind: 'text', content: 'Research: Python, numpy, polars, jax, statsmodels. Build: TypeScript, React, Astro, FastAPI, SQLite.' },
          { kind: 'text', content: 'This site is Astro + React with no backend — so the answers here are scripted, for now.' },
        ],
      },
      followups: [
        { label: 'what are you researching?', goto: 'now' },
        { label: 'tell me something fun', goto: 'fun' },
      ],
    },
    why: {
      id: 'why',
      question: 'why quant?',
      answer: {
        lines: [
          { kind: 'thinking' },
          { kind: 'text', content: 'Because markets are the one place where a clean idea, rigorously tested, meets reality the next morning and tells you — without mercy or flattery — whether you were right. I like that honesty.' },
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
        ],
      },
      followups: [
        { label: 'why quant?', goto: 'why' },
        { label: 'what are you researching?', goto: 'now' },
      ],
    },
  },
};
