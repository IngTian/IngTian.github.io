// src/data/story.ts
// THE EDITORIAL — the prose that explains the descent graph, in the owner's own terms.
//
// It sits directly under the graph and says literally what the picture shows: a career that
// descended into a comfortable local minimum, recognised it as local, and paid a real cost to climb
// out. The owner's brief for it: "the section explains the graph literally… incl. why we transition
// into quants." And the constraint that shaped the voice: "after all we are not an artist" — the
// sentences that made the earlier sketch read well were photograph notes, and this section needs the
// same register applied to the actual subject.
//
// Content lives here rather than in the component because every other fact on this site lives in
// data/ — editing what the page says should never mean editing markup.
import { timeline } from './profile';
import { cap, inWords } from '../lib/words';

/** The roles, counted from the timeline rather than typed: its work entries, so a degree is not a role. */
const ROLES = cap(inWords(timeline.filter((r) => r.kind === 'work').length));

export interface StoryColumn {
  /** Small mono kicker. */
  kicker: string;
  /** Display-size lead sentence — the one a skimmer reads. */
  lead: string;
  /** Body paragraphs. */
  body: string[];
}

/** The two columns. Left states the observation; right states what followed from it.
 *  Two columns rather than one because the piece IS a comparison — where I was against where the
 *  signal actually was — and a single measure makes the reader reconstruct that pairing themselves. */
export const STORY: StoryColumn[] = [
  {
    kicker: 'The local minimum',
    lead: 'Most of my career has been spent as a full-stack engineer, and I was good at it.',
    body: [
      `${ROLES} roles, four companies, systems that held at fifty thousand requests a second. ` +
      'By every visible measure that is a good place to stand, and the field around it is flat: ' +
      'every direction out looks like more of the same, slightly worse.',
      // "Hundreds" is a gloss, not a figure (a printed "260x" reads as a claim about a career; see the foot of this
      // file). tests/trajectory.test.ts holds it to the graph's field: the basin floor against the research side.
      'That flatness is the trap, and it is measurable rather than poetic. In the engineering ' +
      'basin the surface bends almost equally in every direction, so no step tells you much — ' +
      'the gradient there is hundreds of times smaller than on the research side. Years can pass ' +
      'without a signal strong enough to argue with.',
    ],
  },
  {
    kicker: 'Why the climb',
    lead: 'What I learned by moving was not the shape of the landscape. It was the shape of my own preferences.',
    body: [
      'The modelling half of every job held my attention and the plumbing did not. Written down ' +
      'once, that is a sentence about taste. Written down eight times across eight years, it is ' +
      'data — and the direction it points is mathematics, structured argument, and problems where ' +
      'the feedback is direct enough to be worth arguing with.',
      'A gradient method cannot leave a basin; it has no move that goes uphill. So leaving was ' +
      'not an optimisation, it was a decision: a paper written on my own time, a trading system ' +
      'built to test whether the interest survived contact with real money, and a doctorate in ' +
      'the thing itself. The climb is the honest part of the picture.',
    ],
  },
];

/** A single line under the two columns, in the same voice — the thesis, compressed.
 *  Deliberately not a conclusion about how good he is: a statement about what the object shows.
 *
 *  STILL EXPORTED because the graph renders it: it moved from this column into the drawing's empty
 *  lower-right, where it fades in as the walk discovers the deeper basin. The reason was mechanical, not
 *  editorial — this column is taller than one screen, so in the deck the gesture that should have scrolled
 *  down to the coda advanced to the next slide instead, and the line could not be read at all. */
export const STORY_CODA =
  'The deepest point on that surface is not marked, because I do not know where it is. ' +
  'What I know is the direction, and that the descent is still running.';

// NOTHING GOES AT THE FOOT OF A COLUMN: it is taller than one screen, so its last line sits below the deck's
// resting fold and the next gesture jumps the slide (a closing line there, STORY_TAIL, was deleted for that).

// STORY_FIGURES was deleted on the owner's call: three exact "measured facts" computed from the hero's field,
// which is invented. A drawing of an invented surface reads as an illustration; "260x" reads as a claim.
