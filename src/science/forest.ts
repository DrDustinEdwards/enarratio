import * as Plot from "@observablehq/plot";
import { named } from "../plot/marks.js";
import {
  type KeysOfType,
  markKey,
  maxOf,
  readLabel,
  readNumber,
  readNumberOrNull,
} from "../render/data.js";
import { categoryRange, valueRange } from "../render/describe.js";
import {
  type AxisUnits,
  type FigureOptions,
  figure,
  unitLabel,
  validateFigure,
} from "../render/figure.js";
import { keyed, renderPlot } from "../render/plot.js";
import { DEFAULT_WIDTH } from "../render/size.js";
import { numberFormat, stringsFor } from "../render/text.js";
import { type PooledEstimate, poolEstimates, type StudyEstimate } from "./meta.js";

/** Options for {@link forestPlot}. */
export interface ForestPlotOptions<T extends object>
  extends FigureOptions,
    Pick<AxisUnits, "xUnit"> {
  readonly data: readonly T[];
  /** The field naming each study or subgroup, one row each, top to bottom. */
  readonly label: KeysOfType<T, string | number>;
  readonly estimate: KeysOfType<T, number>;
  /** The 95% confidence interval's bounds. */
  readonly lower: KeysOfType<T, number>;
  readonly upper: KeysOfType<T, number>;
  /**
   * Each study's weight, which sizes its square. Without it, weights come from the pooled
   * estimate when there is one, or squares are all one size.
   */
  readonly weight?: KeysOfType<T, number | null | undefined>;
  /**
   * The pooled estimate drawn as a diamond: computed by inverse-variance weighting
   * (`"fixed"`, or `"random"` for DerSimonian and Laird's random effects), or given.
   */
  readonly pooled?: "fixed" | "random" | (StudyEstimate & { readonly label?: string });
  /** A log axis, for ratios (odds, risk, hazard), with the line of no effect at 1. */
  readonly log?: boolean;
  /** Where the line of no effect is (default 1 on a log axis, 0 otherwise). */
  readonly nullValue?: number;
  /** The axis label, such as "Odds ratio (95% CI)", with `xUnit` added. */
  readonly estimateLabel?: string | null;
  /** Words under the axis for each side of no effect, such as ["Favors treatment", "Favors control"]. */
  readonly favors?: readonly [string, string];
  readonly formatValue?: (value: number) => string;
}

interface Row {
  readonly name: string;
  readonly index: number;
  readonly estimate: number;
  readonly lower: number;
  readonly upper: number;
  readonly weight: number | null;
}

const KIND = "forestPlot";

/**
 * A forest plot: each study's estimate as a square sized by its weight, with its 95% confidence
 * interval, against a line of no effect, and the pooled estimate as a diamond spanning its
 * interval. Each estimate and interval is printed in a column to the right, so the figure reads
 * as numbers as well as shapes. Pooling is inverse-variance, fixed or random effects
 * (DerSimonian and Laird 1986), and the caption states the method and heterogeneity (Q, I², τ²).
 *
 * @example
 * forestPlot({ data: trials, label: "trial", estimate: "or", lower: "lo", upper: "hi", log: true, pooled: "random", alt: "..." });
 */
