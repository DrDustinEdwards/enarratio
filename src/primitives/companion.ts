import { type DataTable, dataTableBlock, type FigureOptions, figure } from "../render/figure.js";
import { numberFormat, type Strings, stringsFor } from "../render/text.js";

/**
 * What a primitive's companion function returns: its numbers as a table and as a sentence, both
 * computed from the same values as the drawing, so neither can disagree with it.
 */
export interface PrimitiveTable {
  /** A sentence stating the values, for a caption, a page's text or an AI agent. */
  readonly summary: string;
  /** The values as rows and columns; the first column holds row headers. */
  readonly table: DataTable;
  /**
   * The table as markup, visually hidden for screen readers and AI agents, ready to put beside
   * the primitive (record 0035).
   */
  readonly markup: string;
}

/** Assembles a companion result from its parts. */
export function primitiveTable(
  summary: string,
  table: DataTable,
  caption: string,
  strings: Strings,
): PrimitiveTable {
  return { summary, table, markup: dataTableBlock(table, strings.dataFor(caption)) };
}

/** A primitive's strings and number formats: its `strings` and `locale`, as on a chart. */
export function primitiveText(options: Pick<FigureOptions, "locale" | "strings">): {
  readonly strings: Strings;
  readonly count: (value: number) => string;
  readonly percent: (fraction: number) => string;
} {
  const locale = options.locale ?? "en-US";
  return {
    strings: stringsFor(options.strings),
    count: numberFormat({ locale }),
    percent: numberFormat({ locale, style: "percent", maximumFractionDigits: 2 }),
  };
}

/**
 * Options every primitive takes for the figure it is delivered in: the figure's text slots, the
 * CSV link, locale and issue reporting, as on a chart. `inline: true` returns the bare SVG
 * instead, word-sized, for use inside a sentence or a table cell.
 */
export interface PrimitiveFigureOptions extends Pick<
  FigureOptions,
  | "title"
  | "subtitle"
  | "caption"
  | "notes"
  | "source"
  | "byline"
  | "summary"
  | "csv"
  | "csvHref"
  | "id"
  | "locale"
  | "lang"
  | "strings"
  | "strict"
  | "onIssue"
> {
  /** Return the bare drawing, without figure, summary or table (B30: default false). */
  readonly inline?: boolean;
}

/**
 * A primitive as a whole figure (B30, B51): title (its label by default), finding, the drawing,
 * the companion's summary and table, and the CSV link; or the bare drawing when `inline`.
 */
export function primitiveFigure(
  kind: string,
  svg: string,
  alt: string,
  label: string,
  options: PrimitiveFigureOptions,
  companion: () => PrimitiveTable,
): string {
  if (options.inline) return svg;
  const { summary, table } = companion();
  return figure(
    { ...options, alt, title: options.title ?? label },
    { kind, svg, table, fixed: true, description: { sentence: summary } },
  );
}
