/**
 * The four-parameter logistic (4PL) dose-response model, and its least-squares fit by the
 * Levenberg-Marquardt method (Levenberg 1944, Marquardt 1963). Pure, and tested against
 * published fits.
 */

import { tCritical95 } from "./stats.js";

/** The four parameters of a logistic dose-response curve. */
export interface LogisticParameters {
  /** The response at zero dose for a rising curve (at infinite dose for a falling one). */
  readonly bottom: number;
  readonly top: number;
  /** The dose giving a response halfway between bottom and top: EC50, or IC50 for a falling curve. */
  readonly ec50: number;
  /** The Hill slope: positive for a rising curve, negative for a falling one. */
  readonly hill: number;
}

/** A fitted curve: the parameters with the EC50's 95% confidence interval and the fit's quality. */
export interface LogisticFit extends LogisticParameters {
  readonly n: number;
  /** The 95% confidence interval of the EC50, from the standard error of log EC50 (Wald, Student's t). */
  readonly ec50Lower?: number;
  readonly ec50Upper?: number;
  /** The residual sum of squares. */
  readonly rss: number;
}

/**
 * The 4PL curve's response at a dose: bottom + (top - bottom) / (1 + (ec50 / dose)^hill). Dose 0
 * gives the curve's limit there.
 */
export function logistic(p: LogisticParameters, dose: number): number {
  return p.bottom + (p.top - p.bottom) / (1 + (p.ec50 / dose) ** p.hill);
}

type Vector = [number, number, number, number];

/** Solves a 4 by 4 linear system by Gaussian elimination with partial pivoting; null if singular. */
function solve(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i] as number]);
  for (let c = 0; c < n; c += 1) {
    let pivot = c;
    for (let r = c + 1; r < n; r += 1) {
      if (
        Math.abs((m[r] as number[])[c] as number) > Math.abs((m[pivot] as number[])[c] as number)
      ) {
        pivot = r;
      }
    }
    if (Math.abs((m[pivot] as number[])[c] as number) < 1e-300) return null;
    [m[c], m[pivot]] = [m[pivot] as number[], m[c] as number[]];
    const row = m[c] as number[];
    for (let r = 0; r < n; r += 1) {
      if (r === c) continue;
      const other = m[r] as number[];
      const f = (other[c] as number) / (row[c] as number);
      for (let k = c; k <= n; k += 1) other[k] = (other[k] as number) - f * (row[k] as number);
    }
  }
  return m.map((row, i) => (row[n] as number) / (row[i] as number));
}

/**
 * The model in the parameters the fit works in, [bottom, top, ln EC50, hill], with its gradient.
 * Working in ln EC50 keeps the EC50 positive and the problem well scaled across decades of dose.
 */
function model(q: Vector, x: number): { y: number; grad: Vector } {
  const [bottom, top, logEc50, hill] = q;
  if (x === 0) {
    // The limit at zero dose: bottom for a rising curve, top for a falling one.
    return hill > 0 ? { y: bottom, grad: [1, 0, 0, 0] } : { y: top, grad: [0, 1, 0, 0] };
  }
  const u = Math.exp(hill * (logEc50 - Math.log(x)));
  const d = 1 + u;
  const s = (top - bottom) / (d * d);
  return {
    y: bottom + (top - bottom) / d,
    grad: [1 - 1 / d, 1 / d, -s * u * hill, -s * u * (logEc50 - Math.log(x))],
  };
}

function rssOf(q: Vector, xs: readonly number[], ys: readonly number[]): number {
  let rss = 0;
  xs.forEach((x, i) => {
    rss += ((ys[i] as number) - model(q, x).y) ** 2;
  });
  return rss;
}

