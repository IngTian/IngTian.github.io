import { useEffect, useReducer } from 'react';
import type { Script, Line } from './terminal.types';

export interface RenderedLine { kind: Line['kind']; text: string; revealed: number; done: boolean; isQuestion?: boolean; href?: string; result?: string; ms?: number }

export interface TerminalState {
  script: Script;
  transcript: RenderedLine[];
  queue: Line[];           // remaining answer lines not yet started
  status: 'idle' | 'typing' | 'done';
  currentPairId: string | null;
}

export type TerminalAction =
  | { type: 'ASK'; pairId: string }
  | { type: 'TICK' }
  | { type: 'COMPLETE' }
  | { type: 'RESET' };

export function initialState(script: Script): TerminalState {
  return { script, transcript: [], queue: [], status: 'idle', currentPairId: null };
}

// Internal representation includes full text for slicing
interface InternalRenderedLine extends RenderedLine {
  _full: string;
}

function fullText(line: Line): string {
  if (line.kind === 'text') return line.content;
  if (line.kind === 'tool') return line.label;
  return '';
}

function createRenderedLine(line: Line, revealed: number): InternalRenderedLine {
  const full = fullText(line);
  const done = revealed >= full.length;
  return {
    kind: line.kind,
    text: full.slice(0, revealed),
    revealed,
    done,
    _full: full,
    href: line.kind === 'text' ? line.href : undefined,
    result: line.kind === 'tool' ? line.result : undefined,
  };
}

export function terminalReducer(state: TerminalState, action: TerminalAction): TerminalState {
  switch (action.type) {
    case 'RESET':
      return initialState(state.script);

    case 'ASK': {
      const pair = state.script.pairs[action.pairId];
      if (!pair) return state;
      // Question line is fully revealed immediately, marked as question
      const question: InternalRenderedLine = {
        kind: 'text',
        text: pair.question,
        revealed: pair.question.length,
        done: true,
        isQuestion: true,
        _full: pair.question,
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
      const transcript = [...state.transcript] as InternalRenderedLine[];
      const last = transcript[transcript.length - 1];

      // Complete the current line if it's unfinished
      if (last && !last.done && last.kind === 'text') {
        const full = last._full;
        transcript[transcript.length - 1] = {
          ...last,
          text: full,
          revealed: full.length,
          done: true,
        };
      }

      // Add all remaining queued lines fully revealed
      for (const line of state.queue) {
        if (line.kind === 'thinking' || line.kind === 'divider') {
          transcript.push({
            kind: line.kind,
            text: '',
            revealed: 0,
            done: true,
            _full: '',
          });
        } else if (line.kind === 'tool') {
          const full = line.label;
          transcript.push({
            kind: 'tool',
            text: full,
            revealed: full.length,
            done: true,
            _full: full,
            result: line.result,
          });
        } else if (line.kind === 'text') {
          const full = line.content;
          transcript.push({
            kind: 'text',
            text: full,
            revealed: full.length,
            done: true,
            _full: full,
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
      const transcript = [...state.transcript] as InternalRenderedLine[];
      const last = transcript[transcript.length - 1];

      // If the last transcript line is an unfinished text line, reveal one more char.
      if (last && !last.done && last.kind === 'text') {
        const nextRevealed = last.revealed + 1;
        const full = last._full;
        const next: InternalRenderedLine = {
          ...last,
          text: full.slice(0, nextRevealed),
          revealed: nextRevealed,
          done: nextRevealed >= full.length,
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
        const rendered: InternalRenderedLine = {
          kind: line.kind,
          text: '',
          revealed: 0,
          done: true,
          _full: '',
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

      // Text lines start with 1 char revealed
      const rendered = createRenderedLine(line, 1);
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
    const t = setTimeout(() => dispatch({ type: 'TICK' }), delay);
    return () => clearTimeout(t);
  }, [state]);

  return { state, dispatch };
}
