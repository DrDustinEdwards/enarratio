import { el, num, svgRoot, text } from "../lite/svg.js";
import {
  type KeysOfType,
  markKey,
  maxOf,
  minOf,
  rampStep,
  rampThresholds,
  readLabel,
  readNumberOrNull,
} from "../render/data.js";
import { datumAttributes } from "../render/datum.js";
import { valueRange } from "../render/describe.js";
import { type FigureOptions, figure, type RampItem, validateFigure } from "../render/figure.js";
import { charWidth, DEFAULT_WIDTH, textGrowth } from "../render/size.js";
import { stringsFor, valueFormat } from "../render/text.js";
import { type BasemapLayer, clipped, drawBasemap, readingRanks } from "./draw.js";
import {
  aspect,
  extentOf,
  fitExtent,
  type GeoExtent,
  type GeoJson,
  labelPoint,
  type Projection,
  polygonPath,
  positionsOf,
  readGeoJson,
} from "./geo.js";

/** Options for {@link choroplethMap}. */
export interface ChoroplethMapOptions<T extends object> extends FigureOptions {
  /** The regions, as GeoJSON polygons in longitude and latitude. */
  readonly regions: GeoJson;
  /** The feature property that names each region and matches the data's `region` field. */
  readonly regionKey: string;
  readonly data: readonly T[];
  /** The field naming the region each row belongs to. */
  readonly region: KeysOfType<T, string | number>;
  /** The field colored on the theme's sequential ramp. `null` is a region with no data. */
  readonly value: KeysOfType<T, number | null | undefined>;
  /** The table's header for the regions (default: the region field). */
  readonly regionHeader?: string;
  /** What the value measures, for the key, hover details and the table (default: the field). */
  readonly valueLabel?: string;
  readonly formatValue?: (value: number) => string;
  /**
   * Four ascending thresholds splitting values into the ramp's five steps. Defaults to equal
   * intervals between the lowest and highest value.
   */
  readonly thresholds?: readonly [number, number, number, number];
  /** Print each region's value inside it, where it fits (default true). */
  readonly valueLabels?: boolean;
  /** Context drawn quietly under the regions' edges: rivers, roads. */
  readonly basemap?: readonly BasemapLayer[];
  /** The box to show, `[[west, south], [east, north]]`; by default the regions. */
  readonly extent?: GeoExtent;
  /** How longitude and latitude are drawn (default `"equirectangular"`). */
  readonly projection?: Projection;
}

const KIND = "choroplethMap";

interface Region {
  readonly name: string;
  readonly value: number | null;
  readonly step: number;
  readonly polygons: readonly (readonly (readonly [number, number])[])[][];
}

/**
 * A map of regions shaded by value in five labeled steps of the theme's sequential ramp: rates
 * by district, counts by county. Color is never the only way in: each region prints its value
 * where it fits, the ramp's steps are labeled, a region with no data is outlined dashed rather
 * than shaded as zero, and the data table lists every region. With `enarratio/enhance` the
 * regions are walked by keyboard in reading order, north to south and west to east.
 *
 * Enarratio ships no boundaries: pass the regions as GeoJSON in longitude and latitude, and
 * name the property that matches the data.
 *
 * @example
 * choroplethMap({ regions: districts, regionKey: "name", data: rates, region: "district",
 *   value: "rate", alt: "..." });
 */
