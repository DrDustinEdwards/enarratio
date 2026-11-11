import { el, svgRoot, text } from "../lite/svg.js";
import { arcPath, n2, polar } from "../render/arc.js";
import { markKey } from "../render/data.js";
import { datumAttributes } from "../render/datum.js";
import { type FigureOptions, figure, validateFigure } from "../render/figure.js";
import { charWidth, textGrowth } from "../render/size.js";
import { stringsFor, valueFormat } from "../render/text.js";

/** A qualitative band of a gauge or bullet chart: up to `to`, named. */
export interface QualitativeBand {
  /** Where the band ends; bands run in ascending order from the scale's start. */
  readonly to: number;
  readonly label: string;
}

/** Options for {@link gaugeChart}. */
export interface GaugeChartOptions extends FigureOptions {
  /** The value shown. */
  readonly value: number;
  /** What it measures ("Capacity used"), printed under the value and in the table. */
  readonly label: string;
  /** The scale's start (default 0) and end. */
  readonly min?: number;
  readonly max: number;
  /** A target, marked by a tick across the arc. */
  readonly target?: number;
  /** Two to five qualitative bands along the arc, ascending (record 0038). */
  readonly bands?: readonly QualitativeBand[];
  /** Whether low values are good, which reverses the bands' shading (dark is always worse). */
  readonly lowerIsBetter?: boolean;
  readonly formatValue?: (value: number) => string;
}

const KIND = "gauge";
/** The arc runs from 8 o'clock to 4 o'clock: 240 degrees. */
const START = (-2 / 3) * Math.PI;
const SWEEP = (4 / 3) * Math.PI;

/**
 * The ramp step for band `i` of `n`: one hue, darkest for the worst band and lightest for the
 * best (Few 2013); the first band is the worst unless lower is better.
 */
export function shade(i: number, n: number, lowerIsBetter = false): number {
  return lowerIsBetter ? i + 1 : n - i;
}

/**
 * Checks bands for a gauge or bullet chart: two to five, ascending, inside the scale, the last
 * ending at the scale's end.
 */
export function checkBands(
  kind: string,
  bands: readonly QualitativeBand[],
  min: number,
  max: number,
): void {
  if (bands.length < 2 || bands.length > 5) {
    throw new Error(`${kind}: ${bands.length} bands; give two to five (three reads best)`);
  }
  let from = min;
  for (const b of bands) {
    if (!(Number.isFinite(b.to) && b.to > from)) {
      throw new Error(`${kind}: band "${b.label}" ends at ${b.to}; bands must ascend from ${min}`);
    }
    from = b.to;
  }
  if (from !== max)
    throw new Error(`${kind}: the last band ends at ${from}, not at the scale's end ${max}`);
}

/**
 * A gauge: one value against its scale, as a filled arc with the number printed large in its
 * middle, for a dashboard's single reading (capacity used, a score). Optional qualitative bands
 * run along the outer edge in steps of one hue, dark to light, and a target is a tick across the
 * arc. A bullet chart shows the same in less room and lines several up, so prefer `bulletChart`
 * where there is more than one measure (Few 2013).
 *
 * @example
 * gaugeChart({ value: 72, max: 100, label: "Beds occupied (%)", target: 85, alt: "..." });
 */
