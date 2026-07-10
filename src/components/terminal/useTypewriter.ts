import { useEffect, useReducer } from 'react';
import type { Script, Line } from './terminal.types';

// `full` is the line's complete text — used to reserve the line's final
// wrapped shape (via an invisible tail) so revealing characters never
// reflows surrounding content.
export interface RenderedLine { kind: Line['kind']; text: string; full: string; revealed: number; done: boolean; isQuestion?: boolean; href?: string; result?: string; ms?: number }

export interface TerminalState {
  script: Script;
  transcript: RenderedLine[];
  queue: Line[];           // remaining answer lines not yet started
  status: 'idle' | 'typing' | 'done';
  currentPairId: string | null;
}

export type TerminalAction =
  | { type: 'INTRO' }
  | { type: 'ASK'; pairId: string }
  // `chars` (default 1) lets the calling hook vary the reveal-chunk size —
  // randomness lives in the hook, not the reducer, so the reducer stays a
  // pure, deterministically-testable function of its inputs.
  | { type: 'TICK'; chars?: number }
  | { type: 'COMPLETE' }
  | { type: 'RESET' };

export function initialState(script: Script): TerminalState {
  return { script, transcript: [], queue: [], status: 'idle', currentPairId: null };
}

function fullText(line: Line): string {
  if (line.kind === 'text') return line.content;
  if (line.kind === 'tool') return line.label;
  return '';
}

function createRenderedLine(line: Line, revealed: number): RenderedLine {
  const full = fullText(line);
  const done = revealed >= full.length;
  return {
    kind: line.kind,
    text: full.slice(0, revealed),
    full,
    revealed,
    done,
    href: line.kind === 'text' ? line.href : undefined,
    result: line.kind === 'tool' ? line.result : undefined,
  };
}

export function terminalReducer(state: TerminalState, action: TerminalAction): TerminalState {
  switch (action.type) {
    case 'RESET':
      return initialState(state.script);

    case 'INTRO': {
      if (!state.script.intro || state.status !== 'idle') return state;
      return {
        ...state,
        queue: [...state.script.intro.lines],
        status: 'typing',
        currentPairId: null,
      };
    }

    case 'ASK': {
      const pair = state.script.pairs[action.pairId];
      if (!pair) return state;
      // Question line is fully revealed immediately, marked as question
      const question: RenderedLine = {
        kind: 'text',
        text: pair.question,
        full: pair.question,
        revealed: pair.question.length,
        done: true,
        isQuestion: true,
      };
      return {
        ...state,
        transcript: [...state.transcript, question],
        queue: [...pair.answer.lines],
        status: 'typing',
        currentPairId: action.pairId,
      };
    }

    case 'COMPLETE': {
      if (state.status !== 'typing') return state;
      const transcript = [...state.transcript];
      const last = transcript[transcript.length - 1];

      // Complete the current line if it's unfinished
      if (last && !last.done && last.kind === 'text') {
        transcript[transcript.length - 1] = {
          ...last,
          text: last.full,
          revealed: last.full.length,
          done: true,
        };
      }

      // Add all remaining queued lines fully revealed
      for (const line of state.queue) {
        if (line.kind === 'thinking' || line.kind === 'divider') {
          transcript.push({
            kind: line.kind,
            text: '',
            full: '',
            revealed: 0,
            done: true,
          });
        } else if (line.kind === 'tool') {
          const full = line.label;
          transcript.push({
            kind: 'tool',
            text: full,
            full,
            revealed: full.length,
            done: true,
            result: line.result,
          });
        } else if (line.kind === 'text') {
          const full = line.content;
          transcript.push({
            kind: 'text',
            text: full,
            full,
            revealed: full.length,
            done: true,
            href: line.href,
          });
        }
      }

      return {
        ...state,
        transcript,
        queue: [],
        status: 'done',
      };
    }

    case 'TICK': {
      if (state.status !== 'typing') return state;
      const transcript = [...state.transcript];
      const last = transcript[transcript.length - 1];

      // If the last transcript line is an unfinished text line, reveal the next
      // chunk (the hook varies `action.chars` char-by-char vs. small bursts —
      // small variable bursts read as more natural than a metronomic
      // one-char-per-tick reveal).
      if (last && !last.done && last.kind === 'text') {
        const nextRevealed = Math.min(last.revealed + (action.chars ?? 1), last.full.length);
        const next: RenderedLine = {
          ...last,
          text: last.full.slice(0, nextRevealed),
          revealed: nextRevealed,
          done: nextRevealed >= last.full.length,
        };
        transcript[transcript.length - 1] = next;
        const status = next.done && state.queue.length === 0 ? 'done' : 'typing';
        return { ...state, transcript, status };
      }

      // Otherwise start the next queued line.
      if (state.queue.length === 0) {
        return { ...state, status: 'done' };
      }
      const [line, ...rest] = state.queue;

      // Non-text lines (thinking, divider) render instantly as markers
      if (line.kind === 'thinking' || line.kind === 'divider') {
        const rendered: RenderedLine = {
          kind: line.kind,
          text: '',
          full: '',
          revealed: 0,
          done: true,
          ms: line.kind === 'thinking' ? line.ms : undefined,
        };
        const status = rest.length === 0 ? 'done' : 'typing';
        return { ...state, transcript: [...transcript, rendered], queue: rest, status };
      }

      // Tool lines reveal instantly (full text in one tick)
      if (line.kind === 'tool') {
        const rendered = createRenderedLine(line, line.label.length);
        const status = rest.length === 0 ? 'done' : 'typing';
        return { ...state, transcript: [...transcript, rendered], queue: rest, status };
      }

      // Text lines start with the first chunk revealed
      const rendered = createRenderedLine(line, Math.min(action.chars ?? 1, fullText(line).length));
      const status = rendered.done && rest.length === 0 ? 'done' : 'typing';
      return { ...state, transcript: [...transcript, rendered], queue: rest, status };
    }

    default:
      return state;
  }
}

/** React hook: drives TICK on a jittered timer while typing. */
export function useTypewriter(script: Script) {
  const [state, dispatch] = useReducer(terminalReducer, script, initialState);

  useEffect(() => {
    if (state.status !== 'typing') return;
    const last = state.transcript[state.transcript.length - 1];
    // Smooth & steady cadence: text chars ~34ms with only ±6% jitter (near-even
    // rhythm reads as smooth — heavy randomness was what felt jittery before).
    // Tool/marker lines still advance with a longer beat between them; a
    // "thinking" beat gets its own (longer, per-line-overridable) dwell so its
    // rotating verb+spinner actually has time to register before it clears.
    const base = last && !last.done && last.kind === 'text'
      ? 34
      : last?.kind === 'thinking'
        ? last.ms ?? 900
        : 220;
    const delay = base + (Math.random() * 0.12 - 0.06) * base;
    // Reveal chunk: weighted toward 1 char, occasional small bursts of 2-3 —
    // reads as more natural than a metronomic one-char-per-tick reveal.
    const r = Math.random();
    const chars = r < 0.7 ? 1 : r < 0.92 ? 2 : 3;
    const t = setTimeout(() => dispatch({ type: 'TICK', chars }), delay);
    return () => clearTimeout(t);
  }, [state]);

  return { state, dispatch };
}
