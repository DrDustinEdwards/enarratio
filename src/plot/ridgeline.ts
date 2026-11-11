import * as Plot from "@observablehq/plot";
import {
  domainOf,
  type KeysOfType,
  markKey,
  maxOf,
  minOf,
  readLabel,
  readNumber,
} from "../render/data.js";
import { categoryRange, valueRange } from "../render/describe.js";
import { grid, kernelDensity, quantile, silvermanBandwidth } from "../render/distribution.js";
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
import { charWidth, DEFAULT_WIDTH, textGrowth } from "../render/size.js";
import { numberFormat, stringsFor } from "../render/text.js";
import { named } from "./marks.js";

/** Options for {@link ridgelinePlot}. */
export interface RidgelinePlotOptions<T extends object> extends FigureOptions, AxisUnits {
  readonly data: readonly T[];
  /** The measurement whose distribution each row draws. */
  readonly x: KeysOfType<T, number>;
  /** The field naming each row, top to bottom in first-seen order unless `yDomain` orders it. */
  readonly y: KeysOfType<T, string | number>;
  /** The rows in display order, top first: order them by a key that means something (time, rank). */
  readonly yDomain?: readonly (string | number)[];
  /**
   * How far the tallest ridge rises into the row above, in rows (default 0.5). The ridges share
   * one density scale, so heights compare across rows.
   */
  readonly overlap?: number;
  /** The Gaussian kernel's bandwidth, in x units (default Silverman's rule, per row). */
  readonly bandwidth?: number;
  readonly color?: SeriesColor;
  readonly xLabel?: string | null;
  readonly formatValue?: (value: number) => string;
}

const KIND = "ridgelinePlot";
/** How many evenly spaced x values the table gives, and the points hover and the keys reach. */
const TABLE_POINTS = 15;

/**
 * A ridgeline plot: one smoothed distribution per row on a shared x scale, the rows overlapping a
 * little, each a Gaussian kernel density estimate (Silverman's bandwidth unless one is given), so
 * many groups' shapes compare in little room. Rows run in the order given; the docs advise a
 * meaningful one. Every row is named at its baseline, and its density at evenly spaced values is
 * reached by hover, focus and the keys and listed in the data table.
 *
 * @example
 * ridgelinePlot({ data: temps, x: "celsius", y: "month", alt: "..." });
 */
