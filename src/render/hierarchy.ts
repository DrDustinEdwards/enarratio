/**
 * Parts of a whole in levels, for the treemap and the sunburst (record 0037): the tree built from
 * flat rows and a path of fields, the squarified layout, and the table both charts share.
 */

import { type KeysOfType, readLabel, readNumber } from "./data.js";
import { type DataTable, type FigureOptions, validateFigure } from "./figure.js";
import { charWidth, DEFAULT_WIDTH, textGrowth } from "./size.js";
import { shareFormat, stringsFor, valueFormat } from "./text.js";

/** The options the treemap and the sunburst share. */
export interface HierarchyOptions<T extends object> extends FigureOptions {
  readonly data: readonly T[];
  /** The fields naming each row's place, one to four levels. */
  readonly path: readonly KeysOfType<T, string | number>[];
  /** The field for each part's size: zero or more. */
  readonly value: KeysOfType<T, number>;
  /** What the value measures, for the table and hover details (default: the field's name). */
  readonly valueLabel?: string;
  readonly formatValue?: (value: number) => string;
}

/** One node of a hierarchy: a group, or a leaf for one row. */
export interface HierarchyNode {
  readonly name: string;
  /** The names from the top level down to this node. */
  readonly path: readonly string[];
  /** 1 for the top level. */
  readonly depth: number;
  /** The sum of the leaves under it, or the row's value for a leaf. */
  value: number;
  readonly children: HierarchyNode[];
  /** The index of its top-level ancestor (itself at depth 1), for its color and series. */
  readonly top: number;
}

/**
 * What the treemap and the sunburst read before they draw: the checked options, the tree
 * ({@link buildHierarchy}) and its whole, how values and shares are written, and the drawing's
 * size and text metrics (400 tall by default).
 */
export function readHierarchy<T extends object>(kind: string, options: HierarchyOptions<T>) {
  validateFigure(kind, options);
  const format = valueFormat(options);
  const { terms } = stringsFor(options.strings);
  const percent = shareFormat(options);
  const tops = buildHierarchy(kind, options.data, options.path, options.value);
  const width = options.width ?? DEFAULT_WIDTH;
  return {
    format,
    terms,
    percent,
    tops,
    whole: tops.reduce((sum, n) => sum + n.value, 0),
    valueLabel: options.valueLabel ?? options.value,
    width,
    height: options.height ?? 400,
    char: charWidth(width),
    line: 14 * textGrowth(width),
  };
}

/**
 * The tree of `data` by `path`, the fields from the outermost level to the innermost: each row is
 * a leaf, its value from `value`. Siblings are sorted largest first, as the squarified layout
 * needs and as readers compare them. Throws on a negative value, a repeated leaf or an empty whole.
 */
export function buildHierarchy(
  kind: string,
  data: readonly object[],
  path: readonly string[],
  value: string,
): HierarchyNode[] {
  if (data.length === 0) throw new Error(`${kind}: data is empty`);
  if (path.length === 0) throw new Error(`${kind}: path names no field`);
  if (path.length > 4) throw new Error(`${kind}: path has ${path.length} levels; draw at most 4`);
  const tops: HierarchyNode[] = [];
  const seen = new Set<string>();
  data.forEach((row, i) => {
    const names = path.map((field) => readLabel(kind, row, field, i));
    const v = readNumber(kind, row, value, i);
    if (v < 0) throw new Error(`${kind}: row ${i + 1} value is ${v}; a part cannot be negative`);
    const id = JSON.stringify(names);
    if (seen.has(id)) throw new Error(`${kind}: two rows for ${names.join(" / ")}`);
    seen.add(id);
    let level = tops;
    let top = -1;
    names.forEach((name, d) => {
      let node = level.find((n) => n.name === name);
      if (!node) {
        node = {
          name,
          path: names.slice(0, d + 1),
          depth: d + 1,
          value: 0,
          children: [],
          top: d === 0 ? tops.length : top,
        };
        level.push(node);
      }
      if (d === 0) top = node.top;
      node.value += v;
      level = node.children;
    });
  });
  const total = tops.reduce((sum, n) => sum + n.value, 0);
  if (!(total > 0))
    throw new Error(`${kind}: the values add up to zero; there is no whole to divide`);
  const sort = (nodes: HierarchyNode[]): void => {
    nodes.sort((a, b) => b.value - a.value);
    for (const n of nodes) sort(n.children);
  };
  // Top-level groups keep their data order, so their colors follow the caller's order.
  for (const n of tops) sort(n.children);
  return tops;
}

