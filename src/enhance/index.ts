/**
 * The enhancement layer: optional browser code that adds hover details, keyboard navigation,
 * click-to-filter events, a range brush, animated updates and an entrance animation to charts
 * Enarratio rendered on the server. Charts are complete without it.
 *
 * Every interaction works by pointer and by keyboard, is announced to screen readers, and
 * respects `prefers-reduced-motion`. It has no dependencies and imports nothing from the
 * server-side package, so a page ships only this module.
 *
 * @packageDocumentation
 */

import { Chart, enhanced } from "./chart.js";
import type { EnhancedChart, EnhanceOptions, EnhanceStrings, ResolvedOptions } from "./types.js";

export type {
  BrushDetail,
  EnhancedChart,
  EnhanceOptions,
  EnhanceStrings,
  ResolvedOptions,
  SelectDetail,
} from "./types.js";

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
  copyEmbed: "Copy embed",
  embedCopied: "Embed code copied",
  exportFailed: "Could not export",
};

/**
 * Enhances every Enarratio figure under `root` (the whole document by default) and returns them.
 * Calling it again is safe: a figure is enhanced once, and calling it with different options
 * re-applies the chart with the new ones (F18).
 *
 * @example
 * import { enhance } from "enarratio/enhance";
 * enhance();
 * document.addEventListener("enarratio:select", (e) => filterList(e.detail.field, e.detail.value));
 */
export function enhance(
  root: ParentNode = document,
  options: EnhanceOptions = {},
): EnhancedChart[] {
  const resolved: ResolvedOptions = {
    tooltips: options.tooltips ?? true,
    filter: options.filter ?? true,
    brush: options.brush ?? true,
    entrance: options.entrance ?? true,
    table: options.table ?? true,
    expand: options.expand ?? false,
    url: options.url ?? false,
    download: options.download ?? true,
    embed: options.embed ?? true,
    strings: { ...ENHANCE_STRINGS, ...options.strings },
  };
  // A primitive's figure (data-enarratio-static) has nothing to interact with.
  const selector = "figure.enarratio:not([data-enarratio-static])";
  const figures = [...root.querySelectorAll<HTMLElement>(selector)];
  if (root instanceof HTMLElement && root.matches(selector)) figures.unshift(root);
  return figures.map((figure) => {
    const existing = enhanced.get(figure);
    if (existing && JSON.stringify(existing.options) === JSON.stringify(resolved)) return existing;
    existing?.destroy();
    const chart = new Chart(figure, resolved);
    enhanced.set(figure, chart);
    return chart;
  });
}
