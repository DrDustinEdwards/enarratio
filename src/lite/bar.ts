/**
 * `enarratio/lite/bar`: {@link barChart} without Observable Plot or a DOM, for browser bundles.
 * The same options draw the same SVG as `barChart` from `enarratio/plot`.
 *
 * @packageDocumentation
 */

import {
  type BarChartOptions,
  type BarModel,
  type BarPoint,
  barModel,
  labelFits,
} from "../render/bar-model.js";
import { markKey } from "../render/data.js";
import { datumAttributes } from "../render/datum.js";
import { bottomMargin, leftMargin } from "../render/size.js";
import { annotationMarkup, bandScale, continuousScale, errorBar } from "./annotate.js";
import {
  axisLabel,
  axisTickLabels,
  axisTicks,
  type Frame,
  facetTickLabels,
  grid,
  labelLines,
  type Placement,
  type Tick,
} from "./axis.js";
import {
  band,
  type Continuous,
  continuous,
  linearTickFormat,
  ticks as linearTicks,
  niceLinear,
} from "./scale.js";
import { el, markGroup, svgRoot, text, translate } from "./svg.js";

interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type { BarChartOptions } from "../render/bar-model.js";

const MARGIN_TOP = 20;
const MARGIN_RIGHT = 20;
const MARGIN_BOTTOM = 44;

/** Each bar's extent along the value axis, stacked as Plot stacks it. */
function stack(model: BarModel): Map<BarPoint, [number, number]> {
  const out = new Map<BarPoint, [number, number]>();
  const totals = new Map<string, { pos: number; neg: number }>();
  for (const p of model.points) {
    // Grouped bars each start at zero; stacked ones continue their category's stack.
    const id = model.grouped ? markKey(p.x, p.series) : p.x;
    const total = totals.get(id) ?? { pos: 0, neg: 0 };
    totals.set(id, total);
    const v = p.value;
    if (v < 0) {
      out.set(p, [total.neg, total.neg + v]);
      total.neg += v;
    } else if (v > 0) {
      out.set(p, [total.pos, total.pos + v]);
      total.pos += v;
    } else out.set(p, [total.pos, total.pos]);
  }
  return out;
}

