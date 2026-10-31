/**
 * Everything about a line or area chart except the drawing: reading and checking the rows, the
 * forecast split, hover text, keys and the data table. Shared by the Observable Plot renderer
 * (`enarratio/plot`) and the light one (`enarratio/lite`).
 */

import { type Annotated, withNotes } from "./annotation.js";
import {
  calendarDates,
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
import type { MarkDatum } from "./datum.js";
import {
  type AxisUnits,
  type FigureOptions,
  figure,
  type ScaleDescription,
  type SeriesColor,
  slotStyle,
  unitLabel,
  validateFigure,
} from "./figure.js";
import { planSeries, type SeriesPlan } from "./series.js";
import { charWidth, textGrowth } from "./size.js";
import {
  dateFormat,
  defaultFormat,
  numberFormat,
  type Strings,
  stringsFor,
  valueAxis,
} from "./text.js";
import { texture } from "./texture.js";

export { fitTicks } from "./size.js";

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
export interface SeriesChartOptions<T extends object> extends FigureOptions, AxisUnits, Annotated {
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
   * Formats x values in hover details, the data table and the summary. Dates are written out
   * for the locale ("October 6, 2025"), with the time and "UTC" added when any value falls
   * within a day; years print without a thousands separator.
   */
  readonly formatX?: (value: number | Date) => string;
  /** Horizontal reference lines, each labeled on the chart. */
  readonly references?: readonly ReferenceLine[];
  /** Vertical event markers, each labeled on the chart. */
  readonly markers?: readonly EventMarker[];
  /**
   * The most x tick labels to print. Without it, ticks are thinned to what fits the width, so
   * labels never overlap on a narrow chart; with it, to the fewer of the two.
   */
  readonly maxXTicks?: number;
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
   * hollow, a labeled rule marks the boundary, and the data table marks the rows after it
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
 * Whole-day x ticks for date-only data drawn `plotWidth` pixels wide, where the axis would
 * otherwise tick by the hour ("12 AM", "12 PM") between dates: one tick a day from the first
 * date to the last. Undefined when the axis would tick by the day or coarser on its own (about
 * one tick per 80 pixels, as Plot and the light charts count them), so those ticks are unchanged.
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
  readonly yLabel: string | null;
  /** `forecastFrom` as a number (epoch milliseconds for time), when given. */
  readonly forecastAt?: number;
  readonly band?: { readonly lower: string; readonly upper: string; readonly label?: string };
}

type Forecastable<T extends object> = SeriesChartOptions<T> &
  Partial<Pick<LineChartOptions<T>, "band" | "forecastFrom" | "yType">>;

/** Reads and checks the rows shared by line and area charts. */
function prepare<T extends object>(kind: string, options: Forecastable<T>): Prepared {
  const { data, x, y, series } = options;
  validateFigure(kind, options);
  if (data.length === 0) throw new Error(`${kind}: data is empty`);
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
function markerPoints(
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
function boundColumn(
  prepared: Prepared,
  series: string,
  multi: boolean,
  bound: "lower" | "upper",
): string {
  const { terms } = prepared.strings;
  const label = prepared.band?.label;
  const named = bound === "lower" ? terms.lowerBound : terms.upperBound;
  if (label) return `${multi ? `${series} ` : ""}${label}, ${terms[bound]}`;
  return multi ? `${series} ${named.toLowerCase()}` : named;
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
      ...(forecast ? [prepared.strings.terms.forecast] : []),
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
      ...(forecast ? [forecastAt(prepared, at) ? prepared.strings.terms.yes : ""] : []),
    ]),
  };
}

/** Whether an x value comes after the forecast boundary. */
function forecastAt(prepared: Prepared, at: number): boolean {
  return prepared.forecastAt !== undefined && at > prepared.forecastAt;
}

