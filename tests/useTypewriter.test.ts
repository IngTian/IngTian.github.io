import { describe, it, expect } from 'vitest';
import { terminalReducer, initialState } from '../src/components/terminal/useTypewriter';
import type { Script } from '../src/components/terminal/terminal.types';

const script: Script = {
  start: 'a',
  pairs: {
    a: {
      id: 'a',
      question: 'hi?',
      answer: { lines: [ { kind: 'tool', label: 'Read x' }, { kind: 'text', content: 'yo' } ] },
      followups: [{ label: 'more', goto: 'b' }],
    },
    b: { id: 'b', question: 'more?', answer: { lines: [ { kind: 'text', content: 'ok' } ] } },
  },
};

describe('terminalReducer', () => {
  it('starts idle with empty transcript', () => {
    const s = initialState(script);
    expect(s.status).toBe('idle');
    expect(s.transcript).toEqual([]);
  });

  it('ASK pushes the question line + queues the answer, status typing', () => {
    const s = terminalReducer(initialState(script), { type: 'ASK', pairId: 'a' });
    expect(s.status).toBe('typing');
    expect(s.currentPairId).toBe('a');
    // first transcript entry is the echoed user question, fully revealed
    expect(s.transcript[0]).toMatchObject({ kind: 'text', text: 'hi?', done: true });
  });

  it('tool lines reveal instantly (one TICK marks them done)', () => {
    let s = terminalReducer(initialState(script), { type: 'ASK', pairId: 'a' });
    s = terminalReducer(s, { type: 'TICK' });
    const tool = s.transcript.find((l) => l.kind === 'tool');
    expect(tool?.done).toBe(true);
    expect(tool?.text).toBe('Read x');
  });

  it('text lines reveal one char per TICK', () => {
    let s = terminalReducer(initialState(script), { type: 'ASK', pairId: 'a' });
    // tick once for the tool line, then start the text line
    s = terminalReducer(s, { type: 'TICK' }); // tool done
    s = terminalReducer(s, { type: 'TICK' }); // text reveal 1 -> "y"
    const text = s.transcript[s.transcript.length - 1];
    expect(text.kind).toBe('text');
    expect(text.text).toBe('y');
    expect(text.done).toBe(false);
    s = terminalReducer(s, { type: 'TICK' }); // "yo"
    expect(s.transcript[s.transcript.length - 1].text).toBe('yo');
  });

  it('reaches done after all lines revealed', () => {
    let s = terminalReducer(initialState(script), { type: 'ASK', pairId: 'a' });
    for (let i = 0; i < 20; i++) s = terminalReducer(s, { type: 'TICK' });
    expect(s.status).toBe('done');
  });

  it('COMPLETE instantly reveals all remaining content', () => {
    let s = terminalReducer(initialState(script), { type: 'ASK', pairId: 'a' });
    // state now has question + queued [tool, text]
    expect(s.status).toBe('typing');
    expect(s.queue.length).toBe(2);

    // COMPLETE should instantly finish everything
    s = terminalReducer(s, { type: 'COMPLETE' });
    expect(s.status).toBe('done');
    expect(s.queue.length).toBe(0);
    // transcript should have: question (already done) + tool + text, all done
    expect(s.transcript.length).toBe(3);
    expect(s.transcript.every(l => l.done)).toBe(true);
    const toolLine = s.transcript.find(l => l.kind === 'tool');
    expect(toolLine?.text).toBe('Read x');
    const textLine = s.transcript.find((l, i) => l.kind === 'text' && i > 0); // not the question
    expect(textLine?.text).toBe('yo');
  });
});
