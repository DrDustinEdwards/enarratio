/**
 * Pooling study estimates by inverse-variance weighting: the fixed-effect estimate, and the
 * random-effects estimate of DerSimonian and Laird (1986). Pure, for forest plots.
 */

/** One study's estimate with its 95% confidence interval. */
export interface StudyEstimate {
  readonly estimate: number;
  readonly lower: number;
  readonly upper: number;
}

/** A pooled estimate with its interval, weights and heterogeneity. */
export interface PooledEstimate extends StudyEstimate {
  readonly method: "fixed" | "random";
  /** Each study's share of the total weight, summing to 1. */
  readonly weights: readonly number[];
  /** Cochran's Q. */
  readonly q: number;
  /** I², the share of variation due to heterogeneity rather than chance (Higgins and Thompson 2002). */
  readonly i2: number;
  /** The between-study variance τ² (0 for the fixed-effect estimate). */
  readonly tau2: number;
}

const Z_975 = 1.959964;

/**
 * Pools estimates by inverse variance. Each standard error is taken from its 95% interval as
 * (upper - lower) / (2 × 1.96), on the log scale when `log` is true (for ratios: odds, risk and
 * hazard ratios), and the result is transformed back.
 */
export function poolEstimates(
  studies: readonly StudyEstimate[],
  method: "fixed" | "random" = "fixed",
  log = false,
): PooledEstimate {
  if (studies.length < 2) throw new Error("poolEstimates: needs at least two studies");
  const t = (v: number): number => {
    if (log && !(v > 0)) throw new Error(`poolEstimates: a ratio must be positive, is ${v}`);
    return log ? Math.log(v) : v;
  };
  const ys = studies.map((s) => t(s.estimate));
  const variances = studies.map((s) => {
    const se = (t(s.upper) - t(s.lower)) / (2 * Z_975);
    if (!(se > 0)) throw new Error("poolEstimates: every study needs an interval of some width");
    return se * se;
  });
  const fixedWeights = variances.map((v) => 1 / v);
  const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);
  const sw = sum(fixedWeights);
  const fixed = sum(ys.map((y, i) => (fixedWeights[i] as number) * y)) / sw;
  const q = sum(ys.map((y, i) => (fixedWeights[i] as number) * (y - fixed) ** 2));
  const df = studies.length - 1;
  const i2 = q > df ? (q - df) / q : 0;
  const c = sw - sum(fixedWeights.map((w) => w * w)) / sw;
  const tau2 = method === "random" ? Math.max(0, (q - df) / c) : 0;
  const weights = variances.map((v) => 1 / (v + tau2));
  const total = sum(weights);
  const pooled = sum(ys.map((y, i) => (weights[i] as number) * y)) / total;
  const half = Z_975 / Math.sqrt(total);
  const back = (v: number): number => (log ? Math.exp(v) : v);
  return {
    method,
    estimate: back(pooled),
    lower: back(pooled - half),
    upper: back(pooled + half),
    weights: weights.map((w) => w / total),
    q,
    i2,
    tau2,
  };
}
