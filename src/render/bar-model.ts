/**
 * Everything about a bar chart except the drawing: reading and checking the data, the layout
 * numbers and the data table. Shared by the Observable Plot renderer (`enarratio/plot`) and the
 * light one (`enarratio/lite`), so both draw the same chart from the same options.
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
  readCategory,
  readDate,
  readLabel,
  readNumber,
} from "./data.js";
import type { MarkDatum } from "./datum.js";
import { type FigureOptions, figure, type SeriesColor, validateFigure } from "./figure.js";
import { planSeries, type SeriesPlan } from "./series.js";
import { DEFAULT_HEIGHT, DEFAULT_WIDTH } from "./size.js";

/** Options for `barChart`, from `enarratio/plot` or `enarratio/lite`. */
export interface BarChartOptions<T extends object> extends FigureOptions {
  readonly data: readonly T[];
  /**
   * The field for categories along the bar axis: a label, or a number such as a year. With
   * `xType: "time"` it is a time instead: a Date, an ISO 8601 string or epoch milliseconds.
   */
  readonly x: KeysOfType<T, string | number | Date>;
  /**
   * `"time"` puts the bars on a time axis: each row falls in the `interval` that contains its
   * time, one bar slot for every interval from the first to the last (empty ones too, so a gap
   * in the data is a gap in the chart), labelled for you. A run per day needs no pre-formatted
   * labels. Rows in the same interval and series are summed, or counted when `y` is omitted.
   * Dates are instants in UTC, except that when every Date falls at local midnight they are
   * read as calendar dates, as in `lineChart`. The default, `"category"`, treats `x` as labels.
   */
  readonly xType?: "category" | "time";
  /**
   * With `xType: "time"`, the length of each bar's interval (default `"day"`). Intervals start
   * at UTC midnight; weeks start on Monday. Each bar is labelled by its first moment: an hour
   * as `2026-01-05 14:00 UTC`, a day or week as `2026-01-05`, a month as `2026-01`, a year as
   * `2026`.
   */
  readonly interval?: "hour" | "day" | "week" | "month" | "year";
  /** With `xType: "time"`, formats each interval's start for labels, hover details and the data table. */
  readonly formatX?: (start: Date) => string;
  /**
   * The field for bar length. Omit it to count rows instead: `barChart({ data: entries, x:
   * "year", series: "type" })` draws entries per year by type. Rows sharing a category and series
   * are summed.
   */
  readonly y?: KeysOfType<T, number>;
  /** A field that splits each bar into series, stacked or grouped. */
  readonly series?: KeysOfType<T, string>;
  /** How series share a category: stacked (default) or side by side. */
  readonly layout?: "stacked" | "grouped";
  /** Vertical bars (default), or horizontal bars for long category names and rankings. */
  readonly orientation?: "vertical" | "horizontal";
  /**
   * Every category in display order. Without it, categories appear in data order, or ascending
   * when all are numbers. Give it to show empty years or a fixed order. Not used with
   * `xType: "time"`, which builds its own domain.
   */
  readonly xDomain?: readonly (string | number)[];
  /** Every series in display and color order. Without it, first-seen order. */
  readonly seriesDomain?: readonly string[];
  /**
   * Color overrides by series name. A chart without `series` has one series, named by its value
   * label (`yLabel`).
   */
  readonly colors?: Readonly<Record<string, SeriesColor>>;
  /** The category axis label; defaults to the `x` field name; `null` hides it. */
  readonly xLabel?: string | null;
  /** The value axis label; defaults to the `y` field name or "Count"; `null` hides it. */
  readonly yLabel?: string | null;
  /** Formats values in hover details and the data table. */
  readonly formatValue?: (value: number) => string;
  /**
   * What a click on a bar filters by, once enhanced: its series (default when there are series)
   * or its category (`"x"`, e.g. "this year"). A chart without series always filters by category.
   */
  readonly filterBy?: "series" | "x";
  /**
   * A link for each category, so that with scripts off a bar is a link (to a filtered page, say).
   * Once enhanced, bars filter instead and the link moves to `data-enarratio-href`. Only relative,
   * `http:` and `https:` links are allowed.
   */
  readonly href?: (x: string) => string;
  /**
   * The most category labels to print. With more categories than this, every nth label is
   * printed, starting from the first, so labels stay legible when the chart is drawn small.
   */
  readonly maxXTicks?: number;
  /**
   * Print each series' name inside its bars where the name fits, so series are told apart by
   * text as well as color (A1). Stacked layouts only; small segments keep their hover details and
   * the data table.
   */
  readonly directLabels?: boolean;
}

