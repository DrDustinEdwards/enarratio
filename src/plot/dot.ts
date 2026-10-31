import * as Plot from "@observablehq/plot";
import {
  domainOf,
  type KeysOfType,
  markKey,
  maxOf,
  readLabel,
  readNumber,
} from "../render/data.js";
import { categoryRange, valueRange } from "../render/describe.js";
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
import { type AxisRange, type Strings, signed, stringsFor, valueFormat } from "../render/text.js";
import { type Annotated, drawAnnotations, withNotes } from "./annotate.js";
import { capErrorBars, named, steps } from "./marks.js";

/** Options every item plot shares: one row per item, values along a horizontal axis. */
interface ItemOptions<T extends object> extends FigureOptions, AxisUnits, Annotated {
  readonly data: readonly T[];
  /** The field naming each item, one row each. */
  readonly y: KeysOfType<T, string | number>;
  /** Items in display order, top to bottom. Without it, data order. */
  readonly yDomain?: readonly (string | number)[];
  readonly colors?: Readonly<Record<string, SeriesColor>>;
  /** The value axis label; `null` hides it. */
  readonly xLabel?: string | null;
  /** The item axis label (default none). */
  readonly yLabel?: string | null;
  readonly formatValue?: (value: number) => string;
  /** Start the value axis at zero (default false: values need not be lengths). */
  readonly zero?: boolean;
}

/** Options for {@link dotPlot}. */
export interface DotPlotOptions<T extends object> extends ItemOptions<T> {
  /** The value for each dot. */
  readonly x: KeysOfType<T, number>;
  /** A field giving several dots per item, told apart by color and symbol. */
  readonly series?: KeysOfType<T, string>;
  readonly seriesDomain?: readonly string[];
  /** A horizontal error bar on each dot, from `lower` and `upper` fields. */
  readonly errorBars?: IntervalFields<T>;
  /** Items in data order (default), or sorted by their largest value, largest first. */
  readonly sort?: "data" | "descending";
}

/** Options for {@link rangePlot}. */
export interface RangePlotOptions<T extends object> extends ItemOptions<T> {
  readonly low: KeysOfType<T, number>;
  readonly high: KeysOfType<T, number>;
  /** A value to mark inside each range, such as a median or a current reading. */
  readonly value?: KeysOfType<T, number>;
  /** What the marked value is (default its field name). */
  readonly valueLabel?: string;
}

/** Options for {@link dumbbellPlot}. */
export interface DumbbellPlotOptions<T extends object> extends ItemOptions<T> {
  /** The earlier or reference value. */
  readonly from: KeysOfType<T, number>;
  /** The later or compared value. */
  readonly to: KeysOfType<T, number>;
  /** The legend names of the two ends (default the field names). */
  readonly fromLabel?: string;
  readonly toLabel?: string;
  /** Items in data order (default), or sorted by change, largest increase first. */
  readonly sort?: "data" | "change";
}

interface Read {
  readonly strings: Strings;
  readonly names: readonly string[];
  readonly format: (v: number) => string;
  readonly xLabel: string | null;
  readonly itemLabel: string;
}

function readItems<T extends object>(
  kind: string,
  options: ItemOptions<T>,
  valueField: string,
): Read & { readonly raw: readonly string[] } {
  validateFigure(kind, options);
  if (options.data.length === 0) throw new Error(`${kind}: data is empty`);
  const raw = options.data.map((row, i) => readLabel(kind, row, options.y, i));
  return {
    raw,
    strings: stringsFor(options.strings),
    names: domainOf(kind, options.y, raw, options.yDomain?.map(String)),
    format: valueFormat(options),
    xLabel: unitLabel(options.xLabel, valueField, options.xUnit),
    itemLabel: options.yLabel ?? options.y,
  };
}

/** The value axis along x, over `values`, and the items down y, as the overview states them. */
function itemAxes(r: Read, values: readonly number[]): AxisRange[] {
  return [valueRange("x", r.xLabel, values, r.format), categoryRange("y", r.itemLabel, r.names)];
}

/** One item per row, unless the plot has series. */
function onePerItem(kind: string, raw: readonly string[]): void {
  const seen = new Set<string>();
  for (const name of raw) {
    if (seen.has(name)) throw new Error(`${kind}: two rows for "${name}"; give one row per item`);
    seen.add(name);
  }
}

