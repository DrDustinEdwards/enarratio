import { ticks } from "../lite/scale.js";
import { el, num, svgRoot, text } from "../lite/svg.js";
import { type KeysOfType, markKey, maxOf, readLabel, readNumber } from "../render/data.js";
import { datumAttributes } from "../render/datum.js";
import { valueRange } from "../render/describe.js";
import { type FigureOptions, figure, validateFigure } from "../render/figure.js";
import { charWidth, DEFAULT_WIDTH, textGrowth } from "../render/size.js";
import { numberFormat, stringsFor, valueFormat } from "../render/text.js";
import { type BasemapLayer, clipped, drawBasemap, readingRanks } from "./draw.js";
import {
  aspect,
  extentOf,
  fitExtent,
  type GeoExtent,
  type Projection,
  positionsOf,
  readGeoJson,
} from "./geo.js";

/** A place drawn on a dot map for orientation: a pump, a station, a hospital. */
export interface MapLandmark {
  readonly name: string;
  readonly longitude: number;
  readonly latitude: number;
  /** Draw this one filled, larger and labeled: the landmark the map is about. At most one. */
  readonly highlight?: boolean;
}

/** Options for {@link dotMap}. */
export interface DotMapOptions<T extends object> extends FigureOptions {
  readonly data: readonly T[];
  readonly longitude: KeysOfType<T, number>;
  readonly latitude: KeysOfType<T, number>;
  /** The field each dot is sized by, in area: zero or more. */
  readonly value: KeysOfType<T, number>;
  /** The field naming each point, for the table and hover details (default "Point 1", ...). */
  readonly label?: KeysOfType<T, string | number>;
  /** The table's header for the names (default: the label field, or "Point"). */
  readonly labelHeader?: string;
  /** What the value measures, for the key, hover details and the table (default: the field). */
  readonly valueLabel?: string;
  readonly formatValue?: (value: number) => string;
  /** The largest dot's radius, in the drawing's units (default 9, less on a drawing under 630 wide). */
  readonly maxRadius?: number;
  /** Context drawn quietly under the dots: streets, rivers, areas. */
  readonly basemap?: readonly BasemapLayer[];
  /** Places drawn as squares, not sized, for orientation; one may be highlighted. */
  readonly landmarks?: readonly MapLandmark[];
  /** What the landmarks are, for the key and the table ("Water pump"; default "Landmark"). */
  readonly landmarkLabel?: string;
  /** The box to show, `[[west, south], [east, north]]`; by default the points and landmarks. */
  readonly extent?: GeoExtent;
  /** How longitude and latitude are drawn (default `"equirectangular"`, for small areas). */
  readonly projection?: Projection;
}

interface Point {
  readonly name: string;
  readonly value: number;
  readonly lon: number;
  readonly lat: number;
}

const KIND = "dotMap";

/**
 * The default largest radius: a dot a reader can compare, that hides few streets. 9 at the default
 * width, smaller on a narrow drawing so the dots do not merge, and never under 5.
 */
const maxRadiusFor = (width: number): number => Math.max(5, Math.min(9, width / 70));

function readCoordinate(row: object, key: string, i: number, limit: number): number {
  const v = readNumber(KIND, row, key, i);
  if (Math.abs(v) > limit) {
    throw new Error(`${KIND}: row ${i + 1} field "${key}" is ${v}, outside ±${limit} degrees`);
  }
  return v;
}

/**
 * A map of points sized by value, over the caller's own basemap (streets, coastlines, areas)
 * drawn quietly beneath them: cases by address, sites by count. Dots are sized by area, so the
 * value is read from size and never from color alone; a key gives three reference sizes, and the
 * data table lists every point with its value and position. Landmarks are squares, apart from
 * the dots, and one can be highlighted and labeled. With `enarratio/enhance` the dots are walked
 * by keyboard in reading order: north to south in bands, west to east within each.
 *
 * Enarratio ships no boundaries or streets: pass GeoJSON in longitude and latitude.
 *
 * @example
 * dotMap({ data: cases, longitude: "lon", latitude: "lat", value: "deaths", label: "address",
 *   basemap: [{ geometry: streets, labels: "name" }], landmarks: pumps, alt: "..." });
 */