function describePoint(prepared: Prepared, multi: boolean, xColumn: string) {
  const { strings, format } = prepared;
  const { terms } = strings;
  return (p: Point): string => {
    const notes: string[] = [];
    if (p.forecast) notes.push(terms.forecast.toLowerCase());
    if (prepared.band && p.lower !== null && p.upper !== null) {
      notes.push(
        `${prepared.band.label ?? terms.range.toLowerCase()} ${strings.range(format(p.lower), format(p.upper))}`,
      );
    }
    return `${multi ? `${p.series}, ` : ""}${xColumn} ${p.xText}: ${p.value === null ? terms.noData : format(p.value)}${notes.length > 0 ? ` (${notes.join("; ")})` : ""}`;
  };
}

function datum(p: Point, x: string, series: string | undefined): MarkDatum {
  const multi = series !== undefined;
  return {
    key: markKey(p.at, p.series),
    filter: multi ? { field: series, value: p.series } : { field: x, value: p.xKey },
    x: p.xKey,
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
  /** The caller's limit on x tick labels, checked. */
  readonly maxXTicks: number | undefined;
  readonly markers: readonly MarkerPoint[];
  /** The y axis's tick format for huge values, and whether every value is zero (B41). */
  readonly valueAxis: ReturnType<typeof valueAxis>;
  describe(p: Point): string;
  datum(p: Point): MarkDatum;
  /** Wraps the drawn SVG in the figure, with its legend and data table. */
  figure(svg: string, x: ScaleDescription | undefined): string;
  /** The text alternative, with the annotations' notes added. */
  readonly alt: string | undefined;
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
  const max = options.maxXTicks;
  if (max !== undefined && (!Number.isInteger(max) || max < 1)) {
    throw new Error(`${kind}: maxXTicks must be a whole number of 1 or more`);
  }
  const noted = withNotes(options);
  const multi = options.series !== undefined;
  const xColumn = prepared.xLabel ?? options.x;
  const ats = prepared.points.map((p) => p.at);
  const { points, format } = prepared;
  const values = points.flatMap((p) => [p.value, p.lower, p.upper].filter((v) => v !== null));
  const description = {
    axes: [
      {
        position: "x",
        label: prepared.xLabel ?? "",
        from: points[0]?.xText ?? "",
        to: points.at(-1)?.xText ?? "",
      },
      {
        position: "y",
        label: prepared.yLabel ?? "",
        from: format(minOf(values)),
        to: format(maxOf(values)),
      },
    ] as const,
    ordered: true,
    format,
    log: options.yType === "log",
    ...(prepared.band
      ? { interval: prepared.band.label ?? prepared.strings.terms.range.toLowerCase() }
      : {}),
    series: prepared.seriesNames.map((name) => ({
      name,
      points: points
        .filter((p) => p.series === name)
        .map((p) => ({ at: p.xText, value: p.value, lower: p.lower, upper: p.upper })),
    })),
  };
  return {
    prepared,
    plan,
    multi,
    yearTicks: prepared.years ? yearTicks(minOf(ats), maxOf(ats)) : undefined,
    maxXTicks: options.maxXTicks,
    markers: markerPoints(options, prepared.time, kind),
    valueAxis: valueAxis(
      [...values, ...(options.references ?? []).map((r) => r.y)],
      options.locale,
    ),
    describe: describePoint(prepared, multi, xColumn),
    datum: (p) => datum(p, options.x, options.series),
    alt: noted.alt,
    figure: (svg, x) =>
      figure(noted, {
        kind: figureKind,
        // Area bands are filled, so they take textures; lines are told apart by labels (B5).
        svg: figureKind === "area" ? texture(svg, slotStyle(plan.slotColors)) : svg,
        ...(x ? { x } : {}),
        legend: multi ? plan.legend : [],
        ...(multi && options.series ? { seriesField: options.series } : {}),
        slotColors: plan.slotColors,
        description,
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
            label: options.forecastLabel ?? prepared.strings.terms.forecast,
          },
    directLabels: options.directLabels === true && base.multi,
  };
}

/**
 * The right margin a line chart leaves: room for the longest series name as a direct label (6
 * from the line's end, at the text size of the width drawn), else 24. A drawing 480 or wider
 * keeps at least 96, so desktop charts share one gutter; a narrower one takes only what its
 * labels need, and the plot keeps the rest.
 */
export function rightMargin(model: LineModel, width: number): number {
  if (!model.directLabels) return 24;
  const longest = Math.max(...model.prepared.seriesNames.map((n) => n.length));
  const need = Math.ceil(6 + longest * charWidth(width) + 4);
  return Math.max(width >= 480 ? 96 : 24, need);
}

/** The least distance between two direct labels' baselines, in user units. */
const LABEL_GAP = 16;

/**
 * Moves direct labels apart so none overlaps the next (B8): labels closer than the gap form a
 * cluster, centered on where its labels would sit, and clusters that then touch merge. Order is
 * kept. Both renderers place their labels with it.
 */
export function spreadLabels(ys: readonly number[], width: number): number[] {
  // The gap grows with the text, which grows as the drawing shrinks (record 0022).
  const gap = LABEL_GAP * textGrowth(width);
  const at = (i: number): number => ys[i] as number;
  const clusters: { members: number[]; top: number }[] = [];
  for (const i of ys.map((_, i) => i).sort((a, b) => at(a) - at(b))) {
    clusters.push({ members: [i], top: at(i) });
    for (let n = clusters.length; n > 1; n -= 1) {
      const [a, b] = clusters.slice(-2) as [(typeof clusters)[0], (typeof clusters)[0]];
      if (a.top + a.members.length * gap <= b.top) break;
      const members = [...a.members, ...b.members];
      const mean = members.reduce((sum, m) => sum + at(m), 0) / members.length;
      clusters.splice(-2, 2, { members, top: mean - ((members.length - 1) * gap) / 2 });
    }
  }
  const out = [...ys];
  for (const c of clusters)
    c.members.forEach((m, k) => {
      out[m] = c.top + k * gap;
    });
  return out;
}

const AREA = "areaChart";

/**
 * The fill opacity of an area chart's bands. Light, with a line along each band's top edge,
 * so the gridlines show through and a stack reads as layers rather than one solid block.
 */
export const AREA_OPACITY = 0.3;

/** Options for `areaChart`, from `enarratio/plot` or `enarratio/lite`. */
export interface AreaChartOptions<T extends object> extends SeriesChartOptions<T> {
  /**
   * Stack each x to 100%: every series is drawn, described and tabled as its percentage of that
   * x's total, for how a whole divides when the total itself changes. The y label defaults to
   * "Share of total (%)".
   */
  readonly percent?: boolean;
}

/** The rows as shares of each x's total, in percent; an x whose total is zero stays at zero. */
function asShares(prepared: Prepared): Prepared {
  const totals = new Map<number, number>();
  for (const p of prepared.points) totals.set(p.at, (totals.get(p.at) ?? 0) + (p.value ?? 0));
  return {
    ...prepared,
    points: prepared.points.map((p) => {
      const total = totals.get(p.at) ?? 0;
      return p.value === null ? p : { ...p, value: total > 0 ? (100 * p.value) / total : 0 };
    }),
  };
}

/** Reads and checks an area chart's options. Throws on anything it cannot draw. */
export function areaModel<T extends object>(given: AreaChartOptions<T>): SeriesModel {
  const percent = numberFormat({
    ...(given.locale ? { locale: given.locale } : {}),
    style: "percent",
    maximumFractionDigits: 1,
  });
  const options: AreaChartOptions<T> = given.percent
    ? {
        ...given,
        yLabel: given.yLabel === undefined ? "Share of total (%)" : given.yLabel,
        formatValue: given.formatValue ?? ((v: number) => percent(v / 100)),
      }
    : given;
  const read = prepare(AREA, options);
  const prepared = options.percent ? asShares(read) : read;
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