/** Every node depth first, a parent before its children. */
export function eachNode(nodes: readonly HierarchyNode[]): HierarchyNode[] {
  return nodes.flatMap((n) => [n, ...eachNode(n.children)]);
}

/** The leaves, depth first. */
export function leaves(nodes: readonly HierarchyNode[]): HierarchyNode[] {
  return eachNode(nodes).filter((n) => n.children.length === 0);
}

/** A rectangle. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Squarified rectangles for `values` (largest first) filling `area` (Bruls, Huizing and van Wijk
 * 2000): rows are laid along the shorter side and a value joins the row while that does not worsen
 * the row's most elongated rectangle. Returns one rectangle per value, in order; a zero value gets
 * an empty one.
 */
export function squarify(values: readonly number[], area: Rect): Rect[] {
  const total = values.reduce((a, b) => a + b, 0);
  const out: Rect[] = values.map(() => ({ x: area.x, y: area.y, width: 0, height: 0 }));
  if (!(total > 0) || area.width <= 0 || area.height <= 0) return out;
  const scale = (area.width * area.height) / total;
  let { x, y, width: w, height: h } = area;
  let i = 0;
  const n = values.length;
  while (i < n && (values[i] as number) > 0) {
    const side = Math.min(w, h);
    const start = i;
    let sum = 0;
    let least = Infinity;
    let most = 0;
    let worst = Infinity;
    while (i < n && (values[i] as number) > 0) {
      const a = (values[i] as number) * scale;
      const s = sum + a;
      const lo = Math.min(least, a);
      const hi = Math.max(most, a);
      const ratio = Math.max((side * side * hi) / (s * s), (s * s) / (side * side * lo));
      if (i > start && ratio > worst) break;
      sum = s;
      least = lo;
      most = hi;
      worst = ratio;
      i += 1;
    }
    const thick = sum / side;
    let at = 0;
    for (let k = start; k < i; k += 1) {
      const length = ((values[k] as number) * scale) / thick;
      out[k] =
        w >= h
          ? { x, y: y + at, width: thick, height: length }
          : { x: x + at, y, width: length, height: thick };
      at += length;
    }
    if (w >= h) {
      x += thick;
      w -= thick;
    } else {
      y += thick;
      h -= thick;
    }
  }
  return out;
}

/**
 * The table both hierarchy charts give their figure: one row per leaf, its path in the first
 * columns, then its value and share of the whole; on charts of two or more levels each group is
 * followed by its subtotal ("Total" in the levels below it), and the last row is the whole.
 */
export function hierarchyTable(
  tops: readonly HierarchyNode[],
  columns: readonly string[],
  format: (v: number) => string,
  percent: (v: number) => string,
  totalTerm: string,
): DataTable {
  const levels = columns.length - 2;
  const whole = tops.reduce((sum, n) => sum + n.value, 0);
  const rows: string[][] = [];
  const pad = (path: readonly string[]): string[] =>
    Array.from({ length: levels }, (_, i) => path[i] ?? totalTerm);
  const walk = (node: HierarchyNode): void => {
    if (node.children.length === 0) {
      rows.push([...pad(node.path), format(node.value), percent(node.value / whole)]);
      return;
    }
    for (const child of node.children) walk(child);
    rows.push([...pad(node.path), format(node.value), percent(node.value / whole)]);
  };
  for (const top of tops) walk(top);
  rows.push([
    totalTerm,
    ...Array.from({ length: levels - 1 }, () => ""),
    format(whole),
    percent(1),
  ]);
  return { columns, rows };
}