/** One bar, or one series' segment of a bar: the rows sharing a category and series. */
export interface BarPoint {
  readonly x: string;
  readonly series: string;
  value: number;
}

const KIND = "barChart";

type Interval = NonNullable<BarChartOptions<object>["interval"]>;

const pad = (n: number): string => String(n).padStart(2, "0");

/** The start of the interval containing `t` (UTC; weeks start on Monday), in epoch milliseconds. */
function floorTo(t: number, interval: Interval): number {
  const d = new Date(t);
  switch (interval) {
    case "hour":
      return Math.floor(t / 3_600_000) * 3_600_000;
    case "day":
      return Math.floor(t / DAY) * DAY;
    case "week": {
      const day = Math.floor(t / DAY) * DAY;
      const sinceMonday = (new Date(day).getUTCDay() + 6) % 7;
      return day - sinceMonday * DAY;
    }
    case "month":
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    case "year":
      return Date.UTC(d.getUTCFullYear(), 0, 1);
  }
}

/** The start of the interval after the one starting at `start`. */
function nextAfter(start: number, interval: Interval): number {
  const d = new Date(start);
  switch (interval) {
    case "hour":
      return start + 3_600_000;
    case "day":
      return start + DAY;
    case "week":
      return start + 7 * DAY;
    case "month":
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
    case "year":
      return Date.UTC(d.getUTCFullYear() + 1, 0, 1);
  }
}

/** The default label for an interval starting at `start`. */
function labelFor(start: number, interval: Interval): string {
  const iso = new Date(start).toISOString();
  switch (interval) {
    case "hour":
      return `${iso.slice(0, 10)} ${pad(new Date(start).getUTCHours())}:00 UTC`;
    case "day":
    case "week":
      return iso.slice(0, 10);
    case "month":
      return iso.slice(0, 7);
    case "year":
      return iso.slice(0, 4);
  }
}

/** The most bars a time axis will draw, so a typo in a date cannot ask for millions. */
const MAX_PERIODS = 2000;

/**
 * The time axis: each row's interval start, and the label of every interval from the first to
 * the last, in order.
 */
function timeAxis<T extends object>(
  data: readonly T[],
  x: string,
  options: BarChartOptions<T>,
): { starts: number[]; names: string[]; byRow: string[] } {
  const interval = options.interval ?? "day";
  const rows = calendarDates(data.map((row, i) => readDate(KIND, row, x, i)));
  const starts = rows.map((d) => floorTo(d.getTime(), interval));
  const label = (start: number): string =>
    options.formatX ? options.formatX(new Date(start)) : labelFor(start, interval);
  const first = minOf(starts);
  const last = maxOf(starts);
  const periods: number[] = [];
  for (let t = first; t <= last; t = nextAfter(t, interval)) {
    periods.push(t);
    if (periods.length > MAX_PERIODS) {
      throw new Error(
        `${KIND}: the time axis would need more than ${MAX_PERIODS} bars between the first and last row; use a longer interval`,
      );
    }
  }
  const names = periods.map(label);
  if (new Set(names).size !== names.length) {
    throw new Error(`${KIND}: formatX gives two intervals the same label`);
  }
  return { starts: periods, names, byRow: starts.map(label) };
}

/**
 * Allows relative and http(s) links only, so data can never produce a `javascript:` URL. Browsers
 * ignore control characters and spaces inside a scheme, so the scheme is read without them. A
 * leading `//` (or its backslash forms) names another host, so it is refused too (A11), and so is
 * a user or password before the host, which lets `https://trusted.example@other.example/` read as
 * the trusted name.
 */
function safeHref(href: string): string {
  const compact = [...href].filter((ch) => ch.charCodeAt(0) > 0x20).join("");
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(compact)?.[1]?.toLowerCase();
  const otherHost = /^[/\\][/\\]/.test(compact);
  if (
    otherHost ||
    (scheme !== undefined && scheme !== "http" && scheme !== "https") ||
    hasUserinfo(compact, scheme)
  ) {
    throw new Error(`${KIND}: href "${href}" is not a relative or http(s) link`);
  }
  return href;
}