export function ridgelinePlot<T extends object>(options: RidgelinePlotOptions<T>): string {
  const { data, x, y } = options;
  validateFigure(KIND, options);
  if (data.length === 0) throw new Error(`${KIND}: data is empty`);
  if (options.bandwidth !== undefined && !(options.bandwidth > 0)) {
    throw new Error(`${KIND}: bandwidth must be a positive number, is ${options.bandwidth}`);
  }
  const overlap = options.overlap ?? 0.5;
  if (!(overlap >= 0 && overlap <= 3)) {
    throw new Error(`${KIND}: overlap must be from 0 to 3 rows, is ${overlap}`);
  }
  const strings = stringsFor(options.strings);
  const { terms } = strings;
  const format =
    options.formatValue ??
    numberFormat({
      ...(options.locale ? { locale: options.locale } : {}),
      maximumSignificantDigits: 4,
    });
  const digits = numberFormat({
    ...(options.locale ? { locale: options.locale } : {}),
    maximumSignificantDigits: 3,
  });
  const count = numberFormat(options.locale ? { locale: options.locale } : {});
  const xLabel = unitLabel(options.xLabel, x, options.xUnit);
  const values = data.map((row, i) => readNumber(KIND, row, x, i));
  const rowsOf = data.map((row, i) => readLabel(KIND, row, y, i));
  const names = domainOf(KIND, y, rowsOf, options.yDomain);
  const plan = planSeries(
    KIND,
    [terms.density],
    options.color ? { [terms.density]: options.color } : undefined,
  );
  const groups = names.map((name) => values.filter((_, i) => rowsOf[i] === name));
  for (const [k, g] of groups.entries()) {
    if (g.length === 0) throw new Error(`${KIND}: row "${names[k]}" has no values`);
  }
  const bandwidths = groups.map((g) => options.bandwidth ?? silvermanBandwidth(g));
  const pad = 3 * maxOf(bandwidths);
  const lo = minOf(values) - pad;
  const hi = maxOf(values) + pad;
  const xs = grid(lo, hi, 100);
  const curves = groups.map((g, k) => kernelDensity(g, bandwidths[k] as number, xs));
  const at = grid(minOf(values), maxOf(values), TABLE_POINTS);
  const sampled = groups.map((g, k) => kernelDensity(g, bandwidths[k] as number, at));
  const tallest = maxOf(curves.flat()) || 1;
  const n = names.length;
  // Row k's baseline, the top row highest; a ridge at the tallest density rises 1 + overlap rows.
  const base = (k: number): number => n - 1 - k;
  const lift = (d: number): number => (d / tallest) * (1 + overlap);

  const width = options.width ?? DEFAULT_WIDTH;
  const growth = textGrowth(width);
  const char = charWidth(width);
  const longest = Math.max(...names.map((s) => s.length)) * char;
  // Names left of the ridges while they take no more than a third of the width; past that (a
  // phone) each goes inside its row, above the baseline at the left.
  const inside = longest + 12 > width / 3;
  const pitch = 30 * growth;
  const top = 12;
  const bottom = 44;
  const height = options.height ?? Math.ceil((n + overlap) * pitch + top + bottom * growth);
  const fill = plan.range[0] as string;

  const marks: Plot.Markish[] = names.map((_, k) =>
    Plot.areaY(
      xs.map((xv, i) => ({
        x: xv,
        y1: base(k),
        y2: base(k) + lift((curves[k] as number[])[i] as number),
      })),
      {
        x: "x",
        y1: "y1",
        y2: "y2",
        fill,
        stroke: "var(--enarratio-background)",
        strokeWidth: 1.5,
        curve: "linear",
        render: named("ridge"),
      },
    ),
  );
  const samples = names.flatMap((name, k) =>
    at.map((xv, i) => {
      const d = (sampled[k] as number[])[i] as number;
      return { name, k, i, x: xv, d, y: base(k) + lift(d) };
    }),
  );
  type Sample = (typeof samples)[number];
  marks.push(
    Plot.dot(samples, {
      x: "x",
      y: "y",
      r: 4,
      fill,
      fillOpacity: 0,
      title: (s: Sample) =>
        `${s.name}, ${xLabel ?? x} ${format(s.x)}: ${terms.density.toLowerCase()} ${digits(s.d)}`,
      render: keyed(samples, (s) => ({
        key: markKey(s.name, s.i),
        filter: { field: y, value: s.name },
        series: s.name,
        x: String(s.x),
        column: s.i,
        // The top row is the last, so Up moves to the ridge drawn above.
        row: n - 1 - s.k,
        at: format(s.x),
        shown: digits(s.d),
      })),
    }),
    Plot.text(
      names.map((name, k) => ({ name, y: base(k) })),
      {
        y: "y",
        text: "name",
        frameAnchor: "left",
        textAnchor: inside ? "start" : "end",
        dx: inside ? 2 : -8,
        dy: inside ? -6 * growth : -4 * growth,
        fill: "var(--enarratio-text)",
        stroke: "var(--enarratio-background)",
        strokeWidth: 3,
        paintOrder: "stroke",
        render: named("y-axis tick label"),
      },
    ),
  );
  const rendered = renderPlot(
    {
      width,
      height,
      marginTop: top,
      marginLeft: inside ? Math.ceil(2.5 * char) : Math.ceil(longest + 14),
      marginRight: Math.ceil(2.5 * char),
      marginBottom: bottom,
      x: { label: xLabel, domain: [lo, hi] },
      y: { axis: null, domain: [0, n + overlap] },
      marks,
    },
    options.alt,
  );
  const method = strings.densityMethod(
    names.map((name, k) => ({
      name,
      n: count((groups[k] as number[]).length),
      bandwidth: digits(bandwidths[k] as number),
    })),
  );
  return figure(options, {
    kind: "ridgeline",
    svg: rendered.svg,
    ...(rendered.x ? { x: rendered.x } : {}),
    method,
    slotColors: plan.slotColors,
    limits: { series: 20 },
    // Every value by its row, as a box plot describes its groups, with each row's median.
    description: {
      axes: [valueRange("x", xLabel, values, format), categoryRange("y", y, names)],
      format,
      series: [
        {
          name: xLabel ?? x,
          points: values.map((v, i) => ({ at: rowsOf[i] as string, value: v })),
        },
      ],
      sentence: strings.medians(
        groups.map((g, k) => ({
          value: format(
            quantile(
              [...g].sort((a, b) => a - b),
              0.5,
            ),
          ),
          at: names[k] as string,
        })),
      ),
    },
    table: {
      columns: [xLabel ?? x, ...names.map((s) => `${s} ${terms.density.toLowerCase()}`)],
      rows: at.map((xv, i) => [
        format(xv),
        ...names.map((_, k) => digits((sampled[k] as number[])[i] as number)),
      ]),
    },
  });
}
