/**
 * Enarratio core: accessible, server-rendered charts and scientific figures for the web.
 *
 * The root import has no runtime dependencies. It holds the theme types and stylesheet, the
 * color checks, the HTML helpers and figure assembly that every chart is built from, and the
 * small primitives (sparkline, progress ring, uptime strip), which also run in the browser.
 * Charts live in `enarratio/plot` and `enarratio/science`, and the interaction layer in
 * `enarratio/enhance`. Include {@link stylesheet} (or `enarratio/base.css`) once per page.
 *
 * @packageDocumentation
 */

export { type AttributeValue, element, escapeHtml } from "./html.js";
export type {
  PrimitiveFigureOptions,
  PrimitiveTable,
  PrimitiveTableOptions,
} from "./primitives/companion.js";
export { type HeatStripOptions, heatStrip, heatStripTable } from "./primitives/heat-strip.js";
export {
  type ProgressRingOptions,
  progressRing,
  progressRingTable,
} from "./primitives/progress-ring.js";
export { type SparklineOptions, sparkline, sparklineTable } from "./primitives/sparkline.js";
export {
  type TimelineEvent,
  type TimelineOptions,
  type TimelinePoint,
  type TimelineSpan,
  type TimelineStatus,
  type TimelineTime,
  timeline,
  timelineTable,
} from "./primitives/timeline.js";
export {
  type UptimeSlot,
  type UptimeStatus,
  type UptimeStripOptions,
  uptimeStrip,
  uptimeStripTable,
} from "./primitives/uptime-strip.js";
export { type DatasetOptions, datasetJsonLd } from "./render/dataset.js";
export type { ChartDescription, SummaryPoint, SummarySeries } from "./render/describe.js";
export {
  type AxisUnits,
  type ChartIssue,
  type DataTable,
  dataTableBlock,
  type FigureOptions,
  type FigureParts,
  figure,
  type IssueOptions,
  type LegendItem,
  type RampItem,
  type ScaleDescription,
  type SeriesColor,
  type Source,
  slotStyle,
  validateFigure,
} from "./render/figure.js";
export {
  type DateFormatOptions,
  dateFormat,
  type NumberFormatOptions,
  numberFormat,
} from "./render/format.js";
export { type TableChartOptions, type TableColumn, tableChart } from "./render/table-chart.js";
export {
  type At,
  type AxisRange,
  ENGLISH,
  readingGrade,
  type StringOverrides,
  type Strings,
  type Terms,
  toCsv,
} from "./render/text.js";
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
  labelColor,
  type Rgb,
  readableShade,
  simulateColorVision,
} from "./theme/color.js";
export { defineTheme } from "./theme/define.js";
export {
  baseStylesheet,
  colorStyles,
  type StylesheetOptions,
  stylesheet,
} from "./theme/stylesheet.js";
export type {
  ColorScheme,
  Gridlines,
  HexColor,
  SequentialRamp,
  SeriesPalette,
  StatusColors,
  Theme,
  ThemeColor,
} from "./theme/types.js";