/** Whether an absolute http(s) link names a user or password before its host. */
function hasUserinfo(compact: string, scheme: string | undefined): boolean {
  if (scheme === undefined) return false;
  try {
    const url = new URL(compact);
    return url.username !== "" || url.password !== "";
  } catch {
    return true;
  }
}

/** Every nth category, when there are more than `max`, or undefined to print them all. */
function thinTicks(names: readonly string[], max: number | undefined): string[] | undefined {
  if (max === undefined) return undefined;
  if (!Number.isInteger(max) || max < 1)
    throw new Error(`${KIND}: maxXTicks must be a whole number of 1 or more`);
  if (names.length <= max) return undefined;
  const step = Math.ceil(names.length / max);
  return names.filter((_, i) => i % step === 0);
}

const STEPS = [1, 2, 5];

/** Whole-number ticks from zero past the tallest bar or stack, about five of them. */
function countTicks(points: readonly BarPoint[], grouped: boolean): number[] {
  const totals = new Map<string, number>();
  for (const p of points) {
    const id = grouped ? markKey(p.x, p.series) : p.x;
    totals.set(id, (totals.get(id) ?? 0) + p.value);
  }
  const max = Math.max(1, maxOf(totals.values()));
  let step = 1;
  for (let magnitude = 1; ; magnitude *= 10) {
    const found = STEPS.map((s) => s * magnitude).find((s) => max / s <= 6);
    if (found !== undefined) {
      step = found;
      break;
    }
  }
  const ticks: number[] = [];
  for (let t = 0; t < max + step; t += step) ticks.push(t);
  return ticks;
}

/** A bar chart read from its options, ready for a renderer to draw. */
export interface BarModel {
  /** The bars, in category order, then series order: the reading order and drawing order. */
  readonly points: readonly BarPoint[];
  /** Every category, in display order. */
  readonly xNames: readonly string[];
  /** Every series, in display and color order. */
  readonly seriesNames: readonly string[];
  readonly plan: SeriesPlan;
  readonly horizontal: boolean;
  /** Series side by side, each category a facet. */
  readonly grouped: boolean;
  /** Whether a series name goes inside each stacked segment it fits in. */
  readonly directLabels: boolean;
  readonly categoryLabel: string | null;
  readonly valueLabel: string | null;
  readonly format: (value: number) => string;
  readonly width: number;
  readonly height: number;
  readonly marginLeft: number;
  /** The category labels to print, when not all of them are. */
  readonly thinned: readonly string[] | undefined;
  /** Whole-number value ticks for counted bars; undefined when values come from `y`. */
  readonly countTicks: readonly number[] | undefined;
  /** A bar's hover details, and its name when it is a link. */
  describe(p: BarPoint): string;
  /** A bar's keys for the enhancement layer. */
  datum(p: BarPoint): MarkDatum;
  /** A bar's link, checked, when the chart has `href`. */
  readonly link: ((p: BarPoint) => string) | undefined;
  /** Wraps the drawn SVG in the figure, with its legend and data table. */
  figure(svg: string): string;
}

