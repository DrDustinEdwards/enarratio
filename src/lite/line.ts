/**
 * `enarratio/lite/line`: {@link lineChart} without Observable Plot or a DOM, for browser bundles.
 * The same options draw the same SVG as `lineChart` from `enarratio/plot`.
 *
 * @packageDocumentation
 */

import { type LineChartOptions, lineModel, type Point } from "../render/line-model.js";
import { DEFAULT_HEIGHT, DEFAULT_WIDTH } from "../render/size.js";
import {
  annotations,
  areaPath,
  bySeries,
  dots,
  linePath,
  pathGroup,
  seriesFrame,
  verticalRules,
} from "./series.js";
import { el, svgRoot, text, translate } from "./svg.js";

export type {
  EventMarker,
  LineBand,
  LineChartOptions,
  ReferenceLine,
  SeriesChartOptions,
} from "../render/line-model.js";

/**
 * A line chart over time or any continuous x, drawn without Observable Plot: the same options and
 * output as `lineChart` from `enarratio/plot`, in a bundle small enough for a browser.
 *
 * @example
 * lineChart({
 *   data: weekly,
 *   x: "week",
 *   y: "cases",
 *   series: "county",
 *   references: [{ y: 50, label: "Alert threshold" }],
 *   alt: "Weekly cases in three counties ...",
 * });
 */
export function lineChart<T extends object>(options: LineChartOptions<T>): string {
  const model = lineModel(options);
  const { prepared, present, showPoints, forecast } = model;
  const { points } = prepared;
  const color = (p: Point): string => model.plan.range[p.row] ?? "";

  const ys: (number | null)[] = points.map((p) => p.value);
  if (prepared.band) for (const p of points) ys.push(p.lower, p.upper);
  for (const r of options.references ?? []) ys.push(r.y);
  const xs = [
    ...points.map((p) => p.at),
    ...model.markers.map((m) => Number(m.x)),
    ...(forecast ? [Number(forecast.x)] : []),
  ];
  const layout = seriesFrame(
    model,
    {
      width: options.width ?? DEFAULT_WIDTH,
      height: options.height ?? DEFAULT_HEIGHT,
      marginTop: 20,
      marginRight: model.directLabels ? 96 : 24,
      marginBottom: 44,
      marginLeft: prepared.yLabel === null ? 48 : 64,
    },
    xs,
    ys,
    { log: model.log, zero: !model.log && (options.zero ?? true) },
  );
  const { x, y } = layout;
  const at = (p: Point): [number, number] => [x(p.at), y(p.value ?? 0)];
  const hasValue = (p: Point): boolean => p.value !== null;
  const lines = (rows: readonly Point[]) =>
    bySeries(rows).map((group) => ({
      d: linePath(group, hasValue, at),
      attrs: { stroke: color(group[0] as Point) },
    }));
  const lineStyles = {
    fill: "none",
    "stroke-width": "2",
    "stroke-linejoin": "round",
    "stroke-linecap": "round",
  };

  const hollow = forecast !== undefined;
  const parts = [
    layout.axes,
    prepared.band
      ? pathGroup(
          "area",
          { "fill-opacity": "0.18" },
          bySeries(points).map((group) => ({
            d: areaPath(
              group,
              (p) => p.lower !== null && p.upper !== null,
              (p) => [x(p.at), y(p.upper ?? 0)],
              (p) => [x(p.at), y(p.lower ?? 0)],
            ),
            attrs: { fill: color(group[0] as Point) },
          })),
        )
      : "",
    pathGroup("line", lineStyles, lines(model.solid)),
    forecast
      ? pathGroup("line", { ...lineStyles, "stroke-dasharray": "6,4" }, lines(model.dashed))
      : "",
    dots(
      model,
      present,
      hollow ? { "stroke-width": "1.5" } : { "fill-opacity": showPoints ? undefined : "0" },
      (p) => ({
        cx: x(p.at),
        cy: y(p.value ?? 0),
        r: showPoints ? 3 : 4,
        fill: color(p),
        // After the forecast boundary points are hollow: an outline in place of the fill.
        ...(hollow
          ? {
              "fill-opacity": showPoints && !p.forecast ? "1" : "0",
              stroke: color(p),
              "stroke-opacity": showPoints && p.forecast ? "1" : "0",
            }
          : {}),
      }),
    ),
    annotations(options, model, layout),
    forecast
      ? verticalRules([{ at: x(Number(forecast.x)), label: forecast.label }], layout.frame)
      : "",
  ];
  if (model.directLabels) {
    // Each series named at its last point.
    const last = bySeries(present).map((group) => group[group.length - 1] as Point);
    parts.push(
      el(
        "g",
        { "data-enarratio-mark": "text", "text-anchor": "start", transform: translate(6, 0) },
        last
          .map((p) =>
            el(
              "text",
              { fill: color(p), transform: translate(x(p.at), y(p.value ?? 0)), y: "0.32em" },
              text(p.series),
            ),
          )
          .join(""),
      ),
    );
  }

  return model.figure(
    svgRoot(layout.frame.width, layout.frame.height, options.alt, "img", parts.join("")),
    layout.xScale,
  );
}
