// src/data/inquiry.ts
// WHAT THE RESEARCH ACTUALLY IS — stated as a question, made concrete by one example.
//
// The owner's brief: "it would be better to explain my area with questions and examples… for my
// research I'm working on portfolio optimization (multi-period) with RL, math, in fineng. This is the
// scope. So let's start with an open question, we promote the curiosity with one example, let the
// reader understand what I'm working on, and then say read my papers here."
//
// WHY A QUESTION AND NOT A LIST. The résumé failure mode is leading with credentials — title,
// employer, dates — whose implicit claim is "I was authorized." A question makes a different move: it
// names a problem the reader can disagree with, and it can be understood by someone who has never
// heard of hierarchical risk parity. The artifact then arrives as the answer to something, rather than
// as an item in an inventory.
//
// THE EXAMPLE IS LOAD-BEARING, not decoration. An abstract question about "multi-period allocation
// under transaction costs" is a keyword; the same question with a concrete pair of months in it is
// something a reader can hold. Everything in it is generic finance — no invented numbers, no claimed
// results (see the commit that stripped the made-up figures out of the career section).

export interface InquiryBlock {
  /** Small mono kicker. */
  kicker: string;
  /** Body paragraphs. */
  body: string[];
}

/** The scope, in one line — what field this is, for a reader who needs orienting first. */
export const INQUIRY_SCOPE =
  'Portfolio optimization in financial engineering — multi-period, and increasingly learned rather than assumed.';

/** THE OPEN QUESTION. Deliberately open: it is what the doctorate is for, not a thing already solved. */
export const INQUIRY_QUESTION =
  'A portfolio is not one decision. It is a sequence of them, each paying for the last — so how should today’s holdings be chosen when today’s choice constrains every choice after it, and the world will not hold still?';

/** The example, then the turn toward what is actually being researched. */
export const INQUIRY: InquiryBlock[] = [
  {
    kicker: 'One example',
    body: [
      'Suppose the model says technology is the place to be. A single-period optimizer moves the ' +
      'portfolio there today, because today is the only thing it can see. Next month the signal ' +
      'favours energy, so it moves again — paying the spread, the fees, and the tax each time. Over a ' +
      'year those round trips can cost more than the edge that motivated them.',

      'A multi-period optimizer knows there is a next month. It prefers a position it would still be ' +
      'willing to hold if the signal shifted slightly, and it treats the cost of changing its mind as ' +
      'part of the decision rather than as friction to be ignored. That is a different problem, with ' +
      'different mathematics: the objective now spans horizons, and the constraints couple across time.',
    ],
  },
  {
    kicker: 'Where the research goes',
    body: [
      'The harder question is where the model comes from at all. Classical methods assume a fixed ' +
      'model of risk and optimize against it — elegant, and wrong in exactly the moments that matter. ' +
      'The alternative is to let the allocation policy learn from experience, while keeping the ' +
      'structure that makes a portfolio investable rather than a backtest curiosity.',

      'That is the seam I work on: reinforcement learning for the policy, hierarchical risk structure ' +
      'to keep it diversified, and the operations-research core — convexity, duality, constraints — ' +
      'underneath both, because a learned allocation still has to respect the geometry of the problem.',
    ],
  },
];

/** The invitation, after the reader understands the question. Points at the real work. */
export const INQUIRY_INVITATION = {
  lead: 'The first paper is written and public.',
  linkLabel: 'Read the research',
  href: '/research',
  /** Named so the reader knows what they are about to open, without the page listing its results. */
  note: 'RL-BHRP — reinforcement learning embedded in Bayesian hierarchical risk parity (arXiv:2508.11856), plus the themes the doctorate builds on.',
};
