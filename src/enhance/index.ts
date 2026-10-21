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
import type { EnhancedChart, EnhanceOptions } from "./types.js";

export type { BrushDetail, EnhancedChart, EnhanceOptions, SelectDetail } from "./types.js";

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
  const resolved: Required<EnhanceOptions> = {
    tooltips: options.tooltips ?? true,
    filter: options.filter ?? true,
    brush: options.brush ?? true,
    entrance: options.entrance ?? true,
  };
  const figures = [...root.querySelectorAll<HTMLElement>("figure.enarratio")];
  if (root instanceof HTMLElement && root.matches("figure.enarratio")) figures.unshift(root);
  return figures.map((figure) => {
    const existing = enhanced.get(figure);
    if (existing && JSON.stringify(existing.options) === JSON.stringify(resolved)) return existing;
    existing?.destroy();
    const chart = new Chart(figure, resolved);
    enhanced.set(figure, chart);
    return chart;
  });
}
