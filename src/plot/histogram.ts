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
import { valueRange } from "../render/describe.js";
import {
  type Bin,
  grid,
  histogramBins,
  kernelDensity,
  silvermanBandwidth,
} from "../render/distribution.js";
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
import { charWidth, DEFAULT_HEIGHT, DEFAULT_WIDTH } from "../render/size.js";
import { numberFormat, stringsFor, valueFormat } from "../render/text.js";
import { type Annotated, drawAnnotations, withNotes } from "./annotate.js";
import { dashFor, named } from "./marks.js";

/** Options for {@link histogram}. */
export interface HistogramOptions<T extends object> extends FigureOptions, AxisUnits, Annotated {
  readonly data: readonly T[];
  /** The measurement to bin. */
  readonly x: KeysOfType<T, number>;
  /**
   * A target number of bins, whose edges are then round numbers (default Sturges' rule), or the
   * ascending bin edges, which must cover every value.
   */
  readonly thresholds?: number | readonly number[];
  /** Draw a kernel density curve over the bars, scaled to counts (default false). */
  readonly density?: boolean;
  readonly color?: SeriesColor;
  readonly xLabel?: string | null;
  /** The count axis label (default "Count"). */
  readonly yLabel?: string | null;
  readonly formatValue?: (value: number) => string;
}

/** Options for {@link densityPlot}. */
export interface DensityPlotOptions<T extends object> extends FigureOptions, AxisUnits, Annotated {
  readonly data: readonly T[];
  readonly x: KeysOfType<T, number>;
  /** A field splitting the values into distributions drawn on the same axes. */
  readonly series?: KeysOfType<T, string>;
  readonly seriesDomain?: readonly string[];
  /** The Gaussian kernel's bandwidth, in x units (default Silverman's rule, per series). */
  readonly bandwidth?: number;
  readonly colors?: Readonly<Record<string, SeriesColor>>;
  readonly xLabel?: string | null;
  readonly yLabel?: string | null;
  readonly formatValue?: (value: number) => string;
}

const HISTOGRAM = "histogram";
const DENSITY = "densityPlot";

function readValues<T extends object>(kind: string, data: readonly T[], x: string): number[] {
  if (data.length === 0) throw new Error(`${kind}: data is empty`);
  return data.map((row, i) => readNumber(kind, row, x, i));
}

/**
 * A histogram: how often values fall in each bin, as touching bars with round edges, optionally
 * with a density curve. Every bin is a keyed bar that names its range and count, and the data
 * table lists every bin, empty ones too.
 *
 * @example
 * histogram({ data: patients, x: "age", thresholds: 10, alt: "..." });
 */
export function histogram<T extends object>(given: HistogramOptions<T>): string {
  const options = withNotes(given);
  validateFigure(HISTOGRAM, options);
  const values = readValues(HISTOGRAM, options.data, options.x);
  const format = valueFormat(options);
  const strings = stringsFor(options.strings);
  const { terms } = strings;
  const xLabel = unitLabel(options.xLabel, options.x, options.xUnit);
  const yLabel = unitLabel(options.yLabel, terms.count, options.yUnit);
  const bins = histogramBins(values, options.thresholds);
  const plan = planSeries(
    HISTOGRAM,
    [terms.count],
    options.color ? { [terms.count]: options.color } : undefined,
  );
  const count = numberFormat(options.locale ? { locale: options.locale } : {});
  const range = (b: Bin): string => strings.range(format(b.x0), format(b.x1));
  const marks: Plot.Markish[] = [
    Plot.rectY(bins, {
      x1: "x0",
      x2: "x1",
      y: "count",
      fill: plan.range[0] as string,
      insetLeft: 0.5,
      insetRight: 0.5,
      title: (b: Bin) => `${xLabel ?? options.x} ${range(b)}: ${count(b.count)}`,
      render: keyed(bins, (b) => ({
        key: markKey(b.x0, b.x1),
        x: String(b.x0),
        column: bins.indexOf(b),
        row: 0,
      })),
    }),
    Plot.ruleY([0]),
  ];
  if (options.density) {
    const bandwidth = silvermanBandwidth(values);
    const width = (bins[0] as Bin).x1 - (bins[0] as Bin).x0;
    const xs = grid((bins[0] as Bin).x0, (bins[bins.length - 1] as Bin).x1, 120);
    const ys = kernelDensity(values, bandwidth, xs);
    marks.push(
      Plot.line(
        xs.map((x, i) => ({ x, y: (ys[i] as number) * values.length * width })),
        {
          x: "x",
          y: "y",
          stroke: "var(--enarratio-text)",
          strokeWidth: 2,
          render: named("density"),
        },
      ),
    );
  }
  const { svg } = renderPlot(
    {
      width: options.width ?? DEFAULT_WIDTH,
      height: options.height ?? DEFAULT_HEIGHT,
      marginTop: 20,
      marginLeft: 48,
      marginBottom: 44,
      x: {
        label: xLabel,
        ticks: [...new Set(bins.flatMap((b) => [b.x0, b.x1]))].filter((_, i, all) =>
          all.length <= 12 ? true : i % Math.ceil(all.length / 12) === 0,
        ),
        tickFormat: format,
      },
      y: { label: yLabel, grid: true, nice: true },
      marks,
    },
    options.alt,
    "img",
    drawAnnotations(HISTOGRAM, options.annotations),
  );
  const edges = [(bins[0] as Bin).x0, (bins[bins.length - 1] as Bin).x1];
  return figure(options, {
    kind: "histogram",
    svg,
    ...(options.density ? { method: strings.histogramDensity } : {}),
    // The counts bin by bin, in order, so the summary reads the shape: where it peaks and falls.
    description: {
      axes: [
        valueRange("x", xLabel, edges, format),
        valueRange("y", yLabel, [0, ...bins.map((b) => b.count)], count),
      ],
      ordered: true,
      format: count,
      series: [
        {
          name: yLabel ?? terms.count,
          points: bins.map((b) => ({ at: range(b), value: b.count })),
        },
      ],
    },
    slotColors: plan.slotColors,
    table: {
      columns: [`${xLabel ?? options.x} (${terms.bin})`, yLabel ?? terms.count],
      rows: bins.map((b) => [range(b), count(b.count)]),
    },
  });
}

