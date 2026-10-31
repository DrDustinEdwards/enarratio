/**
 * The Kaplan-Meier estimator of a survival function (Kaplan and Meier 1958), with Greenwood's
 * variance (Greenwood 1926) and a log-log confidence interval (Kalbfleisch and Prentice 1980).
 * Pure, and tested against published tables.
 */

/** One step of a Kaplan-Meier curve: a time at which at least one event happened. */
export interface SurvivalStep {
  readonly time: number;
  /** Subjects still followed just before this time. */
  readonly atRisk: number;
  readonly events: number;
  /** Subjects censored at this time (they count as at risk at it, and leave after). */
  readonly censored: number;
  /** The estimated probability of surviving past this time. */
  readonly survival: number;
  /** Greenwood's standard error of `survival`. */
  readonly standardError: number;
  /** The 95% confidence interval, log-log transformed so it stays within 0 and 1. */
  readonly lower: number;
  readonly upper: number;
}

/** A Kaplan-Meier estimate: its steps, every censoring time, and the median survival time. */
export interface SurvivalEstimate {
  readonly n: number;
  readonly events: number;
  /** One entry per distinct time with an event, ascending. */
  readonly steps: readonly SurvivalStep[];
  /** Every time a subject was censored, ascending, repeated for ties. */
  readonly censorTimes: readonly number[];
  /** The last time anyone was followed. */
  readonly end: number;
  /** The first time survival falls to 0.5 or below; undefined when it never does. */
  readonly median?: number;
}

const Z_975 = 1.959964;

/**
 * Estimates survival from each subject's follow-up time and whether it ended in the event (true)
 * or was censored (false). At a time with both events and censoring, the events come first, the
 * usual convention.
 */
export function kaplanMeier(
  times: readonly number[],
  events: readonly boolean[],
): SurvivalEstimate {
  if (times.length === 0) throw new Error("kaplanMeier: no subjects");
  if (times.length !== events.length)
    throw new Error("kaplanMeier: times and events differ in length");
  times.forEach((t, i) => {
    if (!(Number.isFinite(t) && t >= 0)) throw new Error(`kaplanMeier: time ${i + 1} is ${t}`);
  });
  const distinct = [...new Set(times)].sort((a, b) => a - b);
  let atRisk = times.length;
  let survival = 1;
  let greenwood = 0;
  const steps: SurvivalStep[] = [];
  for (const time of distinct) {
    let d = 0;
    let c = 0;
    times.forEach((t, i) => {
      if (t === time) {
        if (events[i]) d += 1;
        else c += 1;
      }
    });
    if (d > 0) {
      survival *= 1 - d / atRisk;
      greenwood += atRisk > d ? d / (atRisk * (atRisk - d)) : Number.POSITIVE_INFINITY;
      const se = survival * Math.sqrt(greenwood);
      let lower = 0;
      let upper = 1;
      if (survival > 0 && survival < 1 && Number.isFinite(greenwood)) {
        // exp(-exp(log(-log S) ± z sqrt(V) / |log S|)), V = Greenwood's sum.
        const spread = (Z_975 * Math.sqrt(greenwood)) / Math.abs(Math.log(survival));
        const center = Math.log(-Math.log(survival));
        lower = Math.exp(-Math.exp(center + spread));
        upper = Math.exp(-Math.exp(center - spread));
      } else if (survival === 1) {
        lower = 1;
      }
      steps.push({
        time,
        atRisk,
        events: d,
        censored: c,
        survival,
        standardError: se,
        lower,
        upper,
      });
    }
    atRisk -= d + c;
  }
  const median = steps.find((s) => s.survival <= 0.5)?.time;
  return {
    n: times.length,
    events: events.filter(Boolean).length,
    steps,
    censorTimes: times.filter((_, i) => !events[i]).sort((a, b) => a - b),
    end: distinct[distinct.length - 1] as number,
    ...(median === undefined ? {} : { median }),
  };
}

/** The number at risk at `time`, as survival tables print it: subjects followed to it or beyond. */
export function atRiskAt(times: readonly number[], time: number): number {
  return times.filter((t) => t >= time).length;
}
