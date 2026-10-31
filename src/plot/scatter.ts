import * as Plot from "@observablehq/plot";
import { ticks } from "../lite/scale.js";
import { domainOf, type KeysOfType, readLabel, readNumber } from "../render/data.js";
import { correlation, valueRange } from "../render/describe.js";
import {
  type AxisUnits,
  type FigureOptions,
  figure,
  type SeriesColor,
  unitLabel,
  validateFigure,
} from "../render/figure.js";
import {
  type Bounds,
  type IntervalFields,
  intervalText,
  readInterval,
} from "../render/interval.js";
import { keyed, renderPlot } from "../render/plot.js";
import { planSeries } from "../render/series.js";
import { DEFAULT_WIDTH } from "../render/size.js";
import { numberFormat, stringsFor, valueFormat } from "../render/text.js";
import { type Annotated, drawAnnotations, withNotes } from "./annotate.js";
import { capErrorBars, named, steps, svgElement } from "./marks.js";

/** Options for {@link scatterPlot}. */
export interface ScatterPlotOptions<T extends object> extends FigureOptions, AxisUnits, Annotated {
  readonly data: readonly T[];
  readonly x: KeysOfType<T, number>;
  readonly y: KeysOfType<T, number>;
  /** A field grouping points into colored series. */
  readonly series?: KeysOfType<T, string>;
  /** A field naming each point, shown in hover details and the data table. */
  readonly label?: KeysOfType<T, string | number>;
  readonly xType?: "linear" | "log";
  readonly yType?: "linear" | "log";
  /** Draw an ordinary least-squares line (per series), with its 95% confidence band. */
  readonly regression?: boolean;
  readonly seriesDomain?: readonly string[];
  readonly colors?: Readonly<Record<string, SeriesColor>>;
  readonly xLabel?: string | null;
  readonly yLabel?: string | null;
  readonly formatValue?: (value: number) => string;
  /**
   * A field sizing each point by area, making a bubble chart. Values are zero or more; a size
   * legend shows three reference sizes, and the data table gives every value.
   */
  readonly size?: KeysOfType<T, number>;
  /** What the size measures, for the size legend, hover details and the table (default: the field name). */
  readonly sizeLabel?: string;
  /** A vertical error bar on each point, from `lower` and `upper` fields around y. */
  readonly errorBars?: IntervalFields<T>;
}

interface ScatterPoint {
  readonly key: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly series: string;
  readonly size?: number;
  readonly bounds: Bounds | null;
}

/** The largest bubble's radius, in pixels. */
const MAX_RADIUS = 18;

const KIND = "scatterPlot";

/**
 * A scatter plot of two measurements, optionally grouped into series, on linear or log axes,
 * with an optional regression line. Series are told apart by color and by symbol shape, so the
 * chart never relies on hue alone.
 *
 * @example
 * scatterPlot({ data: isolates, x: "ct", y: "titer", yType: "log", label: "isolate", alt: "..." });
 */
