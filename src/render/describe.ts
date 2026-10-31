/**
 * Sentences computed from a chart's data (B39, B24, B53): the overview read before the chart
 * (its type, axes and ranges, series and points) and the visible summary under it (each series'
 * trend, the extremes, values far from the rest and the interval at the end). Short sentences in
 * common words, so the summary stays at grade 9 or below (B19).
 */

import { maxOf, minOf } from "./data.js";
import { quantile } from "./distribution.js";
import type { At, AxisRange, Strings } from "./text.js";

/** One value as a summary reads it: where it is, and its interval when the chart draws one. */
export interface SummaryPoint {
  /** The point's position as text: its category, date or x value. */
  readonly at: string;
  readonly value: number | null;
  readonly lower?: number | null;
  readonly upper?: number | null;
}

/** One series of values, in display order. */
export interface SummarySeries {
  readonly name: string;
  readonly points: readonly SummaryPoint[];
}

/** What a chart hands its figure so the figure can describe it in words. */
export interface ChartDescription {
  /** The kind the overview names, when it is not the figure's (small multiples of bar charts). */
  readonly kind?: string;
  readonly axes?: readonly AxisRange[];
  readonly series?: readonly SummarySeries[];
  /** Whether points run in order (time, years, a numeric x), so a trend means something. */
  readonly ordered?: boolean;
  readonly format?: (value: number) => string;
  /** What the drawn interval is, e.g. "95% interval". */
  readonly interval?: string;
  /** Values on a log scale, so "far from the rest" is judged in orders of magnitude. */
  readonly log?: boolean;
  /** A sentence of the chart's own, for charts the series above do not fit (scatter). */
  readonly sentence?: string;
}

/** How many series a summary describes one by one; past this it states the extremes only. */
const DESCRIBED_SERIES = 3;
/** A change smaller than this share of the starting value reads as flat. */
const FLAT = 0.05;
/** A peak or low is named when it passes both ends by more than this share of the range. */
const TURN = 0.5;

/** A value axis as the overview states it: its label and the lowest and highest values on it. */
export function valueRange(
  position: AxisRange["position"],
  label: string | null,
  values: readonly number[],
  format: (value: number) => string,
): AxisRange {
  return {
    position,
    label: label ?? "",
    from: values.length > 0 ? format(minOf(values)) : "",
    to: values.length > 0 ? format(maxOf(values)) : "",
  };
}

/** A category axis as the overview states it: its label and its first and last categories. */
export function categoryRange(
  position: AxisRange["position"],
  label: string | null,
  names: readonly string[],
): AxisRange {
  return { position, label: label ?? "", from: names[0] ?? "", to: names.at(-1) ?? "" };
}

/**
 * Values far from the rest: beyond three interquartile ranges of the middle half (Tukey's far
 * out), so a smooth peak is not called unusual. Needs five values or more.
 */
export function outliers<P extends { readonly value: number | null }>(
  points: readonly P[],
  scale: (value: number) => number = (v) => v,
): P[] {
  const values = points
    .flatMap((p) => (p.value === null ? [] : [scale(p.value)]))
    .sort((a, b) => a - b);
  if (values.length < 5) return [];
  const q1 = quantile(values, 0.25);
  const q3 = quantile(values, 0.75);
  const fence = 3 * (q3 - q1);
  if (fence === 0) return [];
  return points.filter((p) => {
    if (p.value === null) return false;
    const v = scale(p.value);
    return v < q1 - fence || v > q3 + fence;
  });
}

interface Present extends SummaryPoint {
  readonly value: number;
  readonly series: string;
}

