import * as Plot from "@observablehq/plot";
import { markKey, maxOf } from "../render/data.js";
import { datumAttributes } from "../render/datum.js";
import {
  type BoxStats,
  boxStats,
  grid,
  kernelDensity,
  silvermanBandwidth,
} from "../render/distribution.js";
import { figure } from "../render/figure.js";
import { keyed, renderPlot } from "../render/plot.js";
import { planSeries } from "../render/series.js";
import { charWidth } from "../render/size.js";
import { numberFormat } from "../render/text.js";
import { drawAnnotations, withNotes } from "./annotate.js";
import { describeValues, frame, type GroupedValuesOptions, read, type Value } from "./box.js";
import { named, steps, SVG_NS } from "./marks.js";

/** Options for {@link violinPlot}. */
export interface ViolinPlotOptions<T extends object> extends GroupedValuesOptions<T> {
  /** The Gaussian kernel's bandwidth, in y units (default Silverman's rule, per group). */
  readonly bandwidth?: number;
  /**
   * Draw every value as a point inside its violin. Defaults to true where any group has fewer than
   * 30 values, since a density drawn from few values can show shapes that are not there (Wilke).
   */
  readonly points?: boolean;
}

const KIND = "violinPlot";

/** Text broken at spaces into lines of at most `room` characters (a longer word keeps its line). */
function wrap(text: string, room: number): string {
  const lines: string[] = [];
  for (const word of text.split(" ")) {
    const last = lines.at(-1);
    if (last !== undefined && last.length + 1 + word.length <= room)
      lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines.join("\n");
}
/** The most of a group's width a violin takes at its widest. */
const HALF = 0.42;
/** Fewer values than this in any group, and the points are drawn by default. */
const FEW = 30;

/**
 * Violin plots, one per group (Hintze and Nelson 1998): each group's kernel density mirrored
 * either side of its center, trimmed to the values' range, with a bar across the quartiles and a
 * dot at the median inside. Every violin is drawn on one density scale, so each has the same area.
 * Groups with few values also show every value as a point, since the shape alone can mislead.
 * Every violin (and point) is reached by hover, focus and the keys, and the data table gives each
 * group's n, quartiles and bandwidth. A box plot is simpler to read where the shape is not the
 * point.
 *
 * @example
 * violinPlot({ data: mice, x: "diet", y: "weight", alt: "..." });
 */
export function violinPlot<T extends object>(given: ViolinPlotOptions<T>): string {
  const options = withNotes(given);
  if (options.bandwidth !== undefined && !(options.bandwidth > 0)) {
    throw new Error(`${KIND}: bandwidth must be a positive number, is ${options.bandwidth}`);
  }
  const r = read(KIND, options);
  const { terms } = r.strings;
  const plan = planSeries(KIND, options.colorByGroup ? r.groups : [terms.values], options.colors);
  const slot = (i: number): number => (options.colorByGroup ? i + 1 : 1);
  const f = r.format;
  const range = (a: number, b: number): string => r.strings.range(f(a), f(b));
  const digits = numberFormat({
    ...(options.locale ? { locale: options.locale } : {}),
    maximumSignificantDigits: 3,
  });
  const groups = r.groups.map((g, i) => {
    const values = r.values.filter((v) => v.groupIndex === i).map((v) => v.value);
    const stats = boxStats(values);
    const bandwidth = options.bandwidth ?? silvermanBandwidth(values);
    const ys = stats.min === stats.max ? [stats.min] : grid(stats.min, stats.max, 64);
    const density = kernelDensity(values, bandwidth, ys);
    return { g, i, stats, bandwidth, ys, density };
  });
  type Group = (typeof groups)[number];
  // Each violin as wide as the others at its widest, so a narrow spread does not flatten the
  // rest: shapes compare across groups, widths do not.
  const half = (g: Group, k: number): number =>
    ((g.density[k] ?? 0) / (maxOf(g.density) || 1)) * HALF;
  const describe = (g: Group): string =>
    `${r.xLabel ?? options.x} ${g.g}: ${terms.median.toLowerCase()} ${f(g.stats.median)}, ${terms.quartiles} ${range(g.stats.q1, g.stats.q3)}, ${terms.n} ${r.count(g.stats.n)}`;
  const marks: Plot.Markish[] = groups.map((g) =>
    Plot.areaX(
      g.ys.map((y, k) => ({ y, x1: g.i - half(g, k), x2: g.i + half(g, k) })),
      {
        y: "y",
        x1: "x1",
        x2: "x2",
        fill: `var(--enarratio-series-${slot(g.i)})`,
        curve: "linear",
        render: named("violin"),
      },
    ),
  );
  marks.push(
    Plot.rect(groups, {
      x1: (g: Group) => g.i - 0.025,
      x2: (g: Group) => g.i + 0.025,
      y1: (g: Group) => g.stats.q1,
      y2: (g: Group) => g.stats.q3,
      fill: "var(--enarratio-text)",
      rx: 1.5,
      render: named("quartiles"),
    }),
    Plot.dot(groups, {
      x: "i",
      y: (g: Group) => g.stats.median,
      r: 3,
      fill: "var(--enarratio-background)",
      stroke: "var(--enarratio-text)",
      strokeWidth: 1.5,
      render: named("median"),
    }),
  );
  const showPoints = options.points ?? groups.some((g) => g.stats.n < FEW);
  if (showPoints) {
    // A fixed spread inside the violin's width at each value: the golden-ratio sequence, the same
    // on every render.
    const at = (v: Value): number => {
      const g = groups[v.groupIndex] as Group;
      const k = Math.round(
        ((v.value - g.stats.min) / (g.stats.max - g.stats.min || 1)) * (g.ys.length - 1),
      );
      return (
        v.groupIndex + ((((r.values.indexOf(v) + 1) * 0.618034) % 1) * 2 - 1) * half(g, k) * 0.8
      );
    };
    const order = new Map(
      [...r.values]
        .sort((a, b) => a.groupIndex - b.groupIndex || a.value - b.value)
        .map((v, i) => [v, i + 1]),
    );
    marks.push(
      Plot.dot(r.values, {
        x: at,
        y: "value",
        r: 2.5,
        fill: (v: Value) => `var(--enarratio-series-text-${slot(v.groupIndex)})`,
        fillOpacity: 0.75,
        title: (v: Value) => `${r.xLabel ?? options.x} ${v.group}: ${f(v.value)}`,
        render: keyed(r.values, (v) => ({
          key: markKey("value", v.key),
          filter: { field: options.x, value: v.group },
          x: v.group,
          column: v.groupIndex,
          row: order.get(v) ?? 1,
          at: v.group,
          shown: f(v.value),
        })),
      }),
    );
  }
  // Each violin is one path, keyed as its group.
  const keyViolins = (svg: SVGSVGElement): void => {
    [...svg.querySelectorAll('[data-enarratio-mark="violin"] path')].forEach((path, i) => {
      const g = groups[i] as Group;
      for (const [name, value] of datumAttributes({
        key: markKey(g.g),
        filter: { field: options.x, value: g.g },
        x: g.g,
        column: g.i,
        row: 0,
        at: g.g,
        shown: `${terms.median.toLowerCase()} ${f(g.stats.median)}, ${terms.quartiles} ${range(g.stats.q1, g.stats.q3)}, ${terms.n} ${r.count(g.stats.n)}`,
      })) {
        path.setAttribute(name, value);
      }
      const title = svg.ownerDocument.createElementNS(SVG_NS, "title");
      title.textContent = describe(g);
      path.append(title);
    });
  };
  // Group names wrap onto lines that fit their column, so neighbors never run together on a phone.
  const base = frame(r);
  const room = Math.max(
    4,
    Math.floor(((r.width - r.marginLeft - 20) / r.groups.length - 8) / charWidth(r.width)),
  );
  const { svg } = renderPlot(
    {
      ...base,
      x: { ...(base.x as object), tickFormat: (i: number) => wrap(r.groups[i] ?? "", room) },
      marks,
    },
    options.alt,
    "img",
    steps(keyViolins, drawAnnotations(KIND, options.annotations)),
  );
  const stats: BoxStats[] = groups.map((g) => g.stats);
  return figure(options, {
    kind: "violin",
    svg,
    method: r.strings.densityMethod(
      groups.map((g) => ({
        ...(groups.length > 1 ? { name: g.g } : {}),
        n: r.count(g.stats.n),
        bandwidth: digits(g.bandwidth),
      })),
    ),
    description: describeValues(r, {
      sentence: r.strings.medians(groups.map((g) => ({ value: f(g.stats.median), at: g.g }))),
    }),
    slotColors: plan.slotColors,
    table: {
      columns: [
        r.xLabel ?? options.x,
        terms.n,
        terms.minimum,
        terms.lowerQuartile,
        terms.median,
        terms.upperQuartile,
        terms.maximum,
        terms.bandwidth,
      ],
      rows: groups.map((g, i) => {
        const s = stats[i] as BoxStats;
        return [
          g.g,
          r.count(s.n),
          f(s.min),
          f(s.q1),
          f(s.median),
          f(s.q3),
          f(s.max),
          digits(g.bandwidth),
        ];
      }),
    },
  });
}
