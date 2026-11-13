import {
  drawSparkline,
  prepareSparkline,
  type SparklineDrawingOptions,
} from "../render/sparkline.js";
import {
  type PrimitiveFigureOptions,
  type PrimitiveTable,
  primitiveFigure,
  primitiveTable,
  primitiveText,
} from "./companion.js";

/** Options for {@link sparkline}. */
export interface SparklineOptions extends PrimitiveFigureOptions, SparklineDrawingOptions {}

/** The numbers a sparkline is made from, its sentence written by the options' strings. */
function prepare(options: SparklineOptions) {
  return prepareSparkline(options, primitiveText(options).strings.sparklineSummary);
}

/**
 * A word-sized line chart for a trend beside a number, without axes. Its text alternative is
 * generated from the data (count, first, last, lowest, highest) unless `alt` is given.
 *
 * @example
 * sparkline({ values: [3, 5, 4, 8, 11], label: "Entries per year" });
 */
export function sparkline(options: SparklineOptions): string {
  const prepared = prepare(options);
  const drawing = drawSparkline(prepared, options);
  return primitiveFigure(
    "sparkline",
    drawing,
    prepared.alt,
    options.label?.trim() ?? "",
    options,
    () => sparklineTable(options),
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
export function sparklineTable(options: SparklineOptions): PrimitiveTable {
  const p = prepare(options);
  const { strings, count } = primitiveText(options);
  const { terms } = strings;
  const name = options.label?.trim() || terms.value;
  return primitiveTable(
    p.summary,
    {
      columns: [terms.position, name],
      rows: p.values.map((v, i) => [count(i + 1), v === null ? terms.noData : p.format(v)]),
    },
    options.label?.trim() || p.alt,
    strings,
  );
}
