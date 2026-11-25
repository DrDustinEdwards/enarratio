import * as Plot from "@observablehq/plot";
import { domainOf, type KeysOfType, maxOf, readLabel } from "../render/data.js";
import { categoryRange, valueRange } from "../render/describe.js";
import {
  type AxisUnits,
  type FigureOptions,
  type SeriesColor,
  unitLabel,
  validateFigure,
} from "../render/figure.js";
import { renderPlot } from "../render/plot.js";
import { DEFAULT_WIDTH } from "../render/size.js";
import { type AxisRange, type Strings, stringsFor, valueFormat } from "../render/text.js";
import { type Annotated, drawAnnotations } from "./annotate.js";
import { named, steps } from "./marks.js";

/** Options every item plot shares: one row per item, values along a horizontal axis. */
export interface ItemOptions<T extends object> extends FigureOptions, AxisUnits, Annotated {
  readonly data: readonly T[];
  /** The field naming each item, one row each. */
  readonly y: KeysOfType<T, string | number>;
  /** Items in display order, top to bottom. Without it, data order. */
  readonly yDomain?: readonly (string | number)[];
  readonly colors?: Readonly<Record<string, SeriesColor>>;
  /** The value axis label; `null` hides it. */
  readonly xLabel?: string | null;
  /** The item axis label (default none). */
  readonly yLabel?: string | null;
  readonly formatValue?: (value: number) => string;
  /** Start the value axis at zero (default false: values need not be lengths). */
  readonly zero?: boolean;
}

export interface Read {
  readonly strings: Strings;
  readonly names: readonly string[];
  readonly format: (v: number) => string;
  readonly xLabel: string | null;
  readonly itemLabel: string;
}

export function readItems<T extends object>(
  kind: string,
  options: ItemOptions<T>,
  valueField: string,
): Read & { readonly raw: readonly string[] } {
  validateFigure(kind, options, options.data);
  const raw = options.data.map((row, i) => readLabel(kind, row, options.y, i));
  return {
    raw,
    strings: stringsFor(options.strings),
    names: domainOf(kind, options.y, raw, options.yDomain?.map(String)),
    format: valueFormat(options),
    xLabel: unitLabel(options.xLabel, valueField, options.xUnit),
    itemLabel: options.yLabel ?? options.y,
  };
}

/** The value axis along x, over `values`, and the items down y, as the overview states them. */
export function itemAxes(r: Read, values: readonly number[]): AxisRange[] {
  return [valueRange("x", r.xLabel, values, r.format), categoryRange("y", r.itemLabel, r.names)];
}

/** One item per row, unless the plot has series. */
export function onePerItem(kind: string, raw: readonly string[]): void {
  const seen = new Set<string>();
  for (const name of raw) {
    if (seen.has(name)) throw new Error(`${kind}: two rows for "${name}"; give one row per item`);
    seen.add(name);
  }
}

export function render<T extends object>(
  kind: string,
  options: ItemOptions<T>,
  r: Read,
  marks: Plot.Markish[],
  scales: Plot.PlotOptions,
  after?: (svg: SVGSVGElement) => void,
): string {
  const longest = Math.max(1, maxOf(r.names.map((n) => n.length)));
  return renderPlot(
    {
      width: options.width ?? DEFAULT_WIDTH,
      height: options.height ?? Math.max(120, r.names.length * 28 + 64),
      marginTop: 20,
      marginLeft: Math.min(240, longest * 7 + 24),
      marginRight: 24,
      marginBottom: 44,
      x: {
        label: r.xLabel,
        grid: true,
        nice: true,
        zero: options.zero ?? false,
        inset: 8,
      },
      y: { type: "band", domain: [...r.names], label: options.yLabel ?? null, padding: 0.3 },
      ...scales,
      marks: [
        Plot.ruleY(r.names, {
          y: (d: string) => d,
          stroke: "var(--enarratio-grid)",
          render: named("row"),
        }),
        ...marks,
      ],
    },
    options.alt,
    "img",
    steps(after, drawAnnotations(kind, options.annotations, false)),
  ).svg;
}
