import { el, svgRoot, text } from "../lite/svg.js";
import { n2 } from "../render/arc.js";
import { type KeysOfType, markKey } from "../render/data.js";
import { datumAttributes } from "../render/datum.js";
import { figure, type SeriesColor } from "../render/figure.js";
import {
  type HierarchyNode,
  type HierarchyOptions,
  hierarchyTable,
  readHierarchy,
  leaves,
  type Rect,
  squarify,
} from "../render/hierarchy.js";
import { planSeries } from "../render/series.js";
import { texture } from "../render/texture.js";

/** Options for {@link treemap}. */
export interface TreemapOptions<T extends object> extends HierarchyOptions<T> {
  /**
   * The fields naming each row's place, from the outermost level in: `["region", "country"]`.
   * One to four levels. Each row is one tile.
   */
  readonly path: readonly KeysOfType<T, string | number>[];
  /** Colors for top-level groups, by name, on a chart of two or more levels. */
  readonly colors?: Readonly<Record<string, SeriesColor>>;
}

const KIND = "treemap";
/** The gap between tiles and around groups, in user units. */
const GAP = 2;

interface Tile {
  readonly node: HierarchyNode;
  readonly rect: Rect;
  readonly index: number;
}

interface Header {
  readonly node: HierarchyNode;
  readonly rect: Rect;
}

/**
 * Lays `nodes` out in `area`, squarified, recursing into groups below a header line that names
 * them when there is room for it.
 */
function layout(
  nodes: readonly HierarchyNode[],
  area: Rect,
  header: number,
  tiles: Tile[],
  headers: Header[],
): void {
  const rects = squarify(
    nodes.map((n) => n.value),
    area,
  );
  nodes.forEach((node, i) => {
    const rect = rects[i] as Rect;
    if (node.children.length === 0) {
      tiles.push({ node, rect, index: tiles.length });
      return;
    }
    const titled = rect.height > header * 2 + GAP * 2 && rect.width > 48;
    if (titled) headers.push({ node, rect });
    const top = titled ? header : GAP;
    layout(
      node.children,
      {
        x: rect.x + GAP,
        y: rect.y + top,
        width: Math.max(0, rect.width - GAP * 2),
        height: Math.max(0, rect.height - top - GAP),
      },
      header,
      tiles,
      headers,
    );
  });
}

/** `value` cut to fit `room` characters, with an ellipsis, or "" when not even two fit. */
function fit(value: string, room: number): string {
  if (value.length <= room) return value;
  return room >= 3 ? `${value.slice(0, room - 1).trimEnd()}…` : "";
}

/**
 * A treemap: parts of a whole as nested rectangles whose areas are their values, for wholes with
 * many parts or parts in levels (a budget by department and program, sales by region and
 * country). Tiles are squarified (Bruls, Huizing and van Wijk 2000) so their areas compare, sorted
 * largest first, and each names its part and value where it has room. On two or more levels each
 * top-level group takes a color and a header line with its name and total; on one level every
 * tile is one color and the labels tell them apart. The data table lists every part, with each
 * group's subtotal.
 *
 * @example
 * treemap({ data: budget, path: ["department", "program"], value: "spend", alt: "..." });
 */
