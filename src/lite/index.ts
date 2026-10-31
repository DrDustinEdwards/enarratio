/**
 * `enarratio/lite`: the bar, line and area charts without Observable Plot, linkedom or a DOM.
 * The same options draw the same SVG as the charts in `enarratio/plot`, in a bundle small enough
 * to render charts in a browser. Each chart also has its own entry (`enarratio/lite/bar`,
 * `enarratio/lite/line`, `enarratio/lite/area`) for the smallest bundles.
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
