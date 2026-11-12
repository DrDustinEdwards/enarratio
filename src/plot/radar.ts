import { el, svgRoot, text } from "../lite/svg.js";
import { n2, polar, type RimLabel, rimLabels } from "../render/arc.js";
import {
  type KeysOfType,
  markKey,
  type MeasuresOptions,
  maxOf,
  readLabel,
  readNumber,
} from "../render/data.js";
import { datumAttributes } from "../render/datum.js";
import { figure, validateFigure } from "../render/figure.js";
import { planSeries, seriesLegend } from "../render/series.js";
import { charWidth, DEFAULT_WIDTH, textGrowth } from "../render/size.js";
import { valueFormat } from "../render/text.js";
import { LINE_DASHES } from "../theme/dashes.js";

/** Options for {@link radarChart}. */
export interface RadarChartOptions<T extends object> extends MeasuresOptions<T> {
  /** The measures, one spoke each, clockwise from 12 o'clock: three to twelve, on one scale. */
  readonly axes: readonly KeysOfType<T, number>[];
  /** The value at the rim (default: the largest value, rounded up). The center is zero. */
  readonly max?: number;
}

const KIND = "radar";
/** The rings drawn between the center and the rim. */
const RINGS = 4;
const ADVICE = "draw small multiples, or a grouped bar chart, which compares values more precisely";

/** `v` rounded up to 1, 2, 2.5 or 5 times a power of ten, so the rings read as round numbers. */
export function niceCeil(v: number): number {
  if (!(v > 0)) return 1;
  const power = 10 ** Math.floor(Math.log10(v));
  for (const step of [1, 2, 2.5, 5, 10]) if (step * power >= v - 1e-12) return step * power;
  return 10 * power;
}

/**
 * A radar chart: a few series' profiles over three to twelve measures on one scale (skills, a
 * product's ratings, a sample's composition), one spoke per measure from a zero center. Each series
 * is an outline with a light fill, told apart by color and, from the second on, dash; each value is
 * a point that hover, focus and the keys reach, and the rings are labeled on the top spoke.
 * Profiles are easier to compare than values: a grouped bar chart compares values more precisely.
 * More than four series are reported as an issue, and the data table lists every value.
 *
 * @example
 * radarChart({ data: teams, label: "team", axes: ["speed", "quality", "cost"], alt: "..." });
 */
