/**
 * The streamgraph's layout (Byron and Wattenberg 2008, as d3-shape's stackOrderInsideOut and
 * stackOffsetWiggle compute it): layers ordered from the inside out, stacked on a baseline that
 * moves to keep their slopes small, then centered on zero.
 */

/** Each layer's lower and upper edge at each x, and the order layers stack in, bottom first. */
export interface StreamLayout {
  readonly order: readonly number[];
  readonly lower: readonly (readonly number[])[];
  readonly upper: readonly (readonly number[])[];
}

/**
 * Inside-out order: layers sorted by where they peak, each placed on whichever side of the
 * middle is lighter so far, so the earliest peaks sit in the middle and later ones outside.
 */
export function insideOut(values: readonly (readonly number[])[]): number[] {
  const peak = values.map((v) => v.indexOf(Math.max(...v)));
  const sum = values.map((v) => v.reduce((a, b) => a + b, 0));
  const byPeak = values.map((_, i) => i).sort((a, b) => (peak[a] as number) - (peak[b] as number));
  const tops: number[] = [];
  const bottoms: number[] = [];
  let top = 0;
  let bottom = 0;
  for (const i of byPeak) {
    if (top < bottom) {
      top += sum[i] as number;
      tops.push(i);
    } else {
      bottom += sum[i] as number;
      bottoms.push(i);
    }
  }
  return [...bottoms.reverse(), ...tops];
}

/**
 * Stacks `values` (one row per layer, one column per x, zero or more) in inside-out order on the
 * wiggle baseline, which minimizes the weighted change in slope of every layer's edges between
 * neighboring x values (x assumed evenly spaced, as d3 assumes), then shifts the whole stream so
 * that its middle averages zero.
 */
export function streamLayout(values: readonly (readonly number[])[]): StreamLayout {
  const n = values.length;
  const m = values[0]?.length ?? 0;
  const order = insideOut(values);
  const v = (i: number, j: number): number => values[order[i] as number]?.[j] ?? 0;
  const base = [0];
  for (let j = 1; j < m; j += 1) {
    let total = 0;
    let moved = 0;
    for (let i = 0; i < n; i += 1) {
      let slope = (v(i, j) - v(i, j - 1)) / 2;
      for (let k = 0; k < i; k += 1) slope += v(k, j) - v(k, j - 1);
      total += v(i, j);
      moved += slope * v(i, j);
    }
    base.push((base[j - 1] as number) - (total ? moved / total : 0));
  }
  const totals = Array.from({ length: m }, (_, j) => {
    let t = 0;
    for (let i = 0; i < n; i += 1) t += v(i, j);
    return t;
  });
  const middle = m === 0 ? 0 : base.reduce((a, b, j) => a + b + (totals[j] as number) / 2, 0) / m;
  const lower: number[][] = values.map(() => []);
  const upper: number[][] = values.map(() => []);
  for (let j = 0; j < m; j += 1) {
    let y = (base[j] as number) - middle;
    for (let i = 0; i < n; i += 1) {
      const layer = order[i] as number;
      (lower[layer] as number[]).push(y);
      y += v(i, j);
      (upper[layer] as number[]).push(y);
    }
  }
  return { order, lower, upper };
}
