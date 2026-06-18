export type Line =
  // `href` (optional) turns the whole line into a link once it's fully typed.
  | { kind: 'text'; content: string; href?: string }
  | { kind: 'tool'; label: string }
  | { kind: 'thinking'; ms?: number }
  | { kind: 'divider' };

export interface Answer { lines: Line[] }

export interface Followup { label: string; goto: string }

export interface QAPair {
  id: string;
  question: string;
  answer: Answer;
  followups?: Followup[];
}

export interface Script {
  start: string;
  pairs: Record<string, QAPair>;
}
