/** Small statistics used by the scientific charts. Pure, and tested against published values. */

/** Two-sided 95% Student's t critical values for 1 to 30 degrees of freedom. */
const T_975 = [
  12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145,
  2.131, 2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048,
  2.045, 2.042,
];

/**
 * The 97.5th percentile of Student's t distribution, for a two-sided 95% interval. Exact to three
 * decimals up to 30 degrees of freedom, then the normal value 1.96 with a first-order correction.
 */
export function tCritical95(df: number): number {
  if (!Number.isInteger(df) || df < 1)
    throw new Error(`degrees of freedom must be a positive integer, is ${df}`);
  const exact = T_975[df - 1];
  if (exact !== undefined) return exact;
  return 1.96 + 2.4 / df;
}

/** A geometric mean with its 95% confidence interval, computed on the log scale. */
export interface GeometricSummary {
  readonly n: number;
  readonly mean: number;
  /** Undefined when n is 1: one value has no interval. */
  readonly lower?: number;
  readonly upper?: number;
}

/**
 * The geometric mean of positive values, and its 95% confidence interval from Student's t on the
 * log-transformed values: the standard summary for antibody titers.
 */
export function geometricSummary(values: readonly number[]): GeometricSummary {
  if (values.length === 0) throw new Error("geometric summary of no values");
  for (const v of values) {
    if (!(v > 0) || !Number.isFinite(v))
      throw new Error(`geometric summary needs positive values, got ${v}`);
  }
  const logs = values.map(Math.log);
  const n = logs.length;
  const mean = logs.reduce((a, b) => a + b, 0) / n;
  if (n === 1) return { n, mean: Math.exp(mean) };
  const variance = logs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  const half = (tCritical95(n - 1) * Math.sqrt(variance)) / Math.sqrt(n);
  return { n, mean: Math.exp(mean), lower: Math.exp(mean - half), upper: Math.exp(mean + half) };
}
