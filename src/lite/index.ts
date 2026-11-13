/**
 * `enarratio/lite`: the bar, line and area charts without Observable Plot, linkedom or a DOM.
 * The same options draw the same SVG as the charts in `enarratio/plot`, in a bundle small enough
 * to render charts in a browser; `sparkline` draws the bare SVG of `sparkline({ inline: true })`
 * from `enarratio`. Each has its own entry (`enarratio/lite/bar`, `enarratio/lite/line`,
 * `enarratio/lite/area`, `enarratio/lite/sparkline`) for the smallest bundles.
 *
 * @packageDocumentation
 */

export { type AreaChartOptions, areaChart } from "./area.js";
export { type BarChartOptions, barChart } from "./bar.js";
export {
  type EventMarker,
  type LineBand,
  type LineChartOptions,
  lineChart,
  type ReferenceLine,
  type SeriesChartOptions,
} from "./line.js";
export { type SparklineOptions, sparkline } from "./sparkline.js";
