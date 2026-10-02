import { element, escapeHtml } from "../html.js";
import {
  defaultFormat,
  maxOf,
  minOf,
  rampStep,
  rampThresholds,
  requireSize,
} from "../render/data.js";

/** Options for {@link heatStrip}. */
export interface HeatStripOptions {
  /** One value per cell, in order. `null` is a cell with no data, drawn as a dashed outline. */
  readonly values: readonly (number | null)[];
  /**
   * What the strip shows and over what window, e.g. "Requests per hour, last 48 hours"; it starts
   * the generated text alternative. Required unless `alt` is given.
   */
  readonly label?: string;
  /** The text alternative, instead of the one generated from `label` and the values. */
  readonly alt?: string;
  /** The strip's width in CSS pixels (default 240). */
  readonly width?: number;
  /** The strip's height in CSS pixels (default 24). */
  readonly height?: number;
  /**
   * The values the ramp runs from and to. Default: the lowest and highest value, so the strip
   * uses all five steps; fix them to compare strips drawn from different data.
   */
  readonly min?: number;
  readonly max?: number;
  /**
   * Four ascending values splitting the range into the ramp's five steps, as in `heatmap`.
   * Default: equal intervals between `min` and `max`.
   */
  readonly thresholds?: readonly [number, number, number, number];
  /** Hover text naming each cell, e.g. "Mon 14:00"; the value is added. Default "Cell 3". */
  readonly cellLabels?: readonly string[];
  /** Formats values in hover details and the text alternative. */
  readonly formatValue?: (value: number) => string;
}

const KIND = "heatStrip";

/** Everything the strip, its text alternative and its companion table are computed from. */
export interface HeatStripValues {
  readonly values: readonly (number | null)[];
  /** The ramp step, 1 to 5, of each cell; 0 for a cell with no data. */
  readonly steps: readonly number[];
  readonly min: number;
  readonly max: number;
  readonly thresholds: readonly number[];
  readonly format: (value: number) => string;
  readonly cellLabel: (index: number) => string;
  readonly subject: string;
  /** The sentence that names the values; the default text alternative. */
  readonly summary: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
}

const round = (n: number): number => Math.round(n * 100) / 100;

/** Validates the options and computes the numbers every part of a heat strip is made from. */
export function prepareHeatStrip(options: HeatStripOptions): HeatStripValues {
  const { values } = options;
  if (values.length === 0) throw new Error(`${KIND}: needs at least one value`);
  const subject = options.label?.trim() ?? "";
  const given = options.alt?.trim() ?? "";
  if (subject === "" && given === "") throw new Error(`${KIND}: label or alt is required`);
  const width = options.width ?? 240;
  const height = options.height ?? 24;
  requireSize(KIND, "width", width);
  requireSize(KIND, "height", height);
  values.forEach((v, i) => {
    if (v !== null && !Number.isFinite(v)) {
      throw new Error(`${KIND}: value ${i + 1} is ${v}, not a finite number or null`);
    }
  });
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) throw new Error(`${KIND}: every value is empty`);
  const min = options.min ?? minOf(present);
  const max = options.max ?? maxOf(present);
  for (const [name, n] of [
    ["min", min],
    ["max", max],
  ] as const) {
    if (!Number.isFinite(n)) throw new Error(`${KIND}: ${name} must be a finite number, is ${n}`);
  }
  if (min > max) throw new Error(`${KIND}: min ${min} is above max ${max}`);
  const thresholds = rampThresholds(KIND, min, max, options.thresholds);
  const labels = options.cellLabels;
  if (labels !== undefined && labels.length !== values.length) {
    throw new Error(
      `${KIND}: cellLabels has ${labels.length} entries for ${values.length} values; give one each`,
    );
  }
  const format = options.formatValue ?? defaultFormat;
  const lowest = minOf(present);
  const highest = maxOf(present);
  const missing = values.length - present.length;
  const summary = `${subject === "" ? "" : `${subject}: `}${defaultFormat(values.length)} cells, from ${format(present[0] as number)} to ${format(present[present.length - 1] as number)}; lowest ${format(lowest)}, highest ${format(highest)}${missing > 0 ? `; ${missing} with no data` : ""}.`;
  return {
    values,
    steps: values.map((v) => (v === null ? 0 : rampStep(v, thresholds))),
    min,
    max,
    thresholds,
    format,
    cellLabel: (i) => labels?.[i] ?? `Cell ${i + 1}`,
    subject,
    summary,
    width,
    height,
    alt: given || summary,
  };
}

/**
 * A one-row strip of cells with no axis, each colored on the theme's sequential ramp by its value:
 * hours of load, days of activity, a sibling of {@link uptimeStrip}. It carries a text alternative
 * summarizing the values, and each cell has hover details. Colors come in five steps, so read the
 * numbers from the hover details or from {@link heatStripTable}.
 *
 * @example
 * heatStrip({ values: [3, 5, 9, 14, 8, 2], label: "Requests per hour" });
 */
export function heatStrip(options: HeatStripOptions): string {
  const p = prepareHeatStrip(options);
  const step = p.width / p.values.length;
  const gap = step > 4 ? 1 : 0;
  const cells = p.values.map((value, i) => {
    const title = `${p.cellLabel(i)}: ${value === null ? "no data" : p.format(value)}`;
    const common = {
      x: round(i * step),
      y: 0,
      width: round(step - gap),
      height: p.height,
    };
    return element(
      "rect",
      value === null
        ? {
            ...common,
            x: round(i * step + 0.5),
            y: 0.5,
            width: round(step - gap - 1),
            height: p.height - 1,
            fill: "none",
            stroke: "var(--enarratio-text-muted)",
            "stroke-dasharray": "2,2",
          }
        : {
            ...common,
            fill: `var(--enarratio-sequential-${p.steps[i]})`,
            // A hairline keeps the palest step visible against the page.
            stroke: "var(--enarratio-grid)",
            "stroke-width": 0.5,
            "data-enarratio-step": p.steps[i],
          },
      element("title", {}, escapeHtml(title)),
    );
  });
  return element(
    "svg",
    {
      class: "enarratio enarratio-heat-strip",
      "data-enarratio": "heat-strip",
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: `0 0 ${p.width} ${p.height}`,
      width: p.width,
      height: p.height,
      role: "img",
      "aria-label": p.alt,
    },
    cells.join(""),
  );
}
