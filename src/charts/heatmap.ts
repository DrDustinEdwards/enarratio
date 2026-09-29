import * as Plot from "@observablehq/plot";
import {
  defaultFormat,
  domainOf,
  type KeysOfType,
  markKey,
  maxOf,
  minOf,
  readCategory,
  readNumberOrNull,
} from "../render/data.js";
import { type FigureOptions, figure, type RampItem, validateFigure } from "../render/figure.js";
import { decorate, keyed, renderPlot } from "../render/plot.js";

/** Options for {@link heatmap}. */
export interface HeatmapOptions<T extends object> extends FigureOptions {
  readonly data: readonly T[];
  /** The column field. */
  readonly x: KeysOfType<T, string | number>;
  /** The row field. */
  readonly y: KeysOfType<T, string | number>;
  /** The field colored by the theme's sequential ramp. `null` is an empty cell, outlined dashed. */
  readonly value: KeysOfType<T, number | null | undefined>;
  readonly xDomain?: readonly (string | number)[];
  readonly yDomain?: readonly (string | number)[];
  /**
   * Four ascending thresholds splitting values into the ramp's five steps. Defaults to equal
   * intervals between the lowest and highest value.
   */
  readonly thresholds?: readonly [number, number, number, number];
  /** Print each value in its cell (default true when there are 100 cells or fewer). */
  readonly cellLabels?: boolean;
  readonly xLabel?: string | null;
  readonly yLabel?: string | null;
  /** What the value measures, for hover details and the table header. */
  readonly valueLabel?: string;
  readonly formatValue?: (value: number) => string;
}

interface Cell {
  readonly x: string;
  readonly y: string;
  readonly value: number | null;
  readonly step: number;
}

const KIND = "heatmap";

function stepOf(value: number, thresholds: readonly number[]): number {
  let step = 1;
  for (const t of thresholds) if (value >= t) step += 1;
  return step;
}

/**
 * A grid of cells colored by value on the theme's sequential ramp: cohort retention, weekly
 * activity, plate layouts. Colors come in five labelled steps, printed values keep the chart
 * readable without color, and empty cells are outlined with a dashed line rather than colored as zero.
 *
 * @example
 * heatmap({ data: cohorts, x: "month", y: "cohort", value: "retained", alt: "..." });
 */
export function heatmap<T extends object>(options: HeatmapOptions<T>): string {
  const { data, x, y, value } = options;
  validateFigure(KIND, options);
  if (data.length === 0) throw new Error(`${KIND}: data is empty`);
  const format = options.formatValue ?? defaultFormat;
  const valueLabel = options.valueLabel ?? value;
  const xs = data.map((row, i) => readCategory(KIND, row, x, i));
  const ys = data.map((row, i) => readCategory(KIND, row, y, i));
  const xNames = domainOf(KIND, x, xs, options.xDomain);
  const yNames = domainOf(KIND, y, ys, options.yDomain);
  const values = data.map((row, i) => readNumberOrNull(KIND, row, value, i));
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) throw new Error(`${KIND}: every value is empty`);

  const seen = new Set<string>();
  data.forEach((_, i) => {
    const id = `${xs[i]}|${ys[i]}`;
    if (seen.has(id)) throw new Error(`${KIND}: two rows for cell ${xs[i]}, ${ys[i]}`);
    seen.add(id);
  });

  const min = minOf(present);
  const max = maxOf(present);
  // Flat data still gets ascending thresholds: every cell then lands in the first step.
  const span = max - min || 1;
  const thresholds: readonly number[] =
    options.thresholds ?? [1, 2, 3, 4].map((k) => min + (span * k) / 5);
  for (let i = 1; i < thresholds.length; i += 1) {
    if ((thresholds[i] as number) <= (thresholds[i - 1] as number)) {
      throw new Error(`${KIND}: thresholds must ascend`);
    }
  }
  const cells = data.map((_, i): Cell => {
    const v = values[i] ?? null;
    return {
      x: String(xs[i]),
      y: String(ys[i]),
      value: v,
      step: v === null ? 0 : stepOf(v, thresholds),
    };
  });

  const filledCells = cells.filter((c) => c.value !== null);
  const emptyCells = cells.filter((c) => c.value === null);
  const xColumn = options.xLabel ?? x;
  const yColumn = options.yLabel ?? y;
  const describe = (c: Cell): string =>
    `${yColumn} ${c.y}, ${xColumn} ${c.x}: ${c.value === null ? "no data" : `${format(c.value)} ${valueLabel}`}`;
  const showLabels = options.cellLabels ?? cells.length <= 100;

  const longest = Math.max(maxOf(yNames.map((n) => n.length)), 1);
  const marks: Plot.Markish[] = [
    Plot.cell(emptyCells, {
      x: "x",
      y: "y",
      fill: "none",
      stroke: "var(--abscissa-status-unknown)",
      strokeDasharray: "3,2",
      inset: 1.5,
      title: describe,
    }),
    Plot.cell(filledCells, {
      x: "x",
      y: "y",
      inset: 1,
      title: describe,
      render: keyed(
        filledCells,
        (c) => ({
          key: markKey(c.x, c.y),
          filter: { field: y, value: c.y },
          x: c.x,
          column: xNames.indexOf(c.x),
          row: yNames.indexOf(c.y),
        }),
        (el, c) => el.setAttribute("fill", `var(--abscissa-sequential-${c.step})`),
      ),
    }),
  ];
  if (showLabels) {
    marks.push(
      Plot.text(filledCells, {
        x: "x",
        y: "y",
        text: (c: Cell) => (c.value === null ? "" : format(c.value)),
        render: decorate(filledCells, (el, c) =>
          el.setAttribute("fill", `var(--abscissa-sequential-text-${c.step})`),
        ),
      }),
    );
  }

  const { svg } = renderPlot(
    {
      width: options.width ?? 640,
      height: options.height ?? Math.max(160, yNames.length * 32 + 64),
      marginTop: 20,
      marginLeft: Math.min(200, longest * 7 + 24) + (options.yLabel === null ? 0 : 20),
      marginBottom: 44,
      x: {
        type: "band",
        domain: xNames,
        label: options.xLabel === undefined ? x : options.xLabel,
        labelAnchor: "center",
        labelArrow: "none",
      },
      y: {
        type: "band",
        domain: yNames,
        label: options.yLabel === undefined ? y : options.yLabel,
        labelAnchor: "center",
        labelArrow: "none",
      },
      marks,
    },
    options.alt,
  );

  const edges = [min, ...thresholds, max];
  const ramp: RampItem[] = [1, 2, 3, 4, 5].map((step) => ({
    step,
    label:
      step === 1
        ? `below ${format(edges[1] as number)}`
        : step === 5
          ? `${format(edges[4] as number)} or more`
          : `${format(edges[step - 1] as number)} to ${format(edges[step] as number)}`,
  }));
  const cellOf = new Map(cells.map((c) => [`${c.x}|${c.y}`, c]));

  return figure(options, {
    kind: "heatmap",
    svg,
    ramp,
    table: {
      columns: [`${yColumn} \\ ${xColumn}`, ...xNames],
      rows: yNames.map((yn) => [
        yn,
        ...xNames.map((xn) => {
          const c = cellOf.get(`${xn}|${yn}`);
          return c?.value === null || c === undefined ? "" : format(c.value);
        }),
      ]),
    },
  });
}