export function forestPlot<T extends object>(options: ForestPlotOptions<T>): string {
  const { data, label } = options;
  validateFigure(KIND, options);
  if (data.length === 0) throw new Error(`${KIND}: data is empty`);
  const strings = stringsFor(options.strings);
  const { terms } = strings;
  const locale = options.locale ? { locale: options.locale } : {};
  const plain = numberFormat(locale);
  const format = options.formatValue ?? numberFormat({ ...locale, maximumSignificantDigits: 3 });
  const share = numberFormat({ ...locale, style: "percent", maximumFractionDigits: 1 });
  const log = options.log === true;
  const rows = data.map((row, i): Row => {
    const estimate = readNumber(KIND, row, options.estimate, i);
    const lower = readNumber(KIND, row, options.lower, i);
    const upper = readNumber(KIND, row, options.upper, i);
    if (!(lower <= estimate && estimate <= upper)) {
      throw new Error(
        `${KIND}: row ${i + 1} estimate ${estimate} lies outside its interval ${lower} to ${upper}`,
      );
    }
    if (log && lower <= 0)
      throw new Error(`${KIND}: row ${i + 1} lower bound ${lower} cannot be shown on a log axis`);
    return {
      name: readLabel(KIND, row, label, i),
      index: i,
      estimate,
      lower,
      upper,
      weight: options.weight === undefined ? null : readNumberOrNull(KIND, row, options.weight, i),
    };
  });
  const given = options.pooled;
  const pooled: (StudyEstimate & { label?: string }) | PooledEstimate | undefined =
    given === "fixed" || given === "random" ? poolEstimates(rows, given, log) : given;
  const computed = pooled && "weights" in pooled ? pooled : undefined;
  const weights = rows.map((r, i) => r.weight ?? computed?.weights[i] ?? null);
  const shown = weights.every((w) => w !== null) ? (weights as number[]) : undefined;
  const totalWeight = shown ? shown.reduce((a, b) => a + b, 0) : 0;
  const heaviest = shown ? maxOf(shown) : 1;
  const nullValue = options.nullValue ?? (log ? 1 : 0);
  const pooledName =
    pooled === undefined
      ? undefined
      : ((given !== "fixed" && given !== "random" ? given?.label : undefined) ??
        (computed?.method === "random" ? terms.pooledRandom : terms.pooledFixed));
  const count = rows.length + (pooled ? 1 : 0);
  const weightOf = (i: number): string => (shown ? share((shown[i] as number) / totalWeight) : "");
  const range = (lo: number, hi: number): string => strings.range(format(lo), format(hi));
  const ci = (e: number, lo: number, hi: number): string => `${format(e)} (${range(lo, hi)})`;
  const describe = (r: Row): string =>
    `${r.name}: ${ci(r.estimate, r.lower, r.upper)}${shown ? `, ${terms.weight.toLowerCase()} ${weightOf(r.index)}` : ""}`;
  const allX = [
    ...rows.flatMap((r) => [r.lower, r.upper]),
    nullValue,
    ...(pooled ? [pooled.lower, pooled.upper] : []),
  ];

  const marks: Plot.Markish[] = [
    Plot.ruleX([nullValue], { stroke: "var(--enarratio-text-muted)", render: named("no effect") }),
    Plot.ruleY(rows, {
      y: "index",
      x1: "lower",
      x2: "upper",
      stroke: "var(--enarratio-text)",
      strokeWidth: 1.5,
      render: named("interval"),
    }),
    Plot.dot(rows, {
      x: "estimate",
      y: "index",
      symbol: "square",
      r: (r: Row) => (shown ? 3 + 6 * Math.sqrt((shown[r.index] as number) / heaviest) : 5),
      fill: "var(--enarratio-series-1)",
      stroke: "var(--enarratio-series-1)",
      title: describe,
      render: keyed(rows, (r) => ({
        key: markKey(r.name),
        filter: { field: label, value: r.name },
        x: r.name,
        column: r.index,
        row: 0,
      })),
    }),
    Plot.text(rows, {
      y: "index",
      text: (r: Row) => ci(r.estimate, r.lower, r.upper),
      frameAnchor: "right",
      textAnchor: "start",
      dx: 12,
    }),
  ];
  if (pooled) {
    const y = rows.length + 0.2;
    marks.push(
      Plot.ruleY([rows.length - 0.4], {
        stroke: "var(--enarratio-grid)",
        render: named("separator"),
      }),
      Plot.areaX(
        [
          { y: y - 0.32, x1: pooled.estimate, x2: pooled.estimate },
          { y, x1: pooled.lower, x2: pooled.upper },
          { y: y + 0.32, x1: pooled.estimate, x2: pooled.estimate },
        ],
        {
          y: "y",
          x1: "x1",
          x2: "x2",
          fill: "var(--enarratio-text)",
          title: () => `${pooledName}: ${ci(pooled.estimate, pooled.lower, pooled.upper)}`,
          render: named("pooled"),
        },
      ),
      Plot.text([pooled], {
        y: () => y,
        text: () => ci(pooled.estimate, pooled.lower, pooled.upper),
        frameAnchor: "right",
        textAnchor: "start",
        dx: 12,
        fontWeight: 600,
      }),
    );
  }
  const favors = options.favors;
  if (favors) {
    marks.push(
      Plot.text([favors[0]], {
        x: nullValue,
        frameAnchor: "bottom",
        textAnchor: "end",
        dx: -8,
        dy: 34,
        fill: "var(--enarratio-text-muted)",
      }),
      Plot.text([favors[1]], {
        x: nullValue,
        frameAnchor: "bottom",
        textAnchor: "start",
        dx: 8,
        dy: 34,
        fill: "var(--enarratio-text-muted)",
      }),
    );
  }
  const names = [...rows.map((r) => r.name), ...(pooledName ? [pooledName] : [])];
  const longest = Math.max(1, maxOf(names.map((n) => n.length)));
  const estimateLabel = unitLabel(options.estimateLabel, options.estimate, options.xUnit);
  const { svg } = renderPlot(
    {
      width: options.width ?? DEFAULT_WIDTH,
      height: options.height ?? count * 28 + 72 + (favors ? 16 : 0),
      marginTop: 16,
      marginLeft: Math.min(240, longest * 7 + 20),
      marginRight: 150,
      marginBottom: 44 + (favors ? 16 : 0),
      x: {
        type: log ? "log" : "linear",
        domain: [Math.min(...allX), Math.max(...allX)],
        nice: true,
        label: estimateLabel,
        labelAnchor: "center",
        labelArrow: "none",
        labelOffset: favors ? 50 : 34,
        ...(log ? { ticks: 5, tickFormat: plain } : {}),
        grid: true,
      },
      y: {
        domain: [count - 0.5, -0.5],
        ticks: names.map((_, i) => (i === rows.length ? rows.length + 0.2 : i)),
        tickFormat: (v: number) =>
          v === rows.length + 0.2 ? (pooledName ?? "") : (rows[v]?.name ?? ""),
        tickSize: 0,
        label: null,
      },
      marks,
    },
    options.alt,
  );
  const method = computed
    ? strings.poolingMethod(
        computed.method,
        log,
        format(computed.q),
        numberFormat({ ...locale, style: "percent", maximumFractionDigits: 0 })(computed.i2),
        ...(computed.method === "random" ? [format(computed.tau2)] : []),
      )
    : undefined;
  return figure(options, {
    kind: "forest",
    svg,
    ...(method ? { method } : {}),
    // The studies top to bottom, each with its interval; the pooled estimate's interval last.
    description: {
      axes: [
        valueRange("x", estimateLabel, allX, format),
        categoryRange("y", String(label), names),
      ],
      format,
      log,
      interval: terms.confidence95,
      series: [
        {
          name: estimateLabel ?? options.estimate,
          points: [
            ...rows.map((r) => ({ at: r.name, value: r.estimate, lower: r.lower, upper: r.upper })),
            ...(pooled && pooledName
              ? [
                  {
                    at: pooledName,
                    value: pooled.estimate,
                    lower: pooled.lower,
                    upper: pooled.upper,
                  },
                ]
              : []),
          ],
        },
      ],
    },
    table: {
      columns: [
        String(label),
        estimateLabel ?? options.estimate,
        terms.confidence95,
        ...(shown ? [terms.weight] : []),
      ],
      rows: [
        ...rows.map((r) => [
          r.name,
          format(r.estimate),
          range(r.lower, r.upper),
          ...(shown ? [weightOf(r.index)] : []),
        ]),
        ...(pooled && pooledName
          ? [
              [
                pooledName,
                format(pooled.estimate),
                range(pooled.lower, pooled.upper),
                ...(shown ? [share(1)] : []),
              ],
            ]
          : []),
      ],
    },
  });
}
