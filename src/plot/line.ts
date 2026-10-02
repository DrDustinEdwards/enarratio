import * as Plot from "@observablehq/plot";
import {
  defaultFormat,
  domainOf,
  type KeysOfType,
  markKey,
  maxOf,
  minOf,
  readDate,
  readLabel,
  readNumber,
  readNumberOrNull,
} from "../render/data.js";
import { type FigureOptions, figure, type SeriesColor, validateFigure } from "../render/figure.js";
import { keyed, renderPlot } from "../render/plot.js";
import { planSeries } from "../render/series.js";

/** A horizontal line across the chart at a value: a threshold, a limit, a target. */
export interface ReferenceLine {
  readonly y: number;
  readonly label: string;
}

/** A vertical line at an x position: a deploy, an intervention, an outbreak declared. */
export interface EventMarker {
  readonly x: number | Date | string;
  readonly label: string;
}

/** Options shared by {@link lineChart} and {@link areaChart}. */
export interface SeriesChartOptions<T extends object> extends FigureOptions {
  readonly data: readonly T[];
  /**
   * The field along the x axis: dates or numbers. Dates are Date objects or ISO 8601 strings;
   * epoch milliseconds are numbers, so they need `xType: "time"`. Dates are instants in UTC,
   * except that when every Date falls at local midnight they are read as calendar dates in the
   * local time zone, so `new Date(2025, 0, 6)` is 6 January wherever the server runs (A3).
   */
  readonly x: KeysOfType<T, number | Date | string>;
  /** The field for the value. `null` or a missing value is a gap, never zero. */
  readonly y: KeysOfType<T, number | null | undefined>;
  /** A field naming the series each row belongs to. */
  readonly series?: KeysOfType<T, string>;
  /**
   * Whether x is time or a number. Inferred from the first row: numbers are linear, Dates and
   * strings are time.
   */
  readonly xType?: "time" | "linear";
  /** Every series in display and color order. Without it, first-seen order. */
  readonly seriesDomain?: readonly string[];
  /**
   * Color overrides by series name. A chart without `series` has one series, named by `yLabel`
   * (or "Value" when the y label is hidden).
   */
  readonly colors?: Readonly<Record<string, SeriesColor>>;
  /** The x axis label; defaults to the field name; `null` hides it. */
  readonly xLabel?: string | null;
  /** The y axis label; defaults to the field name; `null` hides it. */
  readonly yLabel?: string | null;
  /** Formats values in hover details and the data table. */
  readonly formatValue?: (value: number) => string;
  /**
   * Formats x values in hover details and the data table. Dates default to YYYY-MM-DD, with the
   * UTC time added when any value falls within a day; years print without a thousands separator.
   */
  readonly formatX?: (value: number | Date) => string;
  /** Horizontal reference lines, each labelled on the chart. */
  readonly references?: readonly ReferenceLine[];
  /** Vertical event markers, each labelled on the chart. */
  readonly markers?: readonly EventMarker[];
}

/** Options for {@link lineChart}. */
export interface LineChartOptions<T extends object> extends SeriesChartOptions<T> {
  /** Show a dot at every value (default: only when there are 30 or fewer per series). */
  readonly points?: boolean;
  /** Label each series at the end of its line as well as in the legend. */
  readonly directLabels?: boolean;
  /**
   * Use a logarithmic y axis, for values spanning orders of magnitude. Every value must then be
   * above zero; a zero or negative value throws rather than vanishing from the line (F2).
   */
  readonly yType?: "linear" | "log";
  /** Include zero on the y axis (default true, except on a log axis). */
  readonly zero?: boolean;
}

interface Point {
  readonly x: number | Date;
  /** The x value as a number (epoch milliseconds for time), which identifies the row. */
  readonly at: number;
  readonly xText: string;
  readonly series: string;
  readonly value: number | null;
  /** The x value's rank among all x values, for keyboard order. */
  column: number;
  readonly row: number;
}

