import * as Plot from "@observablehq/plot";
import { finishBars } from "../render/bar-marks.js";
import { BAR_MAX, type BarChartOptions, type BarPoint, barModel } from "../render/bar-model.js";
import { domainOf, type KeysOfType, markKey, readCategory, readLabel } from "../render/data.js";
import { type ChartDescription, categoryRange, valueRange } from "../render/describe.js";
import {
  type AxisUnits,
  type FigureOptions,
  figure,
  slotStyle,
  validateFigure,
} from "../render/figure.js";
import { type LineChartOptions, lineModel, type Point } from "../render/line-model.js";
import { keyed, renderPlot } from "../render/plot.js";
import { planSeries, seriesLegend } from "../render/series.js";
import { charWidth, DEFAULT_WIDTH, fitTicks, textGrowth, topMargin } from "../render/size.js";
import { texture } from "../render/texture.js";

/** What every small multiple shares: the facet field and the grid. */
interface FacetOptions<T extends object> extends FigureOptions, AxisUnits {
  readonly data: readonly T[];
  /** The field splitting the data into panels, one chart each. */
  readonly facet: KeysOfType<T, string | number>;
  /** Panels in display order, left to right, then down. Without it, first-seen order. */
  readonly facetDomain?: readonly (string | number)[];
  /** Panels per row (default 3, or fewer when there are fewer panels). */
  readonly columns?: number;
  /** Each panel's height in pixels (default 160). */
  readonly panelHeight?: number;
}

type BarFields<T extends object> = Pick<
  BarChartOptions<T>,
  "x" | "y" | "series" | "xDomain" | "seriesDomain" | "colors" | "xLabel" | "yLabel" | "formatValue"
>;
type LineFields<T extends object> = Pick<
  LineChartOptions<T>,
  | "x"
  | "y"
  | "series"
  | "xType"
  | "seriesDomain"
  | "colors"
  | "xLabel"
  | "yLabel"
  | "formatValue"
  | "formatX"
>;

/**
 * Options for {@link smallMultiples}: the facet field and grid, and the fields of the chart drawn
 * in each panel, a bar chart (stacked when there are series) or a line chart.
 */
export type SmallMultiplesOptions<T extends object> = FacetOptions<T> &
  ((BarFields<T> & { readonly chart: "bar" }) | (LineFields<T> & { readonly chart: "line" }));

const KIND = "smallMultiples";

interface Panel {
  readonly name: string;
  readonly index: number;
  readonly fx: number;
  readonly fy: number;
}

/** Each panel's own model, and the first one's, whose series and formats every panel shares. */
function panelModels<M>(panels: readonly Panel[], sub: (p: Panel) => M) {
  const models = panels.map((p) => ({ p, m: sub(p) }));
  const first = models[0]?.m;
  if (!first) throw new Error(`${KIND}: data is empty`);
  return { models, first };
}

/**
 * Small multiples: one bar or line chart per group, in a grid, on shared scales, so panels
 * compare by position alone. Each panel is named above it; series keep one color and legend
 * across panels; every value is keyed with its panel; and the data table has a row per panel and
 * x.
 *
 * @example
 * smallMultiples({ chart: "line", data: weekly, facet: "region", x: "week", y: "cases", alt: "..." });
 */
