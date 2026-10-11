/**
 * Everything about a line or area chart except the drawing: reading and checking the rows, the
 * forecast split, hover text, keys and the data table. Shared by the Observable Plot renderer
 * (`enarratio/plot`) and the light one (`enarratio/lite`).
 */

import {
  calendarDates,
  DAY,
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
} from "./data.js";
import type { MarkDatum } from "./datum.js";
import {
  type FigureOptions,
  figure,
  type ScaleDescription,
  type SeriesColor,
  validateFigure,
} from "./figure.js";
import { planSeries, type SeriesPlan } from "./series.js";

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

/** Options shared by `lineChart` and `areaChart`. */
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

/**
 * A shaded band around each series' line, such as a forecast interval or a confidence interval,
 * from two fields the caller computed. Enarratio draws bounds; it does not estimate them.
 */
export interface LineBand<T extends object> {
  /** The field for the band's lower bound at each x. `null` leaves a gap, with `upper`. */
  readonly lower: KeysOfType<T, number | null | undefined>;
  /** The field for the band's upper bound; never below `lower`. */
  readonly upper: KeysOfType<T, number | null | undefined>;
  /**
   * What the band is, e.g. "95% interval". It names the band's data table columns ("95%
   * interval, lower") and its hover details; without it they say "lower bound" and "upper bound".
   */
  readonly label?: string;
}

