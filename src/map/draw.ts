/** What both maps draw alike: the basemap and its labels, the clip, and the reading order. */

import { el, num, text } from "../lite/svg.js";
import { hash } from "../render/texture.js";
import { charWidth, textGrowth } from "../render/size.js";
import {
  along,
  chains,
  type Fitted,
  type Frame,
  type GeoJson,
  labelPoint,
  lengthOf,
  linePath,
  polygonPath,
  readGeoJson,
  type Shape,
} from "./geo.js";

/**
 * A layer drawn quietly under the data, for context: streets, rivers, coastlines, parks. Its
 * lines are thin and its areas pale, so the data marks stay what the eye reads first.
 */
export interface BasemapLayer {
  /** The layer's lines and polygons, in longitude and latitude. Points are not drawn. */
  readonly geometry: GeoJson;
  /**
   * A feature property naming each feature, printed along a line or in an area where it fits
   * without covering another label. Features sharing a name are labeled once.
   */
  readonly labels?: string;
}

/** A box a label covers, to keep labels apart. */
interface Box {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

const overlaps = (a: Box, b: Box): boolean =>
  a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** The parts of a line inside the frame, split where it leaves. */
function inside(line: readonly (readonly [number, number])[], f: Frame): [number, number][][] {
  const parts: [number, number][][] = [];
  let part: [number, number][] = [];
  for (const [x, y] of line) {
    if (x >= f.left && x <= f.left + f.width && y >= f.top && y <= f.top + f.height) {
      part.push([x, y]);
    } else if (part.length > 0) {
      parts.push(part);
      part = [];
    }
  }
  if (part.length > 0) parts.push(part);
  return parts;
}

/** The text of a label property, or "" when a feature has none. */
const nameOf = (s: Shape, property: string | undefined): string => {
  if (property === undefined) return "";
  const value = s.properties[property];
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
};

/** A basemap's drawing and its labels, drawn apart so the data can sit between them. */
export interface DrawnBasemap {
  readonly svg: string;
  readonly labels: string;
}

/**
 * Draws the basemap layers (lines, then areas under them) and places their labels: along the
 * longest stretch of each named line inside the map, or at each named area's center, skipping a
 * label that would cover one already placed or leave the map.
 */
export function drawBasemap(
  kind: string,
  layers: readonly BasemapLayer[],
  project: Fitted,
  width: number,
  taken: Box[],
): DrawnBasemap {
  const frame = project.frame;
  const ch = charWidth(width) * 0.92;
  const line = 12 * textGrowth(width);
  const areas: string[] = [];
  const lines: string[] = [];
  const labels: string[] = [];
  const place = (label: string, x: number, y: number, angle: number): void => {
    const w = label.length * ch;
    const a = (angle * Math.PI) / 180;
    const hw = (Math.abs(Math.cos(a)) * w + Math.abs(Math.sin(a)) * line) / 2;
    const hh = (Math.abs(Math.sin(a)) * w + Math.abs(Math.cos(a)) * line) / 2;
    const box = { x0: x - hw, y0: y - hh, x1: x + hw, y1: y + hh };
    if (
      box.x0 < frame.left ||
      box.y0 < frame.top ||
      box.x1 > frame.left + frame.width ||
      box.y1 > frame.top + frame.height ||
      taken.some((t) => overlaps(t, box))
    ) {
      return;
    }
    taken.push(box);
    labels.push(
      el(
        "text",
        {
          x: num(x),
          y: num(y),
          dy: "0.32em",
          transform: angle === 0 ? undefined : `rotate(${num(angle)},${num(x)},${num(y)})`,
        },
        text(label),
      ),
    );
  };

  layers.forEach((layer, n) => {
    const shapes = readGeoJson(kind, `basemap layer ${n + 1}`, layer.geometry);
    const projected = shapes.map((s) => ({
      shape: s,
      lines: s.lines.map((l) => l.map(([lon, lat]) => project(lon, lat))),
      polygons: s.polygons.map((rings) => rings.map((r) => r.map(([lon, lat]) => project(lon, lat)))),
    }));
    const area = polygonPath(projected.flatMap((p) => p.polygons));
    if (area) areas.push(el("path", { d: area, "fill-rule": "evenodd" }));
    const path = linePath(projected.flatMap((p) => p.lines));
    if (path) lines.push(el("path", { d: path }));
    if (layer.labels === undefined) return;

    const byName = new Map<string, typeof projected>();
    for (const p of projected) {
      const name = nameOf(p.shape, layer.labels);
      if (!name) continue;
      byName.set(name, [...(byName.get(name) ?? []), p]);
    }
    // Longer features are labeled first, so a short lane never takes the place of a main street.
    const candidates = [...byName].map(([name, parts]) => {
      const stretches = chains(parts.flatMap((p) => p.lines)).flatMap((c) => inside(c, frame));
      const longest = stretches.reduce<[number, number][] | undefined>(
        (best, s) => (!best || lengthOf(s) > lengthOf(best) ? s : best),
        undefined,
      );
      return { name, parts, longest, length: longest ? lengthOf(longest) : 0 };
    });
    candidates.sort((a, b) => b.length - a.length || a.name.localeCompare(b.name));
    for (const c of candidates) {
      if (c.longest) {
        const w = c.name.length * ch;
        if (c.length < w + 8) continue;
        const [x0, y0] = along(c.longest, (c.length - w) / 2);
        const [x1, y1] = along(c.longest, (c.length + w) / 2);
        const [x, y] = along(c.longest, c.length / 2);
        let angle = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI;
        // Text never reads upside down.
        if (angle > 90) angle -= 180;
        if (angle < -90) angle += 180;
        place(c.name, x, y, Math.round(angle * 10) / 10);
      } else {
        const at = labelPoint(c.parts.flatMap((p) => p.polygons));
        if (at) place(c.name, at[0], at[1], 0);
      }
    }
  });

  return {
    svg:
      areas.length + lines.length === 0
        ? ""
        : el(
            "g",
            { "data-enarratio-mark": "basemap", "aria-hidden": "true" },
            [
              areas.length > 0
                ? el("g", { fill: "var(--enarratio-grid)", stroke: "none" }, areas.join(""))
                : "",
              lines.length > 0
                ? el(
                    "g",
                    {
                      fill: "none",
                      stroke: "var(--enarratio-text-muted)",
                      "stroke-opacity": 0.45,
                      "stroke-width": 1,
                      "stroke-linejoin": "round",
                      "stroke-linecap": "round",
                    },
                    lines.join(""),
                  )
                : "",
            ].join(""),
          ),
    labels:
      labels.length === 0
        ? ""
        : el(
            "g",
            {
              "data-enarratio-mark": "basemap label",
              "aria-hidden": "true",
              fill: "var(--enarratio-text-muted)",
              "font-style": "italic",
              // A halo in the background color, so a label reads over the lines under it.
              stroke: "var(--enarratio-background)",
              "stroke-width": 3,
              "stroke-linejoin": "round",
              "paint-order": "stroke",
            },
            labels.join(""),
          ),
  };
}

/**
 * Wraps what is drawn on the map in a clip to its frame, so a basemap reaching past the extent
 * stops at the map's edge and never runs under the key.
 */
export function clipped(frame: Frame, content: string): string {
  if (!content) return "";
  const id = `enarratio-clip-${hash(`${num(frame.left)},${num(frame.top)},${num(frame.width)},${num(frame.height)}|${content.length}|${content.slice(0, 2000)}`)}`;
  return `${el(
    "defs",
    {},
    el(
      "clipPath",
      { id },
      el("rect", { x: frame.left, y: frame.top, width: frame.width, height: frame.height }),
    ),
  )}${el("g", { "clip-path": `url(#${id})` }, content)}`;
}

/** How many bands, top to bottom, the reading order reads a map in. */
const BANDS = 8;

/**
 * The keyboard reading order of points on a map, as each point's rank: in bands from north to
 * south, and west to east within a band, as a page is read.
 */
export function readingRanks(points: readonly (readonly [number, number])[], frame: Frame): number[] {
  const band = (y: number): number =>
    Math.min(BANDS - 1, Math.max(0, Math.floor(((y - frame.top) / frame.height) * BANDS)));
  const order = points
    .map((p, i) => ({ i, band: band(p[1]), x: p[0], y: p[1] }))
    .sort((a, b) => a.band - b.band || a.x - b.x || a.y - b.y);
  const ranks = new Array<number>(points.length);
  order.forEach((p, rank) => {
    ranks[p.i] = rank;
  });
  return ranks;
}