/** The generated summary of a chart's values, or "" when there is nothing to say. */
export function summarize(d: ChartDescription, strings: Strings): string {
  const format = d.format ?? String;
  const series = d.series ?? [];
  const sentences: string[] = [];
  const all: Present[] = series.flatMap((s) =>
    s.points.flatMap((p) => (p.value === null ? [] : [{ ...p, value: p.value, series: s.name }])),
  );
  const multi = series.length > 1;
  const named = (p: Present): At => ({
    value: format(p.value),
    at: multi ? `${p.series}, ${p.at}` : p.at,
  });
  const extreme = (points: readonly Present[], sign: 1 | -1): Present =>
    points.reduce((best, p) => (sign * (p.value - best.value) > 0 ? p : best));

  if (d.ordered && series.length <= DESCRIBED_SERIES) {
    for (const s of series) {
      const present = all.filter((p) => p.series === s.name);
      const first = present[0];
      const last = present.at(-1);
      if (!first || !last || present.length < 2) continue;
      const own = (p: Present): At => ({ value: format(p.value), at: p.at });
      const change = last.value - first.value;
      const scale = Math.abs(first.value) || Math.abs(last.value);
      const direction =
        scale === 0 || Math.abs(change) / scale < FLAT ? "flat" : change > 0 ? "up" : "down";
      const inner = present.slice(1, -1);
      const range = extreme(present, 1).value - extreme(present, -1).value;
      const peak = inner.length > 0 ? extreme(inner, 1) : undefined;
      const low = inner.length > 0 ? extreme(inner, -1) : undefined;
      const rise = peak ? peak.value - Math.max(first.value, last.value) : 0;
      const dip = low ? Math.min(first.value, last.value) - low.value : 0;
      const turn =
        range > 0 && Math.max(rise, dip) > TURN * range
          ? rise >= dip
            ? { kind: "peak" as const, point: own(peak as Present) }
            : { kind: "low" as const, point: own(low as Present) }
          : undefined;
      sentences.push(strings.trend(s.name, direction, own(first), own(last), turn));
    }
  }
  if (all.length > 1) {
    const max = extreme(all, 1);
    const min = extreme(all, -1);
    if (max.value !== min.value) {
      sentences.push(strings.highest(named(max)));
      sentences.push(strings.lowest(named(min)));
    }
  }
  const far = outliers(all, d.log ? Math.log10 : undefined).slice(0, 3);
  if (far.length > 0)
    sentences.push(strings.outliers(far.map((p) => `${named(p).value} (${named(p).at})`)));
  if (d.interval !== undefined || all.some((p) => p.lower != null)) {
    for (const s of series.slice(0, DESCRIBED_SERIES)) {
      const last = s.points.filter((p) => p.lower != null && p.upper != null).at(-1);
      if (!last) continue;
      sentences.push(
        strings.interval(
          multi ? s.name : "",
          d.interval ?? strings.terms.range.toLowerCase(),
          last.at,
          format(last.lower as number),
          format(last.upper as number),
        ),
      );
    }
  }
  if (d.sentence) sentences.push(d.sentence);
  // A trend opens with its series' name, which may be a lowercase field ("posts rose ..."). A
  // name that is not a plain word (a domain, "carrel.app", or an identifier) keeps its case.
  return sentences
    .map((s) =>
      /^\p{Ll}+[,:;]?$/u.test(/^\S+/u.exec(s)?.[0] ?? "")
        ? s.charAt(0).toUpperCase() + s.slice(1)
        : s,
    )
    .join(" ");
}

/** The overview read before the chart: its type, series and points, and each axis's range (B53). */
export function overview(
  kind: string,
  d: ChartDescription | undefined,
  rows: number,
  strings: Strings,
  count: (n: number) => string,
): string {
  const series = d?.series;
  const points = series
    ? series.reduce((n, s) => n + s.points.filter((p) => p.value !== null).length, 0)
    : rows;
  return [
    strings.overview(
      strings.kinds[kind] ?? kind,
      count(points),
      series && series.length > 1 ? count(series.length) : undefined,
    ),
    ...(d?.axes ?? []).map(strings.axis),
  ].join(" ");
}

/** Pearson's r of paired values, or undefined when either varies not at all. */
export function correlation(pairs: readonly (readonly [number, number])[]): number | undefined {
  const n = pairs.length;
  if (n < 3) return undefined;
  let sx = 0;
  let sy = 0;
  for (const [x, y] of pairs) {
    sx += x;
    sy += y;
  }
  const mx = sx / n;
  const my = sy / n;
  let xy = 0;
  let xx = 0;
  let yy = 0;
  for (const [x, y] of pairs) {
    xy += (x - mx) * (y - my);
    xx += (x - mx) ** 2;
    yy += (y - my) ** 2;
  }
  return xx === 0 || yy === 0 ? undefined : xy / Math.sqrt(xx * yy);
}
