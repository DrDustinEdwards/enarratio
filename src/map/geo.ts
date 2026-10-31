/**
 * Geometry for the maps (design record 0028): reading the caller's GeoJSON, projecting longitude
 * and latitude onto the drawing, and writing paths. Enarratio ships no boundaries; every shape
 * is the caller's, in WGS 84 longitude and latitude as GeoJSON (RFC 7946) stores it.
 */

import { num } from "../lite/svg.js";

/** A GeoJSON position: longitude, then latitude (any third value is ignored). */
export type GeoPosition = readonly number[];

/**
 * A GeoJSON geometry. Typed loosely, so a geometry read from a `.json` file (whose `type` is a
 * plain string to TypeScript) is accepted; it is checked as it is read, and a bad one throws.
 */
export interface GeoGeometry {
  readonly type: string;
  readonly coordinates?: unknown;
  readonly geometries?: readonly GeoGeometry[];
}

/** A GeoJSON feature: a geometry and its properties. */
export interface GeoFeature {
  readonly type: string;
  readonly geometry: GeoGeometry | null;
  readonly properties?: Readonly<Record<string, unknown>> | null;
}

/** A GeoJSON feature collection. */
export interface GeoFeatureCollection {
  readonly type: string;
  readonly features: readonly GeoFeature[];
}

/** Any GeoJSON object a map draws: a feature collection, a feature or a bare geometry. */
export type GeoJson = GeoFeatureCollection | GeoFeature | GeoGeometry;

/**
 * How longitude and latitude become the drawing's x and y.
 *
 * - `"equirectangular"` (default): longitude scaled by the cosine of the map's middle latitude,
 *   latitude as it is. At city scale it is true to within a fraction of a percent.
 * - `"mercator"`: the web map projection, conformal, for a region or country, and to match a
 *   tiled map.
 * - A function from longitude and latitude to planar x and y, with y growing northward, for any
 *   other projection; the map fits whatever it returns.
 */
export type Projection =
  | "equirectangular"
  | "mercator"
  | ((longitude: number, latitude: number) => readonly [number, number]);

/** A box on the earth: `[[west, south], [east, north]]` in degrees. */
export type GeoExtent = readonly [readonly [number, number], readonly [number, number]];

/** One feature, read: its parts in longitude and latitude, and its properties. */
export interface Shape {
  readonly lines: readonly (readonly (readonly [number, number])[])[];
  /** Each polygon is its rings, the outer ring first. */
  readonly polygons: readonly (readonly (readonly [number, number])[])[][];
  readonly points: readonly (readonly [number, number])[];
  readonly properties: Readonly<Record<string, unknown>>;
}

const position = (kind: string, where: string, value: unknown): [number, number] => {
  if (!Array.isArray(value) || value.length < 2) {
    throw new Error(`${kind}: ${where} has a position that is not [longitude, latitude]`);
  }
  const [lon, lat] = value as unknown[];
  if (
    typeof lon !== "number" ||
    typeof lat !== "number" ||
    !Number.isFinite(lon) ||
    !Number.isFinite(lat) ||
    Math.abs(lon) > 180 ||
    Math.abs(lat) > 90
  ) {
    throw new Error(
      `${kind}: ${where} has the position ${JSON.stringify(value)}, not a longitude and latitude in degrees`,
    );
  }
  return [lon, lat];
};

const list = (kind: string, where: string, value: unknown): unknown[] => {
  if (!Array.isArray(value)) throw new Error(`${kind}: ${where} has coordinates that are not a list`);
  return value;
};

const ring = (kind: string, where: string, value: unknown): [number, number][] =>
  list(kind, where, value).map((p) => position(kind, where, p));

function readGeometry(
  kind: string,
  where: string,
  geometry: GeoGeometry,
  out: { lines: [number, number][][]; polygons: [number, number][][][]; points: [number, number][] },
): void {
  const c = geometry.coordinates;
  switch (geometry.type) {
    case "Point":
      out.points.push(position(kind, where, c));
      return;
    case "MultiPoint":
      out.points.push(...ring(kind, where, c));
      return;
    case "LineString":
      out.lines.push(ring(kind, where, c));
      return;
    case "MultiLineString":
      for (const part of list(kind, where, c)) out.lines.push(ring(kind, where, part));
      return;
    case "Polygon":
      out.polygons.push(list(kind, where, c).map((r) => ring(kind, where, r)));
      return;
    case "MultiPolygon":
      for (const polygon of list(kind, where, c)) {
        out.polygons.push(list(kind, where, polygon).map((r) => ring(kind, where, r)));
      }
      return;
    case "GeometryCollection":
      for (const inner of geometry.geometries ?? []) readGeometry(kind, where, inner, out);
      return;
    default:
      throw new Error(`${kind}: ${where} has the geometry type "${geometry.type}", not GeoJSON`);
  }
}

