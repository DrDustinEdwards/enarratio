/**
 * `enarratio/lite`: the bar, line and area charts without Observable Plot, linkedom or a DOM, drawing the
 * same SVG as `enarratio/plot` in a bundle small enough for a browser. Each has its own entry
 * (`enarratio/lite/bar`, `/line`, `/area`, `/sparkline`) for the smallest bundles.
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
