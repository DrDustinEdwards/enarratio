import * as Plot from "@observablehq/plot";
import { niceLinear } from "../lite/scale.js";
import {
  domainOf,
  type KeysOfType,
  markKey,
  maxOf,
  minOf,
  readLabel,
  readNumber,
} from "../render/data.js";
import { type ChartDescription, categoryRange, valueRange } from "../render/describe.js";
import { type BoxStats, boxStats } from "../render/distribution.js";
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
import { numberFormat, type Strings, stringsFor, valueFormat } from "../render/text.js";
import { type Annotated, drawAnnotations, withNotes } from "./annotate.js";
import { named } from "./marks.js";

/** Options shared by {@link boxPlot} and {@link stripPlot}. */
interface GroupedValuesOptions<T extends object> extends FigureOptions, AxisUnits, Annotated {
  readonly data: readonly T[];
  /** The field naming each value's group, one column per group. */
  readonly x: KeysOfType<T, string | number>;
  /** The measurement. */
  readonly y: KeysOfType<T, number>;
  /** Groups in display order. Without it, first-seen order, or ascending for numbers. */
  readonly xDomain?: readonly (string | number)[];
  /** Color each group as its own series, or all in the first series color (default). */
  readonly colorByGroup?: boolean;
  readonly colors?: Readonly<Record<string, SeriesColor>>;
  readonly xLabel?: string | null;
  readonly yLabel?: string | null;
  readonly formatValue?: (value: number) => string;
}

/** Options for {@link stripPlot}. */
export interface StripPlotOptions<T extends object> extends GroupedValuesOptions<T> {
  /** A field naming each value, for hover details and the data table. */
  readonly label?: KeysOfType<T, string | number>;
  /**
   * How points in a group are spread so none hides another: `"beeswarm"` (default) packs them
   * side by side, `"jitter"` scatters them by a fixed pattern (the same every render).
   */
  readonly layout?: "beeswarm" | "jitter";
}

/** Options for {@link boxPlot}. */
export interface BoxPlotOptions<T extends object> extends GroupedValuesOptions<T> {
  /** Draw every value as a point beside its box, in a beeswarm (default false: outliers only). */
  readonly points?: boolean;
}

interface Value {
  readonly key: string;
  readonly name: string;
  readonly group: string;
  readonly groupIndex: number;
  readonly value: number;
  offset: number;
}

/** The radius of a point, and the spacing between points in a beeswarm, in pixels. */
const RADIUS = 3.5;
const MARGIN_TOP = 20;
const MARGIN_BOTTOM = 44;

interface Read {
  readonly strings: Strings;
  /** Whole numbers for the locale: counts. */
  readonly count: (n: number) => string;
  readonly groups: readonly string[];
  readonly values: readonly Value[];
  readonly format: (v: number) => string;
  readonly xLabel: string | null;
  readonly yLabel: string | null;
  /** The value axis, made round, and pixels per value unit and per group. */
  readonly domain: readonly [number, number];
  readonly width: number;
  readonly height: number;
  readonly marginLeft: number;
}

function read<T extends object>(
  kind: string,
  options: GroupedValuesOptions<T> & { readonly label?: KeysOfType<T, string | number> },
): Read {
  const { data, x, y, label } = options;
  validateFigure(kind, options);
  if (data.length === 0) throw new Error(`${kind}: data is empty`);
  const strings = stringsFor(options.strings);
  const raw = data.map((row, i) => readLabel(kind, row, x, i));
  const groups = domainOf(kind, x, raw, options.xDomain?.map(String));
  const values = data.map((row, i): Value => {
    const g = raw[i] as string;
    return {
      key: String(i),
      name:
        label === undefined ? `${strings.terms.value} ${i + 1}` : readLabel(kind, row, label, i),
      group: g,
      groupIndex: groups.indexOf(g),
      value: readNumber(kind, row, y, i),
      offset: 0,
    };
  });
  const all = values.map((v) => v.value);
  return {
    strings,
    count: numberFormat(options.locale ? { locale: options.locale } : {}),
    groups,
    values,
    format: valueFormat(options),
    xLabel: unitLabel(options.xLabel, x, options.xUnit),
    yLabel: unitLabel(options.yLabel, y, options.yUnit),
    domain: niceLinear([minOf(all), maxOf(all)]) as [number, number],
    width: options.width ?? DEFAULT_WIDTH,
    height: options.height ?? 360,
    marginLeft: options.yLabel === null ? 48 : 64,
  };
}

/**
 * The groups along x and every value as one series, so the summary names the highest and lowest
 * values and any far from the rest, each with its group.
 */
function describeValues(r: Read, extra?: Partial<ChartDescription>): ChartDescription {
  return {
    axes: [
      categoryRange("x", r.xLabel, r.groups),
      valueRange(
        "y",
        r.yLabel,
        r.values.map((v) => v.value),
        r.format,
      ),
    ],
    format: r.format,
    series: [
      {
        name: r.yLabel ?? r.strings.terms.values,
        points: r.values.map((v) => ({ at: v.group, value: v.value })),
      },
    ],
    ...extra,
  };
}

