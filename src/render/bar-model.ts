/**
 * Everything about a bar chart except the drawing: the data, the layout numbers and the data
 * table. Shared by `enarratio/plot` and `enarratio/lite`, so both draw the same chart.
 */

import { type Annotated, withNotes } from "./annotation.js";
import {
  calendarDates,
  DAY,
  domainOf,
  isYears,
  type KeysOfType,
  markKey,
  maxOf,
  minOf,
  readCategory,
  readDate,
  readLabel,
  readNumber,
  safeHref,
} from "./data.js";
import type { MarkDatum } from "./datum.js";
import {
  figure,
  type SeriesAxesOptions,
  type SeriesColor,
  unitLabel,
  validateFigure,
} from "./figure.js";
import { slotStyle } from "./slot-style.js";
import { type Bounds, type IntervalFields, intervalText, readInterval } from "./interval.js";
import { planSeries, type SeriesPlan, seriesLegend } from "./series.js";
import { charWidth, DEFAULT_HEIGHT, DEFAULT_WIDTH, fitTicks } from "./size.js";
import { stringsFor, valueAxis, valueFormat } from "./text.js";
import { finishBars } from "./bar-marks.js";
import { texture } from "./texture.js";

/** Options for `barChart`, from `enarratio/plot` or `enarratio/lite`. */
export interface BarChartOptions<T extends object> extends SeriesAxesOptions, Annotated {
  readonly data: readonly T[];
  /**
   * The field for categories along the bar axis: a label, or a number such as a year. With
   * `xType: "time"` it is a time: a Date, an ISO 8601 string or epoch milliseconds.
   */
  readonly x: KeysOfType<T, string | number | Date>;
  /**
   * `"time"` puts the bars on a time axis: one bar slot for every `interval` from the first row to
   * the last (empty ones too, so a gap in the data is a gap in the chart). Rows in the same
   * interval and series are summed, or counted when `y` is omitted. Dates are instants in UTC,
   * except that when every Date falls at local midnight they are read as calendar dates, as in
   * `lineChart`. The default, `"category"`, treats `x` as labels.
   */
  readonly xType?: "category" | "time";
  /**
   * With `xType: "time"`, the length of each bar's interval (default `"day"`), from UTC midnight;
   * weeks start on Monday. Bars are labeled by their first moment, e.g. `2026-01-05 14:00 UTC`.
   */
  readonly interval?: "hour" | "day" | "week" | "month" | "year";
  /** With `xType: "time"`, formats each interval's start for labels, hover details and the data table. */
  readonly formatX?: (start: Date) => string;
  /**
   * The field for bar length. Omit it to count rows instead: `barChart({ data: entries, x:
   * "year", series: "type" })`. Rows sharing a category and series are summed.
   */
  readonly y?: KeysOfType<T, number>;
  /**
   * With `y`, keeps the value axis on whole numbers, for values that are counts you already
   * totaled. Values must be whole numbers of 0 or more. Counted bars always have whole-number ticks.
   */
  readonly wholeNumbers?: boolean;
  /** A field that splits each bar into series, stacked or grouped. */
  readonly series?: KeysOfType<T, string>;
  /** How series share a category: stacked (default) or side by side. */
  readonly layout?: "stacked" | "grouped";
  /** Vertical bars (default), or horizontal bars for long category names and rankings. */
  readonly orientation?: "vertical" | "horizontal";
  /**
   * Every category in display order. Without it, data order, or ascending when all are numbers.
   * Not used with `xType: "time"`, which builds its own domain.
   */
  readonly xDomain?: readonly (string | number)[];
  /** Color overrides by series name. A chart without `series` has one series, named by `yLabel`. */
  readonly colors?: Readonly<Record<string, SeriesColor>>;
  /**
   * The category axis label; defaults to the `x` field name; `null` hides it. A time axis or an
   * axis of years draws no title, but the table, hover details and summary still use it.
   */
  readonly xLabel?: string | null;
  /** The value axis label; defaults to the `y` field name or "Count"; `null` hides it. */
  readonly yLabel?: string | null;
  /**
   * What a click on a bar filters by once enhanced: its series (default when there are series) or
   * its category (`"x"`). A chart without series always filters by category.
   */
  readonly filterBy?: "series" | "x";
  /**
   * A link for each category: each category in the data table is that link, and each bar carries
   * it in `data-enarratio-href`, which `enhance()` follows on a click when the bar does not
   * filter. Only relative, `http:` and `https:` links are allowed.
   */
  readonly href?: (x: string) => string;
  /** The most category labels to print; with more categories, every nth is printed, from the first. */
  readonly maxXTicks?: number;
  /**
   * Name the series on the drawing (default true): beside the last stack of vertical stacked bars,
   * or over the last group of two grouped series. A chart whose series are not all named this way
   * (horizontal, more than two grouped, a series missing from the last stack, names wider than a
   * quarter of the drawing, or `false`) fills series 2 to 8 with textures instead.
   */
  readonly directLabels?: boolean;
  /**
   * An error bar on each bar, from `lower` and `upper` fields, carried in the data table and stated
   * in the summary. Needs `y`, and the grouped layout when there are series.
   */
  readonly errorBars?: IntervalFields<T>;
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

/** Throws unless `maxXTicks`, when given, is a whole number of 1 or more. */
function requireMaxXTicks(max: number | undefined): void {
  if (max !== undefined && !(Number.isInteger(max) && max >= 1))
    throw new Error(`${KIND}: maxXTicks must be a whole number of 1 or more`);
}

const STEPS = [1, 2, 5];

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
  /** Each category's place in `xNames`, and each series' in `seriesNames`. */
  readonly columnOf: ReadonlyMap<string, number>;
  readonly rowOf: ReadonlyMap<string, number>;
  readonly plan: SeriesPlan;
  readonly horizontal: boolean;
  /** Series side by side, each category a facet. */
  readonly grouped: boolean;
  /** Whether the series are named on the drawing where they can be (finishBars). */
  readonly directLabels: boolean;
  readonly categoryLabel: string | null;
  /** The category axis title the drawing shows: none on a time axis or an axis of years. The table and text keep `categoryLabel`. */
  readonly categoryTitle: string | null;
  readonly valueLabel: string | null;
  readonly format: (value: number) => string;
  readonly width: number;
  readonly height: number;
  readonly marginLeft: number;
  /** Room on the right for the series names beside the last stack, or the values past the bars. */
  readonly marginRight: number;
  /** The band padding the bars sit in, as fractions of a step, wide enough that no bar is wider than {@link BAR_MAX}. */
  readonly padding: { readonly inner: number; readonly outer: number };
  /** The category labels to print, when not all of them are. */
  readonly thinned: readonly string[] | undefined;
  /** The value axis's tick format for huge values, and whether every value is zero. */
  readonly valueAxis: ReturnType<typeof valueAxis>;
  /** A category's axis label: shortened with an ellipsis when it would not fit. */
  tickLabel(name: string): string;
  /** Whole-number value ticks for counted bars; undefined when values come from `y`. */
  readonly countTicks: readonly number[] | undefined;
  /** A bar's hover details, and its name when it is a link. */
  describe(p: BarPoint): string;
  /** A bar's keys for the enhancement layer. */
  datum(p: BarPoint): MarkDatum;
  /** A bar's link, checked, when the chart has `href`. */
  readonly link: ((p: BarPoint) => string) | undefined;
  /** Each bar's error bar, when the chart has `errorBars`. */
  readonly bounds: ReadonlyMap<BarPoint, Bounds> | undefined;
  /** The text alternative, with the annotations' notes added. */
  readonly alt: string | undefined;
  /** Wraps the drawn SVG in the figure, with its legend and data table. */
  figure(svg: string): string;
}

