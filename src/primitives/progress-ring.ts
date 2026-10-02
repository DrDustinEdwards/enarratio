import { element, escapeHtml } from "../html.js";
import { type SeriesColor, slotStyle } from "../render/figure.js";
import { type PrimitiveTable, type PrimitiveTableOptions, primitiveTable } from "./companion.js";

/** Options for {@link progressRing}. */
export interface ProgressRingOptions {
  /** Progress so far, from 0 to `max`. */
  readonly value: number;
  /** The value that fills the ring (default 1). */
  readonly max?: number;
  /**
   * What is progressing, e.g. "Chapters drafted"; it starts the generated text alternative.
   * Required unless `alt` is given.
   */
  readonly label?: string;
  /** The text alternative, instead of the one generated from `label` and the values (F18). */
  readonly alt?: string;
  /** The ring's outer diameter in CSS pixels (default 40). */
  readonly size?: number;
  /** The ring's stroke width (default size / 8). */
  readonly thickness?: number;
  /** Print the percentage in the middle (default true when size is 36 or more). */
  readonly showValue?: boolean;
  /** The ring's color; defaults to the theme's first series color. */
  readonly color?: SeriesColor;
}

const round = (n: number): number => Math.round(n * 100) / 100;

/** Everything the ring, its text alternative and its companion table are computed from. */
export interface ProgressRingValues {
  readonly value: number;
  readonly max: number;
  /** The share of the ring filled, from 0 to 1 (a value past `max` fills it). */
  readonly fraction: number;
  /** The real percentage, which may pass 100. */
  readonly percent: number;
  readonly size: number;
  readonly thickness: number;
  readonly subject: string;
  /** The sentence generated from the label and values, or "" when only `alt` names the ring. */
  readonly summary: string;
  readonly alt: string;
}

/** Validates the options and computes the numbers every part of a progress ring is made from. */
export function prepareProgressRing(options: ProgressRingOptions): ProgressRingValues {
  const max = options.max ?? 1;
  const { value } = options;
  if (!Number.isFinite(max) || max <= 0)
    throw new Error(`progressRing: max must be above zero, is ${max}`);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`progressRing: value must be zero or more, is ${value}`);
  }
  const subject = options.label?.trim() ?? "";
  const given = options.alt?.trim() ?? "";
  if (subject === "" && given === "") throw new Error("progressRing: label or alt is required");
  const size = options.size ?? 40;
  const thickness = options.thickness ?? size / 8;
  for (const [name, n] of [
    ["size", size],
    ["thickness", thickness],
  ] as const) {
    if (!(Number.isFinite(n) && n > 0)) {
      throw new Error(`progressRing: ${name} must be a positive number, is ${n}`);
    }
  }
  if (thickness >= size) throw new Error("progressRing: thickness must be less than size");
  // The ring can only be full, but the number says how far past the total the value is (A7).
  const fraction = Math.min(1, value / max);
  const percent = Math.round((value / max) * 100);
  const over = value > max ? ", more than the total" : "";
  const summary =
    subject === ""
      ? ""
      : max === 1
        ? `${subject}: ${percent}%${over}`
        : `${subject}: ${value} of ${max} (${percent}%${over})`;
  return {
    value,
    max,
    fraction,
    percent,
    size,
    thickness,
    subject,
    summary,
    alt: given || summary,
  };
}

/**
 * A ring that fills clockwise from the top to show progress toward a total, with the percentage
 * in the middle. Its text alternative states the label, the value and the total.
 *
 * @example
 * progressRing({ value: 7, max: 12, label: "Chapters drafted" });
 */
export function progressRing(options: ProgressRingOptions): string {
  const { fraction, percent, size, thickness, alt } = prepareProgressRing(options);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const c = size / 2;
  const showValue = options.showValue ?? size >= 36;

  return element(
    "svg",
    {
      class: "enarratio enarratio-progress-ring",
      "data-enarratio": "progress-ring",
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: `0 0 ${size} ${size}`,
      width: size,
      height: size,
      role: "img",
      "aria-label": alt,
      style: slotStyle(options.color ? new Map([[1, options.color]]) : undefined),
    },
    [
      element("title", {}, escapeHtml(alt)),
      element("circle", {
        cx: c,
        cy: c,
        r: round(radius),
        fill: "none",
        stroke: "var(--enarratio-grid)",
        "stroke-width": round(thickness),
      }),
      fraction > 0
        ? element("circle", {
            cx: c,
            cy: c,
            r: round(radius),
            fill: "none",
            stroke: "var(--enarratio-series-1)",
            "stroke-width": round(thickness),
            "stroke-linecap": fraction < 1 ? "round" : "butt",
            "stroke-dasharray": `${round(circumference * fraction)} ${round(circumference)}`,
            transform: `rotate(-90 ${c} ${c})`,
          })
        : "",
      showValue
        ? element(
            "text",
            {
              x: c,
              y: c,
              "text-anchor": "middle",
              "dominant-baseline": "central",
              fill: "var(--enarratio-text)",
              "font-size": round(size * 0.28),
              class: "enarratio-numeric",
            },
            `${percent}%`,
          )
        : "",
    ].join(""),
  );
}

/**
 * A progress ring's numbers as a table (value, total and percentage) and a summary sentence,
 * computed from the same values as the ring so the two cannot disagree. Takes the same options as
 * {@link progressRing}. Without `label` the summary is the given `alt`.
 *
 * @example
 * const { summary } = progressRingTable({ value: 7, max: 12, label: "Chapters drafted" });
 */
export function progressRingTable(
  options: ProgressRingOptions,
  display?: PrimitiveTableOptions,
): PrimitiveTable {
  const p = prepareProgressRing(options);
  return primitiveTable(
    p.summary || p.alt,
    {
      columns: ["Measure", "Value", "Total", "Percent"],
      rows: [[p.subject || "Progress", String(p.value), String(p.max), `${p.percent}%`]],
    },
    p.subject || p.alt,
    display,
  );
}
