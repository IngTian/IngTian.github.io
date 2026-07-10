export type Line =
  // `href` (optional) turns the whole line into a link once it's fully typed.
  | { kind: 'text'; content: string; href?: string }
  // `result` (optional) renders as an indented "⎿ ..." line under the call,
  // mirroring Claude Code's own call/result convention.
  | { kind: 'tool'; label: string; result?: string }
  | { kind: 'thinking'; ms?: number }
  | { kind: 'divider' };

export interface Answer { lines: Line[] }

export interface QAPair {
  id: string;
  question: string;
  answer: Answer;
  // Slash-invokable name, no leading slash (e.g. 'why-quant' for "/why-quant").
  // The command palette lists every pair's command globally — like Claude
  // Code's own "/" menu, not a per-answer contextual suggestion list.
  command: string;
}

// A greeting shown before any question is asked — typed lines with no
// "> " question prefix.
export interface Intro { lines: Line[] }

export interface Script {
  start: string;
  pairs: Record<string, QAPair>;
  intro?: Intro;
}
