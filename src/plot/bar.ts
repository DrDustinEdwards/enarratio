import * as Plot from "@observablehq/plot";
import {
  defaultFormat,
  domainOf,
  type KeysOfType,
  markKey,
  maxOf,
  readCategory,
  readLabel,
  readNumber,
} from "../render/data.js";
import { type FigureOptions, figure, type SeriesColor, validateFigure } from "../render/figure.js";
import { keyed, renderPlot } from "../render/plot.js";
import { planSeries } from "../render/series.js";

/** Options for {@link barChart}. */
export interface BarChartOptions<T extends object> extends FigureOptions {
  readonly data: readonly T[];
  /** The field for categories along the bar axis: a label, or a number such as a year. */
  readonly x: KeysOfType<T, string | number>;
  /**
   * The field for bar length. Omit it to count rows instead: `barChart({ data: entries, x:
   * "year", series: "type" })` draws entries per year by type. Rows sharing a category and series
   * are summed.
   */
  readonly y?: KeysOfType<T, number>;
  /** A field that splits each bar into series, stacked or grouped. */
  readonly series?: KeysOfType<T, string>;
  /** How series share a category: stacked (default) or side by side. */
  readonly layout?: "stacked" | "grouped";
  /** Vertical bars (default), or horizontal bars for long category names and rankings. */
  readonly orientation?: "vertical" | "horizontal";
  /**
   * Every category in display order. Without it, categories appear in data order, or ascending
   * when all are numbers. Give it to show empty years or a fixed order.
   */
  readonly xDomain?: readonly (string | number)[];
  /** Every series in display and color order. Without it, first-seen order. */
  readonly seriesDomain?: readonly string[];
  /**
   * Color overrides by series name. A chart without `series` has one series, named by its value
   * label (`yLabel`).
   */
  readonly colors?: Readonly<Record<string, SeriesColor>>;
  /** The category axis label; defaults to the `x` field name; `null` hides it. */
  readonly xLabel?: string | null;
  /** The value axis label; defaults to the `y` field name or "Count"; `null` hides it. */
  readonly yLabel?: string | null;
  /** Formats values in hover details and the data table. */
  readonly formatValue?: (value: number) => string;
  /**
   * What a click on a bar filters by, once enhanced: its series (default when there are series)
   * or its category (`"x"`, e.g. "this year"). A chart without series always filters by category.
   */
  readonly filterBy?: "series" | "x";
  /**
   * A link for each category, so that with scripts off a bar is a link (to a filtered page, say).
   * Once enhanced, bars filter instead and the link moves to `data-enarratio-href`. Only relative,
   * `http:` and `https:` links are allowed.
   */
  readonly href?: (x: string) => string;
  /**
   * The most category labels to print. With more categories than this, every nth label is
   * printed, starting from the first, so labels stay legible when the chart is drawn small.
   */
  readonly maxXTicks?: number;
  /**
   * Print each series' name inside its bars where the name fits, so series are told apart by
   * text as well as color (A1). Stacked layouts only; small segments keep their hover details and
   * the data table.
   */
  readonly directLabels?: boolean;
}

interface BarPoint {
  readonly x: string;
  readonly series: string;
  value: number;
}

const KIND = "barChart";

/**
 * Allows relative and http(s) links only, so data can never produce a `javascript:` URL. Browsers
 * ignore control characters and spaces inside a scheme, so the scheme is read without them. A
 * leading `//` (or its backslash forms) names another host, so it is refused too (A11).
 */
function safeHref(href: string): string {
  const compact = [...href].filter((ch) => ch.charCodeAt(0) > 0x20).join("");
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(compact)?.[1]?.toLowerCase();
  const otherHost = /^[/\\][/\\]/.test(compact);
  if (otherHost || (scheme !== undefined && scheme !== "http" && scheme !== "https")) {
    throw new Error(`${KIND}: href "${href}" is not a relative or http(s) link`);
  }
  return href;
}

/** Every nth category, when there are more than `max`, or undefined to print them all. */
function thinTicks(names: readonly string[], max: number | undefined): string[] | undefined {
  if (max === undefined) return undefined;
  if (!Number.isInteger(max) || max < 1)
    throw new Error(`${KIND}: maxXTicks must be a whole number of 1 or more`);
  if (names.length <= max) return undefined;
  const step = Math.ceil(names.length / max);
  return names.filter((_, i) => i % step === 0);
}

const STEPS = [1, 2, 5];

/** Whole-number ticks from zero past the tallest bar or stack, about five of them. */
function countTicks(points: readonly BarPoint[], grouped: boolean): number[] {
  const totals = new Map<string, number>();
  for (const p of points) {
    const id = grouped ? markKey(p.x, p.series) : p.x;
    totals.set(id, (totals.get(id) ?? 0) + p.value);
  }
  const max = Math.max(1, maxOf(totals.values()));
  let step = 1;
  for (let magnitude = 1; ; magnitude *= 10) {
    const found = STEPS.map((s) => s * magnitude).find((s) => max / s <= 6);
    if (found !== undefined) {
      step = found;
      break;
    }
  }
  const ticks: number[] = [];
  for (let t = 0; t < max + step; t += step) ticks.push(t);
  return ticks;
}

