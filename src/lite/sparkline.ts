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
 * A word-sized line chart for a trend beside a number, without axes: the same options and SVG as
 * `sparkline({ inline: true })` from `enarratio`. Its text alternative is generated in English
 * from the data (count, first, last, lowest, highest) unless `alt` is given; give `alt` for
 * another language, as this entry does not carry the strings table.
 *
 * @example
 * sparkline({ values: [3, 5, 4, 8, 11], label: "Entries per year" });
 */
export function sparkline(options: SparklineOptions): string {
  return drawSparkline(prepareSparkline(options, englishSparklineSentence), options);
}
