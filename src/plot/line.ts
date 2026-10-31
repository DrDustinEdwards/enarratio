import * as Plot from "@observablehq/plot";
import {
  AREA_OPACITY,
  type AreaChartOptions,
  areaModel,
  dayTicks,
  type LineChartOptions,
  lineModel,
  type MarkerPoint,
  type Point,
  type Prepared,
  type SeriesChartOptions,
  type SeriesModel,
  spreadLabels,
} from "../render/line-model.js";
import { keyed, renderPlot } from "../render/plot.js";
import { DEFAULT_HEIGHT, DEFAULT_WIDTH } from "../render/size.js";
import { drawAnnotations } from "./annotate.js";

export type {
  AreaChartOptions,
  EventMarker,
  LineBand,
  LineChartOptions,
  ReferenceLine,
  SeriesChartOptions,
} from "../render/line-model.js";

function annotations(
  options: Pick<SeriesChartOptions<object>, "references">,
  markers: readonly MarkerPoint[],
): Plot.Markish[] {
  const marks: Plot.Markish[] = [];
  const references = options.references ?? [];
  if (references.length > 0) {
    marks.push(
      Plot.ruleY(references, { y: "y", strokeDasharray: "4,3" }),
      Plot.text(references, {
        y: "y",
        text: "label",
        frameAnchor: "right",
        textAnchor: "end",
        dy: -6,
      }),
    );
  }
  if (markers.length > 0) {
    marks.push(
      Plot.ruleX(markers, { x: "x", strokeDasharray: "2,3" }),
      Plot.text(markers, { x: "x", text: "label", frameAnchor: "top", textAnchor: "start", dx: 4 }),
    );
  }
  return marks;
}

/** The x scale shared by line and area charts. */
function xScale(prepared: Prepared, yearTicks: number[] | undefined, plotWidth: number) {
  const base = {
    type: prepared.time ? "utc" : "linear",
    label: prepared.xLabel,
    labelAnchor: "center",
    labelArrow: "none",
  } as const;
  if (yearTicks) return { ...base, ticks: yearTicks, tickFormat: (d: number) => String(d) };
  const days = dayTicks(prepared, plotWidth);
  // As Dates, so Plot labels them as it labels its own time ticks.
  return days ? { ...base, ticks: days.map((t) => new Date(t)) } : base;
}

/** The y scale's domain when every value is zero, and its tick format for huge values (B41). */
function yAxis(model: SeriesModel) {
  return {
    ...(model.valueAxis.flat ? { domain: [0, 1] } : {}),
    ...(model.valueAxis.format ? { tickFormat: model.valueAxis.format } : {}),
  };
}

/** The labeled rule where observed data end and the forecast begins. */
function forecastRule(at: number | Date, label: string): Plot.Markish[] {
  const rule = [{ x: at, label }];
  return [
    Plot.ruleX(rule, { x: "x", strokeDasharray: "2,3" }),
    Plot.text(rule, { x: "x", text: "label", frameAnchor: "top", textAnchor: "start", dx: 4 }),
  ];
}