/**
 * A bar chart, drawn on the server: one series, or several stacked or grouped. Negative values
 * stack below zero. Each bar carries hover details and, once enhanced, filters by its series (or
 * its category when there is one series).
 *
 * @example
 * barChart({
 *   data: [{ year: 2023, type: "Publications" }, { year: 2024, type: "Talks" }],
 *   x: "year",
 *   series: "type",
 *   alt: "Entries per year by type, 2023 to 2024.",
 * });
 */
export function barChart<T extends object>(options: BarChartOptions<T>): string {
  const { data, x, y, series } = options;
  validateFigure(KIND, options);
  if (data.length === 0) throw new Error(`${KIND}: data is empty`);
  if (options.directLabels && options.layout === "grouped") {
    throw new Error(`${KIND}: directLabels needs the stacked layout; grouped bars have a legend`);
  }
  const horizontal = options.orientation === "horizontal";
  const grouped = options.layout === "grouped" && series !== undefined;
  const format = options.formatValue ?? defaultFormat;
  const valueLabel = options.yLabel === undefined ? (y ?? "Count") : options.yLabel;
  const categoryLabel = options.xLabel === undefined ? x : options.xLabel;
  const soleSeries = valueLabel ?? "Value";

  const rawX = data.map((row, i) => readCategory(KIND, row, x, i));
  const xNames = domainOf(KIND, x, rawX, options.xDomain);
  const seriesOf = (row: T, i: number): string =>
    series === undefined ? soleSeries : readLabel(KIND, row, series, i);
  const seriesNames =
    series === undefined
      ? [soleSeries]
      : domainOf(
          KIND,
          series,
          data.map((row, i) => seriesOf(row, i)),
          options.seriesDomain,
        );
  const plan = planSeries(KIND, seriesNames, options.colors);

  const cells = new Map<string, BarPoint>();
  data.forEach((row, i) => {
    const point = { x: String(rawX[i]), series: seriesOf(row, i) };
    const id = markKey(point.x, point.series);
    const value = y === undefined ? 1 : readNumber(KIND, row, y, i);
    const existing = cells.get(id);
    if (existing) existing.value += value;
    else cells.set(id, { ...point, value });
  });
  // In category order, then series order: the reading order, and the order labels are drawn in.
  const columnOf = new Map(xNames.map((name, i) => [name, i]));
  const rowOf = new Map(seriesNames.map((name, i) => [name, i]));
  const points = [...cells.values()].sort(
    (a, b) =>
      (columnOf.get(a.x) ?? 0) - (columnOf.get(b.x) ?? 0) ||
      (rowOf.get(a.series) ?? 0) - (rowOf.get(b.series) ?? 0),
  );

  const describe = (p: BarPoint): string =>
    series === undefined
      ? `${categoryLabel ?? x} ${p.x}: ${format(p.value)}`
      : `${categoryLabel ?? x} ${p.x}, ${p.series}: ${format(p.value)}`;

  const render = keyed(
    points,
    (p) => ({
      key: markKey(p.x, p.series),
      filter:
        series === undefined || options.filterBy === "x"
          ? { field: x, value: p.x }
          : { field: series, value: p.series },
      x: p.x,
      ...(series === undefined ? {} : { series: p.series }),
      column: columnOf.get(p.x) ?? 0,
      row: rowOf.get(p.series) ?? 0,
    }),
    // A link is read on its own, so it carries its own name.
    options.href ? (el, p) => el.setAttribute("aria-label", describe(p)) : undefined,
  );

  const linkOf = options.href;
  const common = {
    fill: "series",
    title: describe,
    render,
    ...(linkOf ? { href: (p: BarPoint) => safeHref(linkOf(p.x)) } : {}),
  };
  const order = { order: seriesNames };
  let bar: Plot.Markish;
  if (horizontal) {
    bar = grouped
      ? Plot.barX(points, { ...common, x: "value", y: "series", fy: "x" })
      : Plot.barX(points, Plot.stackX({ ...common, ...order, x: "value", y: "x" }));
  } else {
    bar = grouped
      ? Plot.barY(points, { ...common, y: "value", x: "series", fx: "x" })
      : Plot.barY(points, Plot.stackY({ ...common, ...order, y: "value", x: "x" }));
  }

  const longest = Math.max(maxOf(xNames.map((n) => n.length)), 1);
  const width = options.width ?? 640;
  const height = options.height ?? (horizontal ? Math.max(120, xNames.length * 28 + 60) : 320);
  const thinned = thinTicks(xNames, options.maxXTicks);
  const categoryScale = {
    domain: grouped ? seriesNames : xNames,
    label: grouped ? null : categoryLabel,
    padding: grouped ? 0.05 : 0.2,
    ...(grouped ? { axis: null } : thinned ? { ticks: thinned } : {}),
  };
  const facetScale = {
    domain: xNames,
    label: categoryLabel,
    padding: 0.15,
    axis: horizontal ? "left" : "bottom",
    ...(thinned ? { ticks: thinned } : {}),
  } as const;
  const ticks = y === undefined ? countTicks(points, grouped) : undefined;
  const valueScale = {
    label: valueLabel,
    labelArrow: "none",
    labelAnchor: "center",
    grid: true,
    zero: true,
    // Counts are whole numbers, so their axis never shows 0.5, and the axis ends at the last
    // tick so no tick is drawn past the plot (A2).
    ...(ticks
      ? { ticks, tickFormat: format, domain: [0, ticks[ticks.length - 1] ?? 1], nice: false }
      : { nice: true }),
  } as const;

  const { svg } = renderPlot(
    {
      width,
      height,
      marginTop: 20,
      marginLeft: horizontal ? Math.min(220, longest * 7 + 16) : valueLabel === null ? 44 : 60,
      marginBottom: 44,
      ...(horizontal
        ? {
            y: { ...categoryScale, type: "band" },
            x: valueScale,
            ...(grouped ? { fy: facetScale } : {}),
          }
        : {
            x: { ...categoryScale, type: "band" },
            y: valueScale,
            ...(grouped ? { fx: facetScale } : {}),
          }),
      color: { domain: seriesNames, range: [...plan.range] },
      marks: [bar, horizontal ? Plot.ruleX([0]) : Plot.ruleY([0])],
    },
    options.alt,
    options.href ? "group" : "img",
    options.directLabels && series !== undefined
      ? (svg) => labelSegments(svg, horizontal)
      : undefined,
  );

  const seriesColumns = seriesNames;
  const rows = xNames.map((name) => [
    name,
    ...seriesColumns.map((s) => {
      const cell = cells.get(markKey(name, s));
      return cell ? format(cell.value) : y === undefined ? format(0) : "";
    }),
  ]);

  return figure(options, {
    kind: "bar",
    svg,
    orientation: horizontal ? "horizontal" : "vertical",
    legend: series === undefined ? [] : plan.legend,
    ...(series === undefined ? {} : { seriesField: series }),
    slotColors: plan.slotColors,
    table: {
      columns: [
        categoryLabel ?? x,
        ...(series === undefined ? [valueLabel ?? "Value"] : seriesColumns),
      ],
      rows,
    },
  });
}

