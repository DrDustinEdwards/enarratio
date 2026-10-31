/**
 * `enarratio/lite/area`: {@link areaChart} without Observable Plot or a DOM, for browser bundles.
 * The same options draw the same SVG as `areaChart` from `enarratio/plot`.
 *
 * @packageDocumentation
 */

import {
  AREA_OPACITY,
  type AreaChartOptions,
  areaModel,
  type Point,
} from "../render/line-model.js";
import { DEFAULT_HEIGHT, DEFAULT_WIDTH } from "../render/size.js";
import { annotationMarkup, continuousScale } from "./annotate.js";
import {
  annotations,
  areaPath,
  bySeries,
  dots,
  linePath,
  pathGroup,
  seriesFrame,
} from "./series.js";
import { el, svgRoot } from "./svg.js";

export type {
  AreaChartOptions,
  EventMarker,
  ReferenceLine,
  SeriesChartOptions,
} from "../render/line-model.js";

/**
 * An area chart over time or any continuous x, drawn without Observable Plot. Several series
 * stack, so the top edge is their total. The same options and output as `areaChart` from
 * `enarratio/plot`, in a bundle small enough for a browser.
 *
 * @example
 * areaChart({ data: monthly, x: "month", y: "hours", series: "activity", alt: "..." });
 */
export function areaChart<T extends object>(options: AreaChartOptions<T>): string {
  const model = areaModel(options);
  const { prepared } = model;
  const { points, seriesNames } = prepared;
  const color = (p: Point): string => model.plan.range[p.row] ?? "";

  // Each x's values stack in series order; a missing value adds nothing.
  const order = new Map(seriesNames.map((name, i) => [name, i]));
  const extents = new Map<Point, [number, number]>();
  const byX = new Map<number, Point[]>();
  for (const p of points) {
    const at = byX.get(p.at);
    if (at) at.push(p);
    else byX.set(p.at, [p]);
  }
  for (const stack of byX.values()) {
    let total = 0;
    const sorted = [...stack].sort(
      (a, b) => (order.get(a.series) ?? 0) - (order.get(b.series) ?? 0),
    );
    for (const p of sorted) {
      const v = Math.max(0, p.value ?? 0);
      extents.set(p, [total, total + v]);
      total += v;
    }
  }
  const span = (p: Point): [number, number] => extents.get(p) as [number, number];

  const ys: number[] = [0];
  for (const [a, b] of extents.values()) ys.push(a, b);
  for (const r of options.references ?? []) ys.push(r.y);
  const layout = seriesFrame(
    model,
    {
      width: options.width ?? DEFAULT_WIDTH,
      height: options.height ?? DEFAULT_HEIGHT,
      marginTop: 20,
      marginRight: 20,
      marginBottom: 44,
      marginLeft: prepared.yLabel === null ? 48 : 64,
    },
    [...points.map((p) => p.at), ...model.markers.map((m) => Number(m.x))],
    ys,
    { log: false, zero: true },
  );
  const { x, y, frame } = layout;

  // Annotations from the same scales Plot's are placed with: ranges behind the marks, notes last.
  const notes = annotationMarkup("areaChart", options.annotations, (axis) =>
    continuousScale(axis === "x" ? x : y),
  );
  const parts = [
    layout.axes,
    notes.behind,
    pathGroup(
      "area",
      { "fill-opacity": String(AREA_OPACITY) },
      bySeries(points).map((group) => ({
        d: areaPath(
          group,
          () => true,
          (p) => [x(p.at), y(span(p)[1])],
          (p) => [x(p.at), y(span(p)[0])],
        ),
        attrs: { fill: color(group[0] as Point) },
      })),
    ),
    // The top edge of each band as a line, so a light fill still reads as a shape.
    pathGroup(
      "line",
      { fill: "none", "stroke-width": "2", "stroke-linejoin": "round", "stroke-linecap": "round" },
      bySeries(points).map((group) => ({
        d: linePath(
          group,
          () => true,
          (p) => [x(p.at), y(span(p)[1])],
        ),
        attrs: { stroke: color(group[0] as Point) },
      })),
    ),
    // Gaps have no point: their hover text would otherwise claim a value.
    dots(
      model,
      points.filter((p) => p.value !== null),
      { "fill-opacity": "0" },
      (p) => ({
        cx: x(p.at),
        cy: y((span(p)[0] + span(p)[1]) / 2),
        r: 4,
        fill: color(p),
      }),
    ),
    el(
      "g",
      { "data-enarratio-mark": "rule", stroke: "currentColor" },
      el("line", {
        x1: frame.marginLeft,
        x2: frame.width - frame.marginRight,
        y1: y(0),
        y2: y(0),
      }),
    ),
    annotations(options, model, layout),
    notes.above,
  ];

  return model.figure(
    svgRoot(frame.width, frame.height, model.alt, "img", parts.join("")),
    layout.xScale,
  );
}
