/**
 * Direct labels: series named on the drawing beside their marks, as every renderer places them
 * (record 0036).
 */

import { textGrowth } from "./size.js";

/** The least distance between two direct labels' baselines, in user units. */
const LABEL_GAP = 16;

/**
 * Moves direct labels apart so none overlaps the next (B8): labels closer than the gap form a
 * cluster, centered on where its labels would sit, and clusters that then touch merge. Order is
 * kept. Both renderers place their labels with it.
 */
export function spreadLabels(ys: readonly number[], width: number): number[] {
  // The gap grows with the text, which grows as the drawing shrinks (record 0022).
  const gap = LABEL_GAP * textGrowth(width);
  const at = (i: number): number => ys[i] as number;
  const clusters: { members: number[]; top: number }[] = [];
  for (const i of ys.map((_, i) => i).sort((a, b) => at(a) - at(b))) {
    clusters.push({ members: [i], top: at(i) });
    for (let n = clusters.length; n > 1; n -= 1) {
      const [a, b] = clusters.slice(-2) as [(typeof clusters)[0], (typeof clusters)[0]];
      if (a.top + a.members.length * gap <= b.top) break;
      const members = [...a.members, ...b.members];
      const mean = members.reduce((sum, m) => sum + at(m), 0) / members.length;
      clusters.splice(-2, 2, { members, top: mean - ((members.length - 1) * gap) / 2 });
    }
  }
  const out = [...ys];
  for (const c of clusters)
    c.members.forEach((m, k) => {
      out[m] = c.top + k * gap;
    });
  return out;
}
