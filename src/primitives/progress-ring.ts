import { element, escapeHtml } from "../html.js";
import { type SeriesColor, slotStyle } from "../render/figure.js";

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

/**
 * A ring that fills clockwise from the top to show progress toward a total, with the percentage
 * in the middle. Its text alternative states the label, the value and the total.
 *
 * @example
 * progressRing({ value: 7, max: 12, label: "Chapters drafted" });
 */
export function progressRing(options: ProgressRingOptions): string {
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
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const c = size / 2;
  const over = value > max ? ", more than the total" : "";
  const alt =
    given ||
    (max === 1
      ? `${subject}: ${percent}%${over}`
      : `${subject}: ${value} of ${max} (${percent}%${over})`);
  const showValue = options.showValue ?? size >= 36;

  return element(
    "svg",
    {
      class: "abscissa abscissa-progress-ring",
      "data-abscissa": "progress-ring",
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
        stroke: "var(--abscissa-grid)",
        "stroke-width": round(thickness),
      }),
      fraction > 0
        ? element("circle", {
            cx: c,
            cy: c,
            r: round(radius),
            fill: "none",
            stroke: "var(--abscissa-series-1)",
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
              fill: "var(--abscissa-text)",
              "font-size": round(size * 0.28),
              class: "abscissa-numeric",
            },
            `${percent}%`,
          )
        : "",
    ].join(""),
  );
}