function render<T extends object>(
  kind: string,
  options: ItemOptions<T>,
  r: Read,
  marks: Plot.Markish[],
  scales: Plot.PlotOptions,
  after?: (svg: SVGSVGElement) => void,
): string {
  const longest = Math.max(1, maxOf(r.names.map((n) => n.length)));
  return renderPlot(
    {
      width: options.width ?? DEFAULT_WIDTH,
      height: options.height ?? Math.max(120, r.names.length * 28 + 64),
      marginTop: 20,
      marginLeft: Math.min(240, longest * 7 + 24) + (options.yLabel ? 20 : 0),
      marginRight: 24,
      marginBottom: 44,
      x: {
        label: r.xLabel,
        labelAnchor: "center",
        labelArrow: "none",
        grid: true,
        nice: true,
        zero: options.zero ?? false,
        inset: 8,
      },
      y: { type: "band", domain: [...r.names], label: options.yLabel ?? null, padding: 0.3 },
      ...scales,
      marks: [
        Plot.ruleY(r.names, {
          y: (d: string) => d,
          stroke: "var(--enarratio-grid)",
          render: named("row"),
        }),
        ...marks,
      ],
    },
    options.alt,
    "img",
    steps(after, drawAnnotations(kind, options.annotations, false)),
  ).svg;
}

interface Dot {
  readonly item: string;
  readonly series: string;
  readonly value: number;
  readonly bounds: Bounds | null;
}

/**
 * A dot plot (Cleveland's): one row per item, a dot at each value, for comparing values that
 * need not start at zero. With `series`, each item has a dot per series, told apart by color and
 * symbol; with `errorBars`, each dot has its interval. Every dot is keyed and named.
 *
 * @example
 * dotPlot({ data: counties, y: "county", x: "rate", series: "year", alt: "..." });
 */
export function dotPlot<T extends object>(given: DotPlotOptions<T>): string {
  const options = withNotes(given);
  const kind = "dotPlot";
  const { data, x, series, errorBars } = options;
  const r = readItems(kind, options, x);
  if (series === undefined) onePerItem(kind, r.raw);
  const sole = r.xLabel ?? x;
  const seriesNames =
    series === undefined
      ? [sole]
      : domainOf(
          kind,
          series,
          data.map((row, i) => readLabel(kind, row, series, i)),
          options.seriesDomain,
        );
  const plan = planSeries(kind, seriesNames, options.colors);
  const dots = data.map((row, i): Dot => {
    const value = readNumber(kind, row, x, i);
    return {
      item: r.raw[i] as string,
      series: series === undefined ? sole : readLabel(kind, row, series, i),
      value,
      bounds: errorBars ? readInterval(kind, row, errorBars, i, value) : null,
    };
  });
  let names = r.names;
  if (options.sort === "descending") {
    const top = (n: string): number => maxOf(dots.filter((d) => d.item === n).map((d) => d.value));
    names = [...names].sort((a, b) => top(b) - top(a));
  }
  const multi = series !== undefined;
  const describe = (d: Dot): string =>
    `${d.item}${multi ? `, ${d.series}` : ""}: ${r.format(d.value)}${d.bounds ? ` (${intervalText(d.bounds, r.format, errorBars?.label, r.strings)})` : ""}`;
  const withBounds = dots.filter((d) => d.bounds);
  const marks: Plot.Markish[] = [];
  if (withBounds.length > 0) {
    marks.push(
      Plot.ruleY(withBounds, {
        y: "item",
        x1: (d: Dot) => d.bounds?.lower,
        x2: (d: Dot) => d.bounds?.upper,
        stroke: "var(--enarratio-text)",
        strokeWidth: 1.25,
        render: named("error bar"),
      }),
    );
  }
  const row = new Map(names.map((n, i) => [n, i]));
  marks.push(
    Plot.dot(dots, {
      x: "value",
      y: "item",
      r: 5,
      fill: "series",
      stroke: "series",
      ...(multi ? { symbol: "series" } : {}),
      title: describe,
      render: keyed(dots, (d) => ({
        key: markKey(d.item, d.series),
        filter:
          multi && series
            ? { field: series, value: d.series }
            : { field: options.y, value: d.item },
        x: d.item,
        ...(multi ? { series: d.series } : {}),
        column: row.get(d.item) ?? 0,
        row: seriesNames.indexOf(d.series),
      })),
    }),
  );
  const svg = render(
    kind,
    options,
    { ...r, names },
    marks,
    {
      color: { domain: seriesNames, range: [...plan.range] },
      ...(multi ? { symbol: { domain: seriesNames } } : {}),
    },
    withBounds.length > 0 ? capErrorBars : undefined,
  );
  const cell = new Map(dots.map((d) => [markKey(d.item, d.series), d]));
  const intervalName = errorBars?.label ?? r.strings.terms.interval;
  return figure(options, {
    kind: "dot",
    svg,
    description: {
      axes: itemAxes(
        r,
        dots.flatMap((d) => [d.value, ...(d.bounds ? [d.bounds.lower, d.bounds.upper] : [])]),
      ),
      format: r.format,
      ...(errorBars ? { interval: intervalName.toLowerCase() } : {}),
      series: seriesNames.map((s) => ({
        name: s,
        points: names.flatMap((n) => {
          const d = cell.get(markKey(n, s));
          return d ? [{ at: n, value: d.value, ...(d.bounds ?? {}) }] : [];
        }),
      })),
    },
    legend: multi ? plan.legend : [],
    ...(multi && series ? { seriesField: series } : {}),
    slotColors: plan.slotColors,
    table: {
      columns: [
        r.itemLabel,
        ...seriesNames,
        ...(errorBars
          ? seriesNames.map((s) => (multi ? `${s} ${intervalName.toLowerCase()}` : intervalName))
          : []),
      ],
      rows: names.map((n) => [
        n,
        ...seriesNames.map((s) => {
          const d = cell.get(markKey(n, s));
          return d ? r.format(d.value) : "";
        }),
        ...(errorBars
          ? seriesNames.map((s) => {
              const b = cell.get(markKey(n, s))?.bounds;
              return b ? r.strings.range(r.format(b.lower), r.format(b.upper)) : "";
            })
          : []),
      ]),
    },
  });
}