/**
 * A line chart over time or any continuous x: one series or several, with gaps where values are
 * missing, reference lines and event markers. Every value is a keyed point that shows hover
 * details and, once enhanced, can be reached by keyboard and brushed as a range.
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
  const { points, seriesNames } = prepared;

  const line = {
    x: "x",
    y: "value",
    z: "series",
    stroke: "series",
    strokeWidth: 2,
    curve: "linear",
  } as const;
  const hollow = forecast !== undefined;
  const marks: Plot.Markish[] = [
    ...(prepared.band
      ? [
          Plot.areaY(points, {
            x: "x",
            y1: "lower",
            y2: "upper",
            z: "series",
            fill: "series",
            fillOpacity: 0.18,
            curve: "linear",
          }),
        ]
      : []),
    Plot.line(model.solid, line),
    ...(forecast === undefined
      ? []
      : [Plot.line(model.dashed, { ...line, strokeDasharray: "6,4" })]),
    Plot.dot(present, {
      x: "x",
      y: "value",
      fill: "series",
      r: showPoints ? 3 : 4,
      // After the forecast boundary points are hollow: an outline in place of the fill.
      fillOpacity: hollow ? (p: Point) => (showPoints && !p.forecast ? 1 : 0) : showPoints ? 1 : 0,
      ...(hollow
        ? {
            stroke: "series",
            strokeWidth: 1.5,
            strokeOpacity: (p: Point) => (showPoints && p.forecast ? 1 : 0),
          }
        : {}),
      title: model.describe,
      render: keyed(present, model.datum),
    }),
    ...annotations(options, model.markers),
    ...(forecast === undefined ? [] : forecastRule(forecast.x, forecast.label)),
  ];
  if (model.directLabels) {
    marks.push(
      Plot.text(
        present,
        Plot.selectLast({
          x: "x",
          y: "value",
          z: "series",
          text: "series",
          fill: "series",
          textAnchor: "start",
          dx: 6,
          // Labels of series that end close together are moved apart (B8).
          render: (index, scales, values, dimensions, context, next) => {
            const group = next?.(index, scales, values, dimensions, context) ?? null;
            const texts = [...(group?.children ?? [])];
            const at = texts.map((t) =>
              /translate\(([^,]+),([^)]+)\)/.exec(t.getAttribute("transform") ?? ""),
            );
            const ys = spreadLabels(at.map((m) => Number(m?.[2])));
            for (const [i, t] of texts.entries()) {
              t.setAttribute("transform", `translate(${at[i]?.[1]},${ys[i]})`);
            }
            return group;
          },
        }),
      ),
    );
  }

  const width = options.width ?? DEFAULT_WIDTH;
  const marginLeft = prepared.yLabel === null ? 48 : 64;
  const marginRight = model.directLabels ? 96 : 24;
  const rendered = renderPlot(
    {
      width,
      height: options.height ?? DEFAULT_HEIGHT,
      marginTop: 20,
      marginLeft,
      marginRight,
      marginBottom: 44,
      x: xScale(prepared, model.yearTicks, width - marginLeft - marginRight),
      y: {
        type: model.log ? "log" : "linear",
        label: prepared.yLabel,
        labelAnchor: "center",
        labelArrow: "none",
        grid: true,
        nice: true,
        ...(model.log ? {} : { zero: options.zero ?? true }),
        ...(model.log ? {} : yAxis(model)),
      },
      color: { domain: seriesNames, range: [...model.plan.range] },
      marks,
    },
    model.alt,
    "img",
    drawAnnotations("lineChart", options.annotations),
  );

  return model.figure(rendered.svg, rendered.x);
}

/**
 * An area chart over time or any continuous x. Several series stack, so the top edge is their
 * total, or with `percent` each x stacks to 100%. A missing value is a gap: that series' band breaks there, has no point to hover, and
 * its table cell is blank (F5). Keyed points carry hover details as in {@link lineChart}.
 *
 * @example
 * areaChart({ data: monthly, x: "month", y: "hours", series: "activity", alt: "..." });
 */
export function areaChart<T extends object>(options: AreaChartOptions<T>): string {
  const model = areaModel(options);
  const { prepared } = model;
  const { points, seriesNames } = prepared;
  const order = { order: seriesNames };
  const width = options.width ?? DEFAULT_WIDTH;
  const marginLeft = prepared.yLabel === null ? 48 : 64;

  const rendered = renderPlot(
    {
      width,
      height: options.height ?? DEFAULT_HEIGHT,
      marginTop: 20,
      marginLeft,
      marginBottom: 44,
      // Plot's default right margin is 20.
      x: xScale(prepared, model.yearTicks, width - marginLeft - 20),
      y: {
        label: prepared.yLabel,
        labelAnchor: "center",
        labelArrow: "none",
        grid: true,
        nice: true,
        zero: true,
        ...yAxis(model),
      },
      color: { domain: seriesNames, range: [...model.plan.range] },
      marks: [
        Plot.areaY(
          points,
          Plot.stackY({
            ...order,
            x: "x",
            y: "value",
            z: "series",
            fill: "series",
            fillOpacity: AREA_OPACITY,
          }),
        ),
        // The top edge of each band as a line, so a light fill still reads as a shape.
        Plot.lineY(
          points,
          Plot.stackY2({
            ...order,
            x: "x",
            y: "value",
            z: "series",
            stroke: "series",
            strokeWidth: 2,
          }),
        ),
        Plot.dot(
          points,
          Plot.stackY({
            ...order,
            x: "x",
            y: "value",
            z: "series",
            fill: "series",
            r: 4,
            fillOpacity: 0,
            title: model.describe,
            // Gaps have no point: their hover text would otherwise claim a value.
            filter: (p: Point) => p.value !== null,
            render: keyed(points, model.datum),
          }),
        ),
        Plot.ruleY([0]),
        ...annotations(options, model.markers),
      ],
    },
    model.alt,
    "img",
    drawAnnotations("areaChart", options.annotations),
  );

  return model.figure(rendered.svg, rendered.x);
}