export function scatterPlot<T extends object>(given: ScatterPlotOptions<T>): string {
  const options = withNotes(given);
  const { data, x, y, series, label, size, errorBars } = options;
  validateFigure(KIND, options);
  if (data.length === 0) throw new Error(`${KIND}: data is empty`);
  const format = valueFormat(options);
  const strings = stringsFor(options.strings);
  const { terms } = strings;
  const xLabel = unitLabel(options.xLabel, x, options.xUnit);
  const yLabel = unitLabel(options.yLabel, y, options.yUnit);
  const sole = terms.points;
  const seriesOf = (row: T, i: number): string =>
    series === undefined ? sole : readLabel(KIND, row, series, i);
  const seriesNames =
    series === undefined
      ? [sole]
      : domainOf(
          KIND,
          series,
          data.map((row, i) => seriesOf(row, i)),
          options.seriesDomain,
        );
  const plan = planSeries(KIND, seriesNames, options.colors);

  const points = data.map((row, i): ScatterPoint => {
    const xv = readNumber(KIND, row, x, i);
    const yv = readNumber(KIND, row, y, i);
    for (const [axis, type, v] of [
      ["x", options.xType, xv],
      ["y", options.yType, yv],
    ] as const) {
      if (type === "log" && v <= 0) {
        throw new Error(`${KIND}: row ${i + 1} ${axis} is ${v}, which a log axis cannot show`);
      }
    }
    const name = label === undefined ? `${terms.point} ${i + 1}` : readLabel(KIND, row, label, i);
    const sv = size === undefined ? undefined : readNumber(KIND, row, size, i);
    if (sv !== undefined && sv < 0)
      throw new Error(`${KIND}: row ${i + 1} size is ${sv}; sizes are zero or more`);
    const bounds = errorBars ? readInterval(KIND, row, errorBars, i, yv) : null;
    if (bounds && options.yType === "log" && bounds.lower <= 0) {
      throw new Error(
        `${KIND}: row ${i + 1} lower bound is ${bounds.lower}, which a log axis cannot show`,
      );
    }
    return {
      key: String(i),
      name,
      x: xv,
      y: yv,
      series: seriesOf(row, i),
      ...(sv === undefined ? {} : { size: sv }),
      bounds,
    };
  });
  const sizeLabel = size === undefined ? undefined : (options.sizeLabel ?? size);

  const multi = series !== undefined;
  // Keyboard order: left to right, and bottom to top among points at the same x.
  const order = points
    .map((p, i) => ({ p, i }))
    .sort((a, b) => a.p.x - b.p.x || a.p.y - b.p.y || a.i - b.i);
  const rank = new Map(order.map(({ p }, r) => [p, r]));
  const describe = (p: ScatterPoint): string =>
    `${label === undefined ? "" : `${p.name}: `}${multi ? `${p.series}, ` : ""}${xLabel ?? x} ${format(p.x)}, ${yLabel ?? y} ${format(p.y)}${p.bounds ? ` (${intervalText(p.bounds, format, errorBars?.label, strings)})` : ""}${p.size === undefined ? "" : `, ${sizeLabel} ${format(p.size)}`}`;

  const marks: Plot.Markish[] = [];
  const withBounds = points.filter((p) => p.bounds !== null);
  if (withBounds.length > 0) {
    marks.push(
      Plot.ruleX(withBounds, {
        x: "x",
        y1: (p: ScatterPoint) => p.bounds?.lower,
        y2: (p: ScatterPoint) => p.bounds?.upper,
        stroke: "var(--enarratio-text)",
        strokeWidth: 1.25,
        render: named("error bar"),
      }),
    );
  }
  if (options.regression) {
    marks.push(
      Plot.linearRegressionY(points, {
        x: "x",
        y: "y",
        stroke: "series",
        fill: "series",
        ...(multi ? { z: "series" } : {}),
      }),
    );
  }
  marks.push(
    Plot.dot(points, {
      x: "x",
      y: "y",
      stroke: "series",
      fill: "series",
      fillOpacity: 0.35,
      strokeWidth: 1.5,
      r: size === undefined ? 4 : "size",
      ...(multi ? { symbol: "series" } : {}),
      title: describe,
      render: keyed(points, (p) => ({
        key: p.key,
        ...(multi && series ? { filter: { field: series, value: p.series } } : {}),
        column: rank.get(p) ?? 0,
        row: 0,
        x: String(p.x),
        ...(multi ? { series: p.series } : {}),
      })),
    }),
  );

  const sizes = points.flatMap((p) => (p.size === undefined ? [] : [p.size]));
  const width = options.width ?? DEFAULT_WIDTH;
  const rendered = renderPlot(
    {
      width,
      height: options.height ?? 360,
      marginTop: 20,
      marginLeft: yLabel === null ? 48 : 64,
      marginBottom: 44,
      // Room for the size legend, and for the largest bubbles at the edges.
      // Points never sit on the axes, where the first one would cover a tick label (inset).
      ...(size === undefined
        ? { inset: 8 }
        : { marginRight: 112, inset: MAX_RADIUS, r: { range: [0, MAX_RADIUS] } }),
      x: {
        type: options.xType ?? "linear",
        // Log axes label powers of ten only; Plot's default adds every minor tick.
        ...(options.xType === "log" ? { ticks: 5 } : {}),
        label: xLabel,
        labelAnchor: "center",
        labelArrow: "none",
        grid: true,
        nice: true,
      },
      y: {
        type: options.yType ?? "linear",
        // Log axes label powers of ten only; Plot's default adds every minor tick.
        ...(options.yType === "log" ? { ticks: 5 } : {}),
        label: yLabel,
        labelAnchor: "center",
        labelArrow: "none",
        grid: true,
        nice: true,
      },
      color: { domain: seriesNames, range: [...plan.range] },
      ...(multi ? { symbol: { domain: seriesNames } } : {}),
      marks,
    },
    options.alt,
    "img",
    steps(
      withBounds.length > 0 ? capErrorBars : undefined,
      sizeLabel === undefined ? undefined : sizeLegend(sizeLabel, sizes, width, format),
      drawAnnotations(KIND, options.annotations),
    ),
  );

  const intervalName = errorBars?.label ?? terms.interval;
  // Judged on the axes as drawn: a log axis compares orders of magnitude.
  const onAxis = (type: "linear" | "log" | undefined) => (v: number) =>
    type === "log" ? Math.log10(v) : v;
  const r = correlation(
    points.map((p) => [onAxis(options.xType)(p.x), onAxis(options.yType)(p.y)]),
  );
  const strength =
    r === undefined
      ? undefined
      : Math.abs(r) >= 0.7
        ? "strong"
        : Math.abs(r) >= 0.4
          ? "moderate"
          : "weak";
  return figure(options, {
    kind: "scatter",
    description: {
      axes: [
        valueRange(
          "x",
          xLabel,
          points.map((p) => p.x),
          format,
        ),
        valueRange(
          "y",
          yLabel,
          points.flatMap((p) => [p.y, ...(p.bounds ? [p.bounds.lower, p.bounds.upper] : [])]),
          format,
        ),
        ...(sizeLabel === undefined ? [] : [valueRange("size", sizeLabel, sizes, format)]),
      ],
      series: seriesNames.map((name) => ({
        name,
        points: points
          .filter((p) => p.series === name)
          .map((p) => ({ at: p.name, value: p.y, ...(p.bounds ?? {}) })),
      })),
      format,
      ...(errorBars ? { interval: intervalName.toLowerCase() } : {}),
      log: options.yType === "log",
      ...(r !== undefined && strength
        ? {
            sentence: strings.correlation(
              strength,
              r > 0 ? "up" : "down",
              numberFormat({ locale: options.locale ?? "en-US", maximumFractionDigits: 2 })(
                Math.trunc(r * 100) / 100,
              ),
            ),
          }
        : {}),
    },
    svg: rendered.svg,
    ...(rendered.x ? { x: rendered.x } : {}),
    legend: multi ? plan.legend : [],
    ...(multi && series ? { seriesField: series } : {}),
    slotColors: plan.slotColors,
    table: {
      columns: [
        terms.point,
        ...(multi ? [terms.series] : []),
        xLabel ?? x,
        yLabel ?? y,
        ...(errorBars ? [intervalName] : []),
        ...(sizeLabel === undefined ? [] : [sizeLabel]),
      ],
      rows: points.map((p) => [
        p.name,
        ...(multi ? [p.series] : []),
        format(p.x),
        format(p.y),
        ...(errorBars
          ? [p.bounds ? strings.range(format(p.bounds.lower), format(p.bounds.upper)) : ""]
          : []),
        ...(p.size === undefined ? [] : [format(p.size)]),
      ]),
    },
  });
}