export function radarChart<T extends object>(options: RadarChartOptions<T>): string {
  const { data, label, axes } = options;
  validateFigure(KIND, options, data);
  if (axes.length < 3 || axes.length > 12) {
    throw new Error(`${KIND}: ${axes.length} axes; a radar chart needs 3 to 12`);
  }
  const format = valueFormat(options);
  const names = data.map((row, i) => readLabel(KIND, row, label, i));
  if (new Set(names).size !== names.length) throw new Error(`${KIND}: two rows share a name`);
  const values = data.map((row, i) =>
    axes.map((field) => {
      const v = readNumber(KIND, row, field, i);
      if (v < 0) throw new Error(`${KIND}: row ${i + 1} ${field} is ${v}; spokes start at zero`);
      return v;
    }),
  );
  const largest = maxOf(values.flat());
  if (options.max !== undefined && !(options.max > 0)) {
    throw new Error(`${KIND}: max must be above zero, is ${options.max}`);
  }
  const max = options.max ?? niceCeil(largest);
  if (largest > max) throw new Error(`${KIND}: a value (${largest}) is past max (${max})`);
  const plan = planSeries(KIND, names, options.colors);
  const axisName = (field: string): string =>
    (options.axisLabels as Readonly<Record<string, string>> | undefined)?.[field] ?? field;

  const width = options.width ?? DEFAULT_WIDTH;
  const growth = textGrowth(width);
  const char = charWidth(width);
  const angle = (k: number): number => (k / axes.length) * 2 * Math.PI;
  const { height, ...rim } = rimLabels(
    axes.map(axisName),
    axes.map((_, k) => angle(k)),
    { width, height: options.height, char, line: 14 * growth },
  );
  const cx = width / 2;
  const cy = height / 2;
  const radius = rim.radius;
  const at = (k: number, v: number): [number, number] =>
    polar(cx, cy, (v / max) * radius, angle(k));
  const ring = (r: number): string =>
    `${axes
      .map((_, k) => polar(cx, cy, r, angle(k)).map(n2).join(","))
      .join("L")
      .replace(/^/, "M")}Z`;

  const grid =
    Array.from({ length: RINGS }, (_, i) =>
      el("path", { d: ring(((i + 1) / RINGS) * radius) }),
    ).join("") +
    axes
      .map((_, k) => {
        const [x, y] = polar(cx, cy, radius, angle(k));
        return el("line", { x1: n2(cx), y1: n2(cy), x2: n2(x), y2: n2(y) });
      })
      .join("");
  // Ring values beside the top spoke, each on a halo just inside where its ring crosses it (near
  // where Chart.js's radial scale places its ticks), clear of the spoke names at the rim and of the
  // points on the spoke.
  const ringLabels = Array.from({ length: RINGS }, (_, i) => {
    const v = ((i + 1) / RINGS) * max;
    return el(
      "text",
      { x: n2(cx + 5), y: n2(cy - ((i + 1) / RINGS) * radius), dy: "1em" },
      text(format(v)),
    );
  }).join("");
  const spokeLabels = axes
    .map((field, k) => {
      const p = rim.labels[k] as RimLabel;
      return el(
        "text",
        { x: n2(p.x), y: n2(p.y), dy: p.dy, "text-anchor": p.anchor },
        text(axisName(field)),
      );
    })
    .join("");

  const shapes = names
    .map((_, s) => {
      const d = `M${axes
        .map((_, k) =>
          at(k, values[s]?.[k] ?? 0)
            .map(n2)
            .join(","),
        )
        .join("L")}Z`;
      return el("path", {
        d,
        stroke: `var(--enarratio-series-${s + 1})`,
        fill: `var(--enarratio-series-${s + 1})`,
        "stroke-dasharray": s === 0 ? undefined : LINE_DASHES[(s - 1) % LINE_DASHES.length],
      });
    })
    .join("");
  const points = names
    .map((name, s) =>
      axes
        .map((field, k) => {
          const v = values[s]?.[k] ?? 0;
          const [x, y] = at(k, v);
          return el(
            "circle",
            {
              cx: n2(x),
              cy: n2(y),
              r: 3.5,
              fill: `var(--enarratio-series-${s + 1})`,
              ...Object.fromEntries(
                datumAttributes({
                  key: markKey(name, field),
                  filter: { field: label, value: name },
                  series: name,
                  column: k,
                  row: s,
                  at: axisName(field),
                  shown: format(v),
                }),
              ),
            },
            el("title", {}, text(`${name}, ${axisName(field)}: ${format(v)}`)),
          );
        })
        .join(""),
    )
    .join("");

  const svg = svgRoot(
    width,
    height,
    options.alt,
    "img",
    [
      el("g", { "data-enarratio-mark": "radial grid", fill: "none" }, grid),
      el(
        "g",
        { "data-enarratio-mark": "outline", "fill-opacity": 0.12, "stroke-width": 2 },
        shapes,
      ),
      el(
        "g",
        {
          "data-enarratio-mark": "ring tick label",
          "aria-hidden": "true",
          "text-anchor": "start",
          stroke: "var(--enarratio-background)",
          "stroke-width": 3,
          "paint-order": "stroke",
          fill: "var(--enarratio-text-muted)",
        },
        ringLabels,
      ),
      el(
        "g",
        {
          "data-enarratio-mark": "dot",
          stroke: "var(--enarratio-background)",
          "stroke-width": 1.5,
        },
        points,
      ),
      el(
        "g",
        {
          "data-enarratio-mark": "spoke label",
          "aria-hidden": "true",
          fill: "var(--enarratio-text)",
        },
        spokeLabels,
      ),
    ].join(""),
  );

  return figure(options, {
    kind: KIND,
    svg,
    limits: { series: 4, advice: ADVICE },
    description: {
      format,
      series: names.map((name, s) => ({
        name,
        points: axes.map((field, k) => ({ at: axisName(field), value: values[s]?.[k] ?? 0 })),
      })),
    },
    ...seriesLegend(plan, true, label),
    table: {
      columns: [label, ...axes.map(axisName)],
      rows: names.map((name, s) => [name, ...(values[s] ?? []).map(format)]),
    },
  });
}
