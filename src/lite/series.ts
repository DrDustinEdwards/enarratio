/** What the light line and area charts share: their scales, axes, annotations and paths. */

import { datumAttributes } from "../render/datum.js";
import type { ScaleDescription } from "../render/figure.js";
import type { Point, SeriesChartOptions, SeriesModel } from "../render/line-model.js";
import { axisLabel, axisTickLabels, axisTicks, type Frame, grid, type Tick } from "./axis.js";
import {
  type Continuous,
  continuous,
  linearTickFormat,
  logTickFormat,
  logTicks,
  niceLinear,
  niceLog,
  type Pair,
  ticks,
  timeTickLabels,
  timeTicks,
} from "./scale.js";
import { type Attrs, el, num, text, textElement, translate } from "./svg.js";

/** A group of labels, or nothing when no label has text, as Plot skips an empty mark. */
function labels(attrs: Attrs, items: string[]): string {
  return items.length === 0 ? "" : el("g", attrs, items.join(""));
}

/** The smallest and largest finite numbers in `values`, or undefined when there are none. */
function extent(values: Iterable<number | null>): Pair | undefined {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const v of values) {
    if (v === null || !Number.isFinite(v)) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return lo <= hi ? [lo, hi] : undefined;
}

/** The scales and axes of a line or area chart. */
export interface SeriesFrame {
  readonly frame: Frame;
  readonly x: Continuous;
  readonly y: Continuous;
  /** The axes and grid, drawn before the marks. */
  readonly axes: string;
  /** The x scale as the enhancement layer reads it. */
  readonly xScale: ScaleDescription;
}

/**
 * Lays out a line or area chart: an x scale over every x the chart draws, without rounding (as
 * Plot leaves it), and a y scale made round, with zero unless told otherwise.
 */
export function seriesFrame(
  model: SeriesModel,
  frame: Frame,
  xs: Iterable<number>,
  ys: Iterable<number | null>,
  y: { readonly log: boolean; readonly zero: boolean },
): SeriesFrame {
  const { prepared } = model;
  const { width, height, marginTop, marginRight, marginBottom, marginLeft } = frame;
  const xDomain = extent(xs) ?? [0, 1];
  const xRange: Pair = [marginLeft, width - marginRight];
  const x = continuous(prepared.time ? "utc" : "linear", xDomain, xRange);

  const values = [...ys].filter((v): v is number => v !== null && (!y.log || v > 0));
  let yDomain: Pair = extent(values) ?? (y.log ? [1, 10] : [0, 1]);
  if (y.zero && (yDomain[0] > 0 || yDomain[1] < 0)) {
    yDomain = yDomain[0] > 0 ? [0, yDomain[1]] : [yDomain[0], 0];
  }
  yDomain = y.log ? niceLog(yDomain) : niceLinear(yDomain);
  const yScale = continuous(y.log ? "log" : "linear", yDomain, [height - marginBottom, marginTop]);

  const yCount = (height - marginBottom - marginTop) / 35;
  const yAt = y.log ? logTicks(yDomain, yCount) : ticks(yDomain[0], yDomain[1], yCount);
  const yFormat = y.log ? logTickFormat(yDomain, yCount) : linearTickFormat(yDomain, yCount);
  const yTicks: Tick[] = yAt.map((t) => ({ at: yScale(t), label: yFormat(t) }));

  const xCount = (xRange[1] - xRange[0]) / 80;
  let xTicks: Tick[];
  if (model.yearTicks) {
    xTicks = model.yearTicks.map((t) => ({ at: x(t), label: String(t) }));
  } else if (prepared.time) {
    const at = timeTicks(xDomain[0], xDomain[1], xCount);
    const labels = timeTickLabels(at);
    xTicks = at.map((t, i) => ({ at: x(t), label: labels[i] ?? "" }));
  } else {
    const format = linearTickFormat(xDomain, xCount);
    xTicks = ticks(xDomain[0], xDomain[1], xCount).map((t) => ({ at: x(t), label: format(t) }));
  }

  const axes = [
    grid(
      "y",
      yTicks.map((t) => t.at),
      frame,
    ),
    axisTicks(
      "y",
      yTicks.map((t) => t.at),
      frame,
    ),
    axisTickLabels("y", yTicks, frame, { tabular: true }),
    axisLabel("y", prepared.yLabel, frame),
    axisTicks(
      "x",
      xTicks.map((t) => t.at),
      frame,
    ),
    axisTickLabels("x", xTicks, frame, { tabular: true }),
    axisLabel("x", prepared.xLabel, frame),
  ].join("");

  return {
    frame,
    x,
    y: yScale,
    axes,
    xScale: { type: x.type, domain: [...xDomain], range: [...xRange] },
  };
}

/**
 * A path point. d3-shape writes path coordinates to three decimals, and the Plot renderer then
 * rounds to two, so a path rounds twice: 123.3846 becomes 123.385, then 123.39.
 */
const xy = (x: number, y: number): string =>
  `${num(Math.round(x * 1000) / 1000)},${num(Math.round(y * 1000) / 1000)}`;