export function gaugeChart(options: GaugeChartOptions): string {
  validateFigure(KIND, options);
  const min = options.min ?? 0;
  const { max, value } = options;
  const format = valueFormat(options);
  const { terms } = stringsFor(options.strings);
  for (const [name, v] of [
    ["value", value],
    ["min", min],
    ["max", max],
  ] as const) {
    if (!Number.isFinite(v)) throw new Error(`${KIND}: ${name} is ${v}, not a finite number`);
  }
  if (!(max > min)) throw new Error(`${KIND}: max (${max}) must be above min (${min})`);
  if (value < min || value > max)
    throw new Error(`${KIND}: value ${value} is outside ${min} to ${max}`);
  const target = options.target;
  if (target !== undefined && (target < min || target > max)) {
    throw new Error(`${KIND}: target ${target} is outside ${min} to ${max}`);
  }
  const bands = options.bands ?? [];
  if (bands.length > 0) checkBands(KIND, bands, min, max);

  const width = options.width ?? 320;
  const growth = textGrowth(width);
  // Below the arc: a line for the scale's ends, then one for what the gauge measures.
  const below = 2 * 14 * growth + 10;
  const height = options.height ?? Math.round((width / 2 - 6) * 1.5 + 6 + below);
  const char = charWidth(width);
  const cx = width / 2;
  const lineHeight = 14 * growth;
  const radius = Math.max(30, Math.min(width / 2 - 6, (height - 6 - below) / 1.5));
  const cy = radius + 6;
  const thick = radius * 0.2;
  const bandWidth = Math.max(4, radius * 0.06);
  const angle = (v: number): number => START + ((v - min) / (max - min)) * SWEEP;
  const outer = bands.length > 0 ? radius - bandWidth - 3 : radius;
  const inner = outer - thick;
  const bandOf = (v: number): QualitativeBand | undefined => bands.find((b) => v <= b.to);
  const band = bandOf(value);
  const shown = format(value);

  const track = el("path", {
    d: arcPath(cx, cy, outer, inner, START, START + SWEEP),
    fill: "var(--enarratio-grid)",
  });
  const fill =
    value > min
      ? el(
          "path",
          {
            d: arcPath(cx, cy, outer, inner, START, angle(value)),
            fill: "var(--enarratio-series-1)",
            ...Object.fromEntries(
              datumAttributes({
                key: markKey(options.label),
                column: 0,
                row: 0,
                at: options.label,
                shown: band ? `${shown} (${band.label})` : shown,
              }),
            ),
          },
          el("title", {}, text(`${options.label}: ${shown}${band ? `, ${band.label}` : ""}`)),
        )
      : "";
  let from = min;
  const bandArcs = bands
    .map((b, i) => {
      const step = shade(i, bands.length, options.lowerIsBetter);
      const d = arcPath(cx, cy, radius, radius - bandWidth, angle(from), angle(b.to));
      from = b.to;
      return el("path", { d, fill: `var(--enarratio-sequential-${step})` });
    })
    .join("");
  const tick =
    target === undefined
      ? ""
      : (() => {
          const [x0, y0] = polar(cx, cy, inner - 4, angle(target));
          const [x1, y1] = polar(cx, cy, outer + 4, angle(target));
          return el("line", {
            x1: n2(x0),
            y1: n2(y0),
            x2: n2(x1),
            y2: n2(y1),
            stroke: "var(--enarratio-text)",
            "stroke-width": 3,
          });
        })();
  const [lx] = polar(cx, cy, (outer + inner) / 2, START);
  const [rx] = polar(cx, cy, (outer + inner) / 2, START + SWEEP);
  const foot = cy + radius * 0.5;
  const big = Math.min(2.4, (inner * 1.6) / Math.max(1, shown.length * char));
  const texts = [
    el(
      "text",
      { x: n2(cx), y: n2(cy), dy: "0.32em", "font-size": `${n2(big)}em`, "font-weight": "600" },
      text(shown),
    ),
    el("text", { x: n2(lx), y: n2(foot + lineHeight) }, text(format(min))),
    el("text", { x: n2(rx), y: n2(foot + lineHeight) }, text(format(max))),
    el(
      "text",
      { x: n2(cx), y: n2(foot + lineHeight * 2 + 4), fill: "var(--enarratio-text-muted)" },
      text(band ? `${options.label}: ${band.label}` : options.label),
    ),
  ].join("");

  const svg = svgRoot(
    width,
    height,
    options.alt,
    "img",
    [
      el("g", { "data-enarratio-mark": "band", "aria-hidden": "true" }, bandArcs),
      el("g", { "data-enarratio-mark": "track", "aria-hidden": "true" }, track),
      el("g", { "data-enarratio-mark": "bar" }, fill),
      el("g", { "data-enarratio-mark": "target", "aria-hidden": "true" }, tick),
      el(
        "g",
        {
          "data-enarratio-mark": "gauge label",
          "aria-hidden": "true",
          fill: "var(--enarratio-text)",
        },
        texts,
      ),
    ].join(""),
  );

  const columns = [terms.measure, terms.value, terms.minimum, terms.maximum];
  const row = [options.label, shown, format(min), format(max)];
  if (target !== undefined) {
    columns.push(terms.targetValue);
    row.push(format(target));
  }
  if (band) {
    columns.push(terms.band);
    row.push(band.label);
  }
  return figure(options, {
    kind: KIND,
    svg,
    description: {
      format,
      axes: [{ position: "x", label: options.label, from: format(min), to: format(max) }],
      series: [{ name: options.label, points: [{ at: options.label, value }] }],
    },
    table: { columns, rows: [row] },
  });
}
