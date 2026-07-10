import { useEffect, useMemo, useRef, useState } from 'react';
import { useTypewriter } from './useTypewriter';
import { script } from '../../data/script';
import { prefersReducedMotion } from '../../lib/motion';

// Claude Code's own thinking-verb convention — a whimsical present participle
// that rotates while a "thinking" beat is on screen. Purely decorative text;
// swapping it never touches the transcript.
const THINKING_VERBS = ['Noodling', 'Percolating', 'Pondering', 'Mulling', 'Ruminating'];

// Every pair's slash command, in script order — the palette Claude Code's own
// "/" menu lists globally, not a per-answer contextual suggestion list.
const COMMANDS = Object.values(script.pairs).map((p) => ({ command: p.command, pairId: p.id, question: p.question }));

export default function Terminal() {
  const { state, dispatch } = useTypewriter(script);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const started = useRef(false);
  const [verbIndex, setVerbIndex] = useState(0);
  const [input, setInput] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  // play the greeting once on mount (falls straight to the opening question
  // if the script defines no intro)
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (script.intro) {
      dispatch({ type: 'INTRO' });
    } else {
      dispatch({ type: 'ASK', pairId: script.start });
    }
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

  // The palette opens the instant the field starts with "/" and filters as
  // you keep typing — Claude Code's own slash-menu behavior.
  const showPalette = input.startsWith('/');
  const filtered = useMemo(() => {
    if (!showPalette) return [];
    const q = input.slice(1).toLowerCase();
    return COMMANDS.filter((c) => c.command.toLowerCase().includes(q));
  }, [showPalette, input]);

  // Clamp the highlighted row whenever the filtered list changes shape (e.g.
  // typing narrows it down to fewer rows than the previous active index).
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);

  const canAsk = state.status === 'done' || state.status === 'idle';

  function ask(pairId: string) {
    if (!canAsk) return;
    dispatch({ type: 'ASK', pairId });
    setInput('');
    setActiveIndex(0);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showPalette || filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      ask(filtered[activeIndex].pairId);
    } else if (e.key === 'Escape') {
      setInput('');
    }
  }

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
              // The not-yet-revealed tail renders invisibly (same text flow,
              // opacity 0) so the line wraps to its FINAL shape from the first
              // character on — growing text never reflows anything around it.
              const ghostTail = !l.done ? l.full.slice(l.text.length) : '';
              return (
                <div key={i} className={isQuestion ? 'text-paper' : 'text-paper/85 mt-2'}>
                  {isQuestion && <span className="text-ochre mr-2">&gt;</span>}{body}
                  {/* Solid, not blinking: a line only ever renders !done while a
                      character is actively landing (~34ms cadence), so the cursor
                      IS the motion — an independent pulse animation fought that
                      rhythm instead of tracking it. */}
                  {!l.done && <span className="inline-block w-2 h-4 align-[-2px] ml-0.5 bg-ochre" />}
                  {ghostTail && <span className="opacity-0">{ghostTail}</span>}
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

        {/* Command line — type "/" to open the palette below, ↑/↓ to move,
            Enter to ask, Esc to clear. Disabled while a beat is running (the
            transcript above finishes its own turn first). */}
        <div className="relative border-t border-ochre/15">
          {/* Standard combobox+listbox pattern: focus stays on the <input>
              (role="combobox") the whole time — the options below are
              pointer/aria-activedescendant targets, not separately focusable
              buttons, since a focusable control nested inside role="option"
              would fight the input for keyboard focus. */}
          {showPalette && filtered.length > 0 && (
            <ul id="ask-listbox" className="absolute bottom-full left-0 right-0 mb-1 mx-2 rounded-lg border border-ochre/25 bg-[rgba(12,11,9,0.97)] overflow-hidden"
                role="listbox">
              {filtered.map((c, i) => (
                <li key={c.pairId}
                    id={`ask-option-${c.pairId}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    onMouseDown={(e) => { e.preventDefault(); ask(c.pairId); }}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`flex items-baseline gap-3 px-3 py-2 cursor-pointer font-mono text-[12.5px] ${i === activeIndex ? 'bg-ochre/15 text-paper' : 'text-paper/70'}`}>
                  <span className="text-ochre">/{c.command}</span>
                  <span className="text-ink-5 truncate">{c.question}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-2 px-4 py-2.5">
            <span className="text-ochre font-mono text-[13px]">&gt;</span>
            <input
              ref={inputRef}
              type="text"
              value={input}
              disabled={!canAsk}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={canAsk ? 'Type / to ask a question…' : ''}
              aria-label="Ask a question"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={showPalette && filtered.length > 0}
              aria-controls="ask-listbox"
              aria-activedescendant={showPalette && filtered.length > 0 ? `ask-option-${filtered[activeIndex].pairId}` : undefined}
              className="flex-1 bg-transparent font-mono text-[13px] text-paper placeholder:text-ink-5 outline-none disabled:opacity-40"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
