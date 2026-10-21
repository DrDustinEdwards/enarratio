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

/** Options for {@link enhance}. Every feature is on unless turned off. */
export interface EnhanceOptions {
  /** Show a hover and focus tooltip with each mark's details. */
  readonly tooltips?: boolean;
  /** Let a click, Enter or Space on a mark or legend entry filter by its value. */
  readonly filter?: boolean;
  /** Let a drag, or Shift with arrow keys, pick a range on charts with a continuous x axis. */
  readonly brush?: boolean;
  /** Animate charts in the first time they scroll into view. */
  readonly entrance?: boolean;
}

/** A chart the enhancement layer is attached to. */
export interface EnhancedChart {
  readonly figure: HTMLElement;
  /** The options the chart was enhanced with, every default filled in. */
  readonly options: Readonly<Required<EnhanceOptions>>;
  /**
   * Replaces the chart with new server-rendered markup for the same chart, animating marks that
   * share a key from their old shape to their new one. The filter, the tab stop and keyboard
   * focus stay on the mark with the same key, or the nearest one if it is gone.
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
