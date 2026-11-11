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
import { bottomMargin, charWidth, DEFAULT_WIDTH, TITLE_LINES, titleLines } from "../render/size.js";
import { numberFormat, stringsFor } from "../render/text.js";
import { type PooledEstimate, poolEstimates, type StudyEstimate } from "./meta.js";

/** Options for {@link forestPlot}. */
export interface ForestPlotOptions<T extends object>
  extends FigureOptions, Pick<AxisUnits, "xUnit"> {
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

  const names = [...rows.map((r) => r.name), ...(pooledName ? [pooledName] : [])];
  const longest = Math.max(1, maxOf(names.map((n) => n.length)));
  const estimateLabel = unitLabel(options.estimateLabel, options.estimate, options.xUnit);
  const width = options.width ?? DEFAULT_WIDTH;
  const char = charWidth(width);
  const favors = options.favors;
  // Names on the left, intervals in the middle and estimates on the right need about 120 units of
  // plot between them. A narrower drawing (a phone's) stacks each row instead: its name and
  // estimate on a line above its interval, which then spans the drawing (record 0041).
  const marginLeft = Math.min(240, longest * 7 + 20);
  const stacked = width - marginLeft - 150 < 120;
  const estimates = [
    ...rows.map((r) => ci(r.estimate, r.lower, r.upper)),
    ...(pooled ? [ci(pooled.estimate, pooled.lower, pooled.upper)] : []),
  ];
  // Stacked, the name and estimate share a line while both fit with a gap between them; else the
  // estimate takes a second line under the name.
  const textLines = names.every(
    (n, i) => (n.length + (estimates[i]?.length ?? 0) + 2) * char <= width - 32,
  )
    ? 1
    : 2;
  const pitch = 15 * textLines + 24;
  // Where a row's interval sits, in pixels from its center: below its text when stacked.
  const intervalDy = stacked ? -pitch / 2 + 15 * textLines + 12 : 0;
  const pooledY = stacked ? rows.length : rows.length + 0.2;
  const size = (i: number): number =>
    shown
      ? (stacked ? 2 : 3) + (stacked ? 4 : 6) * Math.sqrt((shown[i] as number) / heaviest)
      : stacked
        ? 4
        : 5;
  // A stacked row's text: its name at the left, and its estimate at the right or on a second line.
  const rowText = (
    items: readonly { readonly y: number; readonly name: string; readonly estimate: string }[],
    bold: boolean,
  ): Plot.Markish[] => {
    type Item = (typeof items)[number];
    const line = (n: number) => ({
      y: (d: Item) => d.y,
      dy: -pitch / 2 + 4 + 15 * n,
      lineAnchor: "top" as const,
      // A halo, so the no-effect line under the text does not cut through it (with a stroke,
      // Plot leaves the fill unset unless given).
      fill: "var(--enarratio-text)",
      stroke: "var(--enarratio-background)",
      strokeWidth: 3,
      paintOrder: "stroke",
      ...(bold ? { fontWeight: 600 } : {}),
    });
    return [
      Plot.text(items, {
        ...line(0),
        text: (d: Item) => d.name,
        frameAnchor: "left",
        textAnchor: "start",
      }),
      Plot.text(items, {
        ...line(textLines - 1),
        text: (d: Item) => d.estimate,
        frameAnchor: textLines === 1 ? "right" : "left",
        textAnchor: textLines === 1 ? "end" : "start",
        ...(textLines === 1 ? {} : { fill: "var(--enarratio-text-muted)" }),
      }),
    ];
  };

  const marks: Plot.Markish[] = [
    Plot.ruleX([nullValue], { stroke: "var(--enarratio-text-muted)", render: named("no effect") }),
    Plot.ruleY(rows, {
      y: "index",
      x1: "lower",
      x2: "upper",
      dy: intervalDy,
      stroke: "var(--enarratio-text)",
      strokeWidth: 1.5,
      render: named("interval"),
    }),
    Plot.dot(rows, {
      x: "estimate",
      y: "index",
      dy: intervalDy,
      symbol: "square",
      r: (r: Row) => size(r.index),
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
    ...(stacked
      ? rowText(
          rows.map((r) => ({ y: r.index, name: r.name, estimate: estimates[r.index] ?? "" })),
          false,
        )
      : [
          Plot.text(rows, {
            y: "index",
            text: (r: Row) => ci(r.estimate, r.lower, r.upper),
            frameAnchor: "right",
            textAnchor: "start",
            dx: 12,
          }),
        ]),
  ];
  if (pooled) {
    const y = pooledY;
    const half = stacked ? 6 / pitch : 0.32;
    const mid = stacked ? y + intervalDy / pitch : y;
    marks.push(
      Plot.ruleY([rows.length - (stacked ? 0.5 : 0.4)], {
        stroke: "var(--enarratio-grid)",
        render: named("separator"),
      }),
      Plot.areaX(
        [
          { y: mid - half, x1: pooled.estimate, x2: pooled.estimate },
          { y: mid, x1: pooled.lower, x2: pooled.upper },
          { y: mid + half, x1: pooled.estimate, x2: pooled.estimate },
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
      ...(stacked
        ? rowText(
            [
              {
                y,
                name: pooledName ?? "",
                estimate: ci(pooled.estimate, pooled.lower, pooled.upper),
              },
            ],
            true,
          )
        : [
            Plot.text([pooled], {
              y: () => y,
              text: () => ci(pooled.estimate, pooled.lower, pooled.upper),
              frameAnchor: "right",
              textAnchor: "start",
              dx: 12,
              fontWeight: 600,
            }),
          ]),
    );
  }
  if (favors) {
    // Each side's words start at the no-effect line; on a stacked drawing, at the plot's edges,
    // where the null line may leave no room for one of them.
    marks.push(
      Plot.text([favors[0]], {
        ...(stacked
          ? { frameAnchor: "bottom-left", textAnchor: "start" }
          : { x: nullValue, frameAnchor: "bottom", textAnchor: "end", dx: -8 }),
        dy: 34,
        fill: "var(--enarratio-text-muted)",
      }),
      Plot.text([favors[1]], {
        ...(stacked
          ? { frameAnchor: "bottom-right", textAnchor: "end" }
          : { x: nullValue, frameAnchor: "bottom", textAnchor: "start", dx: 8 }),
        dy: 34,
        fill: "var(--enarratio-text-muted)",
      }),
    );
  }
  const domain = [count - 0.5, -0.5];
  const { svg } = renderPlot(
    {
      width,
      height:
        options.height ??
        (stacked ? count * pitch : count * 28) +
          72 +
          (favors ? 16 : 0) +
          16 * (titleLines(estimateLabel, width) - 1),
      marginTop: 16,
      marginLeft: stacked ? 16 : marginLeft,
      marginRight: stacked ? 16 : 150,
      marginBottom:
        bottomMargin(44, estimateLabel !== null, width, 1, titleLines(estimateLabel, width)) +
        (favors ? 16 : 0),
      x: {
        type: log ? "log" : "linear",
        domain: [Math.min(...allX), Math.max(...allX)],
        nice: true,
        label: estimateLabel,
        ...(log ? { ticks: stacked ? 3 : 5, tickFormat: plain } : {}),
        ...(stacked && !log ? { ticks: 3 } : {}),
        grid: true,
      },
      y: {
        domain,
        ticks: stacked ? [] : names.map((_, i) => (i === rows.length ? pooledY : i)),
        tickFormat: (v: number) => (v === pooledY ? (pooledName ?? "") : (rows[v]?.name ?? "")),
        label: null,
      },
      marks,
    },
    options.alt,
    "img",
    // The axis title goes under the favors line (renderPlot sets it under the tick labels).
    favors
      ? (svg) => {
          const title = svg.querySelector('[data-enarratio-mark="x-axis label"] text');
          title?.setAttribute("y", `${1 + TITLE_LINES + 1.2}em`);
        }
      : undefined,
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
