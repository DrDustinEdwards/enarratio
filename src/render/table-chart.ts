/**
 * A table whose cells can draw: inline bars, heat cells and sparklines beside the numbers they
 * stand for. It is HTML, rendered on the server, and needs no Plot.
 */

import { element, escapeHtml } from "../html.js";
import { sparkline } from "../primitives/sparkline.js";
import { maxOf, minOf, rampStep, rampThresholds } from "./data.js";
import { type FigureOptions, figure, validateFigure } from "./figure.js";
import { valueFormat } from "./text.js";

/** One column of a {@link tableChart}. */
export interface TableColumn<T extends object> {
  /** The field the column shows. */
  readonly field: keyof T & string;
  /** The column header (default the field name). */
  readonly label?: string;
  /**
   * How each cell draws: `"text"` (default for strings), `"number"` (default for numbers),
   * `"bar"` (the number with a bar to scale, from zero), `"heat"` (the number on the theme's
   * sequential ramp), or `"sparkline"` (a field holding an array of numbers, drawn as a
   * sparkline with its own text alternative).
   */
  readonly kind?: "text" | "number" | "bar" | "heat" | "sparkline";
  /** Formats the column's numbers (default the chart's `locale`). */
  readonly formatValue?: (value: number) => string;
}

/** Options for {@link tableChart}. */
export interface TableChartOptions<T extends object>
  extends Omit<FigureOptions, "height" | "dataTable"> {
  readonly data: readonly T[];
  /** The columns, in order. The first column's cells are row headers. */
  readonly columns: readonly TableColumn<T>[];
}

const KIND = "tableChart";

/** The width and height of an inline bar, in the units of its drawing. */
const BAR_WIDTH = 96;
const BAR_HEIGHT = 12;

/**
 * A bar to scale in a cell, from zero: right of a center line when the column has negatives,
 * from the left edge if not. An SVG of its own, so it needs no `style` attribute (D4), and hidden
 * from assistive technology: the cell prints its number.
 */
function cellBar(value: number, reach: number, negative: boolean): string {
  const length = (Math.abs(value) / reach) * (negative ? BAR_WIDTH / 2 : BAR_WIDTH);
  const x = negative ? (value < 0 ? BAR_WIDTH / 2 - length : BAR_WIDTH / 2) : 0;
  const round = (n: number): number => Math.round(n * 100) / 100;
  return element(
    "svg",
    {
      class: "enarratio-cell-bar",
      viewBox: `0 0 ${BAR_WIDTH} ${BAR_HEIGHT}`,
      preserveAspectRatio: "none",
      "aria-hidden": "true",
      focusable: "false",
    },
    `${element("rect", {
      x: round(x),
      y: 0,
      width: round(length),
      height: BAR_HEIGHT,
      fill: `var(--enarratio-series-${value < 0 ? 2 : 1})`,
    })}${
      negative
        ? element("line", {
            x1: BAR_WIDTH / 2,
            x2: BAR_WIDTH / 2,
            y1: 0,
            y2: BAR_HEIGHT,
            stroke: "var(--enarratio-text-muted)",
          })
        : ""
    }`,
  );
}

/**
 * A data table with inline graphics: a bar to scale beside each number, heat cells on the theme's
 * sequential ramp, and a sparkline per row, for comparing many rows at a glance. Every cell still
 * prints its number, so the table reads without color and without the graphics, and the table
 * is the figure's data table: assistive technology reads it as it is, the bars hidden and each
 * sparkline named, and `enhance()` makes it sortable, as every chart's table is.
 *
 * @example
 * tableChart({
 *   data: sites,
 *   columns: [{ field: "site" }, { field: "visits", kind: "bar" }, { field: "trend", kind: "sparkline" }],
 *   alt: "...",
 * });
 */
