// src/data/method.ts
// SLIDE 2's words. Short by design — the chart is the argument on that slide.
//
// The owner's brief: "at the next slide, you only need to say that i make and justify my decision
// systematically with math, and ML as a tool blablabla."
//
// "ML AS A TOOL" is the load-bearing phrase and the reason this copy is worth care. The site's identity
// hierarchy is quant-first: the mathematics decides, and machine learning is instrumentation. Copy that
// led with ML would quietly invert that, which the project's guide explicitly forbids.

export const METHOD_HEADLINE =
  'Every weight is a decision I can justify — from the mathematics, not from a hunch.';

export const METHOD_BODY: string[] = [
  'The structure comes first: an objective, the constraints it must respect, and the geometry that makes ' +
  'the problem solvable rather than merely stated. That is operations research, and it is what makes an ' +
  'allocation defensible to someone who wants to argue with it.',

  'Machine learning is a tool inside that structure, not a replacement for it. It is good at the part ' +
  'classical methods assume away — how exposures should adapt as conditions change — and it is only ' +
  'trustworthy when the structure around it still holds.',
];

export interface MethodTool {
  name: string;
  role: string;
}

/** What each tool is FOR. Named as instruments, in the order they actually apply. */
export const METHOD_TOOLS: MethodTool[] = [
  { name: 'Convex optimization', role: 'the objective and the constraints, and a solution you can certify' },
  { name: 'Risk decomposition', role: 'where the risk actually sits, before deciding what to change' },
  { name: 'Reinforcement learning', role: 'how the exposures adapt, once the structure is fixed' },
  { name: 'Out-of-sample testing', role: 'the part that decides whether any of it was real' },
];
