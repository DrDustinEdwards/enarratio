import * as Plot from "@observablehq/plot";
import {
  AREA_OPACITY,
  type AreaChartOptions,
  areaModel,
  dayTicks,
  fitTicks,
  type LineChartOptions,
  lineModel,
  type MarkerPoint,
  type Point,
  rightMargin,
  type SeriesChartOptions,
  type SeriesModel,
  streamModel,
} from "../render/line-model.js";
import { slotStyle } from "../render/figure.js";
import { charWidth, textGrowth } from "../render/size.js";
import { streamLayout } from "../render/stream.js";
import { timeTicks } from "../lite/scale.js";
import { texture } from "../render/texture.js";
import type { KeysOfType } from "../render/data.js";
import { spreadLabels } from "../render/direct-labels.js";
import { keyed, renderPlot } from "../render/plot.js";
import { DEFAULT_HEIGHT, DEFAULT_WIDTH } from "../render/size.js";
import { named } from "./marks.js";
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

/** The x scale shared by line and area charts, its ticks thinned to fit the width. */
function xScale(model: SeriesModel, width: number, plotWidth: number) {
  const { prepared, yearTicks, maxXTicks } = model;
  const base = {
    type: prepared.time ? "utc" : "linear",
    label: prepared.xTitle,
  } as const;
  if (yearTicks) {
    return {
      ...base,
      ticks: fitTicks(yearTicks, String, width, plotWidth, maxXTicks),
      tickFormat: (d: number) => String(d),
    };
  }
  const days = dayTicks(prepared, plotWidth);
  // As Dates, so Plot labels them as it labels its own time ticks ("Jun 7", about 6 characters).
  if (days) {
    const fitted = fitTicks(days, () => "Jun 07", width, plotWidth, maxXTicks);
    return { ...base, ticks: fitted.map((t) => new Date(t)) };
  }
  // Plot's own ticks come about one per 80 pixels; a limit lowers the count.
  return maxXTicks === undefined ? base : { ...base, ticks: Math.min(maxXTicks, plotWidth / 80) };
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
            const ys = spreadLabels(
              at.map((m) => Number(m?.[2])),
              dimensions.width,
            );
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
  const marginLeft = 48;
  const marginRight = rightMargin(model, width);
  const rendered = renderPlot(
    {
      width,
      height: options.height ?? DEFAULT_HEIGHT,
      marginTop: 20,
      marginLeft,
      marginRight,
      marginBottom: 44,
      x: xScale(model, width, width - marginLeft - marginRight),
      y: {
        type: model.log ? "log" : "linear",
        label: prepared.yLabel,
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
  const marginLeft = 48;
  const marginRight = rightMargin(model, width);

  const rendered = renderPlot(
    {
      width,
      height: options.height ?? DEFAULT_HEIGHT,
      marginTop: 20,
      marginLeft,
      marginRight,
      marginBottom: 44,
      x: xScale(model, width, width - marginLeft - marginRight),
      y: {
        label: prepared.yLabel,
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
        // Each point on its band's top edge, where its line is (record 0036).
        Plot.dot(
          points,
          Plot.stackY2({
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

/** Options for {@link streamgraph}: a series chart's, with the series field required. */
export interface StreamgraphOptions<T extends object> extends Omit<
  SeriesChartOptions<T>,
  "series" | "references" | "directLabels" | "yUnit"
> {
  /** The field naming each layer. */
  readonly series: KeysOfType<T, string>;
}

/**
 * A streamgraph: several series over time as layers flowing around a moving center line, ordered
 * from the inside out and stacked on Byron and Wattenberg's "wiggle" baseline, which keeps the
 * layers' slopes small (d3's stackOffsetWiggle with stackOrderInsideOut). It shows how a whole and
 * its parts rise and fall, not exact values, so there is no value axis: each layer is named on the
 * drawing where it is thickest, any it cannot name take their textures, and the data table and
 * hover details give the values. A stacked area chart compares totals more precisely.
 *
 * @example
 * streamgraph({ data: weekly, x: "week", y: "cases", series: "virus", alt: "..." });
 */
export function streamgraph<T extends object>(options: StreamgraphOptions<T>): string {
  let every = true;
  const model = streamModel(options, (svg, plan) =>
    every
      ? { svg, labeled: true }
      : { svg: texture(svg, slotStyle(plan.slotColors)), labeled: false },
  );
  const { prepared, plan } = model;
  const { points, seriesNames, time } = prepared;
  const ats = [...new Set(points.map((p) => p.at))].sort((a, b) => a - b);
  const column = new Map(ats.map((a, j) => [a, j]));
  const values = seriesNames.map((name) => {
    const row = ats.map(() => 0);
    for (const p of points) if (p.series === name) row[column.get(p.at) as number] = p.value ?? 0;
    return row;
  });
  const layout = streamLayout(values);
  const edge = (p: Point, which: "lower" | "upper"): number =>
    layout[which][seriesNames.indexOf(p.series)]?.[column.get(p.at) as number] ?? 0;
  const bands = points.map((p) => ({
    ...p,
    y1: edge(p, "lower"),
    y2: edge(p, "upper"),
  }));
  type Band = (typeof bands)[number];
  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? DEFAULT_HEIGHT;
  const growth = textGrowth(width);
  const char = charWidth(width);
  const margin = Math.ceil(3 * char);
  const top = 12;
  const bottom = 44;
  const lo = Math.min(...layout.lower.flat());
  const hi = Math.max(...layout.upper.flat());
  // Each layer named where it is thickest, if its name fits inside it there; a layer that cannot
  // be named takes its texture (record 0036).
  const plotWidth = width - 2 * margin;
  const plotHeight = height - top - bottom;
  const px = (j: number): number =>
    margin + (ats.length > 1 ? (j / (ats.length - 1)) * plotWidth : plotWidth / 2);
  const py = (v: number): number => top + ((hi - v) / (hi - lo || 1)) * plotHeight;
  const line = 14 * growth;
  const labels: { x: number | Date; y: number; name: string; slot: number }[] = [];
  seriesNames.forEach((name, s) => {
    const lower = layout.lower[s] as readonly number[];
    const upper = layout.upper[s] as readonly number[];
    const thick = (j: number): number => py(lower[j] as number) - py(upper[j] as number);
    const half = (name.length * char) / 2 + 4;
    let best = -1;
    let room = 0;
    ats.forEach((_, j) => {
      const x = Math.min(Math.max(px(j), margin + half), width - margin - half);
      // The thinnest the layer gets under the name's whole width.
      let least = Number.POSITIVE_INFINITY;
      ats.forEach((__, k) => {
        if (Math.abs(px(k) - x) <= half) least = Math.min(least, thick(k));
      });
      if (least > room) {
        room = least;
        best = j;
      }
    });
    if (best < 0 || room < line) {
      every = false;
      return;
    }
    const x = Math.min(Math.max(px(best), margin + half), width - margin - half);
    const at = ats[0] as number;
    const span = (ats.at(-1) as number) - at;
    const xValue = ats.length > 1 ? at + ((x - margin) / plotWidth) * span : at;
    labels.push({
      x: time ? new Date(xValue) : xValue,
      y: ((lower[best] as number) + (upper[best] as number)) / 2,
      name,
      slot: plan.slot(name),
    });
  });
  const order = layout.order.map((i) => seriesNames[i] as string);
  const rendered = renderPlot(
    {
      width,
      height,
      marginTop: top,
      marginLeft: margin,
      marginRight: margin,
      marginBottom: bottom,
      x: {
        ...xScale(model, width, plotWidth),
        // Ticks asked for by width, then thinned to fit: on a phone Plot's own count (one per 80
        // units) picks quarters and can leave a single tick for half a year.
        ...(time && !model.yearTicks
          ? {
              ticks: fitTicks(
                timeTicks(ats[0] as number, ats.at(-1) as number, Math.max(5, plotWidth / 60)),
                () => "Jun",
                width,
                plotWidth,
              ).map((t) => new Date(t)),
            }
          : {}),
        domain: time
          ? [new Date(ats[0] as number), new Date(ats.at(-1) as number)]
          : [ats[0], ats.at(-1)],
      },
      y: { axis: null, domain: [lo, hi] },
      color: { domain: seriesNames, range: [...plan.range] },
      marks: [
        // Stacked bottom first, each a solid layer with a thin edge in the background color.
        ...order.map((name) =>
          Plot.areaY(
            bands.filter((b) => b.series === name),
            {
              x: "x",
              y1: "y1",
              y2: "y2",
              fill: "series",
              stroke: "var(--enarratio-background)",
              strokeWidth: 1,
              curve: "monotone-x",
              render: named("area"),
            },
          ),
        ),
        Plot.dot(bands, {
          x: "x",
          y: (b: Band) => (b.y1 + b.y2) / 2,
          r: 4,
          fill: "series",
          fillOpacity: 0,
          title: model.describe,
          filter: (b: Band) => b.value !== null,
          render: keyed(bands, model.datum),
        }),
        Plot.text(labels, {
          x: "x",
          y: "y",
          text: "name",
          textAnchor: "middle",
          fill: (l: (typeof labels)[number]) => `var(--enarratio-series-text-${l.slot})`,
          // A halo in the layer's own color, so a texture never runs through the name.
          stroke: (l: (typeof labels)[number]) => `var(--enarratio-series-${l.slot})`,
          strokeWidth: 3,
          paintOrder: "stroke",
          render: named("area label"),
        }),
        ...annotations({}, model.markers),
      ],
    },
    model.alt,
    "img",
    drawAnnotations("streamgraph", options.annotations),
  );
  return model.figure(rendered.svg, rendered.x);
}
