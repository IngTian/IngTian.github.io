import { useEffect, useRef, useState } from 'react';
import { useTypewriter } from './useTypewriter';
import { script } from '../../data/script';
import type { Followup } from './terminal.types';
import { prefersReducedMotion } from '../../lib/motion';

// Claude Code's own thinking-verb convention — a whimsical present participle
// that rotates while a "thinking" beat is on screen. Purely decorative text;
// swapping it never touches the transcript.
const THINKING_VERBS = ['Noodling', 'Percolating', 'Pondering', 'Mulling', 'Ruminating'];

export default function Terminal() {
  const { state, dispatch } = useTypewriter(script);
  const bodyRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const [verbIndex, setVerbIndex] = useState(0);

  // auto-ask the opening question once
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    dispatch({ type: 'ASK', pairId: script.start });
  }, [dispatch]);

  // if reduced motion, instantly complete by dispatching COMPLETE
  useEffect(() => {
    if (!prefersReducedMotion()) return;
    if (state.status === 'typing') {
      dispatch({ type: 'COMPLETE' });
    }
  }, [state.status, dispatch]);

  // autoscroll
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [state.transcript]);

  const currentPair = state.currentPairId ? script.pairs[state.currentPairId] : null;
  const chips: Followup[] = state.status === 'done' && currentPair?.followups ? currentPair.followups : [];

  // Rotate the thinking verb only while a "thinking" beat is the active
  // (last, not-yet-superseded) transcript line — cheap to leave running
  // otherwise since it's a no-op once the line is gone.
  const lastLine = state.transcript[state.transcript.length - 1];
  const isThinking = lastLine?.kind === 'thinking' && state.status === 'typing';
  useEffect(() => {
    if (!isThinking || prefersReducedMotion()) return;
    const t = setInterval(() => setVerbIndex((v) => (v + 1) % THINKING_VERBS.length), 550);
    return () => clearInterval(t);
  }, [isThinking]);

  return (
    <div className="max-w-[680px] mx-auto">
      <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-ochre">Now</p>
      <h2 className="font-display text-[27px] font-medium text-paper mt-2">What I'm working on. Just ask.</h2>

      <div className="terminal-chrome mt-6 rounded-xl overflow-hidden border border-ochre/20"
           style={{ boxShadow: '0 30px 70px rgba(0,0,0,0.5)' }}>
        <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-ochre/15">
          <i className="w-2.5 h-2.5 rounded-full bg-ink-3" />
          <i className="w-2.5 h-2.5 rounded-full bg-ochre" />
          <i className="w-2.5 h-2.5 rounded-full bg-ink-4" />
          <span className="ml-2 font-mono text-[11px] text-ink-5">ingtian@research — ask-me</span>
        </div>
        <div ref={bodyRef} className="p-4 font-mono text-[13px] leading-relaxed min-h-[160px] max-h-[340px] overflow-y-auto">
          {/* visible (animated) layer */}
          <div aria-hidden="true">
            {state.transcript.map((l, i) => {
              if (l.kind === 'tool') return (
                <div key={i} className="mt-2">
                  <div className="text-ink-5"><span className="text-ochre">●</span> {l.text}</div>
                  {l.result && <div className="text-ink-5/70 pl-[18px]"><span className="text-ink-4">⎿</span> {l.result}</div>}
                </div>
              );
              if (l.kind === 'thinking') {
                const isLast = i === state.transcript.length - 1;
                const spinning = isLast && state.status === 'typing';
                // Once resolved this settles back to a quiet "…" (matching the
                // prior static marker) rather than leaving a spelled-out label
                // sitting in the scrollback, which would read as stuck.
                return (
                  <div key={i} className="text-ink-5/70 mt-2 flex items-center gap-2">
                    <span className={spinning ? 'inline-block animate-spin' : 'inline-block'}>✢</span>
                    {spinning ? `${THINKING_VERBS[verbIndex]}…` : '…'}
                  </div>
                );
              }
              if (l.kind === 'divider') return <hr key={i} className="my-2 border-ochre/15" />;
              // text — use explicit isQuestion flag
              const isQuestion = l.isQuestion === true;
              // once a text line with an href is fully typed, render it as a link
              const body = l.href && l.done
                ? <a href={l.href} target="_blank" rel="noopener noreferrer" className="text-ochre underline decoration-ochre/40 underline-offset-2 hover:decoration-ochre">{l.text}</a>
                : l.text;
              return (
                <div key={i} className={isQuestion ? 'text-paper' : 'text-paper/85 mt-2'}>
                  {isQuestion && <span className="text-ochre mr-2">&gt;</span>}{body}
                  {!l.done && <span className="inline-block w-2 h-4 align-[-2px] ml-0.5 bg-ochre animate-pulse" />}
                </div>
              );
            })}
          </div>
          {/* screen-reader mirror: announce only the current pair (last question + following answer lines) */}
          <div className="sr-only" aria-live="polite">
            {state.status === 'done' && (() => {
              // Find the last question line
              const lastQIndex = state.transcript.findLastIndex((l) => l.isQuestion === true);
              if (lastQIndex === -1) return '';
              // Slice from that question to the end (current pair)
              const currentPair = state.transcript.slice(lastQIndex).filter((l) => l.kind === 'text');
              const question = currentPair.find((l) => l.isQuestion);
              const answers = currentPair.filter((l) => !l.isQuestion);
              return `Question: ${question?.text || ''}. Answer: ${answers.map((l) => l.text).join(' ')}`;
            })()}
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2 flex-wrap" style={{ opacity: chips.length ? 1 : 0.4, pointerEvents: chips.length ? 'auto' : 'none' }}>
        {chips.map((c) => (
          <button key={c.goto}
            onClick={() => { dispatch({ type: 'ASK', pairId: c.goto }); }}
            className="font-mono text-[11.5px] text-paper/80 border border-ochre/30 bg-ochre/5 px-3 py-1.5 rounded-lg hover:bg-ochre/15 hover:border-ochre hover:text-paper transition-colors">
            <span className="text-ochre">›</span> {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
