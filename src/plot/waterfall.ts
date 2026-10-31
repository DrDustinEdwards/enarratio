import * as Plot from "@observablehq/plot";
import { type KeysOfType, markKey, maxOf, readLabel, readNumberOrNull } from "../render/data.js";
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
import { stringsFor, valueFormat, signed as withSign } from "../render/text.js";
import { type Annotated, drawAnnotations, withNotes } from "./annotate.js";
import { named } from "./marks.js";

/** Options for {@link waterfallChart}. */
export interface WaterfallChartOptions<T extends object>
  extends FigureOptions,
    AxisUnits,
    Annotated {
  readonly data: readonly T[];
  /** The field naming each step, in order. */
  readonly x: KeysOfType<T, string | number>;
  /**
   * The change at each step. On a total row it is the total itself; left empty (`null`), the
   * total is the running sum so far.
   */
  readonly y: KeysOfType<T, number | null | undefined>;
  /**
   * A field marking total rows (true): a bar from zero to the level reached, such as the opening
   * and closing balance. A total given as a number must equal the running sum, unless it is the
   * first row, which sets the starting level.
   */
  readonly total?: KeysOfType<T, boolean | undefined>;
  /** Legend names for the three kinds of bar (default "Increase", "Decrease", "Total"). */
  readonly increaseLabel?: string;
  readonly decreaseLabel?: string;
  readonly totalLabel?: string;
  readonly colors?: Readonly<Record<string, SeriesColor>>;
  readonly xLabel?: string | null;
  readonly yLabel?: string | null;
  readonly formatValue?: (value: number) => string;
}

interface Step {
  readonly name: string;
  readonly index: number;
  readonly kind: string;
  readonly change: number;
  /** The level before and after the step: a total runs from zero. */
  readonly start: number;
  readonly end: number;
}

const KIND = "waterfallChart";

/**
 * A waterfall (bridge) chart: how a starting total becomes an ending one through increases and
 * decreases. Each step floats from the level the last one reached, joined to the next by a
 * dashed connector; totals stand on zero. Increases, decreases and totals differ in color, and
 * every bar is labeled with its signed change or its total, so none relies on color alone.
 *
 * @example
 * waterfallChart({ data: budget, x: "item", y: "amount", total: "isTotal", alt: "..." });
 */
export function waterfallChart<T extends object>(given: WaterfallChartOptions<T>): string {
  const options = withNotes(given);
  const { data, x, y, total } = options;
  validateFigure(KIND, options);
  if (data.length === 0) throw new Error(`${KIND}: data is empty`);
  const format = valueFormat(options);
  const strings = stringsFor(options.strings);
  const { terms } = strings;
  const increase = options.increaseLabel ?? terms.increase;
  const decrease = options.decreaseLabel ?? terms.decrease;
  const totalName = options.totalLabel ?? terms.total;
  const categoryLabel = unitLabel(options.xLabel, x, options.xUnit);
  const valueLabel = unitLabel(options.yLabel, y, options.yUnit);
  const signed = (v: number): string => withSign(format, v);

  let level = 0;
  const seen = new Set<string>();
  const steps = data.map((row, i): Step => {
    const name = readLabel(KIND, row, x, i);
    if (seen.has(name)) throw new Error(`${KIND}: two steps named "${name}"`);
    seen.add(name);
    const isTotal = total !== undefined && (row as Record<string, unknown>)[total] === true;
    const v = readNumberOrNull(KIND, row, y, i);
    if (isTotal) {
      if (v !== null && i > 0 && Math.abs(v - level) > 1e-9 * Math.max(1, Math.abs(level))) {
        throw new Error(
          `${KIND}: total "${name}" is ${format(v)}, but the steps before it reach ${format(level)}`,
        );
      }
      level = v ?? level;
      return { name, index: i, kind: totalName, change: level, start: 0, end: level };
    }
    if (v === null)
      throw new Error(`${KIND}: row ${i + 1} has no change; only a total may be empty`);
    const start = level;
    level += v;
    return { name, index: i, kind: v < 0 ? decrease : increase, change: v, start, end: level };
  });
  const kinds = [increase, decrease, totalName];
  const plan = planSeries(KIND, kinds, options.colors);
  const names = steps.map((s) => s.name);
  const describe = (s: Step): string =>
    s.kind === totalName
      ? `${s.name}: ${totalName.toLowerCase()} ${format(s.end)}`
      : `${s.name}: ${signed(s.change)}, ${strings.range(format(s.start), format(s.end))}`;
  const connectors = steps.slice(0, -1).map((s, i) => ({
    x1: s.name,
    x2: (steps[i + 1] as Step).name,
    y: s.end,
  }));
  const longest = Math.max(1, maxOf(names.map((n) => n.length)));
  const { svg } = renderPlot(
    {
      width: options.width ?? DEFAULT_WIDTH,
      height: options.height ?? DEFAULT_HEIGHT,
      marginTop: 24,
      marginLeft: valueLabel === null ? 52 : 64,
      marginBottom: longest > 10 ? 64 : 44,
      x: {
        type: "band",
        domain: names,
        label: categoryLabel,
        padding: 0.25,
        tickRotate: longest > 10 ? -20 : 0,
      },
      y: {
        label: valueLabel,
        labelAnchor: "center",
        labelArrow: "none",
        grid: true,
        nice: true,
        zero: true,
        insetTop: 12,
      },
      color: { domain: kinds, range: [...plan.range] },
      marks: [
        Plot.link(connectors, {
          x1: "x1",
          x2: "x2",
          y1: "y",
          y2: "y",
          stroke: "var(--enarratio-text-muted)",
          strokeDasharray: "3,3",
          render: named("connector"),
        }),
        Plot.barY(steps, {
          x: "name",
          y1: "start",
          y2: "end",
          fill: "kind",
          title: describe,
          render: keyed(steps, (s) => ({
            key: markKey(s.name),
            filter: { field: x, value: s.name },
            x: s.name,
            series: s.kind,
            column: s.index,
            row: 0,
          })),
        }),
        Plot.text(steps, {
          x: "name",
          y: (s: Step) => Math.max(s.start, s.end),
          text: (s: Step) => (s.kind === totalName ? format(s.end) : signed(s.change)),
          lineAnchor: "bottom",
          dy: -4,
          fill: "var(--enarratio-text)",
        }),
        Plot.ruleY([0]),
      ],
    },
    options.alt,
    "img",
    drawAnnotations(KIND, options.annotations),
  );
  return figure(options, {
    kind: "waterfall",
    svg,
    // The running total is what a reader follows from step to step: its start, end and turns.
    description: {
      axes: [
        categoryRange("x", categoryLabel, names),
        valueRange("y", valueLabel, [0, ...steps.flatMap((s) => [s.start, s.end])], format),
      ],
      ordered: true,
      format,
      series: [
        { name: terms.runningTotal, points: steps.map((s) => ({ at: s.name, value: s.end })) },
      ],
    },
    legend: plan.legend.filter((item) => steps.some((s) => s.kind === item.label)),
    slotColors: plan.slotColors,
    table: {
      columns: [categoryLabel ?? x, terms.change, terms.runningTotal],
      rows: steps.map((s) => [s.name, s.kind === totalName ? "" : signed(s.change), format(s.end)]),
    },
  });
}