/** Reads and checks a bar chart's options and lays it out. Throws on anything it cannot draw. */
export function barModel<T extends object>(given: BarChartOptions<T>): BarModel {
  const options = withNotes(given);
  const { data, x, y, series } = options;
  validateFigure(KIND, options, data);
  if (options.wholeNumbers && y === undefined) {
    throw new Error(
      `${KIND}: wholeNumbers is for bars with y; counted bars always have whole ticks`,
    );
  }
  const horizontal = options.orientation === "horizontal";
  const grouped = options.layout === "grouped" && series !== undefined;
  if (options.annotations?.length && grouped) {
    throw new Error(`${KIND}: annotations need the stacked layout; grouped bars are facets`);
  }
  const { terms } = stringsFor(options.strings);
  const format = valueFormat(options);
  const valueLabel = unitLabel(options.yLabel, y ?? terms.count, options.yUnit);
  const categoryLabel = unitLabel(options.xLabel, x, options.xUnit);
  const soleSeries = valueLabel ?? terms.value;

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

  const errorBars = options.errorBars;
  if (errorBars && (y === undefined || (series !== undefined && !grouped))) {
    throw new Error(
      `${KIND}: errorBars need a y field, and the grouped layout when there are series`,
    );
  }
  const cells = new Map<string, BarPoint>();
  const bounds = errorBars ? new Map<BarPoint, Bounds>() : undefined;
  data.forEach((row, i) => {
    const point = { x: String(rawX[i]), series: seriesOf(row, i) };
    const id = markKey(point.x, point.series);
    const value = y === undefined ? 1 : readNumber(KIND, row, y, i);
    const existing = cells.get(id);
    if (existing && errorBars) {
      throw new Error(
        `${KIND}: two rows for ${point.x}, ${point.series}; error bars cannot be summed`,
      );
    }
    if (existing) existing.value += value;
    else cells.set(id, { ...point, value });
    const interval = errorBars ? readInterval(KIND, row, errorBars, i, value) : null;
    if (interval) bounds?.set(cells.get(id) as BarPoint, interval);
  });
  // In category order, then series order: the reading order, and the order labels are drawn in.
  const columnOf = new Map(xNames.map((name, i) => [name, i]));
  const rowOf = new Map(seriesNames.map((name, i) => [name, i]));
  const points = [...cells.values()].sort(
    (a, b) =>
      (columnOf.get(a.x) ?? 0) - (columnOf.get(b.x) ?? 0) ||
      (rowOf.get(a.series) ?? 0) - (rowOf.get(b.series) ?? 0),
  );
  if (options.wholeNumbers && points.some((p) => !Number.isInteger(p.value) || p.value < 0)) {
    throw new Error(`${KIND}: wholeNumbers needs values that are whole numbers of 0 or more`);
  }

  const strings = stringsFor(options.strings);
  const intervalOf = (p: BarPoint): string => {
    const b = bounds?.get(p);
    return b ? ` (${intervalText(b, format, errorBars?.label, strings)})` : "";
  };
  const describe = (p: BarPoint): string =>
    series === undefined
      ? `${categoryLabel ?? x} ${p.x}: ${format(p.value)}${intervalOf(p)}`
      : `${categoryLabel ?? x} ${p.x}, ${p.series}: ${format(p.value)}${intervalOf(p)}`;
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
    at: p.x,
    shown: `${format(p.value)}${intervalOf(p)}`,
  });
  const linkOf = options.href;

  const width = options.width ?? DEFAULT_WIDTH;
  const char = charWidth(width);
  const longest = (names: Iterable<string>): number =>
    Math.max(0, ...[...names].map((n) => n.length));
  // Series names beside the last stack need a leader and the longest name. They are written only
  // while that room is at most a quarter of the drawing; on a narrower one (a phone) they would
  // squeeze the bars, so the legend names the series and the textures come back.
  const stackNames = 14 + longest(seriesNames) * char + 4;
  const stackNamed =
    options.directLabels !== false &&
    series !== undefined &&
    !grouped &&
    !horizontal &&
    stackNames <= width / 4;
  // Two grouped series are named over the last group, each name running half a group's step from
  // its middle; a longer name would run over the next group's bars, so the legend names them.
  const groupNamed =
    options.directLabels !== false &&
    grouped &&
    !horizontal &&
    seriesNames.length === 2 &&
    longest(seriesNames) * char <= (width - 44 - 20) / Math.max(1, xNames.length) / 2;
  const baseRight = Math.ceil(
    Math.max(
      20,
      stackNamed ? stackNames : 0,
      // The second of two grouped series, named from the middle of the last bar.
      groupNamed ? longest(seriesNames.slice(1)) * char - BAR_MAX / 2 + 10 : 0,
      // Values past the ends of horizontal bars.
      horizontal ? 6 + longest(points.map((p) => format(p.value))) * char + 4 : 0,
    ),
  );
  // Category labels below the bars are thinned, as line charts' x ticks are (fitTicks), when they
  // would come closer than the least gap at the width drawn. maxXTicks caps the count lower still.
  // Beside horizontal bars each label has its own row, so only maxXTicks thins them. The table,
  // hover details and each bar's name keep every one.
  requireMaxXTicks(options.maxXTicks);
  // The room the labels share is the plot's: 80 px less than the drawing, or less where the right
  // margin holds series names or values.
  const plot = horizontal ? width - 80 : Math.min(width - 80, width - 44 - baseRight);
  const across = horizontal ? Number.POSITIVE_INFINITY : plot;
  // Below vertical bars, every category keeps its label while its slot holds four characters: a
  // long one wraps onto a second line and is cut there, rather than a neighbor going unnamed.
  // Seven units a character is a capital's width, so lowercase text leaves a gap at the edges.
  const slotRoom = Math.floor(plot / Math.max(1, xNames.length) / 7);
  const named = !horizontal && !time && options.maxXTicks === undefined && slotRoom >= 4;
  const fitted =
    (horizontal && options.maxXTicks === undefined) || named
      ? undefined
      : fitTicks(xNames, (n) => n, width, across, options.maxXTicks);
  const thinned = fitted && fitted.length < xNames.length ? fitted : undefined;

  // Labels longer than their room are cut with an ellipsis; the table, hover details and each bar's
  // name keep the whole text. Beside horizontal bars the labels take at most 220 px, and at most
  // two fifths of a narrow drawing, so the bars keep the rest; a longer one wraps at a space.
  const labelMargin = Math.min(220, Math.max(72, Math.round(width * 0.4)));
  const room = horizontal
    ? Math.floor((labelMargin - 16) / 7)
    : named
      ? slotRoom
      : Math.max(4, Math.floor(plot / (thinned?.length ?? xNames.length) / 7));
  const cut = (text: string): string =>
    text.length <= room ? text : `${text.slice(0, room - 1).trimEnd()}…`;
  const tickLabel = (name: string): string =>
    time
      ? name
      : (horizontal && labelMargin < 220) || named
        ? wrapLabel(name, room, cut)
        : cut(name);
  const labelWidth = horizontal
    ? Math.max(
        ...xNames.map((n) =>
          maxOf(
            tickLabel(n)
              .split("\n")
              .map((l) => l.length),
          ),
        ),
        1,
      )
    : 0;

  // A row of horizontal bars is 28 tall, or 34 where a label wraps, so two wrapped labels do not touch.
  const wraps = horizontal && xNames.some((n) => tickLabel(n).includes("\n"));
  const height =
    options.height ??
    (horizontal ? Math.max(120, xNames.length * (wraps ? 34 : 28) + 60) : DEFAULT_HEIGHT);
  // The last category's label is centered under its bar; one wider than the half step left runs into
  // the right margin, which grows to hold it.
  const lastName = xNames[xNames.length - 1];
  const lastShown =
    !horizontal && lastName !== undefined && (thinned ?? xNames).at(-1) === lastName;
  const overhang = lastShown
    ? (maxOf(
        tickLabel(lastName)
          .split("\n")
          .map((l) => l.length),
      ) *
        char) /
        2 -
      (width - 44 - baseRight) / Math.max(1, xNames.length) / 2 +
      3
    : 0;
  const marginRight = Math.ceil(Math.max(baseRight, overhang));

  // No bar wider than BAR_MAX; a margin widened later for the tick labels only narrows the bars further.
  const marginLeft = horizontal ? Math.min(labelMargin, labelWidth * 7 + 16) : 44;
  const length = horizontal ? height - 20 - 44 : width - marginLeft - marginRight;
  const padding = grouped
    ? (() => {
        const facet = (length * (1 - FACET_PADDING)) / (xNames.length + FACET_PADDING);
        const n = seriesNames.length;
        const inner = 0.05;
        const outer = (facet * (1 - inner)) / BAR_MAX - n + inner;
        return { inner, outer: Math.max(0.05, outer / 2) };
      })()
    : (() => {
        const n = xNames.length;
        const p = Math.max(0.2, Math.min(0.9, (length - BAR_MAX * n) / (length + BAR_MAX)));
        return { inner: p, outer: p };
      })();

  const rows = xNames.map((name) => [
    name,
    ...seriesNames.map((s) => {
      const cell = cells.get(markKey(name, s));
      return cell ? format(cell.value) : y === undefined ? format(0) : "";
    }),
    ...(errorBars
      ? seriesNames.map((s) => {
          const cell = cells.get(markKey(name, s));
          const b = cell ? bounds?.get(cell) : undefined;
          return b ? strings.range(format(b.lower), format(b.upper)) : "";
        })
      : []),
  ]);
  const intervalColumns = errorBars
    ? seriesNames.map((s) =>
        series === undefined
          ? (errorBars.label ?? terms.interval)
          : `${s} ${errorBars.label ?? terms.interval.toLowerCase()}`,
      )
    : [];

  // The value axis runs over the stacks' extent (each bar's, when grouped), and zero.
  const ends = [0];
  const sums = new Map<string, [number, number]>();
  for (const p of points) {
    const id = grouped ? markKey(p.x, p.series) : p.x;
    const [neg, pos] = sums.get(id) ?? [0, 0];
    sums.set(id, p.value < 0 ? [neg + p.value, pos] : [neg, pos + p.value]);
  }
  for (const [neg, pos] of sums.values()) ends.push(neg, pos);
  // Error bars reach past their bars, and the axis takes them in, as Plot's does.
  for (const b of bounds?.values() ?? []) ends.push(b.lower, b.upper);
  const ordered = time || rawX.every((v) => typeof v === "number");
  const boundsOf = (p: BarPoint | undefined) => {
    const b = p ? bounds?.get(p) : undefined;
    return b ? { lower: b.lower, upper: b.upper } : {};
  };
  const ticks = y === undefined || options.wholeNumbers ? countTicks(points, grouped) : undefined;
  const axes = [
    {
      position: horizontal ? "y" : "x",
      label: categoryLabel ?? "",
      from: xNames[0] ?? "",
      to: xNames.at(-1) ?? "",
    },
    {
      position: horizontal ? "x" : "y",
      label: valueLabel ?? "",
      from: format(minOf(ends)),
      // With whole-number ticks the drawn axis ends at the last tick, past the tallest bar; the summary states that end.
      to: format(ticks ? (ticks.at(-1) ?? 0) : maxOf(ends)),
    },
  ] as const;

  const model: BarModel = {
    points,
    xNames,
    seriesNames,
    columnOf,
    rowOf,
    plan,
    horizontal,
    grouped,
    directLabels:
      options.directLabels !== false &&
      series !== undefined &&
      ((grouped && (groupNamed || seriesNames.length !== 2)) || horizontal || stackNamed),
    categoryLabel,
    categoryTitle:
      time || rawX.every((v) => typeof v === "number" && isYears([v])) ? null : categoryLabel,
    valueLabel,
    format,
    width,
    height,
    marginLeft,
    marginRight,
    padding,
    thinned,
    tickLabel,
    valueAxis: valueAxis(ends, options.locale),
    countTicks: ticks,
    describe,
    datum,
    link: linkOf ? (p) => safeHref(KIND, linkOf(p.x)) : undefined,
    bounds,
    alt: options.alt,
    figure: (svg) => {
      const finished = finishBars(svg, model);
      return figure(options, {
        kind: "bar",
        svg: texture(finished.svg, slotStyle(plan.slotColors)),
        textured: !finished.labeled,
        orientation: horizontal ? "horizontal" : "vertical",
        ...seriesLegend(plan, series !== undefined, series),
        description: {
          axes,
          ordered,
          format,
          ...(errorBars ? { interval: errorBars.label ?? terms.interval.toLowerCase() } : {}),
          series: seriesNames.map((name) => ({
            name,
            points: xNames.map((at) => ({
              at,
              value: cells.get(markKey(at, name))?.value ?? (y === undefined ? 0 : null),
              ...boundsOf(cells.get(markKey(at, name))),
            })),
          })),
        },
        table: {
          columns: [
            categoryLabel ?? x,
            ...(series === undefined ? [valueLabel ?? terms.value] : seriesNames),
            ...intervalColumns,
          ],
          rows,
          // The bars' links, which the image does not expose, are reached here.
          ...(linkOf ? { links: xNames.map((name) => safeHref(KIND, linkOf(name))) } : {}),
        },
      });
    },
  };
  return model;
}

/** The widest a bar is drawn, in user units: wider ones read as blocks, not lengths. */
export const BAR_MAX = 40;
/** The padding between groups of grouped bars, each a facet. */
export const FACET_PADDING = 0.15;

/**
 * A category name in two lines of at most `room` characters, broken at the last space that fits;
 * what is left past the second line is cut by `cut`. A name that fits stays on one line.
 */
function wrapLabel(name: string, room: number, cut: (text: string) => string): string {
  if (name.length <= room) return name;
  const space = name.lastIndexOf(" ", room);
  if (space <= 0) return cut(name);
  return `${name.slice(0, space)}\n${cut(name.slice(space + 1))}`;
}
