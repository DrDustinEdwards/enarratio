import * as Plot from "@observablehq/plot";
import { streamModel } from "../render/area-model.js";
import { type Point, type SeriesChartOptions } from "../render/series-prepare.js";
import { fitTicks } from "../render/line-model.js";
import { slotStyle } from "../render/slot-style.js";
import { charWidth, textGrowth } from "../render/size.js";
import { streamLayout } from "../render/stream.js";
import { timeTicks } from "../lite/scale.js";
import { texture } from "../render/texture.js";
import type { KeysOfType } from "../render/data.js";
import { keyed, renderPlot } from "../render/plot.js";
import { DEFAULT_HEIGHT, DEFAULT_WIDTH } from "../render/size.js";
import { named } from "./marks.js";
import { drawAnnotations } from "./annotate.js";
import { annotations, xScale } from "./line.js";
import { maxOf, minOf } from "../render/data.js";

/** Options for {@link streamgraph}: a series chart's, with the series field required. */
export interface StreamgraphOptions<T extends object> extends Omit<
  SeriesChartOptions<T>,
  "series" | "references" | "directLabels" | "yUnit"
> {
  /** The field naming each layer. */
  readonly series: KeysOfType<T, string>;
}

/**
 * A streamgraph: several series over time as layers around a moving center line, on Byron and
 * Wattenberg's "wiggle" baseline (d3's stackOffsetWiggle with stackOrderInsideOut). It shows how a
 * whole and its parts rise and fall, not exact values, so there is no value axis: each layer is
 * named where it is thickest, any it cannot name take textures, and the table gives the values.
 *
 * @example
 * streamgraph({ data: weekly, x: "week", y: "cases", series: "virus", alt: "..." });
 */
export function streamgraph<T extends object>(options: StreamgraphOptions<T>): string {
  let every = true;
  const model = streamModel(options, (svg, plan) =>
    every
      ? { svg, labeled: true }
      : { svg: texture(svg, slotStyle(plan.slotColors)), labeled: false },
  );
  const { prepared, plan } = model;
  const { points, seriesNames, time } = prepared;
  const ats = [...new Set(points.map((p) => p.at))].sort((a, b) => a - b);
  const column = new Map(ats.map((a, j) => [a, j]));
  const values = seriesNames.map((name) => {
    const row = ats.map(() => 0);
    for (const p of points) if (p.series === name) row[column.get(p.at) as number] = p.value ?? 0;
    return row;
  });
  const layout = streamLayout(values);
  const edge = (p: Point, which: "lower" | "upper"): number =>
    layout[which][seriesNames.indexOf(p.series)]?.[column.get(p.at) as number] ?? 0;
  const bands = points.map((p) => ({
    ...p,
    y1: edge(p, "lower"),
    y2: edge(p, "upper"),
  }));
  type Band = (typeof bands)[number];
  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? DEFAULT_HEIGHT;
  const growth = textGrowth(width);
  const char = charWidth(width);
  const margin = Math.ceil(3 * char);
  const [top, bottom] = [12, 44];
  const lo = minOf(layout.lower.flat());
  const hi = maxOf(layout.upper.flat());
  // Each layer named where it is thickest, if its name fits inside it there; a layer that cannot
  // be named takes its texture.
  const plotWidth = width - 2 * margin;
  const plotHeight = height - top - bottom;
  const px = (j: number): number =>
    margin + (ats.length > 1 ? (j / (ats.length - 1)) * plotWidth : plotWidth / 2);
  const py = (v: number): number => top + ((hi - v) / (hi - lo || 1)) * plotHeight;
  const line = 14 * growth;
  const labels: { x: number | Date; y: number; name: string; slot: number }[] = [];
  seriesNames.forEach((name, s) => {
    const lower = layout.lower[s] as readonly number[];
    const upper = layout.upper[s] as readonly number[];
    const thick = (j: number): number => py(lower[j] as number) - py(upper[j] as number);
    const half = (name.length * char) / 2 + 4;
    let best = -1;
    let room = 0;
    ats.forEach((_, j) => {
      const x = Math.min(Math.max(px(j), margin + half), width - margin - half);
      // The thinnest the layer gets under the name's whole width.
      let least = Number.POSITIVE_INFINITY;
      ats.forEach((__, k) => {
        if (Math.abs(px(k) - x) <= half) least = Math.min(least, thick(k));
      });
      if (least > room) {
        room = least;
        best = j;
      }
    });
    if (best < 0 || room < line) {
      every = false;
      return;
    }
    const x = Math.min(Math.max(px(best), margin + half), width - margin - half);
    const at = ats[0] as number;
    const span = (ats.at(-1) as number) - at;
    const xValue = ats.length > 1 ? at + ((x - margin) / plotWidth) * span : at;
    labels.push({
      x: time ? new Date(xValue) : xValue,
      y: ((lower[best] as number) + (upper[best] as number)) / 2,
      name,
      slot: plan.slot(name),
    });
  });
  const order = layout.order.map((i) => seriesNames[i] as string);
  const rendered = renderPlot(
    {
      width,
      height,
      marginTop: top,
      marginLeft: margin,
      marginRight: margin,
      marginBottom: bottom,
      x: {
        ...xScale(model, width, plotWidth),
        // Ticks asked for by width, then thinned to fit: on a phone Plot's own count picks quarters and can leave a single tick for half a year.
        ...(time && !model.yearTicks
          ? {
              ticks: fitTicks(
                timeTicks(ats[0] as number, ats.at(-1) as number, Math.max(5, plotWidth / 60)),
                () => "Jun",
                width,
                plotWidth,
              ).map((t) => new Date(t)),
            }
          : {}),
        domain: time
          ? [new Date(ats[0] as number), new Date(ats.at(-1) as number)]
          : [ats[0], ats.at(-1)],
      },
      y: { axis: null, domain: [lo, hi] },
      color: { domain: seriesNames, range: [...plan.range] },
      marks: [
        // Stacked bottom first, each a solid layer with a thin edge in the background color.
        ...order.map((name) =>
          Plot.areaY(
            bands.filter((b) => b.series === name),
            {
              x: "x",
              y1: "y1",
              y2: "y2",
              fill: "series",
              stroke: "var(--enarratio-background)",
              strokeWidth: 1,
              curve: "monotone-x",
              render: named("area"),
            },
          ),
        ),
        Plot.dot(bands, {
          x: "x",
          y: (b: Band) => (b.y1 + b.y2) / 2,
          r: 4,
          fill: "series",
          fillOpacity: 0,
          title: model.describe,
          filter: (b: Band) => b.value !== null,
          render: keyed(bands, model.datum),
        }),
        Plot.text(labels, {
          x: "x",
          y: "y",
          text: "name",
          textAnchor: "middle",
          fill: (l: (typeof labels)[number]) => `var(--enarratio-series-text-${l.slot})`,
          // A halo in the layer's own color, so a texture never runs through the name.
          stroke: (l: (typeof labels)[number]) => `var(--enarratio-series-${l.slot})`,
          strokeWidth: 3,
          paintOrder: "stroke",
          render: named("area label"),
        }),
        ...annotations({}, model.markers),
      ],
    },
    model.alt,
    "img",
    drawAnnotations("streamgraph", options.annotations),
  );
  return model.figure(rendered.svg, rendered.x);
}
