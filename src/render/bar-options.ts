import { type Annotated } from "./annotation.js";
import { type KeysOfType } from "./data.js";
import { type SeriesAxesOptions, type SeriesColor } from "./figure.js";
import { type IntervalFields } from "./interval.js";

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

export const KIND = "barChart";
