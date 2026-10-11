/** What the enhancement layer reads from each drawn datum, as attributes on its element. */

/** What the enhancement layer needs to know about one drawn datum. */
export interface MarkDatum {
  /** Unique within the chart and stable across re-renders of the same data (for transitions). */
  readonly key: string;
  /** The value a click filters on, and the name of the field it belongs to. */
  readonly filter?: { readonly field: string; readonly value: string };
  /** The x value as text, for brush and hover. */
  readonly x?: string;
  /** The series name, when the chart has series. */
  readonly series?: string;
  /**
   * The mark's place for keyboard reading order: its category (column) and its position within
   * the category (row). Taken from the data, not the drawing, so order is right in facets and in
   * charts enhanced while hidden (F9).
   */
  readonly column?: number;
  readonly row?: number;
}

/** A datum's keys as attribute names and values, in the order they are written. */
export function datumAttributes(datum: MarkDatum): [string, string][] {
  const out: [string, string][] = [["data-enarratio-key", datum.key]];
  if (datum.filter) {
    out.push(["data-enarratio-field", datum.filter.field]);
    out.push(["data-enarratio-value", datum.filter.value]);
  }
  if (datum.x !== undefined) out.push(["data-enarratio-x", datum.x]);
  if (datum.series !== undefined) out.push(["data-enarratio-series", datum.series]);
  if (datum.column !== undefined) out.push(["data-enarratio-col", String(datum.column)]);
  if (datum.row !== undefined) out.push(["data-enarratio-row", String(datum.row)]);
  return out;
}
