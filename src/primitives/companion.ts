import { type DataTable, dataTableBlock } from "../render/figure.js";

/** Options for the companion functions (`sparklineTable` and the rest). */
export interface PrimitiveTableOptions {
  /**
   * How `markup` shows the table: in a closed disclosure (default), or only to assistive
   * technology. As on a figure.
   */
  readonly dataTable?: "details" | "visually-hidden";
}

/**
 * What a primitive's companion function returns: its numbers as a table and as a sentence, both
 * computed from the same values as the drawing, so neither can disagree with it.
 */
export interface PrimitiveTable {
  /** A sentence stating the values, for a caption, a page's text or an AI agent. */
  readonly summary: string;
  /** The values as rows and columns; the first column holds row headers. */
  readonly table: DataTable;
  /** The table as markup, in a disclosure or visually hidden, ready to put beside the primitive. */
  readonly markup: string;
}

/** Assembles a companion result from its parts. */
export function primitiveTable(
  summary: string,
  table: DataTable,
  caption: string,
  options: PrimitiveTableOptions | undefined,
): PrimitiveTable {
  return {
    summary,
    table,
    markup: dataTableBlock(table, `Data for: ${caption}`, options?.dataTable),
  };
}
