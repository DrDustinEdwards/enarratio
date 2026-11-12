import { el, svgRoot, text } from "../lite/svg.js";
import { n2 } from "../render/arc.js";
import { markKey } from "../render/data.js";
import { datumAttributes } from "../render/datum.js";
import { figure, type SeriesColor, validateFigure } from "../render/figure.js";
import {
  flowDescription,
  type FlowOptions,
  readLinks,
  type SankeyLink,
  type SankeyNode,
  sankeyLayout,
} from "../render/flow.js";
import { planSeries } from "../render/series.js";
import { charWidth, DEFAULT_WIDTH, textGrowth } from "../render/size.js";
import { stringsFor, valueFormat } from "../render/text.js";

/** Options for {@link sankeyDiagram}. */
export interface SankeyDiagramOptions<T extends object> extends FlowOptions<T> {
  /** Colors for the nodes of the first column, by name; the flows they feed take them on. */
  readonly colors?: Readonly<Record<string, SeriesColor>>;
}

const KIND = "sankey";
/** A node's width, and the room between nodes in a column, in user units. */
const NODE = 12;
const PADDING = 14;

/** A band from its source's right edge to its target's left edge, curving halfway. */
function band(l: SankeyLink, x0: number, x1: number): string {
  const mx = (x0 + x1) / 2;
  const [s0, s1, t0, t1] = [l.sy, l.sy + l.width, l.ty, l.ty + l.width].map(n2) as [
    number,
    number,
    number,
    number,
  ];
  return `M${n2(x0)},${s0}C${n2(mx)},${s0} ${n2(mx)},${t0} ${n2(x1)},${t0}L${n2(x1)},${t1}C${n2(mx)},${t1} ${n2(mx)},${s1} ${n2(x0)},${s1}Z`;
}

/**
 * A Sankey diagram: flows from stage to stage (energy from source to use, patients from diagnosis
 * to outcome, a budget from fund to program), each band as thick as what it carries and each node
 * as tall as the larger of what enters and leaves it. Nodes are placed in columns by their longest
 * path from a source and moved so bands cross as little as they can; a cycle cannot be drawn and
 * throws. Each first-column node takes a color the flows it feeds keep, every node is named with its
 * total, and the data table lists every flow.
 *
 * @example
 * sankeyDiagram({ data: energy, from: "source", to: "use", value: "twh", alt: "..." });
 */