/** Reads GeoJSON into shapes, one per feature, or throws naming the feature that is wrong. */
export function readGeoJson(kind: string, name: string, geo: GeoJson): Shape[] {
  const features: readonly GeoFeature[] =
    geo.type === "FeatureCollection"
      ? (geo as GeoFeatureCollection).features
      : geo.type === "Feature"
        ? [geo as GeoFeature]
        : [{ type: "Feature", geometry: geo as GeoGeometry, properties: {} }];
  if (!Array.isArray(features)) throw new Error(`${kind}: ${name} has no features list`);
  return features.map((feature, i) => {
    const out = {
      lines: [] as [number, number][][],
      polygons: [] as [number, number][][][],
      points: [] as [number, number][],
    };
    if (feature.geometry) readGeometry(kind, `${name} feature ${i + 1}`, feature.geometry, out);
    return { ...out, properties: feature.properties ?? {} };
  });
}

/** Every position in some shapes. */
export function positionsOf(shapes: readonly Shape[]): [number, number][] {
  const out: [number, number][] = [];
  for (const s of shapes) {
    for (const line of s.lines) out.push(...line);
    for (const polygon of s.polygons) for (const r of polygon) out.push(...r);
    out.push(...s.points);
  }
  return out;
}

/** The box around some positions, padded by a share of its size on every side. */
export function extentOf(positions: readonly (readonly [number, number])[], pad = 0.04): GeoExtent {
  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;
  for (const [lon, lat] of positions) {
    west = Math.min(west, lon);
    east = Math.max(east, lon);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  // One position, or all on a line, still gets a box to draw in.
  const dx = east - west || Math.max(north - south, 0.01);
  const dy = north - south || dx;
  return [
    [west - dx * pad, south - dy * pad],
    [east + dx * pad, north + dy * pad],
  ];
}

const RAD = Math.PI / 180;

/** The planar projection (y north) for a map of this extent. */
export function planar(
  projection: Projection | undefined,
  extent: GeoExtent,
): (lon: number, lat: number) => readonly [number, number] {
  if (typeof projection === "function") return projection;
  if (projection === "mercator") {
    return (lon, lat) => {
      // Mercator runs to infinity at the poles; web maps stop at about 85.05 degrees.
      const phi = Math.max(-85.05, Math.min(85.05, lat)) * RAD;
      return [lon * RAD, Math.log(Math.tan(Math.PI / 4 + phi / 2))];
    };
  }
  const k = Math.cos(((extent[0][1] + extent[1][1]) / 2) * RAD);
  return (lon, lat) => [lon * k, lat];
}

/** The rectangle a map is drawn in, in the drawing's units. */
export interface Frame {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** A projection fitted to a frame: longitude and latitude to the drawing's x and y. */
export interface Fitted {
  (lon: number, lat: number): [number, number];
  /** The rectangle the extent fills. */
  readonly frame: Frame;
}

/** The planar box of an extent: its corners and the middles of its edges, projected. */
function planarBox(
  project: (lon: number, lat: number) => readonly [number, number],
  extent: GeoExtent,
): { x0: number; x1: number; y0: number; y1: number } {
  const [[w, s], [e, n]] = extent;
  const mx = (w + e) / 2;
  const my = (s + n) / 2;
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [lon, lat] of [
    [w, s],
    [w, n],
    [e, s],
    [e, n],
    [mx, s],
    [mx, n],
    [w, my],
    [e, my],
  ] as const) {
    const [x, y] = project(lon, lat);
    xs.push(x);
    ys.push(y);
  }
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

/** The height over width of an extent once projected, for a map whose height is not given. */
export function aspect(projection: Projection | undefined, extent: GeoExtent): number {
  const b = planarBox(planar(projection, extent), extent);
  return (b.y1 - b.y0) / (b.x1 - b.x0 || 1);
}

/**
 * Fits the extent into the frame without stretching it (one scale for x and y), centered, with
 * north up.
 */
export function fit(projection: Projection | undefined, extent: GeoExtent, frame: Frame): Fitted {
  const project = planar(projection, extent);
  const b = planarBox(project, extent);
  const k = Math.min(frame.width / (b.x1 - b.x0 || 1), frame.height / (b.y1 - b.y0 || 1));
  const dx = frame.left + (frame.width - k * (b.x1 - b.x0)) / 2;
  const dy = frame.top + (frame.height - k * (b.y1 - b.y0)) / 2;
  const fitted = (lon: number, lat: number): [number, number] => {
    const [x, y] = project(lon, lat);
    return [dx + k * (x - b.x0), dy + k * (b.y1 - y)];
  };
  return Object.assign(fitted, { frame });
}

/** Points along a line in the drawing, dropping any within half a unit of the last one kept. */
export function thin(points: readonly (readonly [number, number])[]): [number, number][] {
  const out: [number, number][] = [];
  for (const [x, y] of points) {
    const last = out.at(-1);
    if (last && Math.abs(x - last[0]) < 0.5 && Math.abs(y - last[1]) < 0.5) continue;
    out.push([x, y]);
  }
  // A line keeps its last point, so it ends where it should.
  const end = points.at(-1);
  const kept = out.at(-1);
  if (end && kept && (end[0] !== kept[0] || end[1] !== kept[1])) out[out.length - 1] = [end[0], end[1]];
  return out;
}

const pathOf = (points: readonly (readonly [number, number])[]): string =>
  points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${num(x)},${num(y)}`).join("");

/** A path for some lines in the drawing. */
export function linePath(lines: readonly (readonly (readonly [number, number])[])[]): string {
  return lines
    .map(thin)
    .filter((l) => l.length > 1)
    .map(pathOf)
    .join("");
}

/** A path for some polygons in the drawing, each ring closed (fill with `evenodd` for holes). */
export function polygonPath(
  polygons: readonly (readonly (readonly (readonly [number, number])[])[])[],
): string {
  return polygons
    .flatMap((rings) => rings.map(thin))
    .filter((r) => r.length > 2)
    .map((r) => `${pathOf(r)}Z`)
    .join("");
}

/** A ring's signed area and centroid in the drawing (the shoelace formula). */
function ringCentroid(r: readonly (readonly [number, number])[]): {
  area: number;
  x: number;
  y: number;
} {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < r.length; i += 1) {
    const [x0, y0] = r[i] as readonly [number, number];
    const [x1, y1] = r[(i + 1) % r.length] as readonly [number, number];
    const cross = x0 * y1 - x1 * y0;
    a += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  if (a === 0) {
    const first = r[0] ?? [0, 0];
    return { area: 0, x: first[0], y: first[1] };
  }
  return { area: Math.abs(a / 2), x: cx / (3 * a), y: cy / (3 * a) };
}

/** Where a region's label goes: the centroid of its largest outer ring, in the drawing. */
export function labelPoint(
  polygons: readonly (readonly (readonly (readonly [number, number])[])[])[],
): [number, number] | undefined {
  let best: { area: number; x: number; y: number } | undefined;
  for (const rings of polygons) {
    const outer = rings[0];
    if (!outer || outer.length < 3) continue;
    const c = ringCentroid(outer);
    if (!best || c.area > best.area) best = c;
  }
  return best ? [best.x, best.y] : undefined;
}

/**
 * Joins lines that meet end to end into longer chains, so a street drawn as many short segments,
 * split at each crossing, can carry one label along its length.
 */
export function chains(
  lines: readonly (readonly (readonly [number, number])[])[],
): [number, number][][] {
  const near = (a: readonly [number, number], b: readonly [number, number]): boolean =>
    Math.abs(a[0] - b[0]) < 0.5 && Math.abs(a[1] - b[1]) < 0.5;
  const open = lines.filter((l) => l.length > 1).map((l) => l.map(([x, y]) => [x, y] as [number, number]));
  const out: [number, number][][] = [];
  while (open.length > 0) {
    let chain = open.shift() as [number, number][];
    let grew = true;
    while (grew) {
      grew = false;
      for (let i = 0; i < open.length; i += 1) {
        const line = open[i] as [number, number][];
        const head = chain[0] as [number, number];
        const tail = chain.at(-1) as [number, number];
        const first = line[0] as [number, number];
        const last = line.at(-1) as [number, number];
        if (near(tail, first)) chain = [...chain, ...line.slice(1)];
        else if (near(tail, last)) chain = [...chain, ...line.slice(0, -1).reverse()];
        else if (near(head, last)) chain = [...line.slice(0, -1), ...chain];
        else if (near(head, first)) chain = [...line.slice(1).reverse(), ...chain];
        else continue;
        open.splice(i, 1);
        grew = true;
        break;
      }
    }
    out.push(chain);
  }
  return out;
}

/** A line's length in the drawing. */
export function lengthOf(line: readonly (readonly [number, number])[]): number {
  let total = 0;
  for (let i = 1; i < line.length; i += 1) {
    const [x0, y0] = line[i - 1] as readonly [number, number];
    const [x1, y1] = line[i] as readonly [number, number];
    total += Math.hypot(x1 - x0, y1 - y0);
  }
  return total;
}

/** The point at a distance along a line. */
export function along(
  line: readonly (readonly [number, number])[],
  distance: number,
): [number, number] {
  let left = distance;
  for (let i = 1; i < line.length; i += 1) {
    const [x0, y0] = line[i - 1] as readonly [number, number];
    const [x1, y1] = line[i] as readonly [number, number];
    const step = Math.hypot(x1 - x0, y1 - y0);
    if (left <= step && step > 0) {
      const t = left / step;
      return [x0 + t * (x1 - x0), y0 + t * (y1 - y0)];
    }
    left -= step;
  }
  const end = line.at(-1) ?? [0, 0];
  return [end[0], end[1]];
}
