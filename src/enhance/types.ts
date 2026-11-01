/** The enhancement layer's public types and the events it fires. */

/** Detail of the `enarratio:select` event, fired when a reader selects or clears a filter. */
export interface SelectDetail {
  /** The figure's `id`, or null when the chart was rendered without one. */
  readonly chartId: string | null;
  /** The data field the filter applies to, e.g. `"type"`. */
  readonly field: string;
  /** The value selected, e.g. `"Publications"`; null when the filter was cleared. */
  readonly value: string | null;
  /** The category of the mark selected, when a mark (not a legend entry) was used. */
  readonly x?: string;
}

/** Detail of the `enarratio:brush` event, fired when a reader picks or clears a range. */
export interface BrushDetail {
  readonly chartId: string | null;
  /**
   * The range in data units, low then high: numbers, or milliseconds since the epoch on a time
   * axis. Null when the range was cleared.
   */
  readonly range: readonly [number, number] | null;
  /** Whether the axis is time, so the range holds epoch milliseconds. */
  readonly time: boolean;
}

declare global {
  interface HTMLElementEventMap {
    "enarratio:select": CustomEvent<SelectDetail>;
    "enarratio:brush": CustomEvent<BrushDetail>;
  }
}

/**
 * Every string the layer writes, in English by default. `{name}` is filled in. A page passes the
 * ones it translates as `strings` (B56); the rest stay English.
 */
export interface EnhanceStrings {
  /** The keys, read as the points' description and shown while a point has focus (B10). */
  readonly hint: string;
  /** Added to the hint when points filter. */
  readonly hintFilter: string;
  /** Added to the hint when the chart has a range brush. */
  readonly hintRange: string;
  /** The name of the points when the chart has no title. */
  readonly chart: string;
  /** A point's place in its series, after its label (B20). */
  readonly position: string;
  readonly filtered: string;
  readonly filterCleared: string;
  readonly rangeStart: string;
  readonly rangeSelected: string;
  readonly rangeCleared: string;
  /** Announced after `update()` (C13). */
  readonly updated: string;
  readonly sorted: string;
  readonly ascending: string;
  readonly descending: string;
  readonly showTable: string;
  readonly showChart: string;
  readonly expand: string;
  readonly collapse: string;
  /** The range form's summary, and its fields and buttons (B15). */
  readonly range: string;
  readonly from: string;
  readonly to: string;
  readonly apply: string;
  readonly clear: string;
  /** The export buttons (C3) and the embed snippet's (C4). */
  readonly downloadSvg: string;
  readonly downloadPng: string;
  /** The tactile export (B55): a black-on-white SVG sized for an embosser or swell paper. */
  readonly downloadTactile: string;
  readonly copyEmbed: string;
  /** Announced when the snippet is on the clipboard. */
  readonly embedCopied: string;
  /** Announced when an image or the snippet could not be made. */
  readonly exportFailed: string;
  /** The sound button (B54), and what it says as each series starts. */
  readonly play: string;
  readonly stop: string;
  readonly playing: string;
}

/** Options for {@link enhance}. Every feature is on unless turned off, except `expand` and `url`. */
export interface EnhanceOptions {
  /** Show a hover and focus tooltip with each mark's details. */
  readonly tooltips?: boolean;
  /** Let a click, Enter or Space on a mark or legend entry filter by its value. */
  readonly filter?: boolean;
  /**
   * Let a drag, two clicks, Shift with arrow keys or a from-and-to form pick a range on charts
   * with a continuous x axis.
   */
  readonly brush?: boolean;
  /** Animate charts in the first time they scroll into view. */
  readonly entrance?: boolean;
  /** Make the data table sortable and add a button that switches between chart and table. */
  readonly table?: boolean;
  /** Add a button that expands the chart to fill the window. Off by default. */
  readonly expand?: boolean;
  /**
   * Keep each chart's filter and range in the address, so a link reproduces the view. Needs the
   * figure's `id`. Off by default. A filter or range read from the address fires its event.
   */
  readonly url?: boolean;
  /** Add "Download SVG" and "Download PNG" beside the CSV link (C3). */
  readonly download?: boolean;
  /**
   * Add "Download tactile SVG" beside them: the drawing in black on white, gridlines left out,
   * lines thickened and labels horizontal, on an 11 by 11.5 inch page for a braille embosser or
   * swell paper (B55). Needs `download`.
   */
  readonly tactile?: boolean;
  /**
   * Add "Copy embed", which copies a link to the chart (the page address with the figure's `id`)
   * as HTML to paste elsewhere (C4). Needs the figure's `id`.
   */
  readonly embed?: boolean;
  /**
   * Add "Play as sound", which plays each series in turn as notes that rise and fall with the
   * values (B54). Its code loads only when pressed.
   */
  readonly sound?: boolean;
  /** Translations of the strings the layer writes. */
  readonly strings?: Partial<EnhanceStrings>;
}

/** The options a chart is enhanced with, every default filled in. */
export type ResolvedOptions = Required<Omit<EnhanceOptions, "strings">> & {
  readonly strings: EnhanceStrings;
};

/** A chart the enhancement layer is attached to. */
export interface EnhancedChart {
  readonly figure: HTMLElement;
  /** The options the chart was enhanced with, every default filled in. */
  readonly options: ResolvedOptions;
  /**
   * Replaces the chart with new server-rendered markup for the same chart, animating marks that
   * share a key from their old shape to their new one. The filter, the tab stop and keyboard
   * focus stay on the mark with the same key, or the nearest one if it is gone. The live region
   * says the chart was updated.
   *
   * The markup should come from Enarratio. It is parsed inertly and sanitized before it touches
   * the page: only the elements and attributes Enarratio emits are kept, and event handlers,
   * scripts and unsafe links are dropped (F11).
   */
  update(markup: string): void;
  /**
   * Shows a filter the page chose (from its own controls, or a URL) without firing
   * `enarratio:select`: the page already knows. A filter on the series field emphasizes that
   * series even where clicks filter by x. `null` clears it.
   */
  setFilter(filter: { readonly field: string; readonly value: string } | null): void;
  /**
   * Clears any filter and range the page wants gone, without firing events. A reader pressing
   * Escape clears them too, and that does fire events.
   */
  clear(): void;
  /** Removes every listener and element the layer added, leaving the server markup. */
  destroy(): void;
}