const DAY = 86_400_000;
const pad = (n: number): string => String(n).padStart(2, "0");
const isoDate = (d: Date): string => d.toISOString().slice(0, 10);
const isoDateTime = (d: Date): string =>
  `${isoDate(d)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}${d.getUTCSeconds() ? `:${pad(d.getUTCSeconds())}` : ""} UTC`;

/** Whether numbers look like years, which print without a thousands separator (F4). */
const isYears = (values: readonly number[]): boolean =>
  values.length > 0 && values.every((v) => Number.isInteger(v) && v >= 1000 && v <= 2999);

/** About six whole-year ticks between two years. */
function yearTicks(from: number, to: number): number[] {
  const span = Math.max(1, to - from);
  const step = [1, 2, 5, 10, 20, 50, 100].find((s) => span / s <= 6) ?? 100;
  const ticks: number[] = [];
  for (let t = Math.ceil(from / step) * step; t <= to; t += step) ticks.push(t);
  return ticks;
}

/**
 * Dates made at local midnight (`new Date(2025, 0, 6)`) mean a calendar date, but east of UTC
 * that instant falls on the previous UTC day. When every Date is at local midnight and not at
 * UTC midnight, each is moved to UTC midnight of its local date (A3).
 */
function calendarDates(dates: Date[]): Date[] {
  const localMidnight = dates.every(
    (d) =>
      d.getHours() === 0 &&
      d.getMinutes() === 0 &&
      d.getSeconds() === 0 &&
      d.getMilliseconds() === 0,
  );
  const utcMidnight = dates.every((d) => d.getTime() % DAY === 0);
  if (!localMidnight || utcMidnight) return dates;
  return dates.map((d) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())));
}

interface Prepared {
  readonly points: Point[];
  readonly seriesNames: string[];
  readonly time: boolean;
  readonly years: boolean;
  readonly format: (value: number) => string;
  readonly xLabel: string | null;
  readonly yLabel: string | null;
}

function prepare<T extends object>(kind: string, options: SeriesChartOptions<T>): Prepared {
  const { data, x, y, series } = options;
  validateFigure(kind, options);
  if (data.length === 0) throw new Error(`${kind}: data is empty`);
  const first: unknown = (data[0] as Record<string, unknown>)[x];
  const time = options.xType ? options.xType === "time" : typeof first !== "number";
  const format = options.formatValue ?? defaultFormat;
  const yLabel = options.yLabel === undefined ? y : options.yLabel;
  const xLabel = options.xLabel === undefined ? x : options.xLabel;
  const sole = yLabel ?? "Value";

  const xs: (number | Date)[] = time
    ? calendarDates(data.map((row, i) => readDate(kind, row, x, i)))
    : data.map((row, i) => readNumber(kind, row, x, i));
  const numbers = xs.map(Number);
  const years = !time && isYears(numbers);
  const subDaily = time && numbers.some((n) => n % DAY !== 0);
  const formatX = (v: number | Date): string => {
    if (options.formatX) return options.formatX(v);
    if (v instanceof Date) return subDaily ? isoDateTime(v) : isoDate(v);
    return years ? String(v) : defaultFormat(v);
  };

  const seriesOf = (row: T, i: number): string =>
    series === undefined ? sole : readLabel(kind, row, series, i);
  const seriesNames =
    series === undefined
      ? [sole]
      : domainOf(
          kind,
          series,
          data.map((row, i) => seriesOf(row, i)),
          options.seriesDomain,
        );
  const rowOf = new Map(seriesNames.map((name, i) => [name, i]));
  // Rows are identified by the x value itself, not its text, so hourly data with a daily label
  // (or any coarse formatX) is still distinct (F3).
  const seen = new Set<string>();
  const points = data.map((row, i): Point => {
    const xv = xs[i] as number | Date;
    const at = Number(xv);
    const name = seriesOf(row, i);
    const point: Point = {
      x: xv,
      at,
      xText: formatX(xv),
      series: name,
      value: readNumberOrNull(kind, row, y, i),
      column: 0,
      row: rowOf.get(name) ?? 0,
    };
    const id = markKey(at, name);
    if (seen.has(id)) {
      throw new Error(`${kind}: two rows for x ${point.xText} in series "${name}"`);
    }
    seen.add(id);
    return point;
  });
  if (points.every((p) => p.value === null)) throw new Error(`${kind}: every value is empty`);
  points.sort((a, b) => a.at - b.at || a.row - b.row);
  const ranks = new Map([...new Set(points.map((p) => p.at))].map((at, i) => [at, i]));
  for (const p of points) p.column = ranks.get(p.at) ?? 0;
  return { points, seriesNames, time, years, format, xLabel, yLabel };
}

