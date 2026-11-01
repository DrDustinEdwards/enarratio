/**
 * Locale-aware number and date formats, in a module of their own so a page that only formats a
 * number or a date (a site's own text, not a chart) bundles these few functions and not the
 * strings table in text.ts. text.ts re-exports all of them.
 */

/** A value with its sign always shown, and a true minus sign: "+3.2", "−1.5", "0". */
export function signed(format: (value: number) => string, value: number): string {
  return value > 0 ? `+${format(value)}` : value < 0 ? `\u2212${format(-value)}` : format(0);
}

/** A chart's value formatter: the caller's `formatValue`, or numbers for its locale. */
export function valueFormat(options: {
  readonly formatValue?: ((value: number) => string) | undefined;
  readonly locale?: string | undefined;
}): (value: number) => string {
  return options.formatValue ?? numberFormat(options.locale ? { locale: options.locale } : {});
}

/** Options for {@link numberFormat}. */
export interface NumberFormatOptions {
  /** A BCP 47 locale such as `"de-DE"` (default `"en-US"`). */
  readonly locale?: string;
  /**
   * `"decimal"` (default), `"percent"` (0.25 is 25%), `"currency"` (needs `currency`),
   * `"compact"` (1.2K), `"si"` (1.2 k, with SI prefixes from pico to exa, before `unit`) or
   * `"unit"` (needs `unit`, a unit Intl knows, such as `"kilometer-per-hour"`).
   */
  readonly style?: "decimal" | "percent" | "currency" | "compact" | "si" | "unit";
  /** An ISO 4217 code, such as `"EUR"`, for `style: "currency"`. */
  readonly currency?: string;
  /** The unit: an Intl unit for `style: "unit"`, or any symbol after an SI prefix ("g", "B"). */
  readonly unit?: string;
  /** The most digits after the decimal point (default 6; 1 for compact and SI). */
  readonly maximumFractionDigits?: number;
  /**
   * The most significant digits, for values of any size such as fitted parameters (0.00123,
   * 1,230); it takes the place of `maximumFractionDigits`.
   */
  readonly maximumSignificantDigits?: number;
}

const SI_PREFIXES = ["p", "n", "µ", "m", "", "k", "M", "G", "T", "P", "E"];

/**
 * A number formatter for a locale and style, to pass as a chart's `formatValue` or use in a
 * page's own text. Made once, used for every value.
 *
 * @example
 * numberFormat({ locale: "de-DE", style: "currency", currency: "EUR" })(1234.5); // "1.234,50 €"
 * numberFormat({ style: "si", unit: "B" })(1_500_000); // "1.5 MB"
 */
export function numberFormat(options: NumberFormatOptions = {}): (value: number) => string {
  const locale = options.locale ?? "en-US";
  const style = options.style ?? "decimal";
  const digits = options.maximumFractionDigits;
  if (style === "si") {
    const intl = new Intl.NumberFormat(locale, { maximumFractionDigits: digits ?? 1 });
    const unit = options.unit ?? "";
    return (value) => {
      const power =
        value === 0 ? 0 : Math.max(-4, Math.min(6, Math.floor(Math.log10(Math.abs(value)) / 3)));
      const prefix = `${SI_PREFIXES[power + 4]}${unit}`;
      return `${intl.format(value / 1000 ** power)}${prefix ? ` ${prefix}` : ""}`;
    };
  }
  if (style === "currency" && !options.currency) {
    throw new Error('numberFormat: style "currency" needs a currency code, such as "EUR"');
  }
  if (style === "unit" && !options.unit) {
    throw new Error('numberFormat: style "unit" needs a unit, such as "kilometer"');
  }
  const significant = options.maximumSignificantDigits;
  const intl = new Intl.NumberFormat(locale, {
    ...(style === "compact"
      ? { notation: "compact", maximumFractionDigits: digits ?? 1 }
      : significant !== undefined
        ? { style, maximumSignificantDigits: significant }
        : { style, maximumFractionDigits: digits ?? (style === "currency" ? 2 : 6) }),
    ...(style === "currency" ? { currency: options.currency } : {}),
    ...(style === "unit" ? { unit: options.unit } : {}),
  });
  return (value) => intl.format(value);
}

/**
 * How a value axis labels its ticks, from every value it shows (B41): compact ("2.5M") once
 * values reach a million, so tick labels fit their margin; and whether every value is zero, when
 * the axis runs from 0 to 1 instead of collapsing to one tick.
 */
export function valueAxis(
  values: Iterable<number>,
  locale: string | undefined,
): { readonly format?: (value: number) => string; readonly flat: boolean } {
  let max = 0;
  for (const v of values) max = Math.max(max, Math.abs(v));
  return max >= 1e6
    ? { format: numberFormat({ locale: locale ?? "en-US", style: "compact" }), flat: false }
    : { flat: max === 0 };
}

/** Numbers in English (`en-US`, up to six decimals), where no locale reaches the text. */
export const defaultFormat: (value: number) => string = /* @__PURE__ */ numberFormat();

/** Options for {@link dateFormat}. */
export interface DateFormatOptions {
  readonly locale?: string;
  /** The IANA time zone dates are read in (default `"UTC"`). */
  readonly timeZone?: string;
  /** Add the time of day and name the time zone (default false). */
  readonly time?: boolean;
}

/**
 * A date formatter that writes dates out for a locale, "January 5, 2026" in `en-US` and
 * "5. Januar 2026" in `de-DE`, with the time and time zone when `time` is set.
 */
export function dateFormat(options: DateFormatOptions = {}): (date: Date) => string {
  const intl = new Intl.DateTimeFormat(options.locale ?? "en-US", {
    dateStyle: "long",
    timeZone: options.timeZone ?? "UTC",
    ...(options.time ? { timeStyle: "short" } : {}),
  });
  // dateStyle and timeZoneName cannot be combined, so the zone's short name is added after.
  const zone = options.time
    ? new Intl.DateTimeFormat(options.locale ?? "en-US", {
        timeZone: options.timeZone ?? "UTC",
        timeZoneName: "short",
      })
    : undefined;
  return (date) => {
    const name = zone?.formatToParts(date).find((p) => p.type === "timeZoneName")?.value;
    return name ? `${intl.format(date)} ${name}` : intl.format(date);
  };
}