export function treemap<T extends object>(options: TreemapOptions<T>): string {
  const { format, terms, percent, tops, whole, valueLabel, width, height, char, line } =
    readHierarchy(KIND, options);
  const { path } = options;
  const levels = path.length;
  const grouped = levels > 1;
  const plan = planSeries(
    KIND,
    grouped ? tops.map((t) => t.name) : [],
    grouped ? options.colors : undefined,
  );
  const header = Math.ceil(line + 6);
  const tiles: Tile[] = [];
  const headers: Header[] = [];
  // Largest first for the layout; colors keep the data's order of groups.
  const sorted = [...tops].sort((a, b) => b.value - a.value);
  layout(sorted, { x: 0, y: 0, width, height }, header, tiles, headers);

  const slotOf = (node: HierarchyNode): number => (grouped ? node.top + 1 : 1);
  const named = (node: HierarchyNode): string => node.path.join(" / ");
  const describe = (node: HierarchyNode): string =>
    `${named(node)}: ${format(node.value)} (${percent(node.value / whole)})`;

  const rects = tiles
    .filter((t) => t.rect.width > 0 && t.rect.height > 0)
    .map((t) =>
      el(
        "rect",
        {
          x: n2(t.rect.x),
          y: n2(t.rect.y),
          width: n2(t.rect.width),
          height: n2(t.rect.height),
          fill: `var(--enarratio-series-${slotOf(t.node)})`,
          ...Object.fromEntries(
            datumAttributes({
              key: markKey(...t.node.path),
              filter: { field: path[0] as string, value: t.node.path[0] as string },
              ...(grouped ? { series: t.node.path[0] as string } : {}),
              column: t.index,
              row: 0,
              at: named(t.node),
              shown: `${format(t.node.value)} (${percent(t.node.value / whole)})`,
            }),
          ),
        },
        el("title", {}, text(describe(t.node))),
      ),
    )
    .join("");

  // Each tile's name, and its value below when there is room for two lines, in the color for
  // text on its fill (B1); a tile too small for its name stays unlabeled, read by hover, focus
  // and the table.
  const labels = tiles
    .map((t) => {
      const room = Math.floor((t.rect.width - 8) / char);
      if (t.rect.height < line + 6) return "";
      const name = fit(t.node.name, room);
      if (!name) return "";
      const shown = format(t.node.value);
      const two = t.rect.height >= line * 2 + 8 && shown.length <= room;
      const x = n2(t.rect.x + 4);
      const y = t.rect.y + 4 + line * 0.75;
      return el(
        "text",
        { x, y: n2(y), fill: `var(--enarratio-series-text-${slotOf(t.node)})` },
        el("tspan", { "font-weight": "600" }, text(name)) +
          (two ? el("tspan", { x, dy: `${n2(line)}` }, text(shown)) : ""),
      );
    })
    .join("");
  const heads = headers
    .map((h) => {
      const room = Math.floor((h.rect.width - 8) / char);
      const full = `${h.node.name} ${format(h.node.value)}`;
      const label = full.length <= room ? full : fit(h.node.name, room);
      if (!label) return "";
      return el(
        "text",
        { x: n2(h.rect.x + 4), y: n2(h.rect.y + 3 + line * 0.75), "font-weight": "600" },
        text(label),
      );
    })
    .join("");

  const svg = texture(
    svgRoot(
      width,
      height,
      options.alt,
      "img",
      [
        el(
          "g",
          {
            "data-enarratio-mark": "tile",
            // A gap in the background color between tiles, so neighbors never merge (B6).
            stroke: "var(--enarratio-background)",
            "stroke-width": GAP,
          },
          rects,
        ),
        el(
          "g",
          {
            "data-enarratio-mark": "tile label",
            "aria-hidden": "true",
            "pointer-events": "none",
            "text-anchor": "start",
          },
          labels,
        ),
        el(
          "g",
          {
            "data-enarratio-mark": "group label",
            "aria-hidden": "true",
            "pointer-events": "none",
            "text-anchor": "start",
            fill: "var(--enarratio-text)",
          },
          heads,
        ),
      ].join(""),
    ),
    JSON.stringify(options.colors ?? {}),
  );

  const parts = leaves(tops);
  return figure(options, {
    kind: KIND,
    svg,
    limits: { series: 8 },
    description: {
      format,
      series: [{ name: valueLabel, points: parts.map((n) => ({ at: named(n), value: n.value })) }],
    },
    ...(grouped ? { legend: plan.legend, seriesField: path[0] as string } : {}),
    slotColors: plan.slotColors,
    table: hierarchyTable(tops, [...path, valueLabel, terms.share], format, percent, terms.total),
  });
}