function annotations(
  options: Pick<SeriesChartOptions<object>, "references" | "markers">,
  time: boolean,
  kind: string,
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
  const markers = (options.markers ?? []).map((m, i) => ({
    x: time ? readDate(kind, m, "x", i) : readNumber(kind, m, "x", i),
    label: m.label,
  }));
  if (markers.length > 0) {
    marks.push(
      Plot.ruleX(markers, { x: "x", strokeDasharray: "2,3" }),
      Plot.text(markers, { x: "x", text: "label", frameAnchor: "top", textAnchor: "start", dx: 4 }),
    );
  }
  return marks;
}

function table(prepared: Prepared, xColumn: string) {
  const rowsByX = new Map<number, string>();
  for (const p of prepared.points) if (!rowsByX.has(p.at)) rowsByX.set(p.at, p.xText);
  const cell = new Map(prepared.points.map((p) => [markKey(p.at, p.series), p.value]));
  return {
    columns: [xColumn, ...prepared.seriesNames],
    rows: [...rowsByX].map(([at, text]) => [
      text,
      ...prepared.seriesNames.map((s) => {
        const v = cell.get(markKey(at, s));
        return v === null || v === undefined ? "" : prepared.format(v);
      }),
    ]),
  };
}

function describePoint(prepared: Prepared, multi: boolean, xColumn: string) {
  return (p: Point): string =>
    `${multi ? `${p.series}, ` : ""}${xColumn} ${p.xText}: ${p.value === null ? "no data" : prepared.format(p.value)}`;
}

/** The x scale shared by line and area charts. */
function xScale(prepared: Prepared) {
  const base = {
    type: prepared.time ? "utc" : "linear",
    label: prepared.xLabel,
    labelAnchor: "center",
    labelArrow: "none",
  } as const;
  if (!prepared.years) return base;
  const ats = prepared.points.map((p) => p.at);
  return {
    ...base,
    ticks: yearTicks(minOf(ats), maxOf(ats)),
    tickFormat: (d: number) => String(d),
  };
}

function datum(p: Point, x: string, series: string | undefined) {
  const multi = series !== undefined;
  return {
    key: markKey(p.at, p.series),
    filter: multi ? { field: series, value: p.series } : { field: x, value: p.xText },
    x: p.xText,
    ...(multi ? { series: p.series } : {}),
    column: p.column,
    row: p.row,
  };
}