export function smallMultiples<T extends object>(options: SmallMultiplesOptions<T>): string {
  const { data, facet } = options;
  validateFigure(KIND, options, data);
  const raw = data.map((row, i) => readLabel(KIND, row, facet, i));
  const names = domainOf(KIND, facet, raw, options.facetDomain?.map(String));
  if (names.length > 24) throw new Error(`${KIND}: ${names.length} panels are too many to compare`);
  const asked = Math.min(options.columns ?? 3, names.length);
  if (!(Number.isInteger(asked) && asked >= 1)) {
    throw new Error(`${KIND}: columns must be a whole number of 1 or more`);
  }
  const width = options.width ?? DEFAULT_WIDTH;
  const char = charWidth(width);
  // A panel's column, with the gap after it, at the margins both kinds of panel use.
  const step = (n: number): number => (width - 44 - 20) / (n + 0.12);
  // `columns` is the most panels to a row: fewer where a panel's name would not fit over it or a
  // panel would be under 60 units across (a phone's drawing, record 0041).
  const longestName = Math.max(...names.map((n) => n.length));
  let columns = asked;
  while (columns > 1 && (step(columns) < longestName * char + 6 || step(columns) * 0.88 < 60)) {
    columns -= 1;
  }
  const panels: Panel[] = names.map((name, index) => ({
    name,
    index,
    fx: index % columns,
    fy: Math.floor(index / columns),
  }));
  const rowsOf = (p: Panel): T[] => data.filter((_, i) => raw[i] === p.name);
  const series = options.series;
  const seriesNames =
    series === undefined
      ? undefined
      : domainOf(
          KIND,
          series,
          data.map((row, i) => readLabel(KIND, row, series, i)),
          options.seriesDomain,
        );
  const rows = Math.ceil(names.length / columns);
  // Panels 160 high, or shorter where they are narrow, so a column of them is not a tower.
  const panelHeight =
    options.panelHeight ?? Math.round(Math.min(160, Math.max(100, step(columns) * 1.3)));
  // The y axis title over the first row's panel names, each on its own line (record 0041).
  const marginTop = Math.max(
    28,
    (options.yLabel === null ? 0 : topMargin(0, true, width)) + Math.ceil(16 * textGrowth(width)),
  );
  const height = options.height ?? rows * panelHeight + 36 + marginTop;
  const facetScales = {
    fx: { domain: [...Array(columns).keys()], axis: null, padding: 0.12 },
    fy: { domain: [...Array(rows).keys()], axis: null, padding: 0.22 },
  };
  const titles = Plot.text(panels, {
    fx: "fx",
    fy: "fy",
    text: "name",
    frameAnchor: "top-left",
    lineAnchor: "bottom",
    textAnchor: "start",
    dy: -6,
    fontWeight: 600,
  });
  const { alt } = options;
  // Each panel reads alone, so the limit on series applies to a panel, not to the grid.
  const limits = { series: 6 * names.length };
  // Every panel's series is a series of the figure, named by its panel.
  const seriesName = (panel: string, name: string): string =>
    series === undefined ? panel : `${panel}, ${name}`;

  if (options.chart === "bar") {
    const { x, y } = options;
    const xNames = domainOf(
      KIND,
      x,
      data.map((row, i) => readCategory(KIND, row, x, i)),
      options.xDomain,
    );
    const sub = (p: Panel) =>
      barModel({
        ...(options as BarChartOptions<T>),
        data: rowsOf(p),
        xDomain: xNames,
        ...(seriesNames ? { seriesDomain: seriesNames } : {}),
      });
    const { models, first } = panelModels(panels, sub);
    const allSeries = first.seriesNames;
    const plan = planSeries(KIND, [...allSeries], options.colors);
    const points = models.flatMap(({ p, m }) => m.points.map((pt) => ({ ...pt, p })));
    type Bar = BarPoint & { readonly p: Panel };
    const describe = (b: Bar): string => `${b.p.name}, ${first.describe(b)}`;
    // No bar wider than BAR_MAX (record 0036): each panel's band, at Plot's default right margin.
    const panel =
      ((width - 44 - 20) * (1 - facetScales.fx.padding)) / (columns + facetScales.fx.padding);
    const barPadding = Math.max(
      0.2,
      Math.min(0.9, (panel - BAR_MAX * xNames.length) / (panel + BAR_MAX)),
    );
    const totals = new Map<string, number>();
    for (const b of points) {
      const id = markKey(b.p.name, b.x);
      totals.set(id, (totals.get(id) ?? 0) + Math.max(0, b.value));
    }
    const tallest = Math.max(0, ...totals.values());
    const { svg: drawn } = renderPlot(
      {
        width,
        height,
        marginTop,
        marginLeft: 44,
        marginBottom: 44,
        ...facetScales,
        x: {
          type: "band",
          domain: xNames,
          label: first.categoryTitle,
          padding: barPadding,
          // Names that would run into each other under a narrow panel are thinned (record 0041).
          ticks: fitTicks(xNames, (n) => first.tickLabel(n), width, panel),
          tickFormat: first.tickLabel,
        },
        y: {
          label: first.valueLabel,
          grid: true,
          nice: true,
          zero: true,
          // Headroom for the values at the tips, under the panel names (record 0036).
          domain: [0, tallest * 1.15],
        },
        color: { domain: [...allSeries], range: [...plan.range] },
        marks: [
          Plot.barY(
            points,
            Plot.stackY({
              order: [...allSeries],
              x: "x",
              y: "value",
              fill: "series",
              fx: (b: Bar) => b.p.fx,
              fy: (b: Bar) => b.p.fy,
              title: describe,
              render: keyed(points, (b: Bar) => {
                const d = first.datum(b);
                return {
                  ...d,
                  key: markKey(b.p.name, b.x, b.series),
                  ...(series ? {} : { filter: { field: facet, value: b.p.name } }),
                  column: b.p.index * xNames.length + (d.column ?? 0),
                };
              }),
            }),
          ),
          Plot.ruleY([0]),
          titles,
        ],
      },
      alt,
    );
    // Rounded tops and values at the tips, bar by bar in each panel (record 0036).
    const { svg } = finishBars(drawn, first, {
      points,
      keyOf: (b) => markKey((b as Bar).p.name, b.x, b.series),
      stackOf: (b) => markKey((b as Bar).p.name, b.x),
      names: false,
    });
    const cell = new Map(points.map((b) => [markKey(b.p.name, b.x, b.series), b]));
    const stacks = new Map<string, number>();
    for (const b of points) {
      const id = markKey(b.p.name, b.x);
      stacks.set(id, (stacks.get(id) ?? 0) + b.value);
    }
    const description: ChartDescription = {
      kind: "small-multiples",
      axes: [
        categoryRange("x", first.categoryLabel, xNames),
        valueRange("y", first.valueLabel, [0, ...stacks.values()], first.format),
      ],
      ordered: xNames.every((n) => n !== "" && Number.isFinite(Number(n))),
      format: first.format,
      series: panels.flatMap((p) =>
        allSeries.map((name) => ({
          name: seriesName(p.name, name),
          points: xNames.map((at) => ({
            at,
            value: cell.get(markKey(p.name, at, name))?.value ?? (y === undefined ? 0 : null),
          })),
        })),
      ),
    };
    // Panels have no room to name their series, so several series keep the textures (record 0036).
    const several = series !== undefined && allSeries.length > 1;
    return figure(options, {
      kind: "bar",
      svg: several ? texture(svg, slotStyle(plan.slotColors)) : svg,
      ...(several ? { textured: true } : {}),
      description,
      limits,
      ...seriesLegend(plan, series !== undefined, series),
      table: {
        columns: [
          String(facet),
          first.categoryLabel ?? x,
          ...(series === undefined ? [first.valueLabel ?? "Value"] : allSeries),
        ],
        rows: panels.flatMap((p) =>
          xNames.map((xn) => [
            p.name,
            xn,
            ...allSeries.map((s) => {
              const b = cell.get(markKey(p.name, xn, s));
              return b ? first.format(b.value) : y === undefined ? first.format(0) : "";
            }),
          ]),
        ),
      },
    });
  }

  const sub = (p: Panel) =>
    lineModel({
      ...(options as LineChartOptions<T>),
      data: rowsOf(p),
      ...(seriesNames ? { seriesDomain: seriesNames } : {}),
    });
  const { models, first } = panelModels(panels, sub);
  const prepared = first.prepared;
  const allSeries = prepared.seriesNames;
  const plan = planSeries(KIND, allSeries, options.colors);
  type Value = Point & { readonly p: Panel };
  const points: Value[] = models.flatMap(({ p, m }) =>
    m.prepared.points.map((pt) => ({ ...pt, p })),
  );
  const xs = [...new Set(points.map((v) => v.at))].sort((a, b) => a - b);
  const xRank = new Map(xs.map((at, i) => [at, i]));
  const present = points.filter((v) => v.value !== null);
  const fx = (v: Value): number => v.p.fx;
  const fy = (v: Value): number => v.p.fy;
  const { svg } = renderPlot(
    {
      width,
      height,
      marginTop,
      marginLeft: 44,
      marginRight: 20,
      marginBottom: 44,
      ...facetScales,
      x: {
        type: prepared.time ? "utc" : "linear",
        label: prepared.xTitle,
        ticks: 4,
        ...(prepared.years ? { tickFormat: (d: number) => String(d) } : {}),
      },
      y: {
        label: prepared.yLabel,
        grid: true,
        nice: true,
        zero: true,
      },
      color: { domain: allSeries, range: [...plan.range] },
      marks: [
        Plot.line(points, {
          x: "x",
          y: "value",
          z: "series",
          stroke: "series",
          strokeWidth: 2,
          fx,
          fy,
        }),
        Plot.dot(present, {
          x: "x",
          y: "value",
          fill: "series",
          r: 2.5,
          fx,
          fy,
          title: (v: Value) => `${v.p.name}, ${first.describe(v)}`,
          render: keyed(present, (v: Value) => ({
            ...first.datum(v),
            key: markKey(v.p.name, v.at, v.series),
            ...(series ? {} : { filter: { field: facet, value: v.p.name } }),
            column: v.p.index * xs.length + (xRank.get(v.at) ?? 0),
          })),
        }),
        titles,
      ],
    },
    alt,
  );
  const cell = new Map(points.map((v) => [markKey(v.p.name, v.at, v.series), v]));
  const xText = new Map(points.map((v) => [v.at, v.xText]));
  const description: ChartDescription = {
    kind: "small-multiples",
    axes: [
      categoryRange(
        "x",
        prepared.xLabel,
        xs.map((at) => xText.get(at) ?? ""),
      ),
      valueRange(
        "y",
        prepared.yLabel,
        [0, ...present.map((v) => v.value as number)],
        prepared.format,
      ),
    ],
    ordered: true,
    format: prepared.format,
    series: panels.flatMap((p) =>
      allSeries.map((name) => ({
        name: seriesName(p.name, name),
        points: points
          .filter((v) => v.p === p && v.series === name)
          .map((v) => ({ at: v.xText, value: v.value })),
      })),
    ),
  };
  return figure(options, {
    kind: "line",
    svg,
    description,
    limits,
    ...seriesLegend(plan, series !== undefined, series),
    table: {
      columns: [String(facet), prepared.xLabel ?? options.x, ...allSeries],
      rows: panels.flatMap((p) =>
        xs
          .filter((at) => allSeries.some((s) => cell.has(markKey(p.name, at, s))))
          .map((at) => [
            p.name,
            xText.get(at) ?? "",
            ...allSeries.map((s) => {
              const v = cell.get(markKey(p.name, at, s))?.value;
              return v === null || v === undefined ? "" : prepared.format(v);
            }),
          ]),
      ),
    },
  });
}
