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
export { type HeatStripOptions, heatStrip } from "./primitives/heat-strip.js";
export { type ProgressRingOptions, progressRing } from "./primitives/progress-ring.js";
export { type SparklineOptions, sparkline } from "./primitives/sparkline.js";
export {
  type TimelineEvent,
  type TimelineOptions,
  type TimelinePoint,
  type TimelineSpan,
  type TimelineStatus,
  type TimelineTime,
  timeline,
} from "./primitives/timeline.js";
export {
  type UptimeSlot,
  type UptimeStatus,
  type UptimeStripOptions,
  uptimeStrip,
} from "./primitives/uptime-strip.js";
export {
  type DataTable,
  type FigureOptions,
  type FigureParts,
  figure,
  type LegendItem,
  type RampItem,
  type ScaleDescription,
  type SeriesColor,
  slotStyle,
  validateFigure,
} from "./render/figure.js";
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