interface Range {
  readonly item: string;
  readonly index: number;
  readonly low: number;
  readonly high: number;
  readonly value?: number;
}

/**
 * A range plot: one row per item, a bar from its low to its high value (a daily temperature
 * range, a salary band, a reference interval), with an optional marked value inside. Each range
 * is keyed and named, and the data table gives every bound.
 *
 * @example
 * rangePlot({ data: assays, y: "analyte", low: "min", high: "max", value: "median", alt: "..." });
 */
export function rangePlot<T extends object>(given: RangePlotOptions<T>): string {
  const options = withNotes(given);
  const kind = "rangePlot";
  const { data, low, high, value } = options;
  const r = readItems(kind, options, stringsFor(options.strings).terms.value);
  onePerItem(kind, r.raw);
  const valueLabel = options.valueLabel ?? value;
  const ranges = data.map((row, i): Range => {
    const lo = readNumber(kind, row, low, i);
    const hi = readNumber(kind, row, high, i);
    if (lo > hi) throw new Error(`${kind}: row ${i + 1} low ${lo} is above high ${hi}`);
    const v = value === undefined ? undefined : readNumber(kind, row, value, i);
    if (v !== undefined && (v < lo || v > hi)) {
      throw new Error(`${kind}: row ${i + 1} ${value} ${v} lies outside its range ${lo} to ${hi}`);
    }
    return {
      item: r.raw[i] as string,
      index: r.names.indexOf(r.raw[i] as string),
      low: lo,
      high: hi,
      ...(v === undefined ? {} : { value: v }),
    };
  });
  const plan = planSeries(kind, [r.strings.terms.range], options.colors);
  const describe = (d: Range): string =>
    `${d.item}: ${r.strings.range(r.format(d.low), r.format(d.high))}${d.value === undefined ? "" : `, ${valueLabel} ${r.format(d.value)}`}`;
  const marks: Plot.Markish[] = [
    Plot.ruleY(ranges, {
      y: "item",
      x1: "low",
      x2: "high",
      stroke: plan.range[0] as string,
      strokeWidth: 8,
      strokeLinecap: "round",
      title: describe,
      // Named, or the stylesheet would draw it as a plain rule.
      render: named(
        "range",
        keyed(ranges, (d) => ({
          key: markKey(d.item),
          filter: { field: options.y, value: d.item },
          x: d.item,
          column: d.index,
          row: 0,
        })),
      ),
    }),
  ];
  const marked = ranges.filter((d) => d.value !== undefined);
  if (marked.length > 0) {
    marks.push(
      Plot.tickX(marked, {
        x: "value",
        y: "item",
        stroke: "var(--enarratio-text)",
        strokeWidth: 3,
        render: named("value"),
      }),
    );
  }
  const svg = render(kind, options, r, marks, {});
  // With a marked value, one series of values within their ranges; without, the two ends.
  const ordered = r.names.flatMap((n) => ranges.filter((d) => d.item === n));
  const series =
    value === undefined
      ? [
          { name: low, points: ordered.map((d) => ({ at: d.item, value: d.low })) },
          { name: high, points: ordered.map((d) => ({ at: d.item, value: d.high })) },
        ]
      : [
          {
            name: valueLabel ?? value,
            points: ordered.map((d) => ({
              at: d.item,
              value: d.value ?? null,
              lower: d.low,
              upper: d.high,
            })),
          },
        ];
  return figure(options, {
    kind: "range",
    svg,
    description: {
      axes: itemAxes(
        r,
        ranges.flatMap((d) => [d.low, d.high]),
      ),
      format: r.format,
      ...(value === undefined ? {} : { interval: r.strings.terms.range.toLowerCase() }),
      series,
    },
    slotColors: plan.slotColors,
    table: {
      columns: [r.itemLabel, low, high, ...(value === undefined ? [] : [valueLabel ?? value])],
      rows: r.names.map((n) => {
        const d = ranges.find((x) => x.item === n);
        return d
          ? [
              n,
              r.format(d.low),
              r.format(d.high),
              ...(d.value === undefined ? [] : [r.format(d.value)]),
            ]
          : [n, "", "", ...(value === undefined ? [] : [""])];
      }),
    },
  });
}