/** One Levenberg-Marquardt run from a starting point. */
function levenbergMarquardt(
  start: Vector,
  xs: readonly number[],
  ys: readonly number[],
): { q: Vector; rss: number; jtj: number[][] } {
  let q = start;
  let rss = rssOf(q, xs, ys);
  let lambda = 1e-3;
  let jtj: number[][] = [];
  for (let iteration = 0; iteration < 500; iteration += 1) {
    jtj = [0, 1, 2, 3].map(() => [0, 0, 0, 0]);
    const jtr = [0, 0, 0, 0];
    xs.forEach((x, i) => {
      const { y, grad } = model(q, x);
      const r = (ys[i] as number) - y;
      for (let a = 0; a < 4; a += 1) {
        jtr[a] = (jtr[a] as number) + (grad[a] as number) * r;
        for (let b = 0; b < 4; b += 1) {
          const row = jtj[a] as number[];
          row[b] = (row[b] as number) + (grad[a] as number) * (grad[b] as number);
        }
      }
    });
    let improved = false;
    while (lambda < 1e12) {
      const damped = jtj.map((row, a) =>
        row.map((v, b) => (a === b ? v * (1 + lambda) + 1e-12 : v)),
      );
      const step = solve(damped, jtr);
      if (step) {
        const next = q.map((v, k) => v + (step[k] as number)) as Vector;
        const nextRss = rssOf(next, xs, ys);
        if (Number.isFinite(nextRss) && nextRss <= rss) {
          const converged = rss - nextRss <= 1e-12 * (rss + 1e-30);
          q = next;
          rss = nextRss;
          lambda = Math.max(lambda / 10, 1e-12);
          improved = !converged;
          break;
        }
      }
      lambda *= 10;
    }
    if (!improved) break;
  }
  return { q, rss, jtj };
}

/**
 * Fits a four-parameter logistic curve to doses and responses by least squares. Starts from
 * the data's extremes and the dose nearest the midpoint, tries both slope directions and a
 * steeper start, and keeps the best fit. The EC50's interval is the Wald interval on ln EC50:
 * ±t(0.975, n - 4) standard errors, from the covariance s²(JᵀJ)⁻¹ at the solution (Bates and
 * Watts 1988), as GraphPad Prism and R's drc report it. Doses must be zero or more, with at
 * least four distinct positive doses; the interval needs at least five points.
 */
export function fitLogistic(doses: readonly number[], responses: readonly number[]): LogisticFit {
  const n = doses.length;
  if (n !== responses.length) throw new Error("fitLogistic: doses and responses differ in length");
  for (const [i, v] of doses.entries()) {
    if (!(Number.isFinite(v) && v >= 0)) throw new Error(`fitLogistic: dose ${i + 1} is ${v}`);
    if (!Number.isFinite(responses[i])) {
      throw new Error(`fitLogistic: response ${i + 1} is ${responses[i]}`);
    }
  }
  const positive = [...new Set(doses.filter((d) => d > 0))].sort((a, b) => a - b);
  if (positive.length < 4) {
    throw new Error("fitLogistic: needs at least four distinct positive doses");
  }
  const lo = Math.min(...responses);
  const hi = Math.max(...responses);
  const logs = doses.map((d) => (d > 0 ? Math.log(d) : Math.log(positive[0] as number) - 2));
  const meanLog = logs.reduce((a, b) => a + b, 0) / n;
  const meanY = responses.reduce((a, b) => a + b, 0) / n;
  const rising =
    logs.reduce((a, l, i) => a + (l - meanLog) * ((responses[i] as number) - meanY), 0) >= 0;
  const mid = (lo + hi) / 2;
  let nearest = 0;
  responses.forEach((y, i) => {
    if (
      (doses[i] as number) > 0 &&
      Math.abs(y - mid) < Math.abs((responses[nearest] as number) - mid)
    ) {
      nearest = i;
    }
  });
  const logEc50 = Math.log(
    (doses[nearest] as number) > 0 ? (doses[nearest] as number) : (positive[0] as number),
  );
  const starts: Vector[] = [];
  for (const slope of [1, 3]) {
    starts.push([lo, hi, logEc50, rising ? slope : -slope]);
    starts.push([hi, lo, logEc50, rising ? -slope : slope]);
  }
  let best = levenbergMarquardt(starts[0] as Vector, doses, responses);
  for (const start of starts.slice(1)) {
    const fit = levenbergMarquardt(start, doses, responses);
    if (fit.rss < best.rss) best = fit;
  }
  // Report the curve with bottom below top: (b, t, e, h) and (t, b, e, -h) are the same curve.
  let [bottom, top, logE, hill] = best.q;
  if (bottom > top) [bottom, top, hill] = [top, bottom, -hill];
  const fit = { n, bottom, top, ec50: Math.exp(logE), hill, rss: best.rss };
  if (n <= 4) return fit;
  const covariance = solve(best.jtj, [0, 0, 1, 0]);
  const variance = covariance ? (covariance[2] as number) * (best.rss / (n - 4)) : Number.NaN;
  if (!(variance >= 0)) return fit;
  const half = tCritical95(n - 4) * Math.sqrt(variance);
  return { ...fit, ec50Lower: Math.exp(logE - half), ec50Upper: Math.exp(logE + half) };
}