/** A name fits in a segment when the segment is this much taller and wider than the text. */
const LABEL_HEIGHT = 16;
const CHAR_WIDTH = 6.6;

/**
 * Writes each series' name inside the stacked segments it fits in, in the color chosen for text
 * on that series. Drawn after Plot lays out the bars, from their final geometry.
 */
function labelSegments(svg: SVGSVGElement, horizontal: boolean): void {
  const group = svg.querySelector('[data-enarratio-mark="bar"]');
  if (!group) return;
  const document = svg.ownerDocument;
  const labels = document.createElementNS("http://www.w3.org/2000/svg", "g");
  labels.setAttribute("data-enarratio-mark", "bar label");
  labels.setAttribute("aria-hidden", "true");
  // Labels sit on the bars they name; pointer events go through them to the bar.
  labels.setAttribute("pointer-events", "none");
  labels.setAttribute("text-anchor", "middle");
  labels.setAttribute("font-size", "11");
  for (const mark of group.querySelectorAll("[data-enarratio-key]")) {
    const shape = mark.localName === "rect" ? mark : mark.querySelector("rect");
    const name = mark.getAttribute("data-enarratio-series");
    const fill = shape?.getAttribute("fill") ?? "";
    const slot = /--enarratio-series-(\d)/.exec(fill)?.[1];
    if (!shape || !name || !slot) continue;
    const [bx, by, bw, bh] = ["x", "y", "width", "height"].map((a) =>
      Number(shape.getAttribute(a)),
    ) as [number, number, number, number];
    const needed = name.length * CHAR_WIDTH + 8;
    const fits = horizontal
      ? bw >= needed && bh >= LABEL_HEIGHT
      : bh >= LABEL_HEIGHT && bw >= needed;
    if (!fits) continue;
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", String(bx + bw / 2));
    text.setAttribute("y", String(by + bh / 2));
    text.setAttribute("dy", "0.35em");
    text.setAttribute("fill", `var(--enarratio-series-text-${slot})`);
    text.textContent = name;
    labels.append(text);
  }
  group.after(labels);
}
