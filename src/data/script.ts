import type { Script } from '../components/terminal/terminal.types';

export const script: Script = {
  start: 'now',
  intro: {
    lines: [
      { kind: 'text', content: 'Hey, nice to see you. ^^' },
      { kind: 'text', content: "Tell me what you'd like to know." },
    ],
  },
  pairs: {
    now: {
      id: 'now',
      command: 'about',
      question: 'what are you working on?',
      answer: {
        lines: [
          { kind: 'tool', label: 'Searched memory (research-log.md)', result: '3 notes · 412 tokens' },
          { kind: 'text', content: "I'm a fullstack engineer working for Electronic Arts on a GenAI platform and full-fledged rec systems, i.e., dual-tower and ranker combined." },
          { kind: 'text', content: "In the meantime, I'm heavily invested in optimization methods, convex optimization, and duality to prepare for my incoming Ph.D." },
        ],
      },
    },
    why: {
      id: 'why',
      command: 'why-quant',
      question: 'why quant?',
      answer: {
        lines: [
          { kind: 'thinking' },
          { kind: 'text', content: "I've been a quant since senior year at McGill — always a mathematician at heart, a quant in thinking. I reason from structures and distributions, and make decisions accordingly." },
          { kind: 'text', content: 'The market is a ruthless, direct arena for that hypothesis: wins and losses show up on the PnL chart the next morning. I love seeing my skills and effort tested live, with real impact.' },
        ],
      },
    },
    fun: {
      id: 'fun',
      command: 'fun',
      question: 'tell me something fun',
      answer: {
        lines: [
          { kind: 'text', content: "You might spot me having a plush cow avatar somewhere. That's a plush cow from Cows.ca, arguably the best ice cream brand in Canada!" },
          { kind: 'text', content: 'Why do I love this cow? The way I smile is just like it.' },
        ],
      },
    },
  },
};
