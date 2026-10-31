import * as Plot from "@observablehq/plot";
import { type BarChartOptions, type BarPoint, barModel, labelFits } from "../render/bar-model.js";
import type { Bounds } from "../render/interval.js";
import { keyed, renderPlot } from "../render/plot.js";
import { drawAnnotations } from "./annotate.js";
import { capErrorBars, named, steps } from "./marks.js";

export type { BarChartOptions } from "../render/bar-model.js";

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
  const model = barModel(options);
  const { points, xNames, seriesNames, horizontal, grouped, thinned, categoryLabel } = model;

  // The SVG is one image, so a bar holds no link: its link rides on it for enhance(), and the
  // data table carries the same links for keyboards and screen readers (0026).
  const link = model.link;
  const render = keyed(
    points,
    model.datum,
    link ? (el, p) => el.setAttribute("data-enarratio-href", link(p)) : undefined,
  );

  const common = { fill: "series", title: model.describe, render };
  const order = { order: [...seriesNames] };
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

  const categoryScale = {
    domain: grouped ? seriesNames : xNames,
    label: grouped ? null : categoryLabel,
    padding: grouped ? 0.05 : 0.2,
    ...(grouped ? { axis: null } : { tickFormat: model.tickLabel }),
    ...(!grouped && thinned ? { ticks: thinned } : {}),
  };
  const facetScale = {
    domain: xNames,
    label: categoryLabel,
    padding: 0.15,
    axis: horizontal ? "left" : "bottom",
    tickFormat: model.tickLabel,
    ...(thinned ? { ticks: thinned } : {}),
  } as const;
  const ticks = model.countTicks;
  const valueScale = {
    label: model.valueLabel,
    labelArrow: "none",
    labelAnchor: "center",
    grid: true,
    zero: true,
    // Counts are whole numbers, so their axis never shows 0.5, and the axis ends at the last
    // tick so no tick is drawn past the plot (A2).
    ...(ticks
      ? {
          ticks,
          tickFormat: model.format,
          domain: [0, ticks[ticks.length - 1] ?? 1],
          nice: false,
        }
      : {
          nice: true,
          ...(model.valueAxis.flat ? { domain: [0, 1] } : {}),
          ...(model.valueAxis.format ? { tickFormat: model.valueAxis.format } : {}),
        }),
  } as const;

  const { svg } = renderPlot(
    {
      width: model.width,
      height: model.height,
      marginTop: 20,
      marginLeft: model.marginLeft,
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
      color: { domain: seriesNames, range: [...model.plan.range] },
      marks: [bar, horizontal ? Plot.ruleX([0]) : Plot.ruleY([0]), ...errorMarks(model)],
    },
    model.alt,
    "img",
    steps(
      model.directLabels ? (svg) => labelSegments(svg) : undefined,
      model.bounds ? capErrorBars : undefined,
      drawAnnotations("barChart", options.annotations, horizontal),
    ),
  );

  return model.figure(svg);
}

/** Each bar's error bar, a rule across its value at the middle of the bar. */
function errorMarks(model: ReturnType<typeof barModel>): Plot.Markish[] {
  const { bounds } = model;
  if (!bounds) return [];
  const rows = [...bounds].map(([p, b]: [BarPoint, Bounds]) => ({ ...p, ...b }));
  const render = named("error bar");
  const style = { stroke: "var(--enarratio-text)", strokeWidth: 1.5, render };
  if (model.horizontal) {
    return [
      model.grouped
        ? Plot.ruleY(rows, { y: "series", fy: "x", x1: "lower", x2: "upper", ...style })
        : Plot.ruleY(rows, { y: "x", x1: "lower", x2: "upper", ...style }),
    ];
  }
  return [
    model.grouped
      ? Plot.ruleX(rows, { x: "series", fx: "x", y1: "lower", y2: "upper", ...style })
      : Plot.ruleX(rows, { x: "x", y1: "lower", y2: "upper", ...style }),
  ];
}

/**
 * Writes each series' name inside the stacked segments it fits in, in the color chosen for text
 * on that series. Drawn after Plot lays out the bars, from their final geometry.
 */
function labelSegments(svg: SVGSVGElement): void {
  const group = svg.querySelector('[data-enarratio-mark="bar"]');
  if (!group) return;
  const document = svg.ownerDocument;
  const labels = document.createElementNS("http://www.w3.org/2000/svg", "g");
  labels.setAttribute("data-enarratio-mark", "bar label");
  labels.setAttribute("aria-hidden", "true");
  // Labels sit on the bars they name; pointer events go through them to the bar.
  labels.setAttribute("pointer-events", "none");
  labels.setAttribute("text-anchor", "middle");
  for (const mark of group.querySelectorAll("[data-enarratio-key]")) {
    const shape = mark.localName === "rect" ? mark : mark.querySelector("rect");
    const name = mark.getAttribute("data-enarratio-series");
    const fill = shape?.getAttribute("fill") ?? "";
    const slot = /--enarratio-series-(\d)/.exec(fill)?.[1];
    if (!shape || !name || !slot) continue;
    const [bx, by, bw, bh] = ["x", "y", "width", "height"].map((a) =>
      Number(shape.getAttribute(a)),
    ) as [number, number, number, number];
    if (!labelFits(name, bw, bh)) continue;
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