/**
 * A bar chart, drawn without Observable Plot: one series, or several stacked or grouped. The same
 * options and output as `barChart` from `enarratio/plot`, in a bundle small enough for a browser.
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
  return model.figure(drawBars(model, options));
}

function drawBars<T extends object>(model: BarModel, options: BarChartOptions<T>): string {
  const { width, height, horizontal, grouped, xNames, seriesNames, points } = model;
  let frame: Frame = {
    width,
    height,
    marginTop: MARGIN_TOP,
    marginRight: MARGIN_RIGHT,
    // Room below for the x labels and title, as renderPlot fits Plot's.
    marginBottom: bottomMargin(
      MARGIN_BOTTOM,
      (horizontal ? model.valueLabel : model.categoryLabel) !== null,
      width,
    ),
    marginLeft: model.marginLeft,
  };
  const extents = stack(model);

  // The value scale: the stacks' extent and zero, made round, or the count ticks as given.
  let lo = 0;
  let hi = 0;
  // Error bars reach past their bars, and the axis takes them in, as Plot's does.
  const bounds = [...(model.bounds?.values() ?? [])].map((b): [number, number] => [
    b.lower,
    b.upper,
  ]);
  for (const [a, b] of [...extents.values(), ...bounds]) {
    lo = Math.min(lo, a, b);
    hi = Math.max(hi, a, b);
  }
  const counts = model.countTicks;
  const valueRange: [number, number] = horizontal
    ? [frame.marginLeft, width - frame.marginRight]
    : [height - frame.marginBottom, frame.marginTop];
  const tickCount = horizontal
    ? (valueRange[1] - valueRange[0]) / 80
    : (valueRange[0] - valueRange[1]) / 35;
  // A vertical value axis is rounded to the step of the ticks drawn, so it ends on a tick; a
  // horizontal one keeps d3's finer rounding (as renderPlot does).
  const domain: [number, number] = counts
    ? [0, counts[counts.length - 1] ?? 1]
    : model.valueAxis.flat
      ? [0, 1]
      : (niceLinear([lo, hi], horizontal ? undefined : tickCount) as [number, number]);
  const value: Continuous = continuous("linear", domain, valueRange);
  const valueTicks: Tick[] = counts
    ? counts.map((t) => ({ at: value(t), label: model.format(t) }))
    : (() => {
        const format = model.valueAxis.format ?? linearTickFormat(domain, tickCount);
        return linearTicks(domain[0], domain[1], tickCount).map((t) => ({
          at: value(t),
          label: format(t),
        }));
      })();

  // Room for the value labels and the axis title beside them, as renderPlot makes for Plot's.
  if (!horizontal) {
    frame = {
      ...frame,
      marginLeft: leftMargin(
        frame.marginLeft,
        valueTicks.map((t) => t.label),
        model.valueLabel !== null,
        width,
      ),
    };
  }

  // The category scale, and for grouped bars the facets, one per category.
  const categoryRange: [number, number] = horizontal
    ? [frame.marginTop, height - frame.marginBottom]
    : [frame.marginLeft, width - frame.marginRight];
  const facetBand = grouped ? band(xNames.length, categoryRange, 0.15, 0) : undefined;
  let inner = frame;
  if (facetBand) {
    inner = horizontal
      ? { ...frame, height: facetBand.bandwidth + frame.marginTop + frame.marginBottom }
      : { ...frame, width: facetBand.bandwidth + frame.marginLeft + frame.marginRight };
  }
  const innerRange: [number, number] = horizontal
    ? [inner.marginTop, inner.height - inner.marginBottom]
    : [inner.marginLeft, inner.width - inner.marginRight];
  const category = grouped
    ? band(seriesNames.length, innerRange, 0.05, 0.05)
    : band(xNames.length, innerRange, 0.2, 0.2);
  const columnOf = new Map(xNames.map((name, i) => [name, i]));
  const rowOf = new Map(seriesNames.map((name, i) => [name, i]));

  // Facets in category order; a category without bars is an empty facet, drawn without marks.
  const byCategory = new Map<string, BarPoint[]>();
  if (facetBand) {
    for (const p of points) {
      const list = byCategory.get(p.x);
      if (list) list.push(p);
      else byCategory.set(p.x, [p]);
    }
  }
  const facets = facetBand
    ? xNames.map((name, i) => {
        const at = facetBand.at(i);
        return {
          name,
          dx: horizontal ? 0 : at - frame.marginLeft,
          dy: horizontal ? at - frame.marginTop : 0,
          points: byCategory.get(name) ?? [],
        };
      })
    : undefined;
  const drawn = facets?.filter((f) => f.points.length > 0);
  const outer: Frame | undefined = facetBand
    ? (() => {
        const first = facetBand.at(0);
        const last = facetBand.at(xNames.length - 1) + facetBand.bandwidth;
        return horizontal
          ? { ...frame, marginTop: first, marginBottom: height - last }
          : { ...frame, marginLeft: first, marginRight: width - last };
      })()
    : undefined;

  const parts: string[] = [];
  const thinned = model.thinned ? new Set(model.thinned) : undefined;
  const label = model.categoryLabel;
  const valueAt = valueTicks.map((t) => t.at);

  if (facets && outer) {
    const k = horizontal ? "fy" : "fx";
    parts.push(
      facetTickLabels(
        k,
        facets.map((f) => ({
          dx: f.dx,
          dy: f.dy,
          ...(thinned && !thinned.has(f.name) ? {} : { label: model.tickLabel(f.name) }),
        })),
        inner,
      ),
      axisLabel(k, label, outer),
    );
  }

  const categoryAxis = (k: "x" | "y"): void => {
    const ticks = xNames
      .map((name, i) => ({ at: category.at(i), label: name }))
      .filter((t) => !thinned || thinned.has(t.label))
      .map((t) => ({ ...t, label: model.tickLabel(t.label) }));
    const offset = category.bandwidth / 2;
    parts.push(
      axisTicks(
        k,
        ticks.map((t) => t.at),
        frame,
        offset,
      ),
      axisTickLabels(k, ticks, frame, { offset }),
      axisLabel(k, label, frame, frame, labelLines(ticks)),
    );
  };
  const valueAxis = (k: "x" | "y", placement: Placement): void => {
    parts.push(
      grid(k, valueAt, inner, drawn),
      axisTicks(k, valueAt, inner, 0, placement),
      axisTickLabels(k, valueTicks, inner, { placement }),
      axisLabel(k, model.valueLabel, outer ?? frame, frame, labelLines(valueTicks)),
    );
  };
  if (horizontal) {
    if (!grouped) categoryAxis("y");
    // A faceted axis is drawn in the facets with nothing beyond them: below, for x.
    valueAxis(
      "x",
      facets?.filter((f, i) => f.points.length > 0 && !(facets[i + 1]?.points.length ?? 0)),
    );
  } else {
    // ... and to the left, for y.
    valueAxis(
      "y",
      facets?.filter((f, i) => f.points.length > 0 && !(facets[i - 1]?.points.length ?? 0)),
    );
    if (!grouped) categoryAxis("x");
  }

  // The bars, each its stack's extent across its slot.
  const boxes = new Map(
    points.map((p) => {
      const [a, b] = extents.get(p) as [number, number];
      const start = category.at(grouped ? (rowOf.get(p.series) ?? 0) : (columnOf.get(p.x) ?? 0));
      const v1 = value(a);
      const v2 = value(b);
      const box: Box = horizontal
        ? { x: Math.min(v1, v2), width: Math.abs(v1 - v2), y: start, height: category.bandwidth }
        : { x: start, width: category.bandwidth, y: Math.min(v1, v2), height: Math.abs(v1 - v2) };
      return [p, box];
    }),
  );
  const barMarkup = (list: readonly BarPoint[]): string =>
    list
      .map((p) => {
        const box = boxes.get(p) as Box;
        const keys = Object.fromEntries(datumAttributes(model.datum(p)));
        const shape = { ...box, fill: model.plan.range[rowOf.get(p.series) ?? 0] };
        const title = el("title", {}, text(model.describe(p)));
        // As in the Plot chart: the link rides on the bar for enhance(), and is in the table (0026).
        const link = model.link ? { "data-enarratio-href": model.link(p) } : {};
        return el("rect", { ...shape, ...keys, ...link }, title);
      })
      .join("");
  // Annotations from the same scales Plot's are placed with: ranges behind the bars, notes last.
  const notes = annotationMarkup(
    "barChart",
    options.annotations,
    (axis) =>
      (axis === "x") === !horizontal
        ? bandScale(category, xNames, categoryRange)
        : continuousScale(value),
    horizontal,
  );
  parts.push(notes.behind);
  parts.push(
    markGroup(
      { "data-enarratio-mark": "bar" },
      {},
      drawn
        ? drawn.map((f) => ({ dx: f.dx, dy: f.dy, children: barMarkup(f.points) }))
        : barMarkup(points),
    ),
  );

  if (model.directLabels) {
    // Each series' name inside the stacked segments it fits in, in the color for text on it.
    const labels = points
      .map((p) => {
        const box = boxes.get(p) as Box;
        if (!labelFits(p.series, box.width, box.height)) return "";
        return el(
          "text",
          {
            x: box.x + box.width / 2,
            y: box.y + box.height / 2,
            dy: "0.35em",
            fill: `var(--enarratio-series-text-${(rowOf.get(p.series) ?? 0) + 1})`,
          },
          text(p.series),
        );
      })
      .join("");
    parts.push(
      el(
        "g",
        {
          "data-enarratio-mark": "bar label",
          "aria-hidden": "true",
          // Labels sit on the bars they name; pointer events go through them to the bar.
          "pointer-events": "none",
          "text-anchor": "middle",
        },
        labels,
      ),
    );
  }

  // The rule at zero, across the frame (in each drawn facet).
  const zero = value(0);
  const rule = horizontal
    ? el("line", { x1: zero, x2: zero, y1: inner.marginTop, y2: inner.height - inner.marginBottom })
    : el("line", { x1: inner.marginLeft, x2: inner.width - inner.marginRight, y1: zero, y2: zero });
  parts.push(
    markGroup(
      { "data-enarratio-mark": "rule" },
      { stroke: "currentColor" },
      drawn ? drawn.map((f) => ({ dx: f.dx, dy: f.dy, children: rule })) : rule,
    ),
  );

  // Each bar's error bar, a rule across its value at the middle of its slot.
  if (model.bounds) {
    const offset = category.bandwidth / 2;
    const barsOf = (list: readonly BarPoint[]): string =>
      list
        .map((p) => {
          const b = model.bounds?.get(p);
          if (!b) return "";
          const at = category.at(grouped ? (rowOf.get(p.series) ?? 0) : (columnOf.get(p.x) ?? 0));
          const [v1, v2] = [value(b.lower), value(b.upper)];
          return errorBar(
            horizontal ? { x1: v1, x2: v2, y1: at, y2: at } : { x1: at, x2: at, y1: v1, y2: v2 },
          );
        })
        .join("");
    parts.push(
      markGroup(
        {
          "data-enarratio-mark": "error bar",
          transform: horizontal ? translate(0, offset) : translate(offset, 0),
        },
        { stroke: "var(--enarratio-text)", "stroke-width": "1.5" },
        drawn
          ? drawn.map((f) => ({ dx: f.dx, dy: f.dy, children: barsOf(f.points) }))
          : barsOf(points),
      ),
    );
  }
  parts.push(notes.above);

  return svgRoot(width, height, model.alt, "img", parts.join(""));
}
