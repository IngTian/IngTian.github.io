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
      'Nine roles, four companies, systems that held at fifty thousand requests a second. ' +
      'By every visible measure that is a good place to stand, and the field around it is flat: ' +
      'every direction out looks like more of the same, slightly worse.',
      'That flatness is the trap, and it is measurable rather than poetic. In the engineering ' +
      'basin the surface bends almost equally in every direction, so no step tells you much — ' +
      'the gradient there is a thousandth of what it is on the research side. Years can pass ' +
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

// STORY_TAIL is deleted. It was a replacement closing line for this column, and it inherited the exact bug
// it was meant to work around: the column is taller than one screen, so its last line sits below the deck's
// resting fold and the next gesture jumps the whole slide. Anything at the foot of that column is
// unreachable by normal scrolling — so the column now simply ends with its last body paragraph, and the
// coda above is the closing line, over in the drawing where it can actually be read.

// STORY_FIGURES is deleted. It held three "measured facts" — feedback ratio, climb to leave, blind stops
// — computed at build time from the hero's field. The computation was real; the field is invented. So the
// page printed exact numbers about a fiction in a place where a reader would take them for facts about a
// career, which is a worse failure than having no numbers at all: it borrows the authority of measurement
// for something unmeasured. The owner's call, and the right one.
//
// The graph still draws from those same modules — the difference is that a drawing of an invented surface
// reads as an illustration, while "260x" reads as a claim.
