import { useEffect, useRef } from 'react';
import { useTypewriter } from './useTypewriter';
import { script } from '../../data/script';
import type { Followup } from './terminal.types';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function Terminal() {
  const { state, dispatch } = useTypewriter(script);
  const bodyRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

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

  return (
    <div className="max-w-[680px] mx-auto">
      <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-ochre">Now</p>
      <h2 className="font-display text-[27px] font-medium text-paper mt-2">What I'm working on. Just ask.</h2>

      <div className="mt-6 rounded-xl overflow-hidden border border-ochre/20"
           style={{ background: 'linear-gradient(180deg, rgba(40,36,30,0.7), rgba(20,18,15,0.92))', boxShadow: '0 30px 70px rgba(0,0,0,0.5)' }}>
        <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-ochre/15">
          <i className="w-2.5 h-2.5 rounded-full" style={{ background: '#c56e62' }} />
          <i className="w-2.5 h-2.5 rounded-full" style={{ background: '#c8a36a' }} />
          <i className="w-2.5 h-2.5 rounded-full" style={{ background: '#8aa98f' }} />
          <span className="ml-2 font-mono text-[11px] text-ink-5">ingtian@research — ask-me</span>
        </div>
        <div ref={bodyRef} className="p-4 font-mono text-[13px] leading-relaxed min-h-[160px] max-h-[340px] overflow-y-auto">
          {/* visible (animated) layer */}
          <div aria-hidden="true">
            {state.transcript.map((l, i) => {
              if (l.kind === 'tool') return <div key={i} className="text-ink-5 mt-2"><span className="text-ochre">●</span> {l.text}</div>;
              if (l.kind === 'thinking') return <div key={i} className="text-ink-5/70 mt-2">…</div>;
              if (l.kind === 'divider') return <hr key={i} className="my-2 border-ochre/15" />;
              // text — first line of a pair is the echoed question (prefix '>')
              const isQuestion = i === 0 || state.transcript[i - 1]?.kind === 'divider';
              return (
                <div key={i} className={isQuestion ? 'text-paper' : 'text-paper/85 mt-2'}>
                  {isQuestion && <span className="text-[#8aa98f] mr-2">&gt;</span>}{l.text}
                  {!l.done && <span className="inline-block w-2 h-4 align-[-2px] ml-0.5 bg-ochre animate-pulse" />}
                </div>
              );
            })}
          </div>
          {/* screen-reader mirror: full text, announced once per completed run */}
          <div className="sr-only" aria-live="polite">
            {state.status === 'done' && state.transcript.filter((l) => l.kind === 'text').map((l) => l.text).join(' ')}
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
