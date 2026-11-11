/**
 * What the server figure and the enhancement layer share: the layer's strings and the toolbar's
 * icons, so the figure can write the controls the layer will add with the same labels and look,
 * and the x scales a range can be picked on (records 0033, 0035). The layer's bundle inlines it.
 */

import type { EnhanceStrings } from "./enhance/types.js";

/** The layer's English strings, which `strings` overrides one by one. */
export const ENHANCE_STRINGS: EnhanceStrings = {
  hint: "Arrow keys move between points: left and right along a series, up and down between series. Home and End go to the ends, Page Up and Page Down jump ten, Backspace goes back to the last point.",
  hintFilter: "Enter filters by the point, Escape clears.",
  hintRange: "Shift with the arrows picks a range.",
  chart: "Chart",
  position: "{index} of {count}",
  filtered: "Filtered to {value}",
  filterCleared: "Filter cleared",
  rangeStart: "Range start set; click again to set the end",
  rangeSelected: "Range selected: {from} to {to}",
  rangeCleared: "Range cleared",
  updated: "Chart updated",
  sorted: "Sorted by {column}, {order}",
  ascending: "ascending",
  descending: "descending",
  controls: "Chart controls",
  expand: "Expand",
  range: "Range",
  from: "From",
  to: "To",
  apply: "Apply",
  clear: "Clear",
  download: "Download",
  downloadSvg: "Download SVG",
  downloadPng: "Download PNG",
  downloadTactile: "Download tactile SVG",
  copyEmbed: "Copy embed",
  embedCopied: "Embed code copied",
  exportFailed: "Could not export",
  sound: "Sound",
  playing: "Playing {series}",
};

/** The x scales a range can be picked on: the continuous ones. */
export const BRUSH_SCALES: readonly string[] = ["linear", "utc", "time", "log", "sqrt", "pow"];

/**
 * The toolbar's icons (record 0035): each a 16-unit path stroked in the text color, beside its
 * word, never instead of it. The stylesheet draws them as masks on an empty, hidden span, so no
 * icon is an `<svg>` a page's chart selectors could pick up.
 */
export const ICONS = {
  sound: "M2.5 6h2.5l3.5-3v10L5 10H2.5zM11 5.5a3.5 3.5 0 0 1 0 5M12.8 3.6a6.2 6.2 0 0 1 0 8.8",
  range: "M2.5 3v10M13.5 3v10M5 8h6M6.8 6 4.8 8l2 2M9.2 6l2 2-2 2",
  expand: "M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10",
  download: "M8 2.5v7.5M4.8 7 8 10.2 11.2 7M3 13.5h10",
  chevron: "m4.5 6.5 3.5 3.5 3.5-3.5",
} as const;
