// src/lib/paperFigures/pipelineFigure.ts
// RL-BHRP's Figure 1: how its pieces connect each month, wired as the PAPER specifies (Alg. 4, Def. 3.2.3), not as
// the reproduction's code does. The policy observes the Bayesian layer's estimates; the reward computes its penalty
// from Σ and the weights; PPO updates the policy. BHRP takes Σ and is the comparator. The paper's state (§3.2.2)
// does not include BHRP's weights, so no arrow leaves BHRP; the paper never says where the policy starts, and the
// reproduction starts it at BHRP, so its caption, in the explainer, says both. Pure.
//
// The words are HTML over an svg of arrows, so a symbol is build-time MathML like every other on the site (svg
// <text> cannot hold <math>). Each word is placed in percentages of its drawing and sized in cqw of it, so words
// and arrows scale together as svg text would. Two drawings, .pp-art.wide and .pp-art.narrow, for the page's CSS
// to swap at the phone breakpoint: the swap hides the div, since its words are the svg's siblings, so the rule is
// by class alone (`figure .narrow`), which also reaches Figure 2's svg.wide/svg.narrow. The arrows are .p-arrow
// paths in the order the data flows, for the page to fade in one by one. The words never wait.
import { inlineMath as m } from '../equations';

type Anchor = 'start' | 'middle' | 'end';
type Kind = 'p-name' | 'p-ref' | 'p-lab';
// x, y are the word's baseline in the drawing's units, with an svg text-anchor's meaning
type Word = [x: number, y: number, kind: Kind, html: string, anchor?: Anchor];
interface Art { W: number; H: number; arrows: [d: string, dashed?: boolean][]; words: Word[] }

const SIZE: Record<Kind, number> = { 'p-name': 14.5, 'p-ref': 12, 'p-lab': 12.5 };
const SHIFT: Record<Anchor, string> = { start: '0', middle: '-50%', end: '-100%' };
const MID = 0.35;   // a line of the serif is centred about 0.35em above its baseline

const node = (x: number, y: number, name: string, ref: string): Word[] => [[x, y, 'p-name', name], [x, y + 17, 'p-ref', ref]];
const SIGMA = m(String.raw`\Sigma`), THETA = m(String.raw`\theta`);

const WIDE: Art = {
  W: 612, H: 232,
  arrows: [['M124,73 H272', true], ['M340,73 H504'], ['M66,54 V22 H540 V54'], ['M540,104 V162'], ['M490,181 H306 V104'], ['M66,104 V162']],
  words: [
    ...node(66, 78, 'Bayesian layer', 'Alg. 3'),
    [198, 64, 'p-lab', 'state: estimates'],
    ...node(306, 78, 'Policy', '§3.2.4'),
    [422, 64, 'p-lab', `weights ${m('w')}`],
    [303, 14, 'p-lab', `${SIGMA}, for the penalty`],
    ...node(540, 78, 'Reward', 'eq. (4)'),
    [548, 137, 'p-lab', m('U'), 'start'],
    ...node(540, 186, 'PPO update', 'Alg. 4'),
    [398, 173, 'p-lab', THETA],
    [74, 137, 'p-lab', SIGMA, 'start'],
    ...node(66, 186, 'BHRP', 'Alg. 1–2'),
    [66, 220, 'p-lab', 'the comparator'],
  ],
};

const NARROW: Art = {
  W: 340, H: 440,
  arrows: [['M104,58 V124', true], ['M120,178 V244'], ['M140,58 V92 H318 V266 H158'], ['M120,298 V364'], ['M62,386 H22 V146 H84'], ['M178,25 H246']],
  words: [
    ...node(120, 30, 'Bayesian layer', 'Alg. 3'),
    [96, 96, 'p-lab', 'state', 'end'],
    ...node(120, 150, 'Policy', '§3.2.4'),
    [130, 216, 'p-lab', `weights ${m('w')}`, 'start'],
    [310, 172, 'p-lab', `${SIGMA}, for the`, 'end'],
    [310, 188, 'p-lab', 'penalty', 'end'],
    ...node(120, 270, 'Reward', 'eq. (4)'),
    [130, 336, 'p-lab', m('U'), 'start'],
    ...node(120, 390, 'PPO update', 'Alg. 4'),
    [30, 270, 'p-lab', THETA, 'start'],
    [212, 16, 'p-lab', SIGMA],
    ...node(284, 30, 'BHRP', 'Alg. 1–2'),
    [284, 64, 'p-lab', 'the comparator'],
  ],
};

const pc = (v: number) => `${Math.round(v * 10000) / 100}%`;

function art(a: Art, cls: string): string {
  const head = `ah-${cls}`;
  const word = ([x, y, kind, html, anchor = 'middle']: Word) => `<span class="${kind}" style="position:absolute;`
    + `left:${pc(x / a.W)};top:${pc((y - MID * SIZE[kind]) / a.H)};font-size:${Math.round((SIZE[kind] / a.W) * 1e5) / 1e3}cqw;`
    + `line-height:1;white-space:nowrap;transform:translate(${SHIFT[anchor]},-50%)">${html}</span>`;
  return `<div class="pp-art ${cls}" aria-hidden="true" style="position:relative;container-type:inline-size">`
    + `<svg viewBox="0 0 ${a.W} ${a.H}" aria-hidden="true" focusable="false" style="display:block;width:100%;height:auto;overflow:visible">`
    + `<defs><marker id="${head}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">`
    + '<path class="p-head" fill="none" d="M0,0.8 L7,4 L0,7.2"/></marker></defs>'
    + a.arrows.map(([d, dashed]) => `<path class="p-arrow${dashed ? ' p-dash' : ''}" fill="none" d="${d}" marker-end="url(#${head})"/>`).join('')
    + `</svg>${a.words.map(word).join('')}</div>`;
}

/** The two drawings, hidden from assistive tech: the explainer's caption (a :::figure container) says all they do,
 *  and the <figure> around them takes its name from it. */
export function pipelineFigure(): string {
  return art(WIDE, 'wide') + art(NARROW, 'narrow');
}
