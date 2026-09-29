import * as Plot from "@observablehq/plot";
import { defaultFormat, domainOf, type KeysOfType, readLabel, readNumber } from "../render/data.js";
import { type FigureOptions, figure, type SeriesColor, validateFigure } from "../render/figure.js";
import { keyed, renderPlot } from "../render/plot.js";
import { planSeries } from "../render/series.js";

/** Options for {@link scatterPlot}. */
export interface ScatterPlotOptions<T extends object> extends FigureOptions {
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
}

interface ScatterPoint {
  readonly key: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly series: string;
}

const KIND = "scatterPlot";

/**
 * A scatter plot of two measurements, optionally grouped into series, on linear or log axes,
 * with an optional regression line. Series are told apart by color and by symbol shape, so the
 * chart never relies on hue alone.
 *
 * @example
 * scatterPlot({ data: isolates, x: "ct", y: "titer", yType: "log", label: "isolate", alt: "..." });
 */
export function scatterPlot<T extends object>(options: ScatterPlotOptions<T>): string {
  const { data, x, y, series, label } = options;
  validateFigure(KIND, options);
  if (data.length === 0) throw new Error(`${KIND}: data is empty`);
  const format = options.formatValue ?? defaultFormat;
  const xLabel = options.xLabel === undefined ? x : options.xLabel;
  const yLabel = options.yLabel === undefined ? y : options.yLabel;
  const sole = "Points";
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
    const name = label === undefined ? `Point ${i + 1}` : readLabel(KIND, row, label, i);
    return { key: String(i), name, x: xv, y: yv, series: seriesOf(row, i) };
  });

  const multi = series !== undefined;
  // Keyboard order: left to right, and bottom to top among points at the same x.
  const order = points
    .map((p, i) => ({ p, i }))
    .sort((a, b) => a.p.x - b.p.x || a.p.y - b.p.y || a.i - b.i);
  const rank = new Map(order.map(({ p }, r) => [p, r]));
  const describe = (p: ScatterPoint): string =>
    `${label === undefined ? "" : `${p.name}: `}${multi ? `${p.series}, ` : ""}${xLabel ?? x} ${format(p.x)}, ${yLabel ?? y} ${format(p.y)}`;

  const marks: Plot.Markish[] = [];
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
      r: 4,
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

  const rendered = renderPlot(
    {
      width: options.width ?? 640,
      height: options.height ?? 360,
      marginTop: 20,
      marginLeft: yLabel === null ? 48 : 64,
      marginBottom: 44,
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
  );

  return figure(options, {
    kind: "scatter",
    svg: rendered.svg,
    ...(rendered.x ? { x: rendered.x } : {}),
    legend: multi ? plan.legend : [],
    ...(multi && series ? { seriesField: series } : {}),
    slotColors: plan.slotColors,
    table: {
      columns: ["Point", ...(multi ? ["Series"] : []), xLabel ?? x, yLabel ?? y],
      rows: points.map((p) => [p.name, ...(multi ? [p.series] : []), format(p.x), format(p.y)]),
    },
  });
}
