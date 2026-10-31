import * as Plot from "@observablehq/plot";
import {
  domainOf,
  type KeysOfType,
  markKey,
  maxOf,
  readCategory,
  readNumber,
} from "../render/data.js";
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
import { DEFAULT_HEIGHT, DEFAULT_WIDTH } from "../render/size.js";
import { signed, stringsFor, valueFormat } from "../render/text.js";
import { type Annotated, drawAnnotations, withNotes } from "./annotate.js";

/** Options for {@link divergingBarChart}. */
export interface DivergingBarChartOptions<T extends object>
  extends FigureOptions,
    AxisUnits,
    Annotated {
  readonly data: readonly T[];
  /** The category field: one bar per category. */
  readonly x: KeysOfType<T, string | number>;
  /** The signed value: a change, a difference from a baseline, a net balance. */
  readonly y: KeysOfType<T, number>;
  /** Horizontal bars (default), which leave room for long names, or vertical ones. */
  readonly orientation?: "horizontal" | "vertical";
  /** Bars in data order (default), or sorted from the largest value down. */
  readonly sort?: "data" | "descending";
  /** The legend names of the two sides (default "Above zero" and "Below zero"). */
  readonly positiveLabel?: string;
  readonly negativeLabel?: string;
  readonly colors?: Readonly<Record<string, SeriesColor>>;
  readonly xDomain?: readonly (string | number)[];
  readonly xLabel?: string | null;
  readonly yLabel?: string | null;
  readonly formatValue?: (value: number) => string;
}

interface Signed {
  readonly x: string;
  readonly value: number;
  readonly side: string;
}

const KIND = "divergingBarChart";

/**
 * Bars for signed values about zero: changes, differences from a baseline, net balances. Bars run
 * from a visible zero line, positive values one way and negative the other, in two colors, and
 * every bar is labeled with its signed value, so the sign reads from position and text as well as
 * color.
 *
 * @example
 * divergingBarChart({ data: changes, x: "county", y: "change", sort: "descending", alt: "..." });
 */
export function divergingBarChart<T extends object>(given: DivergingBarChartOptions<T>): string {
  const options = withNotes(given);
  const { data, x, y } = options;
  validateFigure(KIND, options);
  if (data.length === 0) throw new Error(`${KIND}: data is empty`);
  const format = valueFormat(options);
  const { terms } = stringsFor(options.strings);
  const positive = options.positiveLabel ?? terms.aboveZero;
  const negative = options.negativeLabel ?? terms.belowZero;
  const categoryLabel = unitLabel(options.xLabel, x, options.xUnit);
  const valueLabel = unitLabel(options.yLabel, y, options.yUnit);
  const horizontal = (options.orientation ?? "horizontal") === "horizontal";

  const raw = data.map((row, i) => readCategory(KIND, row, x, i));
  const seen = new Set<string>();
  const bars = data.map((row, i): Signed => {
    const name = String(raw[i]);
    if (seen.has(name))
      throw new Error(`${KIND}: two rows for ${name}; give one value per category`);
    seen.add(name);
    const value = readNumber(KIND, row, y, i);
    return { x: name, value, side: value < 0 ? negative : positive };
  });
  let names = domainOf(KIND, x, raw, options.xDomain);
  if (options.sort === "descending") {
    const valueByName = new Map(bars.map((b) => [b.x, b.value]));
    names = [...names].sort((a, b) => (valueByName.get(b) ?? 0) - (valueByName.get(a) ?? 0));
  }
  const sides = [positive, negative];
  const plan = planSeries(KIND, sides, options.colors);
  const column = new Map(names.map((n, i) => [n, i]));
  const describe = (b: Signed): string =>
    `${categoryLabel ?? x} ${b.x}: ${signed(format, b.value)}`;
  const render = keyed(bars, (b) => ({
    key: markKey(b.x),
    filter: { field: x, value: b.x },
    x: b.x,
    series: b.side,
    column: column.get(b.x) ?? 0,
    row: 0,
  }));
  const longest = Math.max(1, maxOf(names.map((n) => n.length)));
  const bar = horizontal
    ? Plot.barX(bars, { x: "value", y: "x", fill: "side", title: describe, render })
    : Plot.barY(bars, { y: "value", x: "x", fill: "side", title: describe, render });
  const rule = horizontal
    ? Plot.ruleX([0], { stroke: "var(--enarratio-text)", strokeWidth: 1.5 })
    : Plot.ruleY([0], { stroke: "var(--enarratio-text)", strokeWidth: 1.5 });
  // Each bar's signed value beyond its end. Plot takes anchors and offsets as constants, so each
  // side is its own text mark.
  const label = { text: (b: Signed) => signed(format, b.value), fill: "var(--enarratio-text)" };
  const textMarks = [-1, 1].map((sign) => {
    const side = bars.filter((b) => (sign < 0 ? b.value < 0 : b.value >= 0));
    return horizontal
      ? Plot.text(side, {
          ...label,
          x: "value",
          y: "x",
          textAnchor: sign < 0 ? "end" : "start",
          dx: sign < 0 ? -4 : 4,
        })
      : Plot.text(side, {
          ...label,
          y: "value",
          x: "x",
          lineAnchor: sign < 0 ? "top" : "bottom",
          dy: sign < 0 ? 4 : -4,
        });
  });
  const valueScale = {
    label: valueLabel,
    labelAnchor: "center",
    labelArrow: "none",
    grid: true,
    nice: true,
    // Room beyond the longest bars for their labels.
    inset: 36,
  } as const;
  const categoryScale = {
    type: "band",
    domain: names,
    label: categoryLabel,
    padding: 0.2,
  } as const;
  const width = options.width ?? DEFAULT_WIDTH;
  const height =
    options.height ?? (horizontal ? Math.max(120, names.length * 28 + 60) : DEFAULT_HEIGHT);
  const { svg } = renderPlot(
    {
      width,
      height,
      marginTop: 20,
      marginLeft: horizontal ? Math.min(240, longest * 7 + 24) : 60,
      marginBottom: 44,
      ...(horizontal ? { x: valueScale, y: categoryScale } : { y: valueScale, x: categoryScale }),
      color: { domain: sides, range: [...plan.range] },
      marks: [bar, ...textMarks, rule],
    },
    options.alt,
    "img",
    drawAnnotations(KIND, options.annotations, horizontal),
  );
  const byName = new Map(bars.map((b) => [b.x, b]));
  const values = bars.map((b) => b.value);
  return figure(options, {
    kind: "bar",
    svg,
    description: {
      axes: [
        categoryRange(horizontal ? "y" : "x", categoryLabel, names),
        valueRange(horizontal ? "x" : "y", valueLabel, [0, ...values], (v) => signed(format, v)),
      ],
      ordered: raw.every((v) => typeof v === "number"),
      format: (v) => signed(format, v),
      series: [
        {
          name: valueLabel ?? y,
          points: names.map((n) => ({ at: n, value: byName.get(n)?.value ?? null })),
        },
      ],
    },
    orientation: horizontal ? "horizontal" : "vertical",
    legend: plan.legend.filter((item) => bars.some((b) => b.side === item.label)),
    slotColors: plan.slotColors,
    table: {
      columns: [categoryLabel ?? x, valueLabel ?? y],
      rows: names.map((n) => {
        const b = byName.get(n);
        return [n, b ? signed(format, b.value) : ""];
      }),
    },
  });
}
