import * as Plot from "@observablehq/plot";
import { named } from "../plot/marks.js";
import { domainOf, markKey, maxOf } from "../render/data.js";
import { categoryRange, valueRange } from "../render/describe.js";
import {
  type AxisUnits,
  type FigureOptions,
  figure,
  type SeriesColor,
  unitLabel,
  validateFigure,
} from "../render/figure.js";
import { keyed, renderPlot } from "../render/plot.js";
import { planSeries } from "../render/series.js";
import { DEFAULT_WIDTH } from "../render/size.js";
import { numberFormat, stringsFor } from "../render/text.js";
import { parseNewick, type TreeNode } from "./newick.js";

/** Options for {@link phylogeneticTree}. */
export interface PhylogeneticTreeOptions extends FigureOptions, Pick<AxisUnits, "xUnit"> {
  /** The tree: Newick text, or a tree already parsed by {@link parseNewick}. */
  readonly tree: string | TreeNode;
  /** A group for each tip, by tip name (clade, host, country), which sets its color and symbol. */
  readonly groups?: Readonly<Record<string, string>>;
  readonly groupDomain?: readonly string[];
  readonly colors?: Readonly<Record<string, SeriesColor>>;
  /**
   * Draw branch lengths to scale (default, when every branch has one), or ignore them and line
   * the tips up (a cladogram).
   */
  readonly branchLengths?: boolean;
  /** Print internal node labels, such as bootstrap support, at their nodes (default true). */
  readonly nodeLabels?: boolean;
  /** The distance axis label (default "Substitutions per site"; `null` hides it), with `xUnit`. */
  readonly lengthLabel?: string | null;
}

interface Laid {
  readonly name: string;
  readonly label?: string;
  readonly tip: boolean;
  readonly parent?: Laid;
  readonly length?: number;
  readonly x: number;
  y: number;
}

const KIND = "phylogeneticTree";
const ROW = 20;

/**
 * A phylogenetic tree in the rectangular layout: branches as right angles, lengths to scale along
 * a distance axis (or tips aligned, as a cladogram), tips named at their ends and colored and
 * shaped by group, and internal node labels such as support values printed at their nodes. Each
 * tip is keyed, top to bottom. The data table lists every node with its parent, branch length,
 * distance from the root and group, so the topology reads as text.
 *
 * @example
 * phylogeneticTree({ tree: "((A:0.1,B:0.2):0.05,C:0.3);", alt: "..." });
 */