/** Reads and checks a bar chart's options and lays it out. Throws on anything it cannot draw. */
export function barModel<T extends object>(options: BarChartOptions<T>): BarModel {
  const { data, x, y, series } = options;
  validateFigure(KIND, options);
  if (data.length === 0) throw new Error(`${KIND}: data is empty`);
  if (options.directLabels && options.layout === "grouped") {
    throw new Error(`${KIND}: directLabels needs the stacked layout; grouped bars have a legend`);
  }
  const horizontal = options.orientation === "horizontal";
  const grouped = options.layout === "grouped" && series !== undefined;
  const format = options.formatValue ?? defaultFormat;
  const valueLabel = options.yLabel === undefined ? (y ?? "Count") : options.yLabel;
  const categoryLabel = options.xLabel === undefined ? x : options.xLabel;
  const soleSeries = valueLabel ?? "Value";

  const time = options.xType === "time";
  if (time && options.xDomain) {
    throw new Error(`${KIND}: xDomain is not used with xType "time", which builds its own axis`);
  }
  if (!time && (options.interval !== undefined || options.formatX !== undefined)) {
    throw new Error(`${KIND}: interval and formatX belong to xType "time"`);
  }
  const axis = time ? timeAxis(data, x, options) : undefined;
  const rawX = axis ? axis.byRow : data.map((row, i) => readCategory(KIND, row, x, i));
  const xNames = axis ? axis.names : domainOf(KIND, x, rawX, options.xDomain);
  const seriesOf = (row: T, i: number): string =>
    series === undefined ? soleSeries : readLabel(KIND, row, series, i);
  const seriesNames =
    series === undefined
      ? [soleSeries]
      : domainOf(
          KIND,
          series,
          data.map((row, i) => seriesOf(row, i)),
          options.seriesDomain,
        );
  const plan = planSeries(KIND, seriesNames, options.colors);

  const cells = new Map<string, BarPoint>();
  data.forEach((row, i) => {
    const point = { x: String(rawX[i]), series: seriesOf(row, i) };
    const id = markKey(point.x, point.series);
    const value = y === undefined ? 1 : readNumber(KIND, row, y, i);
    const existing = cells.get(id);
    if (existing) existing.value += value;
    else cells.set(id, { ...point, value });
  });
  // In category order, then series order: the reading order, and the order labels are drawn in.
  const columnOf = new Map(xNames.map((name, i) => [name, i]));
  const rowOf = new Map(seriesNames.map((name, i) => [name, i]));
  const points = [...cells.values()].sort(
    (a, b) =>
      (columnOf.get(a.x) ?? 0) - (columnOf.get(b.x) ?? 0) ||
      (rowOf.get(a.series) ?? 0) - (rowOf.get(b.series) ?? 0),
  );

  const describe = (p: BarPoint): string =>
    series === undefined
      ? `${categoryLabel ?? x} ${p.x}: ${format(p.value)}`
      : `${categoryLabel ?? x} ${p.x}, ${p.series}: ${format(p.value)}`;
  const datum = (p: BarPoint): MarkDatum => ({
    key: markKey(p.x, p.series),
    filter:
      series === undefined || options.filterBy === "x"
        ? { field: x, value: p.x }
        : { field: series, value: p.series },
    x: p.x,
    ...(series === undefined ? {} : { series: p.series }),
    column: columnOf.get(p.x) ?? 0,
    row: rowOf.get(p.series) ?? 0,
  });
  const linkOf = options.href;

  const longest = Math.max(maxOf(xNames.map((n) => n.length)), 1);
  const width = options.width ?? DEFAULT_WIDTH;
  const height =
    options.height ?? (horizontal ? Math.max(120, xNames.length * 28 + 60) : DEFAULT_HEIGHT);
  // A time axis has many bars and long labels, so it thins them to fit unless told otherwise.
  const fit = time ? Math.max(2, Math.floor((width - 80) / (longest * 7 + 12))) : undefined;
  const thinned = thinTicks(xNames, options.maxXTicks ?? fit);

  const rows = xNames.map((name) => [
    name,
    ...seriesNames.map((s) => {
      const cell = cells.get(markKey(name, s));
      return cell ? format(cell.value) : y === undefined ? format(0) : "";
    }),
  ]);

  return {
    points,
    xNames,
    seriesNames,
    plan,
    horizontal,
    grouped,
    directLabels: options.directLabels === true && series !== undefined,
    categoryLabel,
    valueLabel,
    format,
    width,
    height,
    marginLeft: horizontal ? Math.min(220, longest * 7 + 16) : valueLabel === null ? 44 : 60,
    thinned,
    countTicks: y === undefined ? countTicks(points, grouped) : undefined,
    describe,
    datum,
    link: linkOf ? (p) => safeHref(linkOf(p.x)) : undefined,
    figure: (svg) =>
      figure(options, {
        kind: "bar",
        svg,
        orientation: horizontal ? "horizontal" : "vertical",
        legend: series === undefined ? [] : plan.legend,
        ...(series === undefined ? {} : { seriesField: series }),
        slotColors: plan.slotColors,
        table: {
          columns: [
            categoryLabel ?? x,
            ...(series === undefined ? [valueLabel ?? "Value"] : seriesNames),
          ],
          rows,
        },
      }),
  };
}

/** A name fits in a segment when the segment is this much taller and wider than the text. */
const LABEL_HEIGHT = 16;
const CHAR_WIDTH = 6.6;

/**
 * Whether a series name fits inside a stacked segment of the given size, for `directLabels`.
 * Both renderers decide with this, from the drawn geometry.
 */
export function labelFits(name: string, width: number, height: number): boolean {
  return height >= LABEL_HEIGHT && width >= name.length * CHAR_WIDTH + 8;
}
