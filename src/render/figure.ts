/**
 * The figure every chart is delivered in: an optional title, a legend, the SVG named by its text
 * alternative, an optional caption and a data table. The accessible name lives on the SVG, never
 * on the figure, because `role="img"` hides its descendants: naming the figure would hide the
 * caption and table from the readers they exist for.
 */

import { element, escapeHtml } from "../html.js";
import type { ScaleDescription } from "./plot.js";

/** A color for one series: any CSS color, or a pair for light and dark. */
export type SeriesColor = string | { readonly light: string; readonly dark: string };

/** Options every chart accepts. */
export interface FigureOptions {
  /**
   * Required. What the chart shows, including its finding, written for someone who cannot see
   * it: "Publications rose from 2 in 2015 to 11 in 2024", not "Bar chart of publications".
   */
  readonly alt: string;
  /** A visible title above the chart. */
  readonly title?: string;
  /** A visible caption below the chart: method, source, caveats. */
  readonly caption?: string;
  /** An `id` for the figure, which enhancement events carry as `chartId`. */
  readonly id?: string;
  /** The drawing's width in CSS pixels; the SVG scales down to fit narrower containers. */
  readonly width?: number;
  /** The drawing's height in CSS pixels. */
  readonly height?: number;
  /**
   * How the equivalent data table is shown: in a closed disclosure (default), or only to
   * assistive technology. It is always present.
   */
  readonly dataTable?: "details" | "visually-hidden";
}

/** A table of the values a chart draws. The first column holds row headers. */
export interface DataTable {
  readonly columns: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

/** One legend entry. */
export interface LegendItem {
  readonly label: string;
  /** The palette slot, 1 to 8. */
  readonly slot: number;
}

/** One step of a sequential color legend. */
export interface RampItem {
  readonly label: string;
  /** The ramp step, 1 to 5. */
  readonly step: number;
}

/** Everything a chart hands to {@link figure}. */
export interface FigureParts {
  readonly kind: string;
  readonly svg: string;
  readonly table: DataTable;
  readonly legend?: readonly LegendItem[];
  /** A legend for a sequential ramp (heatmaps, maps), shown instead of a series legend. */
  readonly ramp?: readonly RampItem[];
  /** The data field series come from, which legend filters report. */
  readonly seriesField?: string;
  readonly x?: ScaleDescription;
  /** Which way bars run, for the entrance animation. */
  readonly orientation?: "vertical" | "horizontal";
  /** Per-figure overrides of palette slots, as CSS custom property declarations. */
  readonly slotColors?: ReadonlyMap<number, SeriesColor>;
}

/**
 * Checks the options every chart shares before anything is drawn: a meaningful `alt`, and a
 * positive finite width and height when given (A7, F15).
 */
export function validateFigure(kind: string, options: FigureOptions): void {
  requireAlt(options.alt, kind);
  for (const name of ["width", "height"] as const) {
    const value = options[name];
    if (value !== undefined && !(Number.isFinite(value) && value > 0)) {
      throw new Error(`${kind}: ${name} must be a positive number, is ${value}`);
    }
  }
}

/** Throws unless `alt` is meaningful text. */
function requireAlt(alt: string | undefined, kind: string): string {
  const trimmed = (alt ?? "").trim();
  if (trimmed === "") {
    throw new Error(`${kind}: alt is required and must describe what the chart shows`);
  }
  return trimmed;
}

/** What a caller-supplied color may contain: enough for hex, color functions and var(), not url(). */
const SAFE_COLOR = /^[#a-z0-9(),.%\s-]+$/i;

function cssColor(value: string): string {
  if (!SAFE_COLOR.test(value) || /url\s*\(/i.test(value)) {
    throw new Error(`"${value}" is not an allowed color; use hex, a color function or var(--name)`);
  }
  return value;
}

/** Per-figure palette overrides as an inline style value, or undefined when there are none. */
export function slotStyle(
  colors: ReadonlyMap<number, SeriesColor> | undefined,
): string | undefined {
  if (!colors || colors.size === 0) return undefined;
  return [...colors]
    .map(([slot, color]) => {
      const value =
        typeof color === "string"
          ? cssColor(color)
          : `light-dark(${cssColor(color.light)}, ${cssColor(color.dark)})`;
      return `--abscissa-series-${slot}: ${value}`;
    })
    .join("; ");
}

function tableMarkup(table: DataTable, caption: string): string {
  const head = element(
    "tr",
    {},
    table.columns.map((c) => element("th", { scope: "col" }, escapeHtml(c))).join(""),
  );
  const body = table.rows
    .map((row) =>
      element(
        "tr",
        {},
        row
          .map((cell, i) =>
            i === 0
              ? element("th", { scope: "row" }, escapeHtml(cell))
              : element("td", {}, escapeHtml(cell)),
          )
          .join(""),
      ),
    )
    .join("");
  return element(
    "table",
    {},
    `${element("caption", { class: "abscissa-visually-hidden" }, escapeHtml(caption))}${element("thead", {}, head)}${element("tbody", {}, body)}`,
  );
}

function legendMarkup(parts: FigureParts): string {
  const swatch = element("span", { class: "abscissa-swatch", "aria-hidden": "true" });
  if (parts.ramp && parts.ramp.length > 0) {
    return element(
      "ul",
      { class: "abscissa-legend abscissa-ramp" },
      parts.ramp
        .map((item) =>
          element("li", { "data-step": item.step }, `${swatch}${escapeHtml(item.label)}`),
        )
        .join(""),
    );
  }
  if (!parts.legend || parts.legend.length === 0) return "";
  return element(
    "ul",
    { class: "abscissa-legend" },
    parts.legend
      .map((item) =>
        element(
          "li",
          { "data-abscissa-series": item.label, "data-slot": item.slot },
          `${swatch}${escapeHtml(item.label)}`,
        ),
      )
      .join(""),
  );
}

/** Assembles the figure markup for a chart. */
export function figure(options: FigureOptions, parts: FigureParts): string {
  const alt = requireAlt(options.alt, parts.kind);
  const title = options.title?.trim();
  const caption = options.caption?.trim();

  const legend = legendMarkup(parts);
  const table = tableMarkup(parts.table, `Data for: ${title ?? alt}`);
  const tableBlock =
    options.dataTable === "visually-hidden"
      ? element("div", { class: "abscissa-data abscissa-visually-hidden" }, table)
      : element(
          "details",
          { class: "abscissa-data" },
          `${element("summary", {}, "Data table")}${table}`,
        );

  return element(
    "figure",
    {
      class: "abscissa",
      id: options.id,
      "data-abscissa": parts.kind,
      "data-abscissa-orientation": parts.orientation,
      "data-abscissa-x-scale": parts.x ? JSON.stringify(parts.x) : undefined,
      "data-abscissa-series-field": parts.seriesField,
      style: slotStyle(parts.slotColors),
    },
    [
      title ? element("p", { class: "abscissa-title" }, escapeHtml(title)) : "",
      legend,
      // A frame that scrolls sideways on narrow screens instead of shrinking the text (A13).
      // Drawings 30rem or wider keep that width and scroll; narrower ones scale as usual.
      element(
        "div",
        {
          class:
            (options.width ?? 640) >= 480 ? "abscissa-frame abscissa-frame-wide" : "abscissa-frame",
        },
        parts.svg,
      ),
      caption ? element("figcaption", { class: "abscissa-caption" }, escapeHtml(caption)) : "",
      tableBlock,
    ].join(""),
  );
}