interface Pair {
  readonly item: string;
  readonly from: number;
  readonly to: number;
}

/**
 * A dumbbell plot: one row per item, two values joined by a line (before and after, two groups,
 * a target and an actual). The ends differ by shape and fill as well as color, a hollow circle
 * for `from` and a filled one for `to`, and the data table gives both values and the change.
 *
 * @example
 * dumbbellPlot({ data: states, y: "state", from: "y2015", to: "y2025", fromLabel: "2015", toLabel: "2025", alt: "..." });
 */
export function dumbbellPlot<T extends object>(given: DumbbellPlotOptions<T>): string {
  const options = withNotes(given);
  const kind = "dumbbellPlot";
  const { data, from, to } = options;
  const r = readItems(kind, options, stringsFor(options.strings).terms.value);
  onePerItem(kind, r.raw);
  const fromLabel = options.fromLabel ?? from;
  const toLabel = options.toLabel ?? to;
  const plan = planSeries(kind, [fromLabel, toLabel], options.colors);
  const pairs = data.map(
    (row, i): Pair => ({
      item: r.raw[i] as string,
      from: readNumber(kind, row, from, i),
      to: readNumber(kind, row, to, i),
    }),
  );
  let names = r.names;
  if (options.sort === "change") {
    const change = new Map(pairs.map((p) => [p.item, p.to - p.from]));
    names = [...names].sort((a, b) => (change.get(b) ?? 0) - (change.get(a) ?? 0));
  }
  const row = new Map(names.map((n, i) => [n, i]));
  const ends = pairs.flatMap((p) => [
    { ...p, end: fromLabel, at: p.from, k: 0 },
    { ...p, end: toLabel, at: p.to, k: 1 },
  ]);
  type End = (typeof ends)[number];
  const signedChange = (p: Pair): string =>
    p.to === p.from ? r.strings.terms.noChange.toLowerCase() : signed(r.format, p.to - p.from);
  const marks: Plot.Markish[] = [
    Plot.ruleY(pairs, {
      y: "item",
      x1: "from",
      x2: "to",
      stroke: "var(--enarratio-text-muted)",
      strokeWidth: 2,
      render: named("link"),
    }),
    Plot.dot(ends, {
      x: "at",
      y: "item",
      r: 5.5,
      stroke: "end",
      strokeWidth: 2,
      // The first end is hollow and the second filled, so the ends differ by more than hue.
      fill: (e: End) => (e.k === 0 ? "var(--enarratio-background)" : plan.range[1]),
      title: (e: End) =>
        `${e.item}, ${e.end}: ${r.format(e.at)} (${r.strings.range(fromLabel, toLabel)}: ${signedChange(e)})`,
      render: keyed(ends, (e) => ({
        key: markKey(e.item, e.end),
        filter: { field: options.y, value: e.item },
        x: e.item,
        series: e.end,
        column: row.get(e.item) ?? 0,
        row: e.k,
      })),
    }),
  ];
  const svg = render(kind, options, { ...r, names }, marks, {
    color: { domain: [fromLabel, toLabel], range: [...plan.range] },
  });
  const byItem = new Map(pairs.map((p) => [p.item, p]));
  return figure(options, {
    kind: "dumbbell",
    svg,
    description: {
      axes: itemAxes(
        r,
        pairs.flatMap((p) => [p.from, p.to]),
      ),
      format: r.format,
      series: [
        [fromLabel, (p: Pair) => p.from] as const,
        [toLabel, (p: Pair) => p.to] as const,
      ].map(([name, end]) => ({
        name,
        points: names.map((n) => ({ at: n, value: end(byItem.get(n) as Pair) })),
      })),
    },
    legend: plan.legend,
    slotColors: plan.slotColors,
    table: {
      columns: [r.itemLabel, fromLabel, toLabel, r.strings.terms.change],
      rows: names.map((n) => {
        const p = pairs.find((x) => x.item === n) as Pair;
        return [n, r.format(p.from), r.format(p.to), signedChange(p)];
      }),
    },
  });
}
