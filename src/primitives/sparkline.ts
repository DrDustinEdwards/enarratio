import { element, escapeHtml } from "../html.js";
import { defaultFormat, maxOf, minOf } from "../render/data.js";
import { type SeriesColor, slotStyle } from "../render/figure.js";
import { type PrimitiveTable, type PrimitiveTableOptions, primitiveTable } from "./companion.js";

/** Options for {@link sparkline}. */
export interface SparklineOptions {
  /** The values in order. `null` is a gap: the line breaks rather than dropping to zero. */
  readonly values: readonly (number | null)[];
  /** What the values measure, e.g. "Entries per year"; it starts the generated description. */
  readonly label?: string;
  /** A description to use instead of the generated one. */
  readonly alt?: string;
  readonly width?: number;
  readonly height?: number;
  /** Shade the area under the line. */
  readonly area?: boolean;
  /** Mark the last value with a dot (default true). */
  readonly endDot?: boolean;
  /** The line's color; defaults to the theme's first series color. */
  readonly color?: SeriesColor;
  readonly formatValue?: (value: number) => string;
}

const INSET = 2.5;

const round = (n: number): number => Math.round(n * 100) / 100;

/** Everything the sparkline, its text alternative and its companion table are computed from. */
export interface SparklineValues {
  readonly values: readonly (number | null)[];
  /** The values that are not gaps, in order. */
  readonly present: readonly number[];
  readonly min: number;
  readonly max: number;
  readonly width: number;
  readonly height: number;
  readonly format: (value: number) => string;
  /** The sentence generated from the data: count, first, last, lowest, highest. */
  readonly summary: string;
  readonly alt: string;
}

/** Validates the options and computes the numbers every part of a sparkline is made from. */
export function prepareSparkline(options: SparklineOptions): SparklineValues {
  const { values } = options;
  const width = options.width ?? 120;
  const height = options.height ?? 32;
  for (const [name, n] of [
    ["width", width],
    ["height", height],
  ] as const) {
    if (!(Number.isFinite(n) && n > 0)) {
      throw new Error(`sparkline: ${name} must be a positive number, is ${n}`);
    }
  }
  const format = options.formatValue ?? defaultFormat;
  values.forEach((v, i) => {
    if (v !== null && !Number.isFinite(v)) {
      throw new Error(`sparkline: value ${i + 1} is ${v}, not a finite number or null`);
    }
  });
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) throw new Error("sparkline: needs at least one value");
  const min = minOf(present);
  const max = maxOf(present);
  const summary = `${options.label ? `${options.label}: ` : ""}${defaultFormat(values.length)} values, from ${format(present[0] as number)} to ${format(present[present.length - 1] as number)}; lowest ${format(min)}, highest ${format(max)}.`;
  return {
    values,
    present,
    min,
    max,
    width,
    height,
    format,
    summary,
    alt: options.alt?.trim() || summary,
  };
}

/**
 * A word-sized line chart for a trend beside a number, without axes. Its text alternative is
 * generated from the data (count, first, last, lowest, highest) unless `alt` is given.
 *
 * @example
 * sparkline({ values: [3, 5, 4, 8, 11], label: "Entries per year" });
 */
export function sparkline(options: SparklineOptions): string {
  const { values, width, height, min, max, alt } = prepareSparkline(options);

  const xOf = (i: number): number =>
    round(
      values.length === 1 ? width / 2 : INSET + (i * (width - 2 * INSET)) / (values.length - 1),
    );
  const yOf = (v: number): number =>
    round(
      max === min ? height / 2 : height - INSET - ((v - min) * (height - 2 * INSET)) / (max - min),
    );

  const segments: [number, number][][] = [];
  let current: [number, number][] = [];
  values.forEach((v, i) => {
    if (v === null) {
      if (current.length > 0) segments.push(current);
      current = [];
    } else current.push([xOf(i), yOf(v)]);
  });
  if (current.length > 0) segments.push(current);

  const line = segments
    .map((seg) => seg.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(""))
    .join("");
  const areaPath = options.area
    ? segments
        .map(
          (seg) =>
            `M${seg[0]?.[0]},${height}${seg.map(([x, y]) => `L${x},${y}`).join("")}L${seg[seg.length - 1]?.[0]},${height}Z`,
        )
        .join("")
    : "";

  const lastIndex = values.length - 1;
  const lastValue = values[lastIndex];

  const parts = [
    element("title", {}, escapeHtml(alt)),
    areaPath
      ? element("path", {
          d: areaPath,
          fill: "var(--enarratio-series-1)",
          "fill-opacity": 0.15,
          stroke: "none",
        })
      : "",
    element("path", {
      d: line,
      fill: "none",
      stroke: "var(--enarratio-series-1)",
      "stroke-width": 1.5,
      "stroke-linejoin": "round",
      "stroke-linecap": "round",
    }),
    options.endDot !== false && lastValue !== null && lastValue !== undefined
      ? element("circle", {
          cx: xOf(lastIndex),
          cy: yOf(lastValue),
          r: 2.25,
          fill: "var(--enarratio-series-1)",
        })
      : "",
  ];

  return element(
    "svg",
    {
      class: "enarratio enarratio-sparkline",
      "data-enarratio": "sparkline",
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: `0 0 ${width} ${height}`,
      width,
      height,
      role: "img",
      "aria-label": alt,
      style: slotStyle(options.color ? new Map([[1, options.color]]) : undefined),
    },
    parts.join(""),
  );
}

/**
 * A sparkline's numbers as a table (position and value, `no data` for a gap) and a summary
 * sentence, computed from the same values as the drawing so the two cannot disagree. Takes the
 * same options as {@link sparkline}. The summary is the generated description even when `alt`
 * is given.
 *
 * @example
 * const { summary, markup } = sparklineTable({ values: [3, 5, 4], label: "Entries per year" });
 */
export function sparklineTable(
  options: SparklineOptions,
  display?: PrimitiveTableOptions,
): PrimitiveTable {
  const p = prepareSparkline(options);
  const name = options.label?.trim() || "Value";
  return primitiveTable(
    p.summary,
    {
      columns: ["Position", name],
      rows: p.values.map((v, i) => [String(i + 1), v === null ? "no data" : p.format(v)]),
    },
    options.label?.trim() || p.alt,
    display,
  );
}