/**
 * A legend of three reference bubbles, drawn in the right margin from the chart's own size scale,
 * so the circles a reader compares against are exactly the sizes the points are drawn at.
 */
function sizeLegend(
  title: string,
  sizes: readonly number[],
  width: number,
  format: (value: number) => string,
): (svg: SVGSVGElement) => void {
  return (svg) => {
    const scale = (svg as unknown as Plot.Plot).scale("r");
    if (!scale) return;
    const top = Math.max(...sizes);
    const values = ticks(0, top, 3)
      .filter((v) => v > 0)
      .slice(-3);
    if (values.length === 0) return;
    const doc = svg.ownerDocument;
    const legend = svgElement(doc, "g", {
      "data-enarratio-mark": "size legend",
      "aria-hidden": "true",
    });
    const cx = width - 112 + 8 + MAX_RADIUS;
    const heading = svgElement(doc, "text", { x: width - 104, y: 28, "text-anchor": "start" });
    heading.textContent = title;
    legend.append(heading);
    let cursor = 44;
    for (const v of values) {
      const r = scale.apply(v) as number;
      legend.append(
        svgElement(doc, "circle", {
          cx,
          cy: cursor + r,
          r,
          fill: "none",
          stroke: "var(--enarratio-text-muted)",
        }),
      );
      const text = svgElement(doc, "text", {
        x: cx + MAX_RADIUS + 6,
        y: cursor + r,
        dy: "0.32em",
        "text-anchor": "start",
      });
      text.textContent = format(v);
      legend.append(text);
      cursor += 2 * r + 8;
    }
    svg.append(legend);
  };
}