export function choroplethMap<T extends object>(options: ChoroplethMapOptions<T>): string {
  const { data, value } = options;
  validateFigure(KIND, options);
  if (data.length === 0) throw new Error(`${KIND}: data is empty`);
  const format = valueFormat(options);
  const strings = stringsFor(options.strings);
  const valueLabel = options.valueLabel ?? value;
  const regionHeader = options.regionHeader ?? options.region;

  const byName = new Map<string, number | null>();
  data.forEach((row, i) => {
    const name = readLabel(KIND, row, options.region, i);
    if (byName.has(name)) throw new Error(`${KIND}: two rows for region ${name}`);
    byName.set(name, readNumberOrNull(KIND, row, value, i));
  });
  const present = [...byName.values()].filter((v): v is number => v !== null);
  if (present.length === 0) throw new Error(`${KIND}: every value is empty`);
  const min = minOf(present);
  const max = maxOf(present);
  const thresholds = rampThresholds(KIND, min, max, options.thresholds);

  // Each feature is matched to its row by name; features sharing a name are one region.
  const shapes = readGeoJson(KIND, "regions", options.regions);
  const polygonsOf = new Map<string, (readonly (readonly [number, number])[])[][]>();
  shapes.forEach((s, i) => {
    const raw = s.properties[options.regionKey];
    if (typeof raw !== "string" && typeof raw !== "number") {
      throw new Error(`${KIND}: regions feature ${i + 1} has no "${options.regionKey}" property`);
    }
    const name = String(raw).trim();
    polygonsOf.set(name, [...(polygonsOf.get(name) ?? []), ...s.polygons]);
  });
  const missing = [...byName.keys()].filter((name) => !polygonsOf.has(name));
  if (missing.length > 0) {
    throw new Error(
      `${KIND}: no region named ${missing.map((m) => `"${m}"`).join(", ")} in the regions' "${options.regionKey}" property`,
    );
  }
  // A region drawn but missing from the data has no data; it is listed too, so nothing is unsaid.
  const regions: Region[] = [...polygonsOf].map(([name, polygons]) => {
    const v = byName.get(name) ?? null;
    return { name, value: v, step: v === null ? 0 : rampStep(v, thresholds), polygons };
  });

  const width = options.width ?? DEFAULT_WIDTH;
  const extent = options.extent ?? extentOf(positionsOf(shapes), 0.02);
  const pad = 4;
  const mapWidth = width - 2 * pad;
  const mapHeight =
    options.height === undefined
      ? Math.round(
          Math.min(1.5 * width, Math.max(160, mapWidth * aspect(options.projection, extent))),
        )
      : Math.max(40, options.height - 2 * pad);
  const height = options.height ?? mapHeight + 2 * pad;
  const frame = { left: 0, top: 0, width, height };
  const project = Object.assign(
    fitExtent(options.projection, extent, {
      left: pad,
      top: pad,
      width: mapWidth,
      height: mapHeight,
    }),
    { frame },
  );

  const drawn = regions.map((r) => {
    const polygons = r.polygons.map((rings) =>
      rings.map((ring) => ring.map(([lon, lat]) => project(lon, lat))),
    );
    return { region: r, d: polygonPath(polygons), at: labelPoint(polygons), polygons };
  });
  const ranks = readingRanks(
    drawn.map((d) => d.at ?? [0, 0]),
    frame,
  );

  // Values print inside a region whose box holds them, with a halo in the region's own color.
  const ch = charWidth(width);
  const line = 12 * textGrowth(width);
  const taken: { x0: number; y0: number; x1: number; y1: number }[] = [];
  const showLabels = options.valueLabels ?? true;
  const labels = showLabels
    ? drawn
        .map(({ region, at, polygons }) => {
          if (!at || region.value === null) return "";
          const label = format(region.value);
          const w = label.length * ch;
          let x0 = Number.POSITIVE_INFINITY;
          let x1 = Number.NEGATIVE_INFINITY;
          let y0 = Number.POSITIVE_INFINITY;
          let y1 = Number.NEGATIVE_INFINITY;
          for (const [x, y] of polygons.flat(2)) {
            x0 = Math.min(x0, x);
            x1 = Math.max(x1, x);
            y0 = Math.min(y0, y);
            y1 = Math.max(y1, y);
          }
          if (x1 - x0 < w + 6 || y1 - y0 < line + 4) return "";
          const box = {
            x0: at[0] - w / 2,
            y0: at[1] - line / 2,
            x1: at[0] + w / 2,
            y1: at[1] + line / 2,
          };
          if (taken.some((t) => t.x0 < box.x1 && box.x0 < t.x1 && t.y0 < box.y1 && box.y0 < t.y1))
            return "";
          taken.push(box);
          return el(
            "text",
            {
              x: num(at[0]),
              y: num(at[1]),
              dy: "0.32em",
              fill: `var(--enarratio-sequential-text-${region.step})`,
            },
            text(label),
          );
        })
        .join("")
    : "";
  const basemap = drawBasemap(KIND, options.basemap ?? [], project, width, taken);

  const describe = (r: Region): string =>
    `${r.name}: ${r.value === null ? strings.terms.noData : `${format(r.value)} ${valueLabel}`}`;
  const areas = drawn
    .filter((d) => d.d)
    .map(({ region, d }, i) =>
      el(
        "path",
        {
          d,
          "fill-rule": "evenodd",
          ...(region.value === null
            ? {
                fill: "none",
                stroke: "var(--enarratio-status-unknown)",
                "stroke-dasharray": "3,2",
              }
            : {
                fill: `var(--enarratio-sequential-${region.step})`,
                "data-enarratio-step": region.step,
              }),
          ...Object.fromEntries(
            datumAttributes({
              key: markKey(region.name),
              filter: { field: options.region, value: region.name },
              column: ranks[drawn.findIndex((x) => x.region === region)] ?? i,
              row: 0,
            }),
          ),
        },
        el("title", {}, text(describe(region))),
      ),
    )
    .join("");
  // Every region's edge in the background color, over the fills, so neighbors in one step part.
  const edges = el("path", {
    d: drawn.map((x) => x.d).join(""),
    fill: "none",
    stroke: "var(--enarratio-background)",
    "stroke-width": 1,
    "stroke-linejoin": "round",
  });

  const svg = svgRoot(
    width,
    height,
    options.alt,
    "img",
    [
      clipped(frame, basemap.svg),
      el("g", { "data-enarratio-mark": "cell" }, areas),
      el("g", { "data-enarratio-mark": "region edge", "aria-hidden": "true" }, edges),
      clipped(frame, basemap.labels),
      labels
        ? el("g", { "data-enarratio-mark": "value label", "aria-hidden": "true" }, labels)
        : "",
    ].join(""),
  );

  const stops = [min, ...thresholds, max];
  const ramp: RampItem[] = [1, 2, 3, 4, 5].map((step) => ({
    step,
    label:
      step === 1
        ? strings.below(format(stops[1] as number))
        : step === 5
          ? strings.orMore(format(stops[4] as number))
          : strings.range(format(stops[step - 1] as number), format(stops[step] as number)),
  }));
  const ordered = [...regions].sort((a, b) => a.name.localeCompare(b.name));

  return figure(options, {
    kind: "choropleth",
    svg,
    ramp,
    description: {
      axes: [valueRange("color", valueLabel, present, format)],
      format,
      series: [{ name: valueLabel, points: ordered.map((r) => ({ at: r.name, value: r.value })) }],
    },
    table: {
      columns: [regionHeader, valueLabel],
      rows: ordered.map((r) => [r.name, r.value === null ? strings.terms.noData : format(r.value)]),
    },
  });
}
