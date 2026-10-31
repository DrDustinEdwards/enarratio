import * as Plot from "@observablehq/plot";
import { niceLinear } from "../lite/scale.js";
import { type KeysOfType, markKey, maxOf, minOf, readLabel, readNumber } from "../render/data.js";
import { type FigureOptions, figure, type SeriesColor, validateFigure } from "../render/figure.js";
import { keyed, renderPlot } from "../render/plot.js";
import { planSeries } from "../render/series.js";
import { DEFAULT_WIDTH } from "../render/size.js";
import { signed, stringsFor, valueFormat } from "../render/text.js";
import { named } from "./marks.js";

/** Options for {@link slopeChart}. */
export interface SlopeChartOptions<T extends object> extends FigureOptions {
  readonly data: readonly T[];
  /** The field naming each item: one line each. */
  readonly label: KeysOfType<T, string | number>;
  /** The value at the first time point. */
  readonly from: KeysOfType<T, number>;
  /** The value at the second time point. */
  readonly to: KeysOfType<T, number>;
  /** The names of the two time points, printed above them (default the field names). */
  readonly fromLabel?: string;
  readonly toLabel?: string;
  /** Colors for "Rising", "Falling" and "No change" (or their translations in `strings.terms`). */
  readonly colors?: Readonly<Record<string, SeriesColor>>;
  readonly formatValue?: (value: number) => string;
}

interface Slope {
  readonly name: string;
  readonly from: number;
  readonly to: number;
  readonly direction: string;
}

const KIND = "slopeChart";
const MARGIN_TOP = 36;
const MARGIN_BOTTOM = 16;
/** The least vertical distance between two labels on the same side, in pixels. */
const LINE_GAP = 14;

/**
 * Label positions on one side, in pixels: each label as near its line's end as it can be with
 * no two closer than {@link LINE_GAP}, kept inside the frame.
 */
function spread(ys: readonly number[], top: number, bottom: number): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  const placed = order.map((o) => o.y);
  for (let pass = 0; pass < 50; pass += 1) {
    let moved = false;
    for (let k = 1; k < placed.length; k += 1) {
      const overlap = LINE_GAP - ((placed[k] as number) - (placed[k - 1] as number));
      if (overlap > 0.01) {
        placed[k - 1] = (placed[k - 1] as number) - overlap / 2;
        placed[k] = (placed[k] as number) + overlap / 2;
        moved = true;
      }
    }
    // Pushed past an edge, the stack moves back inside.
    const low = top - (placed[0] ?? top);
    if (low > 0) for (let k = 0; k < placed.length; k += 1) placed[k] = (placed[k] as number) + low;
    const high = (placed[placed.length - 1] ?? bottom) - bottom;
    if (high > 0)
      for (let k = 0; k < placed.length; k += 1) placed[k] = (placed[k] as number) - high;
    if (!moved) break;
  }
  const out = new Array<number>(ys.length);
  order.forEach((o, k) => {
    out[o.i] = placed[k] as number;
  });
  return out;
}

/**
 * A slope chart: each item's value at two time points joined by a line, labeled with its name
 * and both values at the ends, so items are told apart by text, not color. Rising and falling
 * lines differ in color and dash, and labels are moved apart where values are close.
 *
 * @example
 * slopeChart({ data: rates, label: "county", from: "y2015", to: "y2025", fromLabel: "2015", toLabel: "2025", alt: "..." });
 */