/**
 * Spreads each group's points sideways so that none overlaps another: each point, lowest value
 * first, takes the offset nearest the center line where it clears every point already placed.
 * Offsets are in group widths; a group too crowded to fit is squeezed to its width.
 */
function beeswarm(r: Read, pxPerValue: number, pxPerGroup: number): void {
  const gap = 2 * RADIUS + 1;
  for (const g of r.groups) {
    const members = r.values.filter((v) => v.group === g).sort((a, b) => a.value - b.value);
    if (members.length > 2000) {
      throw new Error(
        `a beeswarm of ${members.length} points is too dense to draw; use a box plot`,
      );
    }
    const placed: { y: number; x: number }[] = [];
    for (const v of members) {
      const y = v.value * pxPerValue;
      const near = placed.filter((p) => Math.abs(p.y - y) < gap);
      let best = 0;
      for (let k = 0; ; k += 1) {
        const candidate = (k % 2 === 0 ? 1 : -1) * Math.ceil(k / 2) * (gap / 2);
        if (near.every((p) => Math.hypot(p.x - candidate, p.y - y) >= gap)) {
          best = candidate;
          break;
        }
      }
      placed.push({ x: best, y });
      v.offset = best;
    }
    const widest = maxOf(placed.map((p) => Math.abs(p.x)));
    const room = pxPerGroup * 0.42;
    const squeeze = widest > room ? room / widest : 1;
    for (const v of members) v.offset = (v.offset * squeeze) / pxPerGroup;
  }
}

/** A fixed jitter: the golden-ratio sequence, the same on every render. */
function jitter(r: Read): void {
  for (const g of r.groups) {
    r.values
      .filter((v) => v.group === g)
      .forEach((v, i) => {
        v.offset = (((i + 1) * 0.618034) % 1) * 0.6 - 0.3;
      });
  }
}

/** Pixels per value unit and per group, from the drawing's size and margins. */
function pixels(r: Read): { perValue: number; perGroup: number } {
  const [lo, hi] = r.domain;
  return {
    perValue: (r.height - MARGIN_TOP - MARGIN_BOTTOM) / (hi - lo || 1),
    perGroup: (r.width - r.marginLeft - 20) / r.groups.length,
  };
}

function frame(r: Read): Plot.PlotOptions {
  return {
    width: r.width,
    height: r.height,
    marginTop: MARGIN_TOP,
    marginLeft: r.marginLeft,
    marginRight: 20,
    marginBottom: MARGIN_BOTTOM,
    x: {
      type: "linear",
      domain: [-0.5, r.groups.length - 0.5],
      ticks: r.groups.map((_, i) => i),
      tickFormat: (i: number) => r.groups[i] ?? "",
      label: r.xLabel,
      labelAnchor: "center",
      labelArrow: "none",
    },
    y: {
      domain: [...r.domain],
      label: r.yLabel,
      labelAnchor: "center",
      labelArrow: "none",
      grid: true,
    },
  };
}

function pointMark<T extends object>(
  options: GroupedValuesOptions<T>,
  values: readonly Value[],
  describe: (v: Value) => string,
): Plot.Markish {
  const colorByGroup = options.colorByGroup ?? false;
  const fill = (v: Value): string =>
    `var(--enarratio-series-${colorByGroup ? v.groupIndex + 1 : 1})`;
  const order = new Map(
    [...values]
      .sort((a, b) => a.groupIndex - b.groupIndex || a.value - b.value)
      .map((v, i) => [v, i]),
  );
  return Plot.dot(values, {
    x: (v: Value) => v.groupIndex + v.offset,
    y: "value",
    r: RADIUS,
    fill,
    stroke: fill,
    fillOpacity: 0.6,
    title: describe,
    render: keyed(values, (v) => ({
      key: v.key,
      filter: { field: options.x, value: v.group },
      x: v.group,
      column: v.groupIndex,
      row: order.get(v) ?? 0,
    })),
  });
}

/**
 * Every value as a point, one column per group, spread in a beeswarm (or a fixed jitter) so that
 * none hides another and the shape of each group shows. Each point is keyed and named, and the
 * data table lists every value.
 *
 * @example
 * stripPlot({ data: mice, x: "diet", y: "weight", label: "mouse", alt: "..." });
 */
export function stripPlot<T extends object>(given: StripPlotOptions<T>): string {
  const options = withNotes(given);
  const kind = "stripPlot";
  const r = read(kind, options);
  const { perValue, perGroup } = pixels(r);
  if ((options.layout ?? "beeswarm") === "beeswarm") beeswarm(r, perValue, perGroup);
  else jitter(r);
  const plan = planSeries(
    kind,
    options.colorByGroup ? r.groups : [r.strings.terms.values],
    options.colors,
  );
  const describe = (v: Value): string =>
    `${options.label === undefined ? "" : `${v.name}: `}${r.xLabel ?? options.x} ${v.group}, ${r.format(v.value)}`;
  const { svg } = renderPlot(
    { ...frame(r), marks: [pointMark(options, r.values, describe)] },
    options.alt,
    "img",
    drawAnnotations(kind, options.annotations),
  );
  return figure(options, {
    kind: "strip",
    svg,
    description: describeValues(r),
    slotColors: plan.slotColors,
    table: {
      columns: [
        options.label === undefined ? r.strings.terms.value : options.label,
        r.xLabel ?? options.x,
        r.yLabel ?? options.y,
      ],
      rows: r.values.map((v) => [v.name, v.group, r.format(v.value)]),
    },
  });
}

