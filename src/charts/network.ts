import * as Plot from "@observablehq/plot";
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { maxOf, minOf } from "../render/data.js";
import { type FigureOptions, figure, type SeriesColor, validateFigure } from "../render/figure.js";
import { keyed, renderPlot } from "../render/plot.js";
import { planSeries } from "../render/series.js";

/** A node in a {@link networkChart}. */
export interface NetworkNode {
  /** Unique within the chart. */
  readonly id: string;
  /** The text shown beside the node; defaults to `id`. */
  readonly label?: string;
  /** A group the node belongs to, colored as a series and listed in the legend. */
  readonly group?: string;
}

/** A link between two nodes, by id. */
export interface NetworkLink {
  readonly source: string;
  readonly target: string;
}

/** Options for {@link networkChart}. */
export interface NetworkChartOptions extends FigureOptions {
  readonly nodes: readonly NetworkNode[];
  readonly links: readonly NetworkLink[];
  /** Every group in display and color order. Without it, first-seen order. */
  readonly groupDomain?: readonly string[];
  readonly colors?: Readonly<Record<string, SeriesColor>>;
  /** Print node labels (default true when there are 40 nodes or fewer). */
  readonly nodeLabels?: boolean;
  /** Simulation steps; more settles a large network further (default 300). */
  readonly iterations?: number;
}

interface LaidOutNode extends SimulationNodeDatum {
  readonly id: string;
  readonly label: string;
  readonly group: string;
  degree: number;
}

const KIND = "networkChart";
const RADIUS = 6;

/**
 * A force-directed network, laid out on the server with d3-force so it needs no script and draws
 * the same every time: collaborators, co-authorship, transmission clusters. Groups are colored
 * as series; the data table lists every node with its connections.
 *
 * @example
 * networkChart({
 *   nodes: [{ id: "a", group: "Lab" }, { id: "b", group: "Clinic" }],
 *   links: [{ source: "a", target: "b" }],
 *   alt: "Two collaborators ...",
 * });
 */
export function networkChart(options: NetworkChartOptions): string {
  const { nodes, links } = options;
  validateFigure(KIND, options);
  if (nodes.length === 0) throw new Error(`${KIND}: nodes is empty`);
  const width = options.width ?? 640;
  const height = options.height ?? 420;
  const ungrouped = "Nodes";
  const grouped = nodes.some((n) => n.group !== undefined);

  const byId = new Map<string, LaidOutNode>();
  nodes.forEach((n, i) => {
    if (n.id === "") throw new Error(`${KIND}: node ${i + 1} has an empty id`);
    if (byId.has(n.id)) throw new Error(`${KIND}: two nodes have id "${n.id}"`);
    byId.set(n.id, { id: n.id, label: n.label ?? n.id, group: n.group ?? ungrouped, degree: 0 });
  });
  const laidOut = [...byId.values()];
  const edges = links.map(
    (l, i): SimulationLinkDatum<LaidOutNode> & { a: LaidOutNode; b: LaidOutNode } => {
      const a = byId.get(l.source);
      const b = byId.get(l.target);
      if (!a || !b) {
        throw new Error(
          `${KIND}: link ${i + 1} names "${a ? l.target : l.source}", which is not a node`,
        );
      }
      a.degree += 1;
      b.degree += 1;
      return { source: a, target: b, a, b };
    },
  );

  const groupNames = options.groupDomain
    ? [...options.groupDomain]
    : [...new Set(laidOut.map((n) => n.group))];
  for (const n of laidOut) {
    if (!groupNames.includes(n.group)) {
      throw new Error(`${KIND}: group "${n.group}" is missing from groupDomain`);
    }
  }
  const plan = planSeries(KIND, groupNames, options.colors);

  // d3-force seeds its layout deterministically, so the same data always yields the same drawing.
  const simulation = forceSimulation<LaidOutNode>(laidOut)
    .force("link", forceLink<LaidOutNode, (typeof edges)[number]>(edges).distance(40))
    .force("charge", forceManyBody().strength(-90))
    .force("x", forceX(0).strength(0.06))
    .force("y", forceY(0).strength(0.06 * (width / height)))
    .force("collide", forceCollide(RADIUS + 3))
    .stop();
  simulation.tick(options.iterations ?? 300);

  const xs = laidOut.map((n) => n.x ?? 0);
  const ys = laidOut.map((n) => n.y ?? 0);
  const pad = 1;
  const span = (values: number[]): [number, number] => {
    const lo = minOf(values);
    const hi = maxOf(values);
    return lo === hi ? [lo - pad, hi + pad] : [lo, hi];
  };
  const showLabels = options.nodeLabels ?? laidOut.length <= 40;
  const describe = (n: LaidOutNode): string =>
    `${n.label}${grouped ? ` (${n.group})` : ""}: ${n.degree} connection${n.degree === 1 ? "" : "s"}`;

  const marks: Plot.Markish[] = [
    Plot.link(edges, {
      x1: (e: (typeof edges)[number]) => e.a.x ?? 0,
      y1: (e: (typeof edges)[number]) => e.a.y ?? 0,
      x2: (e: (typeof edges)[number]) => e.b.x ?? 0,
      y2: (e: (typeof edges)[number]) => e.b.y ?? 0,
      stroke: "var(--abscissa-text-muted)",
      strokeOpacity: 0.5,
    }),
    Plot.dot(laidOut, {
      x: (n: LaidOutNode) => n.x ?? 0,
      y: (n: LaidOutNode) => n.y ?? 0,
      r: RADIUS,
      fill: "group",
      stroke: "var(--abscissa-background)",
      strokeWidth: 1.5,
      title: describe,
      render: keyed(laidOut, (n) => ({
        key: n.id,
        column: laidOut.indexOf(n),
        row: 0,
        filter: grouped ? { field: "group", value: n.group } : { field: "id", value: n.id },
        x: n.label,
        ...(grouped ? { series: n.group } : {}),
      })),
    }),
  ];
  if (showLabels) {
    marks.push(
      Plot.text(laidOut, {
        x: (n: LaidOutNode) => n.x ?? 0,
        y: (n: LaidOutNode) => n.y ?? 0,
        text: "label",
        dx: RADIUS + 3,
        textAnchor: "start",
        fill: "var(--abscissa-text)",
        stroke: "var(--abscissa-background)",
        strokeWidth: 3,
        paintOrder: "stroke",
      }),
    );
  }

  const { svg } = renderPlot(
    {
      width,
      height,
      margin: 16,
      marginRight: showLabels ? 96 : 16,
      x: { domain: span(xs), axis: null },
      y: { domain: span(ys), axis: null },
      color: { domain: groupNames, range: [...plan.range] },
      marks,
    },
    options.alt,
  );

  const neighbors = new Map<string, string[]>(laidOut.map((n) => [n.id, []]));
  for (const e of edges) {
    neighbors.get(e.a.id)?.push(e.b.label);
    neighbors.get(e.b.id)?.push(e.a.label);
  }

  return figure(options, {
    kind: "network",
    svg,
    legend: grouped ? plan.legend : [],
    ...(grouped ? { seriesField: "group" } : {}),
    slotColors: plan.slotColors,
    table: {
      columns: ["Node", ...(grouped ? ["Group"] : []), "Connected to"],
      rows: laidOut.map((n) => [
        n.label,
        ...(grouped ? [n.group] : []),
        (neighbors.get(n.id) ?? []).join(", ") || "none",
      ]),
    },
  });
}
