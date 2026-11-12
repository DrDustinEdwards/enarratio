/**
 * Flows between named things, for the Sankey and chord diagrams (record 0037): links read from
 * rows, and the Sankey layout.
 */

import { type KeysOfType, readLabel, readNumber } from "./data.js";
import type { ChartDescription } from "./describe.js";
import type { FigureOptions } from "./figure.js";

/** The options the flow diagrams share: which fields name a flow's ends and size it. */
export interface FlowOptions<T extends object> extends FigureOptions {
  /** One row per flow. */
  readonly data: readonly T[];
  /** The field naming where each flow comes from. */
  readonly from: KeysOfType<T, string | number>;
  /** The field naming where it goes. */
  readonly to: KeysOfType<T, string | number>;
  /** The field for how much flows: zero or more. */
  readonly value: KeysOfType<T, number>;
  /** What the value measures, for the table and hover details (default: the field's name). */
  readonly valueLabel?: string;
  readonly formatValue?: (value: number) => string;
}

/** One flow from a source to a target. */
export interface FlowLink {
  readonly source: string;
  readonly target: string;
  readonly value: number;
  readonly index: number;
}

/** The overview of a flow diagram: one series, each flow a point named "source → target". */
export function flowDescription(
  format: (value: number) => string,
  valueLabel: string,
  links: readonly FlowLink[],
): ChartDescription {
  return {
    format,
    series: [
      {
        name: valueLabel,
        points: links.map((l) => ({ at: `${l.source} → ${l.target}`, value: l.value })),
      },
    ],
  };
}

/** Reads links from rows; throws on a negative value or a repeated pair. */
export function readLinks(
  kind: string,
  data: readonly object[],
  source: string,
  target: string,
  value: string,
): { links: FlowLink[]; names: string[] } {
  if (data.length === 0) throw new Error(`${kind}: data is empty`);
  const names: string[] = [];
  const seen = new Set<string>();
  const links = data.map((row, i): FlowLink => {
    const s = readLabel(kind, row, source, i);
    const t = readLabel(kind, row, target, i);
    const v = readNumber(kind, row, value, i);
    if (v < 0) throw new Error(`${kind}: row ${i + 1} value is ${v}; a flow cannot be negative`);
    const id = JSON.stringify([s, t]);
    if (seen.has(id)) throw new Error(`${kind}: two rows for the flow from ${s} to ${t}`);
    seen.add(id);
    for (const n of [s, t]) if (!names.includes(n)) names.push(n);
    return { source: s, target: t, value: v, index: i };
  });
  return { links, names };
}

/** A node of a laid-out Sankey diagram. */
export interface SankeyNode {
  readonly name: string;
  readonly index: number;
  column: number;
  /** The larger of what flows in and what flows out. */
  value: number;
  y0: number;
  y1: number;
}

/** A link of a laid-out Sankey diagram: where its band leaves its source and reaches its target. */
export interface SankeyLink extends FlowLink {
  readonly from: SankeyNode;
  readonly to: SankeyNode;
  /** The band's top at its source and at its target; its thickness is `width`. */
  sy: number;
  ty: number;
  width: number;
}

/**
 * Lays out a Sankey diagram (after d3-sankey's method): each node's column is its longest path
 * from a source, sinks move to the last column, node heights are their values on one scale for
 * the whole drawing, and nodes are moved toward the weighted middle of their neighbors and then
 * apart, in passes both ways, so bands cross less. Throws on a cycle, which a Sankey cannot draw.
 */