/** Options for `lineChart`. */
export interface LineChartOptions<T extends object> extends SeriesChartOptions<T> {
  /**
   * A shaded band around each line, from `lower` and `upper` fields (a forecast interval, a
   * confidence interval). Drawn in the series' color, behind the line, and carried in the data
   * table as two columns per series. Every row has both bounds or neither.
   */
  readonly band?: LineBand<T>;
  /**
   * The x after which the data are forecast: the line is dashed from here on, points are drawn
   * hollow, a labelled rule marks the boundary, and the data table marks the rows after it
   * (those with x greater than this). Must lie within the data's x range, before its last value.
   * The forecast itself is computed by the caller.
   */
  readonly forecastFrom?: number | Date | string;
  /** The label on the forecast boundary (default "Forecast"). */
  readonly forecastLabel?: string;
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

/** One row of a line or area chart. */
export interface Point {
  readonly x: number | Date;
  /** The x value as a number (epoch milliseconds for time), which identifies the row. */
  readonly at: number;
  readonly xText: string;
  readonly series: string;
  readonly value: number | null;
  readonly lower: number | null;
  readonly upper: number | null;
  /** Whether the row comes after `forecastFrom`. */
  readonly forecast: boolean;
  /** The x value's rank among all x values, for keyboard order. */
  column: number;
  readonly row: number;
}

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

/** A line or area chart's rows, read and checked, with what its axes and table need. */
export interface Prepared {
  readonly points: Point[];
  readonly seriesNames: string[];
  readonly time: boolean;
  readonly years: boolean;
  readonly format: (value: number) => string;
  readonly xLabel: string | null;
  readonly yLabel: string | null;
  /** `forecastFrom` as a number (epoch milliseconds for time), when given. */
  readonly forecastAt?: number;
  readonly band?: { readonly lower: string; readonly upper: string; readonly label?: string };
}

type Forecastable<T extends object> = SeriesChartOptions<T> &
  Partial<Pick<LineChartOptions<T>, "band" | "forecastFrom">>;

/** Reads and checks the rows shared by line and area charts. */
function prepare<T extends object>(kind: string, options: Forecastable<T>): Prepared {
  const { data, x, y, series } = options;
  validateFigure(kind, options);
  if (data.length === 0) throw new Error(`${kind}: data is empty`);
  const first: unknown = (data[0] as Record<string, unknown>)[x];
  const time = options.xType ? options.xType === "time" : typeof first !== "number";
  const format = options.formatValue ?? defaultFormat;
  const yLabel = options.yLabel === undefined ? y : options.yLabel;
  const xLabel = options.xLabel === undefined ? x : options.xLabel;
  const sole = yLabel ?? "Value";

  // forecastFrom is read with the data, so calendar dates treat both the same way.
  const given = options.forecastFrom;
  const read: (number | Date)[] = time
    ? data.map((row, i) => readDate(kind, row, x, i))
    : data.map((row, i) => readNumber(kind, row, x, i));
  if (given !== undefined) {
    read.push(
      time
        ? readDate(kind, { forecastFrom: given }, "forecastFrom", 0)
        : readNumber(kind, { forecastFrom: given }, "forecastFrom", 0),
    );
  }
  const all = time ? calendarDates(read as Date[]) : read;
  const forecastBoundary = given !== undefined ? Number(all[all.length - 1]) : undefined;
  const xs = given !== undefined ? all.slice(0, -1) : all;
  const numbers = xs.map(Number);
  if (forecastBoundary !== undefined) {
    if (!(forecastBoundary >= minOf(numbers) && forecastBoundary < maxOf(numbers))) {
      throw new Error(
        `${kind}: forecastFrom must lie within the x range and before its last value, so that some rows are forecast`,
      );
    }
  }
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
  const band = options.band;
  // Rows are identified by the x value itself, not its text, so hourly data with a daily label
  // (or any coarse formatX) is still distinct (F3).
  const seen = new Set<string>();
  const points = data.map((row, i): Point => {
    const xv = xs[i] as number | Date;
    const at = Number(xv);
    const name = seriesOf(row, i);
    const lower = band ? readNumberOrNull(kind, row, band.lower, i) : null;
    const upper = band ? readNumberOrNull(kind, row, band.upper, i) : null;
    if (band && (lower === null) !== (upper === null)) {
      throw new Error(
        `${kind}: row ${i + 1} has only one of the band's "${band.lower}" and "${band.upper}"; give both or neither`,
      );
    }
    if (lower !== null && upper !== null && lower > upper) {
      throw new Error(
        `${kind}: row ${i + 1} band lower bound ${lower} is above its upper bound ${upper}`,
      );
    }
    const point: Point = {
      x: xv,
      at,
      xText: formatX(xv),
      series: name,
      value: readNumberOrNull(kind, row, y, i),
      lower,
      upper,
      forecast: forecastBoundary !== undefined && at > forecastBoundary,
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
  return {
    points,
    seriesNames,
    time,
    years,
    format,
    xLabel,
    yLabel,
    ...(forecastBoundary !== undefined ? { forecastAt: forecastBoundary } : {}),
    ...(band ? { band } : {}),
  };
}

/** A marker's position read like the data's x values, with its label. */
export interface MarkerPoint {
  readonly x: number | Date;
  readonly label: string;
}

/** Reads the event markers' positions the way the chart reads x. */
export function markerPoints(
  options: Pick<SeriesChartOptions<object>, "markers">,
  time: boolean,
  kind: string,
): MarkerPoint[] {
  return (options.markers ?? []).map((m, i) => ({
    x: time ? readDate(kind, m, "x", i) : readNumber(kind, m, "x", i),
    label: m.label,
  }));
}

/** The data table column for one bound of a band, e.g. "Berlin 95% interval, lower". */
function boundColumn(prepared: Prepared, series: string, multi: boolean, bound: string): string {
  const what = prepared.band?.label ? `${prepared.band.label}, ${bound}` : `${bound} bound`;
  if (multi) return `${series} ${what}`;
  return `${what.charAt(0).toUpperCase()}${what.slice(1)}`;
}

function table(prepared: Prepared, xColumn: string, multi: boolean) {
  const rowsByX = new Map<number, string>();
  for (const p of prepared.points) if (!rowsByX.has(p.at)) rowsByX.set(p.at, p.xText);
  const cell = new Map(prepared.points.map((p) => [markKey(p.at, p.series), p]));
  const bounds = prepared.band
    ? prepared.seriesNames.flatMap((s) => [
        { series: s, which: "lower" as const, column: boundColumn(prepared, s, multi, "lower") },
        { series: s, which: "upper" as const, column: boundColumn(prepared, s, multi, "upper") },
      ])
    : [];
  const forecast = prepared.forecastAt !== undefined;
  return {
    columns: [
      xColumn,
      ...prepared.seriesNames,
      ...bounds.map((b) => b.column),
      ...(forecast ? ["Forecast"] : []),
    ],
    rows: [...rowsByX].map(([at, text]) => [
      text,
      ...prepared.seriesNames.map((s) => {
        const v = cell.get(markKey(at, s))?.value;
        return v === null || v === undefined ? "" : prepared.format(v);
      }),
      ...bounds.map((b) => {
        const v = cell.get(markKey(at, b.series))?.[b.which];
        return v === null || v === undefined ? "" : prepared.format(v);
      }),
      ...(forecast ? [forecastAt(prepared, at) ? "Yes" : ""] : []),
    ]),
  };
}

/** Whether an x value comes after the forecast boundary. */
function forecastAt(prepared: Prepared, at: number): boolean {
  return prepared.forecastAt !== undefined && at > prepared.forecastAt;
}

function describePoint(prepared: Prepared, multi: boolean, xColumn: string) {
  return (p: Point): string => {
    const notes: string[] = [];
    if (p.forecast) notes.push("forecast");
    if (prepared.band && p.lower !== null && p.upper !== null) {
      notes.push(
        `${prepared.band.label ?? "range"} ${prepared.format(p.lower)} to ${prepared.format(p.upper)}`,
      );
    }
    return `${multi ? `${p.series}, ` : ""}${xColumn} ${p.xText}: ${p.value === null ? "no data" : prepared.format(p.value)}${notes.length > 0 ? ` (${notes.join("; ")})` : ""}`;
  };
}

function datum(p: Point, x: string, series: string | undefined): MarkDatum {
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

/** What line and area charts share once read: rows, colors, hover text, keys and the figure. */
export interface SeriesModel {
  readonly prepared: Prepared;
  readonly plan: SeriesPlan;
  /** Whether the chart has a `series` field (and so a legend). */
  readonly multi: boolean;
  /** Whole-year x ticks, when x holds years. */
  readonly yearTicks: number[] | undefined;
  readonly markers: readonly MarkerPoint[];
  describe(p: Point): string;
  datum(p: Point): MarkDatum;
  /** Wraps the drawn SVG in the figure, with its legend and data table. */
  figure(svg: string, x: ScaleDescription | undefined): string;
}

function seriesModel<T extends object>(
  kind: string,
  figureKind: string,
  options: Forecastable<T>,
  prepared: Prepared,
  check?: () => void,
): SeriesModel {
  const plan = planSeries(kind, prepared.seriesNames, options.colors);
  check?.();
  const multi = options.series !== undefined;
  const xColumn = prepared.xLabel ?? options.x;
  const ats = prepared.points.map((p) => p.at);
  return {
    prepared,
    plan,
    multi,
    yearTicks: prepared.years ? yearTicks(minOf(ats), maxOf(ats)) : undefined,
    markers: markerPoints(options, prepared.time, kind),
    describe: describePoint(prepared, multi, xColumn),
    datum: (p) => datum(p, options.x, options.series),
    figure: (svg, x) =>
      figure(options, {
        kind: figureKind,
        svg,
        ...(x ? { x } : {}),
        legend: multi ? plan.legend : [],
        ...(multi && options.series ? { seriesField: options.series } : {}),
        slotColors: plan.slotColors,
        table: table(prepared, xColumn, multi),
      }),
  };
}

const LINE = "lineChart";

/** A line chart read from its options. */
export interface LineModel extends SeriesModel {
  readonly log: boolean;
  /** The rows with a value: the drawn points. */
  readonly present: readonly Point[];
  /** Whether points are drawn, or only there to hover. */
  readonly showPoints: boolean;
  /** The rows drawn solid: all of them, or those up to the forecast boundary. */
  readonly solid: readonly Point[];
  /** The rows drawn dashed, after the forecast boundary; empty without a forecast. */
  readonly dashed: readonly Point[];
  /** The forecast boundary as the axis reads it, with its label. */
  readonly forecast: { readonly x: number | Date; readonly label: string } | undefined;
  readonly directLabels: boolean;
}

/** Reads and checks a line chart's options. Throws on anything it cannot draw. */
export function lineModel<T extends object>(options: LineChartOptions<T>): LineModel {
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
  if (log) {
    const low = points.find((p) => p.lower !== null && p.lower <= 0);
    if (low) {
      throw new Error(
        `${LINE}: the band's lower bound for ${low.series} at ${low.xText} is ${low.lower}, which a log axis cannot show`,
      );
    }
  }
  const base = seriesModel(LINE, "line", options, prepared);
  const present = points.filter((p) => p.value !== null);
  const perSeries = present.length / seriesNames.length;
  const boundary = prepared.forecastAt;
  // Each series' dashed stretch starts at its last point on or before the boundary, so the line
  // stays joined where the data change from observed to forecast.
  const dashed =
    boundary === undefined
      ? []
      : points
          .filter((p) => p.at > boundary)
          .concat(
            seriesNames.flatMap((name) => {
              const own = points.filter((p) => p.series === name && p.at <= boundary);
              const last = own[own.length - 1];
              return last ? [last] : [];
            }),
          )
          .sort((a, b) => a.at - b.at || a.row - b.row);
  return {
    ...base,
    log,
    present,
    showPoints: options.points ?? perSeries <= 30,
    solid: boundary === undefined ? points : points.filter((p) => p.at <= boundary),
    dashed,
    forecast:
      boundary === undefined
        ? undefined
        : {
            x: time ? new Date(boundary) : boundary,
            label: options.forecastLabel ?? "Forecast",
          },
    directLabels: options.directLabels === true && base.multi,
  };
}

const AREA = "areaChart";

/** Reads and checks an area chart's options. Throws on anything it cannot draw. */
export function areaModel<T extends object>(options: SeriesChartOptions<T>): SeriesModel {
  const prepared = prepare(AREA, options);
  return seriesModel(AREA, "area", options, prepared, () => {
    for (const p of prepared.points) {
      if (p.value !== null && p.value < 0) {
        throw new Error(
          `${AREA}: stacked areas need values of zero or more; ${p.series} at ${p.xText} is ${p.value}`,
        );
      }
    }
  });
}
