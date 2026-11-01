/**
 * Draws a chart again at its frame's width in the browser, so a chart drawn on the server for a
 * wide page fits a 320 px phone instead of shrinking its text below the mark size or scrolling
 * (record 0027). Bar, line and area charts are drawn again by `enarratio/lite`, which draws the
 * same SVG as `enarratio/plot` at any width; any other chart may give a narrow drawing made on the
 * server, used once the frame is under 30rem. Each drawing is enhanced (`enarratio/enhance`).
 *
 * The server writes the spec beside the chart with {@link redrawAttribute}; the page calls
 * {@link redrawCharts} once the document is parsed. Without the script the server's drawing
 * stands, with its table.
 */

import type { EnhanceOptions } from "../enhance/types.js";
import { areaChart } from "../lite/area.js";
import { barChart } from "../lite/bar.js";
import { lineChart } from "../lite/line.js";
import {
  followWidth,
  isStarted,
  narrowChart,
  REDRAW_ATTRIBUTE,
  type RedrawnChart,
} from "./narrow.js";

export { narrowChart, REDRAW_ATTRIBUTE, type RedrawnChart };

/** What a chart is drawn again from: a light chart and its options, or a narrow drawing. */
export type RedrawSpec =
  | { readonly chart: "bar" | "line" | "area"; readonly options: Record<string, unknown> }
  | { readonly narrow: string };

// biome-ignore lint/suspicious/noExplicitAny: each light chart takes its own options.
const DRAW: Record<string, (options: any) => string> = {
  bar: barChart,
  line: lineChart,
  area: areaChart,
};
/** Narrower than this, a drawing would crowd its own axes; the frame scrolls from here down. */
const MIN_WIDTH = 200;
/** Narrower than this, a line chart drops its end labels; its legend names the series. */
const LABELS_MIN_WIDTH = 400;

/**
 * The attribute, escaped for HTML, that a server writes on the element around a chart's figure:
 * `<div class="cap-chart" ${redrawAttribute(spec)}>`.
 */
export function redrawAttribute(spec: RedrawSpec): string {
  const json = JSON.stringify(spec)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
  return `${REDRAW_ATTRIBUTE}="${json}"`;
}

/**
 * Enhances every chart under `root` that carries a spec and draws each again at its frame's
 * width while the page lives. Calling it again is safe: a chart starts once.
 */
export function redrawCharts(
  root: ParentNode = document,
  options: EnhanceOptions = {},
): RedrawnChart[] {
  const hosts = [
    ...(root instanceof Element && root.hasAttribute(REDRAW_ATTRIBUTE) ? [root] : []),
    ...root.querySelectorAll(`[${REDRAW_ATTRIBUTE}]`),
  ];
  const out: RedrawnChart[] = [];
  for (const host of hosts) {
    if (!(host instanceof HTMLElement) || isStarted(host)) continue;
    let spec: RedrawSpec | null = null;
    try {
      spec = JSON.parse(host.getAttribute(REDRAW_ATTRIBUTE) ?? "null");
    } catch {
      spec = null;
    }
    if (spec) out.push(redrawChart(host, spec, options));
  }
  return out;
}

/** Enhances the chart in `host` and draws it again from `spec` whenever its width changes. */
export function redrawChart(
  host: HTMLElement,
  spec: RedrawSpec,
  options: EnhanceOptions = {},
): RedrawnChart {
  if ("narrow" in spec) return narrowChart(host, spec.narrow, options);
  return followWidth(host, (width, original) => drawing(spec, width, original), options);
}

/** The frame markup for a width, and a key that is the same when the drawing would be. */
function drawing(
  spec: Extract<RedrawSpec, { chart: string }>,
  width: number,
  original: string,
): { markup: string; key: string } {
  const kept = { markup: original, key: "original" };
  const draw = DRAW[spec.chart];
  const full = Number(spec.options["width"] ?? 640);
  if (!draw || width >= full || width < MIN_WIDTH) return kept;
  const labels =
    spec.options["directLabels"] && width < LABELS_MIN_WIDTH ? { directLabels: false } : {};
  let html: string;
  try {
    html = draw({ ...spec.options, ...labels, width, onIssue: () => {} });
  } catch {
    return kept;
  }
  const start = html.indexOf('<div class="enarratio-frame');
  const end = html.indexOf("</svg></div>", start);
  if (start === -1 || end === -1) return kept;
  return { markup: html.slice(start, end + "</svg></div>".length), key: String(width) };
}
