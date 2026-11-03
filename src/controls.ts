/**
 * What the server figure and the enhancement layer share: the layer's strings, so the figure can
 * write the controls the layer will add with the same labels, and the x scales a range can be
 * picked on (record 0033). The layer's bundle inlines it.
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
  showTable: "Show table",
  showChart: "Show chart",
  expand: "Expand",
  collapse: "Close expanded view",
  range: "Pick a range",
  from: "From",
  to: "To",
  apply: "Apply",
  clear: "Clear",
  downloadSvg: "Download SVG",
  downloadPng: "Download PNG",
  downloadTactile: "Download tactile SVG",
  copyEmbed: "Copy embed",
  embedCopied: "Embed code copied",
  exportFailed: "Could not export",
  play: "Play as sound",
  stop: "Stop sound",
  playing: "Playing {series}",
};

/** The x scales a range can be picked on: the continuous ones. */
export const BRUSH_SCALES: readonly string[] = ["linear", "utc", "time", "log", "sqrt", "pow"];
