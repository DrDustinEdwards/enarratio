/**
 * Everything about a line or area chart except the drawing: the rows, the forecast split, hover
 * text, keys and the data table. Shared by `enarratio/plot` and `enarratio/lite`.
 */

import { withNotes } from "./annotation.js";
import { markKey, maxOf, minOf, readDate, readNumber } from "./data.js";
import type { MarkDatum } from "./datum.js";
import { figure, type ScaleDescription } from "./figure.js";
import { slotStyle } from "./slot-style.js";
import { planSeries, type SeriesPlan, seriesLegend } from "./series.js";
import {
  type Forecastable,
  type LineChartOptions,
  type Point,
  prepare,
  type Prepared,
  type SeriesChartOptions,
  yearTicks,
} from "./series-prepare.js";
import { charWidth, DEFAULT_HEIGHT, DEFAULT_WIDTH } from "./size.js";
import { valueAxis } from "./text.js";
import { finishAreas } from "./area-marks.js";
import { texture } from "./texture.js";

export { fitTicks } from "./size.js";

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

function datum(
  p: Point,
  x: string,
  series: string | undefined,
  format: (value: number) => string,
): MarkDatum {
  const multi = series !== undefined;
  return {
    key: markKey(p.at, p.series),
    filter: multi ? { field: series, value: p.series } : { field: x, value: p.xKey },
    x: p.xKey,
    ...(multi ? { series: p.series } : {}),
    column: p.column,
    row: p.row,
    at: p.xText,
    ...(p.value === null ? {} : { shown: format(p.value) }),
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
  /** The y axis's tick format for huge values, and whether every value is zero. */
  readonly valueAxis: ReturnType<typeof valueAxis>;
  describe(p: Point): string;
  datum(p: Point): MarkDatum;
  /** Wraps the drawn SVG in the figure, with its legend and data table. */
  figure(svg: string, x: ScaleDescription | undefined): string;
  /** The text alternative, with the annotations' notes added. */
  readonly alt: string | undefined;
  /** Whether each series is named at its end. */
  readonly directLabels: boolean;
}

export function seriesModel<T extends object>(
  kind: string,
  figureKind: string,
  options: Forecastable<T>,
  prepared: Prepared,
  check?: () => void,
  finish?: (svg: string, plan: SeriesPlan) => { svg: string; labeled: boolean },
): SeriesModel {
  const plan = planSeries(kind, prepared.seriesNames, options.colors);
  check?.();
  const max = options.maxXTicks;
  if (max !== undefined && (!Number.isInteger(max) || max < 1)) {
    throw new Error(`${kind}: maxXTicks must be a whole number of 1 or more`);
  }
  const noted = withNotes(options);
  const multi = options.series !== undefined;
  const directLabels = options.directLabels !== false && multi;
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
    datum: (p) => datum(p, options.x, options.series, format),
    alt: noted.alt,
    directLabels,
    figure: (svg, x) => {
      // Area bands are filled, so they take textures where not all are named; lines are told apart by labels and dashes.
      const area = finish
        ? finish(svg, plan)
        : figureKind === "area"
          ? finishAreas(texture(svg, slotStyle(plan.slotColors)), prepared, plan, directLabels)
          : undefined;
      return figure(noted, {
        kind: figureKind,
        svg: area ? area.svg : svg,
        ...(area && !area.labeled ? { textured: true } : {}),
        ...(x ? { x } : {}),
        ...seriesLegend(plan, multi, options.series),
        description,
        table: table(prepared, xColumn, multi),
      });
    },
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
  // Each series' dashed stretch starts at its last point on or before the boundary, so the line stays joined.
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
  };
}

/**
 * The size and margins a line or area chart is drawn at, by Plot and `enarratio/lite` alike. The
 * right margin leaves room for the longest series name as a direct label, else 24; a drawing 480
 * or wider keeps at least 96, so desktop charts share one gutter.
 */
export function seriesMargins(
  model: SeriesModel,
  options: { readonly width?: number; readonly height?: number },
) {
  const width = options.width ?? DEFAULT_WIDTH;
  const longest = Math.max(...model.prepared.seriesNames.map((n) => n.length));
  const need = Math.ceil(6 + longest * charWidth(width) + 4);
  return {
    width,
    height: options.height ?? DEFAULT_HEIGHT,
    marginTop: 20,
    marginRight: model.directLabels ? Math.max(width >= 480 ? 96 : 24, need) : 24,
    marginBottom: 44,
    marginLeft: 48,
  };
}
