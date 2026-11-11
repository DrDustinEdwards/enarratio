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

import { ENHANCE_STRINGS } from "../controls.js";
import { Chart, enhanced } from "./chart.js";
import type { EnhancedChart, EnhanceOptions, ResolvedOptions } from "./types.js";

export type {
  BrushDetail,
  EnhancedChart,
  EnhanceOptions,
  EnhanceStrings,
  ResolvedOptions,
  SelectDetail,
} from "./types.js";
export { ENHANCE_STRINGS };

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
    tactile: options.tactile ?? true,
    embed: options.embed ?? true,
    sound: options.sound ?? true,
    strings: { ...ENHANCE_STRINGS, ...options.strings },
  };
  // A primitive's figure (data-enarratio-static) has no points to read or filter, so it gets
  // only its toolbar: the Download menu with the drawing's files (chart.ts attach).
  const selector = "figure.enarratio";
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
