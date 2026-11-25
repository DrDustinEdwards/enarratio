/**
 * Everything about a bar chart except the drawing: the data, the layout numbers and the data
 * table. Shared by `enarratio/plot` and `enarratio/lite`, so both draw the same chart.
 */

import { withNotes } from "./annotation.js";
import {
  domainOf,
  isYears,
  markKey,
  maxOf,
  minOf,
  readCategory,
  readLabel,
  readNumber,
  safeHref,
} from "./data.js";
import type { MarkDatum } from "./datum.js";
import { figure, unitLabel, validateFigure } from "./figure.js";
import { slotStyle } from "./slot-style.js";
import { type Bounds, intervalText, readInterval } from "./interval.js";
import { planSeries, type SeriesPlan, seriesLegend } from "./series.js";
import { charWidth, DEFAULT_HEIGHT, DEFAULT_WIDTH, fitTicks } from "./size.js";
import { stringsFor, valueAxis, valueFormat } from "./text.js";
import { countTicks, requireMaxXTicks, timeAxis } from "./bar-axis.js";
import { finishBars } from "./bar-marks.js";
import { type BarChartOptions, type BarPoint, KIND } from "./bar-options.js";
import { texture } from "./texture.js";

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