const LINE = "lineChart";

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
  const prepared = prepare(LINE, options);
  const { points, seriesNames, time } = prepared;
  const log = options.yType === "log";
  if (log) {
    const bad = points.find((p) => p.value !== null && p.value <= 0);
    if (bad) {
      throw new Error(
        `${LINE}: ${bad.series} at ${bad.xText} is ${bad.value}, which a log axis cannot show`,
      );
    }
  }
  const plan = planSeries(LINE, seriesNames, options.colors);
  const multi = options.series !== undefined;
  const xColumn = prepared.xLabel ?? options.x;
  const describe = describePoint(prepared, multi, xColumn);
  const present = points.filter((p) => p.value !== null);
  const perSeries = present.length / seriesNames.length;
  const showPoints = options.points ?? perSeries <= 30;

  const marks: Plot.Markish[] = [
    Plot.line(points, {
      x: "x",
      y: "value",
      z: "series",
      stroke: "series",
      strokeWidth: 2,
      curve: "linear",
    }),
    Plot.dot(present, {
      x: "x",
      y: "value",
      fill: "series",
      r: showPoints ? 3 : 4,
      fillOpacity: showPoints ? 1 : 0,
      title: describe,
      render: keyed(present, (p) => datum(p, options.x, options.series)),
    }),
    ...annotations(options, time, LINE),
  ];
  if (options.directLabels && multi) {
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
        }),
      ),
    );
  }

  const rendered = renderPlot(
    {
      width: options.width ?? 640,
      height: options.height ?? 320,
      marginTop: 20,
      marginLeft: prepared.yLabel === null ? 48 : 64,
      marginRight: options.directLabels && multi ? 96 : 24,
      marginBottom: 44,
      x: xScale(prepared),
      y: {
        type: log ? "log" : "linear",
        label: prepared.yLabel,
        labelAnchor: "center",
        labelArrow: "none",
        grid: true,
        nice: true,
        ...(log ? {} : { zero: options.zero ?? true }),
      },
      color: { domain: seriesNames, range: [...plan.range] },
      marks,
    },
    options.alt,
  );

  return figure(options, {
    kind: "line",
    svg: rendered.svg,
    ...(rendered.x ? { x: rendered.x } : {}),
    legend: multi ? plan.legend : [],
    ...(multi && options.series ? { seriesField: options.series } : {}),
    slotColors: plan.slotColors,
    table: table(prepared, xColumn),
  });
}

const AREA = "areaChart";

/**
 * An area chart over time or any continuous x. Several series stack, so the top edge is their
 * total. A missing value is a gap: that series' band breaks there, has no point to hover, and
 * its table cell is blank (F5). Keyed points carry hover details as in {@link lineChart}.
 *
 * @example
 * areaChart({ data: monthly, x: "month", y: "hours", series: "activity", alt: "..." });
 */
export function areaChart<T extends object>(options: SeriesChartOptions<T>): string {
  const prepared = prepare(AREA, options);
  const { points, seriesNames, time } = prepared;
  const plan = planSeries(AREA, seriesNames, options.colors);
  const multi = options.series !== undefined;
  const xColumn = prepared.xLabel ?? options.x;
  const describe = describePoint(prepared, multi, xColumn);
  for (const p of points) {
    if (p.value !== null && p.value < 0) {
      throw new Error(
        `${AREA}: stacked areas need values of zero or more; ${p.series} at ${p.xText} is ${p.value}`,
      );
    }
  }
  const order = { order: seriesNames };

  const rendered = renderPlot(
    {
      width: options.width ?? 640,
      height: options.height ?? 320,
      marginTop: 20,
      marginLeft: prepared.yLabel === null ? 48 : 64,
      marginBottom: 44,
      x: xScale(prepared),
      y: {
        label: prepared.yLabel,
        labelAnchor: "center",
        labelArrow: "none",
        grid: true,
        nice: true,
        zero: true,
      },
      color: { domain: seriesNames, range: [...plan.range] },
      marks: [
        Plot.areaY(
          points,
          Plot.stackY({
            ...order,
            x: "x",
            y: "value",
            z: "series",
            fill: "series",
            fillOpacity: 0.85,
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
            title: describe,
            // Gaps have no point: their hover text would otherwise claim a value.
            filter: (p: Point) => p.value !== null,
            render: keyed(points, (p) => datum(p, options.x, options.series)),
          }),
        ),
        Plot.ruleY([0]),
        ...annotations(options, time, AREA),
      ],
    },
    options.alt,
  );

  return figure(options, {
    kind: "area",
    svg: rendered.svg,
    ...(rendered.x ? { x: rendered.x } : {}),
    legend: multi ? plan.legend : [],
    ...(multi && options.series ? { seriesField: options.series } : {}),
    slotColors: plan.slotColors,
    table: table(prepared, xColumn),
  });
}
