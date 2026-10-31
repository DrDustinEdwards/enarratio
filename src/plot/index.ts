/**
 * `enarratio/plot`: the charts drawn with Observable Plot (bars, lines, areas, scatter plots,
 * heatmaps, distributions, comparisons and parts of a whole), rendered on the server to HTML. Needs the optional peer dependencies
 * `@observablehq/plot` and, outside a browser, `linkedom`.
 *
 * @packageDocumentation
 */

export type { IntervalFields } from "../render/interval.js";
export type { Annotation, AnnotationValue } from "./annotate.js";
export { type BarChartOptions, barChart } from "./bar.js";
export { type BoxPlotOptions, boxPlot, type StripPlotOptions, stripPlot } from "./box.js";
export { type DivergingBarChartOptions, divergingBarChart } from "./diverging.js";
export {
  type DotPlotOptions,
  type DumbbellPlotOptions,
  dotPlot,
  dumbbellPlot,
  type RangePlotOptions,
  rangePlot,
} from "./dot.js";
export { type SmallMultiplesOptions, smallMultiples } from "./facets.js";
export { type HeatmapOptions, heatmap } from "./heatmap.js";
export {
  type DensityPlotOptions,
  densityPlot,
  type HistogramOptions,
  histogram,
} from "./histogram.js";
export {
  type AreaChartOptions,
  areaChart,
  type EventMarker,
  type LineBand,
  type LineChartOptions,
  lineChart,
  type ReferenceLine,
  type SeriesChartOptions,
} from "./line.js";
export { type PieChartOptions, pieChart } from "./pie.js";
export { type ScatterPlotOptions, scatterPlot } from "./scatter.js";
export { type SlopeChartOptions, slopeChart } from "./slope.js";
export { type WaterfallChartOptions, waterfallChart } from "./waterfall.js";