export function dotMap<T extends object>(options: DotMapOptions<T>): string {
  const { data, longitude, latitude, value } = options;
  validateFigure(KIND, options);
  if (data.length === 0) throw new Error(`${KIND}: data is empty`);
  const format = valueFormat(options);
  const strings = stringsFor(options.strings);
  const { terms } = strings;
  const coordinate = numberFormat({
    ...(options.locale ? { locale: options.locale } : {}),
    maximumFractionDigits: 6,
  });
  const count = numberFormat({
    ...(options.locale ? { locale: options.locale } : {}),
    maximumFractionDigits: 0,
  });
  const valueLabel = options.valueLabel ?? value;
  const landmarkLabel = options.landmarkLabel ?? terms.landmark;
  const points: Point[] = data.map((row, i) => {
    const v = readNumber(KIND, row, value, i);
    if (v < 0) throw new Error(`${KIND}: row ${i + 1} value is ${v}; dot sizes are zero or more`);
    return {
      name:
        options.label === undefined
          ? `${terms.point} ${i + 1}`
          : readLabel(KIND, row, options.label, i),
      value: v,
      lon: readCoordinate(row, longitude, i, 180),
      lat: readCoordinate(row, latitude, i, 90),
    };
  });
  const landmarks = options.landmarks ?? [];
  landmarks.forEach((l, i) => {
    if (
      !Number.isFinite(l.longitude) ||
      !Number.isFinite(l.latitude) ||
      Math.abs(l.longitude) > 180 ||
      Math.abs(l.latitude) > 90
    ) {
      throw new Error(`${KIND}: landmark ${i + 1} (${l.name}) is not at a longitude and latitude`);
    }
  });
  if (landmarks.filter((l) => l.highlight).length > 1) {
    throw new Error(`${KIND}: more than one landmark is highlighted; highlight at most one`);
  }
  const highlighted = landmarks.find((l) => l.highlight);

  const width = options.width ?? DEFAULT_WIDTH;
  const maxRadius = options.maxRadius ?? maxRadiusFor(width);
  if (!(maxRadius > 0)) throw new Error(`${KIND}: maxRadius must be a positive number`);
  const top = maxOf(points.map((p) => p.value));
  const radius = (v: number): number => (top > 0 ? maxRadius * Math.sqrt(v / top) : 0);

  // The key, under the map: reference dots, then the landmarks' squares.
  const ch = charWidth(width);
  const line = 12 * textGrowth(width);
  const references =
    top > 0
      ? ticks(0, top, 3)
          .filter((v) => v > 0 && v <= top)
          .slice(-3)
      : [];
  if (top > 0 && !references.includes(top) && references.length < 3) references.push(top);
  const keyItems: { width: number; height: number; draw: (x: number, y: number) => string }[] = [];
  const heading = `${valueLabel.charAt(0).toUpperCase()}${valueLabel.slice(1)}:`;
  keyItems.push({
    width: heading.length * ch + 6,
    height: line,
    draw: (x, y) => el("text", { x, y, dy: "0.32em", "text-anchor": "start" }, text(heading)),
  });
  for (const v of references) {
    const r = radius(v);
    const label = format(v);
    keyItems.push({
      width: 2 * r + 4 + label.length * ch + 12,
      height: Math.max(2 * r, line),
      draw: (x, y) =>
        el("circle", {
          cx: num(x + r),
          cy: num(y),
          r: num(r),
          fill: "var(--enarratio-series-1)",
          "fill-opacity": 0.35,
          stroke: "var(--enarratio-series-1)",
        }) +
        el(
          "text",
          { x: num(x + 2 * r + 4), y: num(y), dy: "0.32em", "text-anchor": "start" },
          text(label),
        ),
    });
  }
  const square = (x: number, y: number, side: number, filled: boolean): string =>
    el("rect", {
      x: num(x - side / 2),
      y: num(y - side / 2),
      width: num(side),
      height: num(side),
      fill: filled ? "var(--enarratio-text)" : "var(--enarratio-background)",
      stroke: "var(--enarratio-text)",
      "stroke-width": 1.5,
    });
  if (landmarks.some((l) => !l.highlight)) {
    keyItems.push({
      width: 8 + 6 + landmarkLabel.length * ch + 12,
      height: line,
      draw: (x, y) =>
        square(x + 4, y, 7, false) +
        el(
          "text",
          { x: num(x + 14), y: num(y), dy: "0.32em", "text-anchor": "start" },
          text(landmarkLabel),
        ),
    });
  }
  if (highlighted) {
    keyItems.push({
      width: 11 + 6 + highlighted.name.length * ch + 12,
      height: line,
      draw: (x, y) =>
        square(x + 5.5, y, 11, true) +
        el(
          "text",
          { x: num(x + 17), y: num(y), dy: "0.32em", "text-anchor": "start" },
          text(highlighted.name),
        ),
    });
  }
  const rows: (typeof keyItems)[] = [[]];
  let used = 0;
  for (const item of keyItems) {
    const row = rows.at(-1) as typeof keyItems;
    if (row.length > 0 && used + item.width > width - 8) {
      rows.push([item]);
      used = item.width;
    } else {
      row.push(item);
      used += item.width;
    }
  }
  const rowHeights = rows.map((r) => Math.max(...r.map((i) => i.height)) + 8);
  const keyHeight = rowHeights.reduce((a, b) => a + b, 0) + 4;

  // The map fills the width; its height follows the extent's shape unless given.
  const extent =
    options.extent ??
    extentOf([
      ...points.map((p) => [p.lon, p.lat] as [number, number]),
      ...landmarks.map((l) => [l.longitude, l.latitude] as [number, number]),
    ]);
  const pad = maxRadius + 2;
  const mapWidth = width - 2 * pad;
  const mapHeight =
    options.height === undefined
      ? Math.round(
          Math.min(1.5 * width, Math.max(160, mapWidth * aspect(options.projection, extent))),
        )
      : Math.max(40, options.height - keyHeight - 2 * pad);
  const height = options.height ?? mapHeight + 2 * pad + keyHeight;
  const project = fitExtent(options.projection, extent, {
    left: pad,
    top: pad,
    width: mapWidth,
    height: mapHeight,
  });
  // A drawn frame (the basemap's clip) is the whole map area, a little past the extent.
  const frame = { left: 0, top: 0, width, height: mapHeight + 2 * pad };
  const drawable = Object.assign(project, { frame });

  const at = points.map((p) => project(p.lon, p.lat));
  const ranks = readingRanks(at, frame);
  const labelBoxes: { x0: number; y0: number; x1: number; y1: number }[] = [];

  // The highlighted landmark's name, beside it, placed before the basemap's labels so they
  // keep clear of it.
  let highlightLabel = "";
  if (highlighted) {
    const [x, y] = project(highlighted.longitude, highlighted.latitude);
    const w = highlighted.name.length * ch;
    const right = x + 10 + w <= width;
    const tx = right ? x + 10 : x - 10;
    labelBoxes.push({
      x0: right ? tx : tx - w,
      y0: y - line / 2,
      x1: right ? tx + w : tx,
      y1: y + line / 2,
    });
    highlightLabel = el(
      "text",
      {
        x: num(tx),
        y: num(y),
        dy: "0.32em",
        "text-anchor": right ? "start" : "end",
        "font-weight": "600",
        stroke: "var(--enarratio-background)",
        "stroke-width": 4,
        "stroke-linejoin": "round",
        "paint-order": "stroke",
      },
      text(highlighted.name),
    );
  }
  // Street names keep clear of the dots and landmarks, so none hides a point.
  points.forEach((p, i) => {
    const [x, y] = at[i] as [number, number];
    const r = Math.max(radius(p.value), 1.5);
    labelBoxes.push({ x0: x - r, y0: y - r, x1: x + r, y1: y + r });
  });
  for (const l of landmarks) {
    const [x, y] = project(l.longitude, l.latitude);
    const half = l.highlight ? 5.5 : 3.5;
    labelBoxes.push({ x0: x - half, y0: y - half, x1: x + half, y1: y + half });
  }
  const basemap = drawBasemap(KIND, options.basemap ?? [], drawable, width, labelBoxes);
  // Positions on the basemap are read too, so a bad one fails here, not silently.
  for (const layer of options.basemap ?? [])
    positionsOf(readGeoJson(KIND, "basemap", layer.geometry));

  const describe = (p: Point): string => `${p.name}: ${format(p.value)} ${valueLabel}`;
  // Big dots first, so a small one is never hidden under a big one.
  const drawOrder = points
    .map((p, i) => ({ p, i }))
    .sort((a, b) => b.p.value - a.p.value || (ranks[a.i] as number) - (ranks[b.i] as number));
  const dots = drawOrder
    .map(({ p, i }) => {
      const [x, y] = at[i] as [number, number];
      const r = radius(p.value);
      return el(
        "circle",
        {
          cx: num(x),
          cy: num(y),
          // A zero is a small ring, so it is still there to find.
          r: num(r > 0 ? r : 1.5),
          ...(r > 0 ? {} : { fill: "none" }),
          ...Object.fromEntries(
            datumAttributes({
              key: markKey(p.name, p.lon, p.lat),
              column: ranks[i] as number,
              row: 0,
            }),
          ),
        },
        el("title", {}, text(describe(p))),
      );
    })
    .join("");

  const landmarkMarks = landmarks
    .map((l) => {
      const [x, y] = project(l.longitude, l.latitude);
      return el(
        "g",
        {},
        `${el("title", {}, text(`${l.name} (${landmarkLabel})`))}${square(x, y, l.highlight ? 11 : 7, l.highlight === true)}`,
      );
    })
    .join("");

  let cursor = mapHeight + 2 * pad + 4;
  const key = rows
    .map((row, r) => {
      const h = rowHeights[r] as number;
      const y = cursor + h / 2;
      cursor += h;
      let x = 4;
      return row
        .map((item) => {
          const drawn = item.draw(x, y);
          x += item.width;
          return drawn;
        })
        .join("");
    })
    .join("");

  const svg = svgRoot(
    width,
    height,
    options.alt,
    "img",
    [
      clipped(frame, `${basemap.svg}${basemap.labels}`),
      el(
        "g",
        {
          "data-enarratio-mark": "dot",
          fill: "var(--enarratio-series-1)",
          "fill-opacity": 0.35,
          stroke: "var(--enarratio-series-1)",
          "stroke-width": 1,
        },
        dots,
      ),
      landmarkMarks
        ? el("g", { "data-enarratio-mark": "landmark" }, landmarkMarks + highlightLabel)
        : "",
      el(
        "g",
        { "data-enarratio-mark": "map key", "aria-hidden": "true", fill: "currentColor" },
        key,
      ),
    ].join(""),
  );

  const named = (l: MapLandmark): string =>
    `${l.name} (${l.highlight ? `${landmarkLabel}, ${terms.highlightedLandmark}` : landmarkLabel})`;
  return figure(options, {
    kind: "dot-map",
    svg,
    description: {
      axes: [
        valueRange(
          "size",
          valueLabel,
          points.map((p) => p.value),
          format,
        ),
      ],
      format,
      series: [{ name: valueLabel, points: points.map((p) => ({ at: p.name, value: p.value })) }],
      ...(landmarks.length > 0
        ? { sentence: strings.landmarks(count(landmarks.length), landmarkLabel, highlighted?.name) }
        : {}),
    },
    table: {
      columns: [
        options.labelHeader ?? options.label ?? terms.point,
        valueLabel,
        terms.longitude,
        terms.latitude,
      ],
      rows: [
        ...points.map((p) => [p.name, format(p.value), coordinate(p.lon), coordinate(p.lat)]),
        ...landmarks.map((l) => [named(l), "", coordinate(l.longitude), coordinate(l.latitude)]),
      ],
    },
  });
}
