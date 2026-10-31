/**
 * Statistics of one distribution, for histograms, density curves and box plots: bins, quartiles
 * and a kernel density estimate. Pure functions with no dependencies.
 */

import { ticks } from "../lite/scale.js";
import { maxOf, minOf } from "./data.js";

/**
 * The p-quantile of ascending values by linear interpolation between order statistics (Hyndman
 * and Fan's type 7: R's default, d3.quantile and Plot's box mark).
 */
export function quantile(sorted: readonly number[], p: number): number {
  const n = sorted.length;
  if (n === 0) throw new Error("quantile of no values");
  const h = (n - 1) * p;
  const lo = Math.floor(h);
  const a = sorted[lo] as number;
  const b = sorted[Math.min(lo + 1, n - 1)] as number;
  return a + (h - lo) * (b - a);
}

/** A Tukey box plot's numbers. */
export interface BoxStats {
  readonly n: number;
  readonly min: number;
  readonly q1: number;
  readonly median: number;
  readonly q3: number;
  readonly max: number;
  /** The whiskers: the most extreme values within 1.5 interquartile ranges of the box. */
  readonly low: number;
  readonly high: number;
  /** Values beyond the whiskers. */
  readonly outliers: readonly number[];
}

/** Quartiles, whiskers at 1.5 IQR (Tukey 1977) and outliers. */
export function boxStats(values: readonly number[]): BoxStats {
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const fence = 1.5 * (q3 - q1);
  const inside = sorted.filter((v) => v >= q1 - fence && v <= q3 + fence);
  return {
    n: sorted.length,
    min: sorted[0] as number,
    q1,
    median: quantile(sorted, 0.5),
    q3,
    max: sorted[sorted.length - 1] as number,
    low: inside[0] as number,
    high: inside[inside.length - 1] as number,
    outliers: sorted.filter((v) => v < q1 - fence || v > q3 + fence),
  };
}

/** One histogram bin: values from `x0` up to, not including, `x1` (the last bin includes `x1`). */
export interface Bin {
  readonly x0: number;
  readonly x1: number;
  readonly count: number;
}

/** Removes the float noise of repeated addition: 0.30000000000000004 becomes 0.3. */
const clean = (n: number): number => Number(n.toPrecision(12));

/**
 * Bins values into a histogram. `thresholds` is a number of bins, as a target (default Sturges'
 * rule, ceil(log2 n) + 1), and the edges are then round numbers covering every value; or it is
 * the ascending edges themselves, which must cover every value. Every bin is half-open except
 * the last, which includes its upper edge, so the maximum is counted.
 */
export function histogramBins(
  values: readonly number[],
  thresholds?: number | readonly number[],
): Bin[] {
  if (values.length === 0) throw new Error("histogram of no values");
  const min = minOf(values);
  const max = maxOf(values);
  let edges: number[];
  if (Array.isArray(thresholds)) {
    edges = [...thresholds];
    if (edges.length < 2) throw new Error("histogram thresholds need at least two edges");
    for (let i = 1; i < edges.length; i += 1) {
      if ((edges[i] as number) <= (edges[i - 1] as number)) {
        throw new Error("histogram thresholds must ascend");
      }
    }
    if (min < (edges[0] as number) || max > (edges[edges.length - 1] as number)) {
      throw new Error(
        `histogram thresholds ${edges[0]} to ${edges[edges.length - 1]} leave out values from ${min} to ${max}`,
      );
    }
  } else {
    const count = (thresholds as number | undefined) ?? Math.ceil(Math.log2(values.length)) + 1;
    if (!(Number.isInteger(count) && count >= 1)) {
      throw new Error(`histogram bin count must be a whole number of 1 or more, is ${count}`);
    }
    if (min === max) {
      edges = [min - 0.5, min + 0.5];
    } else {
      const round = ticks(min, max, count);
      const step = clean((round[1] ?? max) - (round[0] ?? min)) || max - min;
      const first = Math.floor(clean(min / step)) * step;
      edges = [];
      for (let k = 0; ; k += 1) {
        const edge = clean(first + k * step);
        edges.push(edge);
        if (edge > max || (edge === max && k > 0)) break;
      }
    }
  }
  const counts = new Array<number>(edges.length - 1).fill(0);
  for (const v of values) {
    // The last edge that is not above v, by bisection; the top edge belongs to the last bin.
    let lo = 0;
    let hi = edges.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if ((edges[mid] as number) <= v) lo = mid;
      else hi = mid;
    }
    counts[lo] = (counts[lo] as number) + 1;
  }
  return counts.map((count, i) => ({
    x0: edges[i] as number,
    x1: edges[i + 1] as number,
    count,
  }));
}

/**
 * Silverman's rule-of-thumb bandwidth for a Gaussian kernel: 0.9 min(sd, IQR / 1.34) n^(-1/5)
 * (Silverman 1986, eq. 3.31). Falls back to the standard deviation, then to 1, for data too
 * uniform to say.
 */
export function silvermanBandwidth(values: readonly number[]): number {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  const sorted = [...values].sort((a, b) => a - b);
  const iqr = quantile(sorted, 0.75) - quantile(sorted, 0.25);
  const spread = iqr > 0 ? Math.min(sd, iqr / 1.34) : sd;
  return spread > 0 ? 0.9 * spread * n ** -0.2 : 1;
}

/** A Gaussian kernel density estimate at `xs`, integrating to 1. */
export function kernelDensity(
  values: readonly number[],
  bandwidth: number,
  xs: readonly number[],
): number[] {
  const scale = 1 / (values.length * bandwidth * Math.sqrt(2 * Math.PI));
  return xs.map((x) => {
    let sum = 0;
    for (const v of values) sum += Math.exp(-0.5 * ((x - v) / bandwidth) ** 2);
    return sum * scale;
  });
}

/** `count` evenly spaced numbers from `from` to `to`. */
export function grid(from: number, to: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => from + ((to - from) * i) / (count - 1));
}
