/**
 * The finish both area renderers share (record 0036): each stacked band named at its right end,
 * read from the finished SVG's points so `enarratio/plot` and `enarratio/lite` agree by
 * construction, as {@link texture} does for patterns.
 */

import { escapeHtml } from "../html.js";
import { num } from "../lite/svg.js";
import { spreadLabels } from "./direct-labels.js";
import type { Prepared } from "./line-model.js";
import type { SeriesPlan } from "./series.js";

/** How far past the last point a band's name starts, in user units. */
const OFFSET = 6;

const ATTRIBUTE = /\s([\w:-]+)="([^"]*)"/g;

const unescape = (value: string): string =>
  value
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");

/**
 * Names each stacked band at the last x, in the middle of the band there, spread so no two names
 * overlap. A band with no thickness at the last x cannot be named, and the chart then shows its
 * textures. Reports whether every series is named.
 */
export function finishAreas(
  svg: string,
  prepared: Prepared,
  plan: SeriesPlan,
  directLabels: boolean,
): { svg: string; labeled: boolean } {
  const several = prepared.seriesNames.length > 1;
  if (!several) return { svg, labeled: true };
  if (!directLabels) return { svg, labeled: false };
  // The points: one circle per value, keyed by column and row.
  const points = [...svg.matchAll(/<circle\b([^>]*)>/g)]
    .map((m) => new Map([...(m[1] ?? "").matchAll(ATTRIBUTE)].map((a) => [a[1], a[2] ?? ""])))
    .filter((a) => a.has("data-enarratio-key") && a.has("data-enarratio-col"));
  const last = Math.max(...points.map((a) => Number(a.get("data-enarratio-col"))));
  const ends = points
    .filter((a) => Number(a.get("data-enarratio-col")) === last)
    .map((a) => ({
      series: unescape(a.get("data-enarratio-series") ?? ""),
      row: Number(a.get("data-enarratio-row")),
      x: Number(a.get("cx")),
      y: Number(a.get("cy")),
    }))
    .sort((a, b) => a.row - b.row);
  // Each point sits on its band's top edge; a band runs from the top of the band below (the zero
  // line for the first) and is named where it has thickness at the last x.
  const zero = /<g data-enarratio-mark="rule"[^>]*><line\b[^>]*\sy1="([-\d.e]+)"/.exec(svg);
  if (!zero || ends.length === 0) return { svg, labeled: false };
  const lastAt = Math.max(...prepared.points.map((p) => p.at));
  const filled = new Set(
    prepared.points
      .filter((p) => p.at === lastAt && p.value !== null && p.value > 0)
      .map((p) => p.series),
  );
  let floor = Number(zero[1]);
  const bands: { series: string; x: number; mid: number }[] = [];
  for (const e of ends) {
    if (filled.has(e.series)) bands.push({ series: e.series, x: e.x, mid: (floor + e.y) / 2 });
    floor = e.y;
  }
  const width = Number(/^<svg\b[^>]*\swidth="([\d.]+)"/.exec(svg)?.[1] ?? 640);
  const ys = spreadLabels(
    bands.map((b) => b.mid),
    width,
  );
  const texts = bands
    .map(
      (b, i) =>
        `<text x="${num(b.x + OFFSET)}" y="${num(ys[i] ?? b.mid)}" dy="0.32em" fill="var(--enarratio-series-${plan.slot(b.series)})">${escapeHtml(b.series)}</text>`,
    )
    .join("");
  const labels = `<g data-enarratio-mark="area label" aria-hidden="true" pointer-events="none" text-anchor="start">${texts}</g>`;
  const named = new Set(bands.map((b) => b.series));
  return {
    svg: svg.replace(/<\/svg>$/, `${labels}</svg>`),
    labeled: prepared.seriesNames.every((n) => named.has(n)),
  };
}