export function sankeyDiagram<T extends object>(options: SankeyDiagramOptions<T>): string {
  const { data, from, to, value } = options;
  validateFigure(KIND, options);
  const format = valueFormat(options);
  const { terms } = stringsFor(options.strings);
  const valueLabel = options.valueLabel ?? value;
  const { links: flows, names } = readLinks(KIND, data, from, to, value);

  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? 400;
  const growth = textGrowth(width);
  const char = charWidth(width);
  const top = 6;
  const plotHeight = height - top * 2;
  const { nodes, links, columns } = sankeyLayout(KIND, names, flows, plotHeight, PADDING * growth);
  const step = columns > 1 ? (width - NODE) / (columns - 1) : 0;
  const xOf = (n: SankeyNode): number => n.column * step;

  // First-column nodes take the palette in order (one color for all past eight); every other node
  // takes the color of its largest inflow.
  const firsts = nodes.filter((n) => n.column === 0);
  const colored = firsts.length <= 8;
  const plan = planSeries(
    KIND,
    colored ? firsts.map((n) => n.name) : [],
    colored ? options.colors : undefined,
  );
  const slot = new Map<SankeyNode, number>();
  for (const n of [...nodes].sort((a, b) => a.column - b.column)) {
    if (n.column === 0) {
      slot.set(n, colored ? plan.slot(n.name) : 1);
      continue;
    }
    const biggest = links
      .filter((l) => l.to === n)
      .reduce<SankeyLink | null>((best, l) => (!best || l.value > best.value ? l : best), null);
    slot.set(n, biggest ? (slot.get(biggest.from) ?? 1) : 1);
  }
  const slotOf = (n: SankeyNode): number => slot.get(n) ?? 1;
  const y = (v: number): number => top + v;

  const bands = links
    .filter((l) => l.width > 0)
    .map((l, i) =>
      el(
        "path",
        {
          d: band({ ...l, sy: y(l.sy), ty: y(l.ty) }, xOf(l.from) + NODE, xOf(l.to)),
          fill: `var(--enarratio-series-${slotOf(l.from)})`,
          ...Object.fromEntries(
            datumAttributes({
              key: markKey(l.source, l.target),
              filter: { field: from, value: l.source },
              series: terms.flows,
              column: i,
              row: 0,
              at: `${l.source} → ${l.target}`,
              shown: format(l.value),
            }),
          ),
        },
        el("title", {}, text(`${l.source} → ${l.target}: ${format(l.value)} ${valueLabel}`)),
      ),
    )
    .join("");

  const blocks = nodes
    .map((n) =>
      el(
        "rect",
        {
          x: n2(xOf(n)),
          y: n2(y(n.y0)),
          width: NODE,
          height: n2(Math.max(1, n.y1 - n.y0)),
          fill: `var(--enarratio-series-${slotOf(n)})`,
          ...Object.fromEntries(
            datumAttributes({
              key: markKey("node", n.name),
              series: terms.nodes,
              column: n.column * names.length + n.index,
              row: 0,
              at: n.name,
              shown: format(n.value),
            }),
          ),
        },
        el("title", {}, text(`${n.name}: ${format(n.value)} ${valueLabel}`)),
      ),
    )
    .join("");

  // Each node's name and total beside it, toward the middle of the drawing, on a halo of the
  // background so a band behind it does not lower its contrast (B1).
  // Placed largest node first: the name and total on one line, else on two, else the name cut to
  // fit; a label that would overlap one already placed is left out (hover, focus and the table
  // still name the node). A label stays within the gap to the next column.
  const lineHeight = 14 * growth;
  const room = columns > 1 ? step - NODE - 12 : width - NODE - 12;
  const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
  const labelOf = new Map<SankeyNode, string>();
  for (const n of [...nodes].sort((a, b) => b.value - a.value)) {
    const last = n.column === columns - 1 && columns > 1;
    const x = last ? xOf(n) - 6 : xOf(n) + NODE + 6;
    const cy = y((n.y0 + n.y1) / 2);
    const chars = Math.floor(room / char);
    const total = format(n.value);
    const cut =
      n.name.length <= chars
        ? n.name
        : chars >= 4
          ? `${n.name.slice(0, chars - 1).trimEnd()}…`
          : "";
    const tries: string[][] = [[`${n.name} ${total}`], [n.name, total], [cut]];
    for (const lines of tries) {
      if (lines.some((l) => !l || l.length > chars)) continue;
      const w = Math.max(...lines.map((l) => l.length)) * char;
      const box = {
        x0: last ? x - w : x,
        x1: last ? x : x + w,
        y0: cy - (lines.length * lineHeight) / 2,
        y1: cy + (lines.length * lineHeight) / 2,
      };
      if (box.y0 < 0 || box.y1 > height) continue;
      if (placed.some((p) => p.x0 < box.x1 && box.x0 < p.x1 && p.y0 < box.y1 && box.y0 < p.y1)) {
        continue;
      }
      placed.push(box);
      const first = cy - ((lines.length - 1) * lineHeight) / 2;
      labelOf.set(
        n,
        el(
          "text",
          { x: n2(x), y: n2(first), dy: "0.32em", "text-anchor": last ? "end" : "start" },
          lines
            .map((l, k) =>
              k === 0 ? text(l) : el("tspan", { x: n2(x), dy: `${n2(lineHeight)}` }, text(l)),
            )
            .join(""),
        ),
      );
      break;
    }
  }
  const labels = nodes.map((n) => labelOf.get(n) ?? "").join("");

  const svg = svgRoot(
    width,
    height,
    options.alt,
    "img",
    [
      el("g", { "data-enarratio-mark": "flow", "fill-opacity": 0.45 }, bands),
      el("g", { "data-enarratio-mark": "node" }, blocks),
      el(
        "g",
        {
          "data-enarratio-mark": "node label",
          "aria-hidden": "true",
          "pointer-events": "none",
          fill: "var(--enarratio-text)",
          stroke: "var(--enarratio-background)",
          "stroke-width": 3,
          "stroke-linejoin": "round",
          "paint-order": "stroke",
        },
        labels,
      ),
    ].join(""),
  );

  return figure(options, {
    kind: KIND,
    svg,
    limits: { series: 8 },
    description: flowDescription(format, valueLabel, links),
    ...(colored ? { legend: plan.legend } : {}),
    slotColors: plan.slotColors,
    table: {
      columns: [terms.source, terms.target, valueLabel],
      rows: links.map((l) => [l.source, l.target, format(l.value)]),
    },
  });
}