/**
 * Splits rows into runs of defined values, as Plot does for lines and areas: rows before the
 * first defined value are dropped, and an undefined value ends a run.
 */
function runs<P>(rows: readonly P[], defined: (p: P) => boolean): P[][] {
  const out: P[][] = [];
  let current: P[] | undefined;
  for (const p of rows) {
    if (defined(p)) {
      if (!current) {
        current = [];
        out.push(current);
      }
      current.push(p);
    } else current = undefined;
  }
  return out;
}

/** Rows grouped by series, in the order each series first appears. */
export function bySeries<P extends { readonly series: string }>(rows: readonly P[]): P[][] {
  const groups = new Map<string, P[]>();
  for (const p of rows) {
    const group = groups.get(p.series);
    if (group) group.push(p);
    else groups.set(p.series, [p]);
  }
  return [...groups.values()];
}

/** A line through each run of defined points; a lone point closes on itself. */
export function linePath<P>(
  rows: readonly P[],
  defined: (p: P) => boolean,
  at: (p: P) => [number, number],
): string | undefined {
  const parts = runs(rows, defined).map(
    (run) =>
      run.map((p, i) => `${i === 0 ? "M" : "L"}${xy(...at(p))}`).join("") +
      (run.length === 1 ? "Z" : ""),
  );
  return parts.length === 0 ? undefined : parts.join("");
}

/** An area over each run of defined points: along the top, back along the base, closed. */
export function areaPath<P>(
  rows: readonly P[],
  defined: (p: P) => boolean,
  top: (p: P) => [number, number],
  base: (p: P) => [number, number],
): string | undefined {
  const parts = runs(rows, defined).map((run) => {
    const forward = run.map((p, i) => `${i === 0 ? "M" : "L"}${xy(...top(p))}`).join("");
    const back = [...run]
      .reverse()
      .map((p) => `L${xy(...base(p))}`)
      .join("");
    return `${forward}${back}Z`;
  });
  return parts.length === 0 ? undefined : parts.join("");
}

/** A group of one path per series. */
export function pathGroup(
  name: string,
  styles: Attrs,
  paths: readonly { readonly d: string | undefined; readonly attrs: Attrs }[],
): string {
  const drawn = paths.filter((p) => p.d !== undefined);
  if (drawn.length === 0) return "";
  return el(
    "g",
    { "data-enarratio-mark": name, ...styles },
    drawn.map((p) => el("path", { d: p.d, ...p.attrs })).join(""),
  );
}

/** Keyed points with hover details, drawn as circles. */
export function dots(
  model: SeriesModel,
  points: readonly Point[],
  styles: Attrs,
  circle: (p: Point) => Attrs,
): string {
  return el(
    "g",
    { "data-enarratio-mark": "dot", ...styles },
    points
      .map((p) =>
        el(
          "circle",
          { ...circle(p), ...Object.fromEntries(datumAttributes(model.datum(p))) },
          el("title", {}, text(model.describe(p))),
        ),
      )
      .join(""),
  );
}

/** Reference lines across the frame, and markers down it, each labelled, as Plot draws them. */
export function annotations(
  options: Pick<SeriesChartOptions<object>, "references">,
  model: SeriesModel,
  layout: SeriesFrame,
): string {
  const { frame, x, y } = layout;
  const { width, marginRight, marginLeft } = frame;
  let out = "";
  const references = options.references ?? [];
  if (references.length > 0) {
    out += el(
      "g",
      { "data-enarratio-mark": "rule", stroke: "currentColor", "stroke-dasharray": "4,3" },
      references
        .map((r) => el("line", { x1: marginLeft, x2: width - marginRight, y1: y(r.y), y2: y(r.y) }))
        .join(""),
    );
    out += labels(
      { "data-enarratio-mark": "text", "text-anchor": "end", transform: translate(0, -6) },
      references
        .filter((r) => r.label !== "")
        .map((r) =>
          textElement({ transform: translate(width - marginRight, y(r.y)) }, r.label, "middle"),
        ),
    );
  }
  out += verticalRules(
    model.markers.map((m) => ({ at: x(Number(m.x)), label: m.label })),
    frame,
  );
  return out;
}

/** Labelled vertical rules (event markers, the forecast boundary), from the top of the frame. */
export function verticalRules(rules: readonly Tick[], frame: Frame): string {
  if (rules.length === 0) return "";
  const { marginTop, height, marginBottom } = frame;
  return (
    el(
      "g",
      { "data-enarratio-mark": "rule", stroke: "currentColor", "stroke-dasharray": "2,3" },
      rules
        .map((r) => el("line", { x1: r.at, x2: r.at, y1: marginTop, y2: height - marginBottom }))
        .join(""),
    ) +
    labels(
      { "data-enarratio-mark": "text", "text-anchor": "start", transform: translate(4, 0) },
      rules
        .filter((r) => r.label !== "")
        .map((r) => textElement({ transform: translate(r.at, marginTop) }, r.label, "top")),
    )
  );
}
