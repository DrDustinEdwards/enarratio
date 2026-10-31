/** Uncertainty intervals the caller computed (error bars, confidence intervals), read from rows. */

import { type KeysOfType, readNumberOrNull } from "./data.js";
import { ENGLISH, type Strings } from "./text.js";

/**
 * An interval around each value, from two fields: error bars, a confidence interval, a range.
 * Enarratio draws intervals; it does not estimate them.
 */
export interface IntervalFields<T extends object> {
  /** The field for the lower bound. `null` on both bounds draws no interval for that row. */
  readonly lower: KeysOfType<T, number | null | undefined>;
  /** The field for the upper bound; never below `lower`. */
  readonly upper: KeysOfType<T, number | null | undefined>;
  /** What the interval is, e.g. "95% CI" or "± 1 SD". It names table columns and hover details. */
  readonly label?: string;
}

/** One row's interval. */
export interface Bounds {
  readonly lower: number;
  readonly upper: number;
}

/**
 * Reads a row's interval, or null when the row has neither bound. Throws when it has only one,
 * when the bounds are reversed, or when they leave out the value they surround.
 */
export function readInterval<T extends object>(
  kind: string,
  row: T,
  fields: IntervalFields<T>,
  index: number,
  value?: number,
): Bounds | null {
  const lower = readNumberOrNull(kind, row, fields.lower, index);
  const upper = readNumberOrNull(kind, row, fields.upper, index);
  if (lower === null && upper === null) return null;
  if (lower === null || upper === null) {
    throw new Error(
      `${kind}: row ${index + 1} has only one of "${fields.lower}" and "${fields.upper}"; give both or neither`,
    );
  }
  if (lower > upper) {
    throw new Error(
      `${kind}: row ${index + 1} lower bound ${lower} is above its upper bound ${upper}`,
    );
  }
  if (value !== undefined && (value < lower || value > upper)) {
    throw new Error(
      `${kind}: row ${index + 1} value ${value} lies outside its interval ${lower} to ${upper}`,
    );
  }
  return { lower, upper };
}

/** An interval as text: "95% CI 1.2 to 3.4". */
export function intervalText(
  bounds: Bounds,
  format: (value: number) => string,
  label: string | undefined,
  strings: Strings = ENGLISH,
): string {
  return `${label ?? strings.terms.interval.toLowerCase()} ${strings.range(format(bounds.lower), format(bounds.upper))}`;
}
