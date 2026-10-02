/**
 * Enarratio: accessible, server-rendered charts and scientific figures for the web.
 *
 * Every chart function returns HTML (a `<figure>`, or an `<svg>` for primitives) that reads
 * without scripts. Include {@link stylesheet} once per page for the theme, and optionally
 * `enhance()` from `enarratio/enhance` for hover, keyboard and filter interactions.
 *
 * @packageDocumentation
 */

export { type BarChartOptions, barChart } from "./charts/bar.js";
export { type HeatmapOptions, heatmap } from "./charts/heatmap.js";
export {
  areaChart,
  type EventMarker,
  type LineChartOptions,
  lineChart,
  type ReferenceLine,
  type SeriesChartOptions,
} from "./charts/line.js";
export {
  type NetworkChartOptions,
  type NetworkLink,
  type NetworkNode,
  networkChart,
} from "./charts/network.js";
export { type ScatterPlotOptions, scatterPlot } from "./charts/scatter.js";
export { type ProgressRingOptions, progressRing } from "./primitives/progress-ring.js";
export { type SparklineOptions, sparkline } from "./primitives/sparkline.js";
export {
  type UptimeSlot,
  type UptimeStatus,
  type UptimeStripOptions,
  uptimeStrip,
} from "./primitives/uptime-strip.js";
export type { FigureOptions, SeriesColor } from "./render/figure.js";
export { type GenomeFeature, type GenomeTrackOptions, genomeTrack } from "./science/genome.js";
export { type GeometricSummary, geometricSummary } from "./science/stats.js";
export { type DilutionSeries, type TiterPlotOptions, titerPlot } from "./science/titer.js";
export {
  type CheckIssue,
  type CheckReport,
  type CheckThresholds,
  checkTheme,
  DEFAULT_THRESHOLDS,
} from "./theme/check.js";
export {
  type ColorVision,
  colorDifference,
  contrastRatio,
  type Rgb,
  simulateColorVision,
} from "./theme/color.js";
export { defineTheme } from "./theme/define.js";
export { baseStylesheet, type StylesheetOptions, stylesheet } from "./theme/stylesheet.js";
export type {
  ColorScheme,
  Gridlines,
  HexColor,
  SequentialRamp,
  SeriesPalette,
  StatusColors,
  Theme,
} from "./theme/types.js";
export { defaultTheme } from "./themes/default.js";
export { dustinedwardsTheme } from "./themes/dustinedwards.js";