export function slopeChart<T extends object>(options: SlopeChartOptions<T>): string {
  const { data, label, from, to } = options;
  validateFigure(KIND, options);
  if (data.length === 0) throw new Error(`${KIND}: data is empty`);
  if (data.length > 30)
    throw new Error(`${KIND}: ${data.length} items are too many to label; use a dumbbell plot`);
  const format = valueFormat(options);
  const { terms } = stringsFor(options.strings);
  const [RISING, FALLING, FLAT] = [terms.rising, terms.falling, terms.noChange];
  const fromLabel = options.fromLabel ?? from;
  const toLabel = options.toLabel ?? to;
  const seen = new Set<string>();
  const slopes = data.map((row, i): Slope => {
    const name = readLabel(KIND, row, label, i);
    if (seen.has(name)) throw new Error(`${KIND}: two rows for "${name}"`);
    seen.add(name);
    const a = readNumber(KIND, row, from, i);
    const b = readNumber(KIND, row, to, i);
    return { name, from: a, to: b, direction: b > a ? RISING : b < a ? FALLING : FLAT };
  });
  const directions = [RISING, FALLING, FLAT].filter((d) => slopes.some((s) => s.direction === d));
  const plan = planSeries(KIND, directions, options.colors);
  const values = slopes.flatMap((s) => [s.from, s.to]);
  const domain = niceLinear([minOf(values), maxOf(values)]);
  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? Math.max(240, slopes.length * 20 + 80);
  const longest = Math.max(
    ...slopes.map(
      (s) => s.name.length + format(Math.max(Math.abs(s.from), Math.abs(s.to))).length + 1,
    ),
  );
  const side = Math.min(240, longest * 7 + 16);
  const pixel = (v: number): number =>
    height -
    MARGIN_BOTTOM -
    ((v - domain[0]) / (domain[1] - domain[0] || 1)) * (height - MARGIN_TOP - MARGIN_BOTTOM);
  const value = (px: number): number =>
    domain[0] +
    ((height - MARGIN_BOTTOM - px) / (height - MARGIN_TOP - MARGIN_BOTTOM)) *
      (domain[1] - domain[0]);
  const left = spread(
    slopes.map((s) => pixel(s.from)),
    MARGIN_TOP,
    height - MARGIN_BOTTOM,
  );
  const right = spread(
    slopes.map((s) => pixel(s.to)),
    MARGIN_TOP,
    height - MARGIN_BOTTOM,
  );
  const order = [...slopes].sort((a, b) => b.from - a.from);
  const rank = new Map(order.map((s, i) => [s, i]));
  const describe = (s: Slope): string =>
    `${s.name}: ${fromLabel} ${format(s.from)}, ${toLabel} ${format(s.to)} (${s.direction.toLowerCase()})`;

  const marks: Plot.Markish[] = directions.map((direction, k) => {
    const these = slopes.filter((s) => s.direction === direction);
    return Plot.link(these, {
      x1: () => fromLabel,
      x2: () => toLabel,
      y1: "from",
      y2: "to",
      stroke: plan.range[k] as string,
      strokeWidth: 2,
      ...(direction === FALLING ? { strokeDasharray: "6,3" } : {}),
      title: describe,
      render: keyed(these, (s) => ({
        key: markKey(s.name),
        filter: { field: label, value: s.name },
        x: s.name,
        series: s.direction,
        column: rank.get(s) ?? 0,
        row: 0,
      })),
    });
  });
  const ends = slopes.flatMap((s, i) => [
    {
      x: fromLabel,
      y: s.from,
      at: value(left[i] as number),
      text: `${s.name} ${format(s.from)}`,
      k: directions.indexOf(s.direction),
    },
    {
      x: toLabel,
      y: s.to,
      at: value(right[i] as number),
      text: `${format(s.to)} ${s.name}`,
      k: directions.indexOf(s.direction),
    },
  ]);
  type End = (typeof ends)[number];
  marks.push(
    Plot.dot(ends, {
      x: "x",
      y: "y",
      r: 3.5,
      fill: (e: End) => plan.range[e.k],
      render: named("end"),
    }),
    Plot.text(
      ends.filter((e) => e.x === fromLabel),
      { x: "x", y: "at", text: "text", textAnchor: "end", dx: -10 },
    ),
    Plot.text(
      ends.filter((e) => e.x === toLabel),
      { x: "x", y: "at", text: "text", textAnchor: "start", dx: 10 },
    ),
  );
  const { svg } = renderPlot(
    {
      width,
      height,
      marginTop: MARGIN_TOP,
      marginBottom: MARGIN_BOTTOM,
      marginLeft: side,
      marginRight: side,
      x: {
        type: "point",
        domain: [fromLabel, toLabel],
        padding: 0,
        axis: "top",
        label: null,
        tickSize: 0,
      },
      y: { domain: [...domain], axis: null },
      marks,
    },
    options.alt,
  );
  return figure(options, {
    kind: "slope",
    svg,
    // Every line is labeled at both ends, so the chart reads with many more than six items.
    limits: { series: 30 },
    // Each item is a series of two points, so the summary reads each one's rise or fall. The
    // chart draws no axes: its ends are labeled with the values.
    description: {
      ordered: true,
      format,
      series: slopes.map((s) => ({
        name: s.name,
        points: [
          { at: fromLabel, value: s.from },
          { at: toLabel, value: s.to },
        ],
      })),
    },
    legend: plan.legend,
    slotColors: plan.slotColors,
    table: {
      columns: [label, fromLabel, toLabel, terms.change],
      rows: slopes.map((s) => [
        s.name,
        format(s.from),
        format(s.to),
        signed(format, s.to - s.from),
      ]),
    },
  });
}