export function sankeyLayout(
  kind: string,
  names: readonly string[],
  flows: readonly FlowLink[],
  height: number,
  padding: number,
): { nodes: SankeyNode[]; links: SankeyLink[]; columns: number } {
  const nodes: SankeyNode[] = names.map((name, index) => ({
    name,
    index,
    column: 0,
    value: 0,
    y0: 0,
    y1: 0,
  }));
  const byName = new Map(nodes.map((n) => [n.name, n]));
  const links: SankeyLink[] = flows.map((f) => ({
    ...f,
    from: byName.get(f.source) as SankeyNode,
    to: byName.get(f.target) as SankeyNode,
    sy: 0,
    ty: 0,
    width: 0,
  }));
  const outs = new Map(nodes.map((n) => [n, links.filter((l) => l.from === n)]));
  const ins = new Map(nodes.map((n) => [n, links.filter((l) => l.to === n)]));
  for (const l of links) {
    if (l.from === l.to)
      throw new Error(`${kind}: ${l.source} flows to itself; a Sankey cannot draw a loop`);
  }
  // Columns by longest path from a source (Kahn's order); a node left unvisited is on a cycle.
  const indegree = new Map(nodes.map((n) => [n, (ins.get(n) ?? []).length]));
  const queue = nodes.filter((n) => indegree.get(n) === 0);
  let visited = 0;
  while (queue.length > 0) {
    const n = queue.shift() as SankeyNode;
    visited += 1;
    for (const l of outs.get(n) ?? []) {
      l.to.column = Math.max(l.to.column, n.column + 1);
      const d = (indegree.get(l.to) ?? 0) - 1;
      indegree.set(l.to, d);
      if (d === 0) queue.push(l.to);
    }
  }
  if (visited < nodes.length) {
    throw new Error(`${kind}: the flows form a cycle; a Sankey draws flows that only move forward`);
  }
  const columns = Math.max(...nodes.map((n) => n.column)) + 1;
  for (const n of nodes) {
    if ((outs.get(n) ?? []).length === 0) n.column = columns - 1;
    const sum = (ls: readonly SankeyLink[]): number => ls.reduce((s, l) => s + l.value, 0);
    n.value = Math.max(sum(ins.get(n) ?? []), sum(outs.get(n) ?? []));
  }
  const cols = Array.from({ length: columns }, (_, c) => nodes.filter((n) => n.column === c));
  const ky = Math.min(
    ...cols.map((col) => {
      const total = col.reduce((s, n) => s + n.value, 0);
      return total > 0 ? (height - (col.length - 1) * padding) / total : Infinity;
    }),
  );
  const scale = Number.isFinite(ky) ? ky : 0;
  for (const col of cols) {
    let y = 0;
    for (const n of col) {
      n.y0 = y;
      n.y1 = y + n.value * scale;
      y = n.y1 + padding;
    }
  }
  for (const l of links) l.width = l.value * scale;

  // Resolves overlaps in a column, top down then bottom up, keeping order by position.
  const collide = (col: SankeyNode[]): void => {
    col.sort((a, b) => a.y0 - b.y0);
    let y = 0;
    for (const n of col) {
      const dy = y - n.y0;
      if (dy > 0) {
        n.y0 += dy;
        n.y1 += dy;
      }
      y = n.y1 + padding;
    }
    let bottom = height;
    for (let i = col.length - 1; i >= 0; i -= 1) {
      const n = col[i] as SankeyNode;
      const dy = n.y1 - bottom;
      if (dy > 0) {
        n.y0 -= dy;
        n.y1 -= dy;
      }
      bottom = n.y0 - padding;
    }
  };
  const center = (n: SankeyNode): number => (n.y0 + n.y1) / 2;
  const relax = (col: SankeyNode[], side: "in" | "out", alpha: number): void => {
    for (const n of col) {
      const ls = (side === "in" ? ins : outs).get(n) ?? [];
      const total = ls.reduce((s, l) => s + l.value, 0);
      if (total === 0) continue;
      const target =
        ls.reduce((s, l) => s + center(side === "in" ? l.from : l.to) * l.value, 0) / total;
      const dy = (target - center(n)) * alpha;
      n.y0 += dy;
      n.y1 += dy;
    }
    collide(col);
  };
  for (let pass = 0, alpha = 1; pass < 6; pass += 1, alpha *= 0.99) {
    for (let c = 1; c < columns; c += 1) relax(cols[c] as SankeyNode[], "in", alpha);
    for (let c = columns - 2; c >= 0; c -= 1) relax(cols[c] as SankeyNode[], "out", alpha);
  }
  // Each node's bands stacked in the order of the nodes at their other ends, so they do not cross
  // at the node.
  for (const n of nodes) {
    let y = n.y0;
    for (const l of [...(outs.get(n) ?? [])].sort((a, b) => a.to.y0 - b.to.y0)) {
      l.sy = y;
      y += l.width;
    }
    y = n.y0;
    for (const l of [...(ins.get(n) ?? [])].sort((a, b) => a.from.y0 - b.from.y0)) {
      l.ty = y;
      y += l.width;
    }
  }
  return { nodes, links, columns };
}