/**
 * Box plots, one per group: the box spans the quartiles with a line at the median, whiskers reach
 * the most extreme values within 1.5 interquartile ranges, and values beyond are drawn as points
 * (Tukey 1977; quartiles by linear interpolation, R's default). With `points`, every value is
 * drawn beside its box. The data table gives each group's n, quartiles, whiskers and outliers.
 *
 * @example
 * boxPlot({ data: mice, x: "diet", y: "weight", points: true, alt: "..." });
 */
export function boxPlot<T extends object>(given: BoxPlotOptions<T>): string {
  const options = withNotes(given);
  const kind = "boxPlot";
  const r = read(kind, options);
  const { terms } = r.strings;
  const plan = planSeries(kind, options.colorByGroup ? r.groups : [terms.values], options.colors);
  const stats = r.groups.map((g) =>
    boxStats(r.values.filter((v) => v.group === g).map((v) => v.value)),
  );
  const boxes = r.groups.map((g, i) => ({ g, i, s: stats[i] as BoxStats }));
  type Box = (typeof boxes)[number];
  const half = options.points ? 0.18 : 0.28;
  const at = (b: Box): number => b.i - (options.points ? 0.14 : 0);
  const fill = (b: Box): string => `var(--enarratio-series-${options.colorByGroup ? b.i + 1 : 1})`;
  const f = r.format;
  const range = (a: number, b: number): string => r.strings.range(f(a), f(b));
  const describeBox = (b: Box): string =>
    `${r.xLabel ?? options.x} ${b.g}: ${terms.median.toLowerCase()} ${f(b.s.median)}, ${terms.quartiles} ${range(b.s.q1, b.s.q3)}, ${terms.whiskers.toLowerCase()} ${range(b.s.low, b.s.high)}, ${terms.n} ${r.count(b.s.n)}${b.s.outliers.length ? `, ${terms.outliers.toLowerCase()} ${r.count(b.s.outliers.length)}` : ""}`;
  const marks: Plot.Markish[] = [
    Plot.ruleX(boxes, {
      x: at,
      y1: (b: Box) => b.s.low,
      y2: (b: Box) => b.s.high,
      stroke: "var(--enarratio-text)",
      render: named("whisker"),
    }),
    Plot.rect(boxes, {
      x1: (b: Box) => at(b) - half,
      x2: (b: Box) => at(b) + half,
      y1: (b: Box) => b.s.q1,
      y2: (b: Box) => b.s.q3,
      fill,
      fillOpacity: 0.35,
      stroke: fill,
      strokeWidth: 1.5,
      title: describeBox,
      render: keyed(boxes, (b) => ({
        key: markKey(b.g),
        filter: { field: options.x, value: b.g },
        x: b.g,
        column: b.i,
        row: 0,
      })),
    }),
    Plot.link(boxes, {
      x1: (b: Box) => at(b) - half,
      x2: (b: Box) => at(b) + half,
      y1: (b: Box) => b.s.median,
      y2: (b: Box) => b.s.median,
      stroke: "var(--enarratio-text)",
      strokeWidth: 2.5,
      render: named("median"),
    }),
  ];
  if (options.points) {
    const { perValue, perGroup } = pixels(r);
    beeswarm(r, perValue, perGroup * 0.4);
    for (const v of r.values) v.offset += 0.2;
    marks.push(
      pointMark(options, r.values, (v) => `${r.xLabel ?? options.x} ${v.group}: ${f(v.value)}`),
    );
  } else {
    const outliers = r.values.filter((v) => {
      const s = stats[v.groupIndex] as BoxStats;
      return v.value < s.low || v.value > s.high;
    });
    marks.push(
      pointMark(
        options,
        outliers,
        (v) => `${r.xLabel ?? options.x} ${v.group}: ${terms.outlier} ${f(v.value)}`,
      ),
    );
  }
  const { svg } = renderPlot(
    { ...frame(r), marks },
    options.alt,
    "img",
    drawAnnotations(kind, options.annotations),
  );
  return figure(options, {
    kind: "box",
    svg,
    description: describeValues(r, {
      sentence: r.strings.medians(boxes.map((b) => ({ value: f(b.s.median), at: b.g }))),
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
        terms.whiskers,
        terms.outliers,
      ],
      rows: boxes.map(({ g, s }) => [
        g,
        r.count(s.n),
        f(s.min),
        f(s.q1),
        f(s.median),
        f(s.q3),
        f(s.max),
        range(s.low, s.high),
        s.outliers.map(f).join(", "),
      ]),
    },
  });
}
