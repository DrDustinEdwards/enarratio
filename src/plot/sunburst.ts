import { el, svgRoot, text } from "../lite/svg.js";
import { arcPath, n2, polar } from "../render/arc.js";
import { type KeysOfType, markKey } from "../render/data.js";
import { datumAttributes } from "../render/datum.js";
import { type FigureOptions, figure, type SeriesColor, validateFigure } from "../render/figure.js";
import {
  buildHierarchy,
  eachNode,
  type HierarchyNode,
  hierarchyTable,
  leaves,
} from "../render/hierarchy.js";
import { planSeries } from "../render/series.js";
import { charWidth, DEFAULT_WIDTH, textGrowth } from "../render/size.js";
import { numberFormat, stringsFor, valueFormat } from "../render/text.js";
import { texture } from "../render/texture.js";

/** Options for {@link sunburst}. */
export interface SunburstOptions<T extends object> extends FigureOptions {
  readonly data: readonly T[];
  /** The fields naming each row's place, from the innermost ring out: `["region", "country"]`. */
  readonly path: readonly KeysOfType<T, string | number>[];
  /** The field for each part's size: zero or more. */
  readonly value: KeysOfType<T, number>;
  /** What the value measures, for the table and hover details (default: the field's name). */
  readonly valueLabel?: string;
  /** Text in the hole, such as the whole ("$4,750 a month"). Defaults to the total. */
  readonly centerLabel?: string;
  /** Colors for top-level groups, by name. */
  readonly colors?: Readonly<Record<string, SeriesColor>>;
  readonly formatValue?: (value: number) => string;
}

const KIND = "sunburst";
/** The gap between arcs, in user units. */
const GAP = 2;

interface Arc {
  readonly node: HierarchyNode;
  readonly a0: number;
  readonly a1: number;
  readonly r0: number;
  readonly r1: number;
  readonly index: number;
}

/**
 * Whether a horizontal label `w` wide and `h` high, centered at the arc's middle, lies inside the
 * arc with a little room to spare: each corner is checked against the arc's radii and angles.
 */