export function phylogeneticTree(options: PhylogeneticTreeOptions): string {
  validateFigure(KIND, options);
  const strings = stringsFor(options.strings);
  const { terms } = strings;
  const locale = options.locale ? { locale: options.locale } : {};
  const number = numberFormat(locale);
  const four = numberFormat({ ...locale, maximumSignificantDigits: 4 });
  const root = typeof options.tree === "string" ? parseNewick(options.tree) : options.tree;
  const nodes: Laid[] = [];
  let tips = 0;
  let internal = 0;
  let everyLength = true;
  const visit = (n: TreeNode, depth: number, child: boolean): number => {
    if (child && n.length === undefined) everyLength = false;
    return n.children.reduce((d, c) => Math.max(d, visit(c, depth + 1, true)), depth);
  };
  const deepest = visit(root, 0, false);
  const scaled = options.branchLengths ?? everyLength;
  if (scaled && !everyLength)
    throw new Error(`${KIND}: branchLengths needs a length on every branch`);
  const place = (n: TreeNode, at: number, depth: number, parent?: Laid): Laid => {
    const tip = n.children.length === 0;
    const x = scaled ? at + (parent ? (n.length ?? 0) : 0) : tip ? deepest : depth;
    const name = tip
      ? (n.name ?? `${terms.tip} ${tips + 1}`)
      : parent
        ? `${terms.node} ${++internal}`
        : terms.root;
    const laid: Laid = {
      name,
      ...(n.name !== undefined && !tip ? { label: n.name } : {}),
      tip,
      ...(parent ? { parent } : {}),
      ...(n.length !== undefined && parent ? { length: n.length } : {}),
      x,
      y: tip ? tips++ : 0,
    };
    nodes.push(laid);
    const kids = n.children.map((c) => place(c, x, depth + 1, laid));
    if (!tip) laid.y = ((kids[0] as Laid).y + (kids[kids.length - 1] as Laid).y) / 2;
    return laid;
  };
  place(root, 0, 0);
  if (tips > 400) throw new Error(`${KIND}: ${tips} tips are too many to label`);
  const tipNodes = nodes.filter((n) => n.tip);
  const names = new Set<string>();
  for (const t of tipNodes) {
    if (names.has(t.name)) throw new Error(`${KIND}: two tips are named "${t.name}"`);
    names.add(t.name);
  }
  const groups = options.groups;
  for (const name of Object.keys(groups ?? {})) {
    if (!names.has(name)) throw new Error(`${KIND}: groups names "${name}", which is not a tip`);
  }
  const groupOf = (t: Laid): string | undefined => groups?.[t.name];
  const groupNames = groups
    ? domainOf(
        KIND,
        "group",
        tipNodes.flatMap((t) => groupOf(t) ?? []),
        options.groupDomain,
      )
    : [terms.tips];
  const plan = planSeries(KIND, groupNames, options.colors);
  const branches = nodes.filter((n) => n.parent);
  const parents = nodes.filter((n) => !n.tip);
  const kidsOf = (p: Laid): Laid[] => nodes.filter((n) => n.parent === p);
  const at = (x: number): string => (scaled ? four(x) : number(x));
  const distance = (n: Laid): string => at(n.x);
  const describe = (t: Laid): string =>
    `${t.name}${groupOf(t) ? ` (${groupOf(t)})` : ""}: ${(scaled ? terms.distanceFromRoot : terms.depth).toLowerCase()} ${distance(t)}`;
  const showLabels = options.nodeLabels ?? true;
  const labeled = parents.filter((p) => p.label !== undefined && p.parent);
  const lengthLabel = unitLabel(options.lengthLabel, terms.substitutionsPerSite, options.xUnit);
  const longest = Math.max(1, maxOf(tipNodes.map((t) => t.name.length)));
  const marks: Plot.Markish[] = [
    Plot.link(parents, {
      x1: "x",
      x2: "x",
      y1: (p: Laid) => (kidsOf(p)[0] as Laid).y,
      y2: (p: Laid) => (kidsOf(p).at(-1) as Laid).y,
      stroke: "var(--enarratio-text)",
      strokeWidth: 1.5,
      render: named("branch"),
    }),
    Plot.link(branches, {
      x1: (n: Laid) => n.parent?.x,
      x2: "x",
      y1: "y",
      y2: "y",
      stroke: "var(--enarratio-text)",
      strokeWidth: 1.5,
      render: named("branch"),
    }),
    Plot.dot(tipNodes, {
      x: "x",
      y: "y",
      r: 4,
      fill: (t: Laid) => groupOf(t) ?? groupNames[0],
      stroke: (t: Laid) => groupOf(t) ?? groupNames[0],
      ...(groups ? { symbol: (t: Laid) => groupOf(t) ?? groupNames[0] } : {}),
      title: describe,
      render: keyed(tipNodes, (t) => ({
        key: markKey(t.name),
        ...(groupOf(t)
          ? {
              filter: { field: "group", value: groupOf(t) as string },
              series: groupOf(t) as string,
            }
          : {}),
        x: t.name,
        column: t.y,
        row: 0,
      })),
    }),
    Plot.text(tipNodes, { x: "x", y: "y", text: "name", textAnchor: "start", dx: 8 }),
  ];
  if (showLabels && labeled.length > 0) {
    marks.push(
      Plot.text(labeled, {
        x: "x",
        y: "y",
        text: "label",
        textAnchor: "end",
        dx: -4,
        dy: -7,
        fill: "var(--enarratio-text-muted)",
      }),
    );
  }
  const { svg } = renderPlot(
    {
      width: options.width ?? DEFAULT_WIDTH,
      height: options.height ?? tips * ROW + 64,
      marginTop: 16,
      marginLeft: 16,
      marginRight: Math.min(260, longest * 7 + 24),
      marginBottom: scaled ? 44 : 16,
      x: scaled
        ? { label: lengthLabel, labelAnchor: "center", labelArrow: "none", grid: true, nice: true }
        : { axis: null, domain: [0, deepest] },
      y: { axis: null, domain: [tips - 0.5, -0.5] },
      color: { domain: groupNames, range: [...plan.range] },
      ...(groups ? { symbol: { domain: groupNames } } : {}),
      marks,
    },
    options.alt,
  );
  return figure(options, {
    kind: "tree",
    svg,
    // The tips top to bottom, each at its distance from the root (or depth, as a cladogram).
    description: {
      axes: [
        valueRange("x", scaled ? lengthLabel : terms.depth, [0, ...tipNodes.map((t) => t.x)], at),
        categoryRange(
          "y",
          terms.tips,
          tipNodes.map((t) => t.name),
        ),
      ],
      format: at,
      series: [
        {
          name: scaled ? terms.distanceFromRoot : terms.depth,
          points: tipNodes.map((t) => ({ at: t.name, value: t.x })),
        },
      ],
    },
    legend: groups ? plan.legend : [],
    ...(groups ? { seriesField: "group" } : {}),
    slotColors: plan.slotColors,
    table: {
      columns: [
        terms.node,
        terms.parent,
        ...(scaled ? [terms.branchLength, terms.distanceFromRoot] : [terms.depth]),
        ...(showLabels && labeled.length > 0 ? [terms.label] : []),
        ...(groups ? [terms.group] : []),
      ],
      rows: nodes.map((n) => [
        n.name,
        n.parent?.name ?? "",
        ...(scaled ? [n.length === undefined ? "" : number(n.length), distance(n)] : [number(n.x)]),
        ...(showLabels && labeled.length > 0 ? [n.label ?? ""] : []),
        ...(groups ? [groupOf(n) ?? ""] : []),
      ]),
    },
  });
}
