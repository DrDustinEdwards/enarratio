/**
 * `enarratio/lite/sparkline`: {@link sparkline} without the figure, the strings table or a DOM,
 * for browser bundles. It draws the same SVG as `sparkline({ inline: true })` from `enarratio`,
 * named by the same generated sentence unless `alt` is given.
 *
 * @packageDocumentation
 */

import {
  drawSparkline,
  englishSparklineSentence,
  prepareSparkline,
  type SparklineDrawingOptions,
} from "../render/sparkline.js";

/** Options for {@link sparkline}: those of `sparkline` in `enarratio` that shape the drawing. */
export type SparklineOptions = SparklineDrawingOptions;

/**
 * A word-sized line chart without axes: the same options and SVG as `sparkline({ inline: true })` from
 * `enarratio`. Its text alternative is generated in English unless `alt` is given; give `alt` for another
 * language, as this entry has no strings table.
 */
export function sparkline(options: SparklineOptions): string {
  return drawSparkline(prepareSparkline(options, englishSparklineSentence), options);
}
