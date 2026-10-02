/**
 * `enarratio/plot`: the charts drawn with Observable Plot (bars, lines, areas, scatter plots and
 * heatmaps), rendered on the server to HTML. Needs the optional peer dependencies
 * `@observablehq/plot` and, outside a browser, `linkedom`.
 *
 * @packageDocumentation
 */

export { type BarChartOptions, barChart } from "./bar.js";
export { type HeatmapOptions, heatmap } from "./heatmap.js";
export {
  areaChart,
  type EventMarker,
  type LineChartOptions,
  lineChart,
  type ReferenceLine,
  type SeriesChartOptions,
} from "./line.js";
export { type ScatterPlotOptions, scatterPlot } from "./scatter.js";
