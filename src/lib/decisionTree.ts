// src/lib/decisionTree.ts
// THE BRANCHING OF DECISIONS — why multi-period is hard, drawn rather than asserted.
//
// The owner: "seems like you didn't surface countless decisions you make in the multi period setting" and
// "why is it hard seems lack visuals".
//
// Both are the same gap. The slides SAID the choices multiply and printed 72,000 as a figure; neither showed
// the thing that actually makes the problem hard, which is that each decision opens a new set of decisions.
// A number in a table does not convey that. A tree does: every node is a state of the book, every edge is a
// reweight you could make, and the width of the last row is the answer to "how many ways could this year
// have gone".
//
// WHAT MAKES THE TREE HONEST. It is not a decoration with arbitrary branching — the branch factor IS the
// number of distinct actions offered at each decision point, and the leaf count is that raised to the number
// of decision points, which is exactly the arithmetic of the real problem. Nothing is rounded up for effect,
// and the module exposes the count so the copy cannot drift from the picture.
//
// Pure: no DOM. Unit-tested (tests/decisionTree.test.ts).

/** A node in the decision tree, positioned in unit space (0..1 on both axes). */
export interface TreeNode {
  /** Depth: 0 is today, 1 is after the first news event, and so on. */
  depth: number;
  /** Index within its depth. */
  index: number;
  /** Unit x — position across the fan at this depth. */
  x: number;
  /** Unit y — 0 at the root, 1 at the last decision. */
  y: number;
  /** Parent's index within the previous depth, or -1 at the root. */
  parent: number;
  /** Which action this node arrived by: 0..branch-1. Root is -1. */
  action: number;
}

export interface TreeEdge {
  from: TreeNode;
  to: TreeNode;
  /** The action taken, 0..branch-1. */
  action: number;
}

export interface Tree {
  nodes: TreeNode[];
  edges: TreeEdge[];
  /** Nodes grouped by depth, for drawing row by row. */
  byDepth: TreeNode[][];
  branch: number;
  depths: number;
  /** Total leaves = branch^depths. The honest headline number. */
  leaves: number;
}

/**
 * Build a complete branching tree.
 *
 * @param branch how many distinct actions are available at each decision point
 * @param depths how many decision points there are
 *
 * Leaves grow as branch^depths, which is why this is drawn small (3^4 = 81 fits a slide) and stated large
 * (the real problem's count is astronomical). The picture and the number are the same fact at two scales.
 */
export function buildTree(branch: number, depths: number): Tree {
  const b = Math.max(1, Math.floor(branch));
  const d = Math.max(0, Math.floor(depths));

  const byDepth: TreeNode[][] = [];
  const nodes: TreeNode[] = [];
  const edges: TreeEdge[] = [];

  for (let depth = 0; depth <= d; depth++) {
    const count = Math.pow(b, depth);
    const row: TreeNode[] = [];
    for (let i = 0; i < count; i++) {
      // Centre each node in its own slice of the row, so a row of one sits in the middle and a row of many
      // spreads evenly. This is what makes the fan read as a fan rather than as a left-aligned ladder.
      const x = (i + 0.5) / count;
      const y = d > 0 ? depth / d : 0;
      const node: TreeNode = {
        depth,
        index: i,
        x,
        y,
        parent: depth === 0 ? -1 : Math.floor(i / b),
        action: depth === 0 ? -1 : i % b,
      };
      row.push(node);
      nodes.push(node);
    }
    byDepth.push(row);

    if (depth > 0) {
      const prev = byDepth[depth - 1];
      for (const n of row) {
        edges.push({ from: prev[n.parent], to: n, action: n.action });
      }
    }
  }

  return { nodes, edges, byDepth, branch: b, depths: d, leaves: Math.pow(b, d) };
}

/**
 * One path through the tree, as a list of actions — used to highlight a single "what if I do this, then
 * this" sequence against the full fan.
 *
 * Deterministic: the caller passes the actions, so a highlighted path is a stated choice rather than a
 * random walk (the project bans Math.random() at paint time).
 */
export function pathOf(tree: Tree, actions: readonly number[]): TreeNode[] {
  const out: TreeNode[] = [];
  if (!tree.byDepth.length) return out;
  let node = tree.byDepth[0][0];
  out.push(node);
  for (let depth = 1; depth <= tree.depths; depth++) {
    const a = actions[depth - 1];
    if (a === undefined) break;
    const action = ((a % tree.branch) + tree.branch) % tree.branch;
    const index = node.index * tree.branch + action;
    const row = tree.byDepth[depth];
    if (!row || !row[index]) break;
    node = row[index];
    out.push(node);
  }
  return out;
}

/**
 * How the count explodes, as a per-depth series — for labelling each row of the drawing with the number of
 * distinct books you could be holding by then.
 */
export function countsByDepth(tree: Tree): number[] {
  return tree.byDepth.map((row) => row.length);
}

/**
 * SLIPPAGE: what a reweight actually costs, and why it is not linear.
 *
 * The owner: "you need to consider the reweight costs from slippage etc."
 *
 * Cost has two parts. The spread is paid on everything you trade — linear in size. Market impact is the part
 * that makes size itself the problem: pushing a large order through a finite book moves the price against
 * you, and the standard model for that is proportional to the square root of participation (your order as a
 * fraction of daily volume). Square-root impact is the widely used empirical form; it is not a claim of
 * precision, and the slide calls it a model rather than a law.
 *
 * @param fraction  the fraction of the portfolio being reweighted (0..1)
 * @param spreadBp  half-spread paid per unit traded, in basis points
 * @param impactBp  impact coefficient in basis points at 100% participation
 * @param participation the order as a fraction of the instrument's daily volume
 * @returns cost as a fraction of the portfolio
 */
export function reweightCost(
  fraction: number,
  spreadBp = 2,
  impactBp = 35,
  participation = 0.1,
): number {
  const f = Math.max(0, fraction);
  const spread = (spreadBp / 10000) * f;
  const impact = (impactBp / 10000) * Math.sqrt(Math.max(0, participation)) * f;
  return spread + impact;
}

/** Cost curve samples, for drawing the "why size hurts" line. */
export function costCurve(
  samples = 40,
  maxParticipation = 1,
  spreadBp = 2,
  impactBp = 35,
): { participation: number; costBp: number }[] {
  const out: { participation: number; costBp: number }[] = [];
  for (let i = 0; i <= samples; i++) {
    const p = (maxParticipation * i) / samples;
    // Cost of reweighting the whole position, expressed in bp so the axis is readable.
    out.push({ participation: p, costBp: reweightCost(1, spreadBp, impactBp, p) * 10000 });
  }
  return out;
}

/**
 * The size at which trading cost overwhelms an expected edge — the honest reason "just rebalance" is not an
 * answer at scale. Returns the participation level where cost equals the given edge in bp, or null when the
 * edge covers the cost at every level modelled.
 */
export function breakEvenParticipation(
  edgeBp: number,
  spreadBp = 2,
  impactBp = 35,
): number | null {
  // spread + impact*sqrt(p) = edge  ->  sqrt(p) = (edge - spread) / impact
  const net = edgeBp - spreadBp;
  if (net <= 0) return 0;            // the spread alone already eats the edge
  const root = net / impactBp;
  const p = root * root;
  return p <= 1 ? p : null;
}
