/**
 * `enarratio/science`: figures for the laboratory (genome tracks, titer plots) and the network
 * chart. Needs the optional peer dependencies `@observablehq/plot` and `d3-force`, and, outside a
 * browser, `linkedom`.
 *
 * @packageDocumentation
 */

export { type GenomeFeature, type GenomeTrackOptions, genomeTrack } from "./genome.js";
export {
  type NetworkChartOptions,
  type NetworkLink,
  type NetworkNode,
  networkChart,
} from "./network.js";
export { type GeometricSummary, geometricSummary } from "./stats.js";
export { type DilutionSeries, type TiterPlotOptions, titerPlot } from "./titer.js";
