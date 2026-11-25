import { type Annotated } from "./annotation.js";
import {
  calendarDates,
  isYears,
  DAY,
  domainOf,
  formatInstant,
  type KeysOfType,
  markKey,
  maxOf,
  minOf,
  readDate,
  readLabel,
  readNumber,
  readNumberOrNull,
} from "./data.js";
import { type SeriesAxesOptions, type SeriesColor, unitLabel, validateFigure } from "./figure.js";
import { dateFormat, defaultFormat, numberFormat, type Strings, stringsFor } from "./text.js";

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
export interface SeriesChartOptions<T extends object> extends SeriesAxesOptions, Annotated {
  readonly data: readonly T[];
  /**
   * The field along the x axis: dates or numbers. Dates are Date objects or ISO 8601 strings;
   * epoch milliseconds need `xType: "time"`. Dates are instants in UTC, except that when every Date
   * falls at local midnight they are read as calendar dates in the local time zone.
   */
  readonly x: KeysOfType<T, number | Date | string>;
  /** The field for the value. `null` or a missing value is a gap, never zero. */
  readonly y: KeysOfType<T, number | null | undefined>;
  /** A field naming the series each row belongs to. */
  readonly series?: KeysOfType<T, string>;
  /** Whether x is time or a number. Inferred from the first row: numbers are linear, Dates and strings are time. */
  readonly xType?: "time" | "linear";
  /** Color overrides by series name. A chart without `series` has one series, named by `yLabel`. */
  readonly colors?: Readonly<Record<string, SeriesColor>>;
  /**
   * Formats x values in hover details, the data table and the summary. Dates are written out for the
   * locale, with the time and "UTC" added when any value falls within a day.
   */
  readonly formatX?: (value: number | Date) => string;
  /** Horizontal reference lines, each labeled on the chart. */
  readonly references?: readonly ReferenceLine[];
  /** Vertical event markers, each labeled on the chart. */
  readonly markers?: readonly EventMarker[];
  /** The most x tick labels to print. Without it, ticks are thinned to what fits the width. */
  readonly maxXTicks?: number;
  /**
   * Name each series at the end of its line or band as well as in the legend (default true when
   * there are series). An area chart whose bands are not all named this way (a band empty at the
   * last x, or `false`) fills series 2 to 8 with textures instead.
   */
  readonly directLabels?: boolean;
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
  /** What the band is, e.g. "95% interval": it names the band's table columns and hover details (default "lower bound" and "upper bound"). */
  readonly label?: string;
}

/** Options for `lineChart`. */
export interface LineChartOptions<T extends object> extends SeriesChartOptions<T> {
  /**
   * A shaded band around each line, from `lower` and `upper` fields, drawn in the series' color
   * behind the line and carried in the data table as two columns per series. Every row has both
   * bounds or neither.
   */
  readonly band?: LineBand<T>;
  /**
   * The x after which the data are forecast: the line is dashed from here on, points are hollow, a
   * labeled rule marks the boundary, and the data table marks the later rows. Must lie within the
   * data's x range, before its last value. The caller computes the forecast.
   */
  readonly forecastFrom?: number | Date | string;
  /** The label on the forecast boundary (default "Forecast"). */
  readonly forecastLabel?: string;
  /** Show a dot at every value (default: only when there are 30 or fewer per series). */
  readonly points?: boolean;
  /** Use a logarithmic y axis. Every value must be above zero; a zero or negative value throws rather than vanishing. */
  readonly yType?: "linear" | "log";
  /** Include zero on the y axis (default true, except on a log axis). */
  readonly zero?: boolean;
}

/** One row of a line or area chart. */
export interface Point {
  readonly x: number | Date;
  /** The x value as a number (epoch milliseconds for time), which identifies the row. */
  readonly at: number;
  /** The x value as readers see it, in the table, hover details and summary. */
  readonly xText: string;
  /** The x value as filter events and mark keys carry it: ISO dates, or `formatX`'s text. */
  readonly xKey: string;
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

const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

export function yearTicks(from: number, to: number): number[] {
  const span = Math.max(1, to - from);
  const step = [1, 2, 5, 10, 20, 50, 100].find((s) => span / s <= 6) ?? 100;
  const ticks: number[] = [];
  for (let t = Math.ceil(from / step) * step; t <= to; t += step) ticks.push(t);
  return ticks;
}

/**
 * Whole-day x ticks for date-only data drawn `plotWidth` pixels wide, where the axis would
 * otherwise tick by the hour between dates. Undefined when the axis already ticks by the day or
 * coarser (about one tick per 80 pixels, as Plot and the light charts count them).
 */
export function dayTicks(prepared: Prepared, plotWidth: number): number[] | undefined {
  if (!prepared.dates) return undefined;
  const ats = prepared.points.map((p) => p.at);
  const [from, to] = [minOf(ats), maxOf(ats)];
  if ((to - from) / (plotWidth / 80) >= DAY) return undefined;
  const ticks: number[] = [];
  for (let t = from; t <= to; t += DAY) ticks.push(t);
  return ticks;
}

/** A line or area chart's rows, read and checked, with what its axes and table need. */
export interface Prepared {
  readonly points: Point[];
  readonly seriesNames: string[];
  readonly time: boolean;
  /** Whether x is time and every value a whole day (no time of day). */
  readonly dates: boolean;
  readonly years: boolean;
  readonly format: (value: number) => string;
  readonly strings: Strings;
  readonly xLabel: string | null;
  /** The x axis title drawn: none on a time or year axis, whose ticks say what they are. */
  readonly xTitle: string | null;
  readonly yLabel: string | null;
  /** `forecastFrom` as a number (epoch milliseconds for time), when given. */
  readonly forecastAt?: number;
  readonly band?: { readonly lower: string; readonly upper: string; readonly label?: string };
}

export type Forecastable<T extends object> = SeriesChartOptions<T> &
  Partial<Pick<LineChartOptions<T>, "band" | "forecastFrom" | "yType">>;

export function prepare<T extends object>(kind: string, options: Forecastable<T>): Prepared {
  const { data, x, y, series } = options;
  validateFigure(kind, options, data);
  const first: unknown = (data[0] as Record<string, unknown>)[x];
  const time = options.xType ? options.xType === "time" : typeof first !== "number";
  const locale = options.locale ?? "en-US";
  const number = numberFormat({ locale });
  const format = options.formatValue ?? number;
  const yLabel = unitLabel(options.yLabel, y, options.yUnit);
  const xLabel = unitLabel(options.xLabel, x, options.xUnit);
  const strings = stringsFor(options.strings);
  const sole = yLabel ?? strings.terms.value;

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
  const written = dateFormat({ locale, time: subDaily });
  const keyOf = (v: number | Date): string => {
    if (options.formatX) return options.formatX(v);
    if (v instanceof Date) return subDaily ? formatInstant(v) : isoDate(v);
    return years ? String(v) : defaultFormat(v);
  };
  const formatX = (v: number | Date): string => {
    if (options.formatX) return options.formatX(v);
    if (v instanceof Date) return written(v);
    return years ? String(v) : number(v);
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
  // Rows are identified by the x value itself, not its text, so hourly data with a coarse formatX stays distinct.
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
      xKey: keyOf(xv),
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
    dates: time && !subDaily,
    years,
    format,
    strings,
    xLabel,
    xTitle: time || years ? null : xLabel,
    yLabel,
    ...(forecastBoundary !== undefined ? { forecastAt: forecastBoundary } : {}),
    ...(band ? { band } : {}),
  };
}