function fitsIn(arc: Arc, cx: number, cy: number, w: number, h: number): boolean {
  const mid = (arc.a0 + arc.a1) / 2;
  const [mx, my] = polar(cx, cy, (arc.r0 + arc.r1) / 2, mid);
  const pad = 3;
  for (const [dx, dy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    const x = mx + (dx * w) / 2 - cx;
    const y = my + (dy * h) / 2 - cy;
    const r = Math.hypot(x, y);
    if (r < arc.r0 + pad || r > arc.r1 - pad) return false;
    let a = Math.atan2(x, -y);
    if (a < 0) a += 2 * Math.PI;
    const margin = pad / r;
    if (a < arc.a0 + margin || a > arc.a1 - margin) return false;
  }
  return true;
}

/**
 * Whether a label `w` wide and `h` high fits along the arc, turned to its tangent at the middle:
 * its height within the ring, its ends inside the outer radius and between the arc's ends.
 */
function fitsAlong(arc: Arc, w: number, h: number): boolean {
  const pad = 3;
  const rm = (arc.r0 + arc.r1) / 2;
  if (h > arc.r1 - arc.r0 - pad * 2) return false;
  if (Math.hypot(rm + h / 2, w / 2) > arc.r1 - pad) return false;
  const half = Math.atan2(w / 2, rm - h / 2);
  return half * 2 + (pad * 2) / rm <= arc.a1 - arc.a0;
}

/**
 * A sunburst: parts of a whole in levels as rings, the top level innermost and each part's arc
 * spanning its share of its parent's, for a hierarchy read from the center out (a budget by
 * department and program, a genome's reads by kingdom and phylum). Each top-level group takes a
 * color its parts keep, arcs are separated by a gap, and an arc is named where its name fits
 * inside it, level or along the arc; the hole holds the whole. Angles are harder to compare than the lengths or
 * areas of a treemap, so prefer a treemap when exact comparison matters; the data table lists
 * every part with each group's subtotal.
 *
 * @example
 * sunburst({ data: budget, path: ["department", "program"], value: "spend", alt: "..." });
 */
export function sunburst<T extends object>(options: SunburstOptions<T>): string {
  const { data, path, value } = options;
  validateFigure(KIND, options);
  const format = valueFormat(options);
  const { terms } = stringsFor(options.strings);
  const percent = numberFormat({
    ...(options.locale ? { locale: options.locale } : {}),
    style: "percent",
    maximumFractionDigits: 1,
  });
  const tops = buildHierarchy(KIND, data, path, value);
  const plan = planSeries(
    KIND,
    tops.map((t) => t.name),
    options.colors,
  );
  const whole = tops.reduce((sum, n) => sum + n.value, 0);
  const valueLabel = options.valueLabel ?? value;

  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? 400;
  const growth = textGrowth(width);
  const char = charWidth(width);
  const line = 14 * growth;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.max(40, Math.min(width, height) / 2 - 4);
  const hole = radius * 0.3;
  const ring = (radius - hole) / path.length;

  const arcs: Arc[] = [];
  const place = (
    nodes: readonly HierarchyNode[],
    from: number,
    span: number,
    total: number,
  ): void => {
    let at = from;
    for (const node of nodes) {
      const sweep = total > 0 ? (node.value / total) * span : 0;
      const r0 = hole + (node.depth - 1) * ring;
      arcs.push({ node, a0: at, a1: at + sweep, r0, r1: r0 + ring, index: arcs.length });
      place(node.children, at, sweep, node.value);
      at += sweep;
    }
  };
  place(tops, 0, 2 * Math.PI, whole);

  const named = (node: HierarchyNode): string => node.path.join(" / ");
  const shown = (node: HierarchyNode): string =>
    `${format(node.value)} (${percent(node.value / whole)})`;
  const order = new Map(eachNode(tops).map((n, i) => [n, i]));

  const paths = arcs
    .filter((a) => a.a1 > a.a0)
    .map((a) =>
      el(
        "path",
        {
          d: arcPath(cx, cy, a.r1, a.r0, a.a0, a.a1),
          fill: `var(--enarratio-series-${a.node.top + 1})`,
          ...Object.fromEntries(
            datumAttributes({
              key: markKey(...a.node.path),
              filter: { field: path[0] as string, value: a.node.path[0] as string },
              series: a.node.path[0] as string,
              column: order.get(a.node) ?? a.index,
              row: 0,
              at: named(a.node),
              shown: shown(a.node),
            }),
          ),
        },
        el("title", {}, text(`${named(a.node)}: ${shown(a.node)}`)),
      ),
    )
    .join("");

  const labels = arcs
    .map((a) => {
      const name = a.node.name;
      const w = name.length * char;
      const mid = (a.a0 + a.a1) / 2;
      const rm = (a.r0 + a.r1) / 2;
      const [x, y] = polar(cx, cy, rm, mid);
      const attrs = {
        x: n2(x),
        y: n2(y),
        dy: "0.32em",
        fill: `var(--enarratio-series-text-${a.node.top + 1})`,
      };
      if (fitsIn(a, cx, cy, w, line)) return el("text", attrs, text(name));
      if (!fitsAlong(a, w, line)) return "";
      // Along the arc, turned so it never reads upside down.
      const deg = (mid * 180) / Math.PI;
      const turn = deg > 90 && deg < 270 ? deg - 180 : deg;
      return el(
        "text",
        { ...attrs, transform: `rotate(${n2(turn)} ${n2(x)} ${n2(y)})` },
        text(name),
      );
    })
    .join("");

  const centerText = options.centerLabel ?? format(whole);
  const center =
    centerText.length * char <= hole * 2 - 8
      ? el(
          "g",
          { "data-enarratio-mark": "center label", "aria-hidden": "true", "font-weight": "600" },
          el(
            "text",
            { x: n2(cx), y: n2(cy - line / 2), dy: "0.32em", fill: "var(--enarratio-text-muted)" },
            text(terms.total),
          ) +
            el(
              "text",
              { x: n2(cx), y: n2(cy + line / 2), dy: "0.32em", fill: "var(--enarratio-text)" },
              text(centerText),
            ),
        )
      : "";

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
            "data-enarratio-mark": "arc",
            // A gap in the background color between arcs, so neighbors never merge (B6).
            stroke: "var(--enarratio-background)",
            "stroke-width": GAP,
            "stroke-linejoin": "round",
          },
          paths,
        ),
        el(
          "g",
          { "data-enarratio-mark": "arc label", "aria-hidden": "true", "pointer-events": "none" },
          labels,
        ),
        center,
      ].join(""),
    ),
    JSON.stringify(options.colors ?? {}),
  );

  const parts = leaves(tops);
  return figure(options, {
    kind: KIND,
    svg,
    description: {
      format,
      series: [{ name: valueLabel, points: parts.map((n) => ({ at: named(n), value: n.value })) }],
    },
    legend: plan.legend,
    seriesField: path[0] as string,
    slotColors: plan.slotColors,
    table: hierarchyTable(tops, [...path, valueLabel, terms.share], format, percent, terms.total),
  });
}