export function tableChart<T extends object>(options: TableChartOptions<T>): string {
  const { data, columns } = options;
  validateFigure(KIND, options);
  if (data.length === 0) throw new Error(`${KIND}: data is empty`);
  if (columns.length === 0) throw new Error(`${KIND}: columns is empty`);
  const valueAt = (row: T, field: string): unknown => (row as Record<string, unknown>)[field];
  const numbersOf = (c: TableColumn<T>): number[] =>
    data.map((row, i) => {
      const v = valueAt(row, c.field);
      if (typeof v !== "number" || !Number.isFinite(v)) {
        throw new Error(
          `${KIND}: row ${i + 1} field "${c.field}" is ${String(v)}, not a finite number`,
        );
      }
      return v;
    });
  const rowName = (row: T, i: number): string => {
    const v = valueAt(row, (columns[0] as TableColumn<T>).field);
    return v === null || v === undefined || v === "" ? `${i + 1}` : String(v);
  };
  const names = data.map(rowName);
  const plain: string[][] = data.map(() => []);
  const drawn: string[][] = data.map(() => []);
  let described: { header: string; values: number[]; format: (v: number) => string } | undefined;
  for (const c of columns) {
    const header = c.label ?? c.field;
    const format = c.formatValue ?? valueFormat(options);
    const first = valueAt(data[0] as T, c.field);
    const kind = c.kind ?? (typeof first === "number" ? "number" : "text");
    if (kind === "sparkline") {
      data.forEach((row, i) => {
        const v = valueAt(row, c.field);
        if (!Array.isArray(v))
          throw new Error(`${KIND}: row ${i + 1} field "${c.field}" is not an array of numbers`);
        const values = v as (number | null)[];
        (plain[i] as string[]).push(values.map((n) => (n === null ? "" : format(n))).join(", "));
        (drawn[i] as string[]).push(
          element(
            "td",
            {},
            sparkline({
              values,
              label: `${header}, ${names[i] as string}`,
              formatValue: format,
              inline: true,
            }),
          ),
        );
      });
      continue;
    }
    if (kind === "text") {
      data.forEach((row, i) => {
        const v = valueAt(row, c.field);
        const text = v === null || v === undefined ? "" : String(v);
        (plain[i] as string[]).push(text);
        (drawn[i] as string[]).push(element("td", {}, escapeHtml(text)));
      });
      continue;
    }
    const values = numbersOf(c);
    described ??= { header, values, format };
    const min = minOf(values);
    const max = maxOf(values);
    const thresholds = kind === "heat" ? rampThresholds(KIND, min, max, undefined) : [];
    const reach = Math.max(Math.abs(min), Math.abs(max)) || 1;
    values.forEach((v, i) => {
      const number = element("span", { class: "enarratio-numeric" }, escapeHtml(format(v)));
      (plain[i] as string[]).push(format(v));
      (drawn[i] as string[]).push(
        kind === "heat"
          ? element("td", { class: "enarratio-heat", "data-step": rampStep(v, thresholds) }, number)
          : element("td", {}, kind === "bar" ? `${number}${cellBar(v, reach, min < 0)}` : number),
      );
    });
  }
  const headers = columns.map((c) => c.label ?? c.field);
  const head = element(
    "tr",
    {},
    headers.map((h) => element("th", { scope: "col" }, escapeHtml(h))).join(""),
  );
  // The first column's cells are row headers, whatever they draw.
  const body = drawn
    .map((cells) =>
      element(
        "tr",
        {},
        cells
          .map((cell, k) =>
            k === 0 ? cell.replace(/^<td\b/, '<th scope="row"').replace(/<\/td>$/, "</th>") : cell,
          )
          .join(""),
      ),
    )
    .join("");
  return figure(options, {
    kind: "table",
    svg: "",
    // A table is what the figure suggests in place of a chart that is too dense, so no limit.
    limits: { series: Number.POSITIVE_INFINITY, points: Number.POSITIVE_INFINITY },
    ...(described
      ? {
          description: {
            format: described.format,
            series: [
              {
                name: described.header,
                points: described.values.map((value, i) => ({
                  at: `${described?.header}, ${names[i]}`,
                  value,
                })),
              },
            ],
          },
        }
      : {}),
    table: { columns: headers, rows: plain },
    tableMarkup: (caption) =>
      element(
        "div",
        { class: "enarratio-data enarratio-table-chart" },
        element(
          "table",
          {},
          `${element("caption", { class: "enarratio-visually-hidden" }, escapeHtml(caption))}${element("thead", {}, head)}${element("tbody", {}, body)}`,
        ),
      ),
  });
}