/** How many evenly spaced x values the density table gives. */
const TABLE_POINTS = 15;

/**
 * Density values to three significant digits, in scientific notation below 0.001: a curve's tail
 * can be 1e-22, which as plain digits is 21 zeros that a screen reader reads one by one in the
 * table, the hover details and the summary (WCAG 2.2 SC 1.1.1, 1.3.1).
 */
function densityDigits(locale: string | undefined): (value: number) => string {
  const plain = numberFormat({ ...(locale ? { locale } : {}), maximumSignificantDigits: 3 });
  const scientific = new Intl.NumberFormat(locale ?? "en-US", {
    notation: "scientific",
    maximumSignificantDigits: 3,
  });
  return (value) =>
    value !== 0 && Math.abs(value) < 0.001 ? scientific.format(value) : plain(value);
}

/**
 * Smoothed distributions of one measurement, one curve per series on shared axes: a Gaussian
 * kernel density estimate with Silverman's bandwidth unless one is given. Curves differ by color,
 * dash and a label at each curve's peak, and the data table gives each curve's density at evenly
 * spaced values with its n and bandwidth in the caption.
 *
 * @example
 * densityPlot({ data: cells, x: "diameter", series: "line", alt: "..." });
 */
export function densityPlot<T extends object>(given: DensityPlotOptions<T>): string {
  const options = withNotes(given);
  validateFigure(DENSITY, options);
  const { data, x, series } = options;
  const values = readValues(DENSITY, data, x);
  if (options.bandwidth !== undefined && !(options.bandwidth > 0)) {
    throw new Error(`${DENSITY}: bandwidth must be a positive number, is ${options.bandwidth}`);
  }
  // The table samples the curve on an even grid, so its x values are 23.128571, not 23.1: four
  // significant digits, unless the page gave its own format.
  const format =
    options.formatValue ??
    numberFormat({
      ...(options.locale ? { locale: options.locale } : {}),
      maximumSignificantDigits: 4,
    });
  const strings = stringsFor(options.strings);
  const { terms } = strings;
  const xLabel = unitLabel(options.xLabel, x, options.xUnit);
  const yLabel = unitLabel(options.yLabel, terms.density, options.yUnit);
  const sole = xLabel ?? x;
  const seriesOf = (row: T, i: number): string =>
    series === undefined ? sole : readLabel(DENSITY, row, series, i);
  const names = domainOf(
    DENSITY,
    series ?? "series",
    data.map((row, i) => seriesOf(row, i)),
    options.seriesDomain,
  );
  const plan = planSeries(DENSITY, names, options.colors);
  const groups = names.map((name) => values.filter((_, i) => seriesOf(data[i] as T, i) === name));
  const bandwidths = groups.map((g) => options.bandwidth ?? silvermanBandwidth(g));
  const pad = 3 * maxOf(bandwidths);
  const lo = minOf(values) - pad;
  const hi = maxOf(values) + pad;
  const xs = grid(lo, hi, 160);
  const curves = groups.map((g, k) => kernelDensity(g, bandwidths[k] as number, xs));
  const at = grid(minOf(values), maxOf(values), TABLE_POINTS);
  const sampled = groups.map((g, k) => kernelDensity(g, bandwidths[k] as number, at));
  const digits = densityDigits(options.locale);

  const marks: Plot.Markish[] = names.map((name, k) =>
    Plot.line(
      xs.map((xv, i) => ({ x: xv, y: (curves[k] as number[])[i] as number, series: name })),
      {
        x: "x",
        y: "y",
        stroke: plan.range[k] as string,
        strokeWidth: 2,
        ...dashFor(k),
      },
    ),
  );
  // Hover points where the table samples each curve.
  const samples = names.flatMap((name, k) =>
    at.map((xv, i) => ({ name, k, i, x: xv, y: (sampled[k] as number[])[i] as number })),
  );
  marks.push(
    Plot.dot(samples, {
      x: "x",
      y: "y",
      r: 4,
      fill: (s: (typeof samples)[number]) => plan.range[s.k],
      fillOpacity: 0,
      title: (s: (typeof samples)[number]) =>
        `${names.length > 1 ? `${s.name}, ` : ""}${sole} ${format(s.x)}: ${terms.density.toLowerCase()} ${digits(s.y)}`,
      render: keyed(samples, (s) => ({
        key: markKey(s.name, s.i),
        ...(series ? { filter: { field: series, value: s.name }, series: s.name } : {}),
        x: String(s.x),
        column: s.i,
        row: s.k,
      })),
    }),
  );
  if (names.length > 1) {
    // Each name over its curve's peak. Names that would overlap (close peaks on a phone's
    // drawing) are moved apart, upward, and every name is kept inside the plot (record 0041).
    const width = options.width ?? DEFAULT_WIDTH;
    const height = options.height ?? DEFAULT_HEIGHT;
    const char = charWidth(width);
    const plotWidth = width - 56 - 20;
    const plotHeight = height - 24 - 44;
    const yTop = maxOf(curves.map((ys) => maxOf(ys))) * 1.1;
    const toPx = (x: number): number => ((x - lo) / (hi - lo || 1)) * plotWidth;
    const placed: { left: number; right: number; y: number }[] = [];
    const peaks = names.map((name, k) => {
      const ys = curves[k] as number[];
      const top = ys.indexOf(maxOf(ys));
      const half = (name.length * char) / 2;
      const at = toPx(xs[top] as number);
      const px = Math.min(Math.max(at, half), plotWidth - half);
      const peak = ((ys[top] as number) / yTop) * plotHeight;
      let py = peak;
      while (
        placed.some((b) => b.left < px + half && px - half < b.right && Math.abs(b.y - py) < 17)
      ) {
        py += 17;
      }
      placed.push({ left: px - half, right: px + half, y: py });
      return {
        name,
        x: px === at ? (xs[top] as number) : lo + (px / plotWidth) * (hi - lo),
        y: py === peak ? (ys[top] as number) : (py / plotHeight) * yTop,
        k,
      };
    });
    marks.push(
      Plot.text(peaks, {
        x: "x",
        y: "y",
        text: "name",
        dy: -8,
        fill: (p: (typeof peaks)[number]) => plan.range[p.k],
        stroke: "var(--enarratio-background)",
        strokeWidth: 3,
        paintOrder: "stroke",
      }),
    );
  }
  marks.push(Plot.ruleY([0]));
  const { svg } = renderPlot(
    {
      width: options.width ?? DEFAULT_WIDTH,
      height: options.height ?? DEFAULT_HEIGHT,
      marginTop: 24,
      marginLeft: 56,
      marginBottom: 44,
      x: { label: xLabel, domain: [lo, hi] },
      y: { label: yLabel, grid: true, nice: true },
      marks,
    },
    options.alt,
    "img",
    drawAnnotations(DENSITY, options.annotations),
  );
  const count = numberFormat(options.locale ? { locale: options.locale } : {});
  const method = strings.densityMethod(
    names.map((name, k) => ({
      ...(names.length > 1 ? { name } : {}),
      n: count((groups[k] as number[]).length),
      bandwidth: digits(bandwidths[k] as number),
    })),
  );
  return figure(options, {
    kind: "density",
    svg,
    method,
    // Each curve at the table's evenly spaced values, so the summary names where it peaks.
    description: {
      axes: [
        valueRange("x", xLabel, values, format),
        valueRange("y", yLabel, [0, ...curves.flat()], digits),
      ],
      ordered: true,
      format: digits,
      series: names.map((name, k) => ({
        name,
        points: at.map((xv, i) => ({
          at: format(xv),
          value: (sampled[k] as number[])[i] as number,
        })),
      })),
    },
    legend: series === undefined ? [] : plan.legend,
    ...(series === undefined ? {} : { seriesField: series }),
    slotColors: plan.slotColors,
    table: {
      columns: [
        sole,
        ...names.map((n) =>
          names.length > 1 ? `${n} ${terms.density.toLowerCase()}` : terms.density,
        ),
      ],
      rows: at.map((xv, i) => [
        format(xv),
        ...names.map((_, k) => digits((sampled[k] as number[])[i] as number)),
      ]),
    },
  });
}
