import { el, svgRoot, text } from "../lite/svg.js";
import { arcPath, n2, polar, type RimLabel, rimLabels } from "../render/arc.js";
import { type KeysOfType, markKey } from "../render/data.js";
import { datumAttributes } from "../render/datum.js";
import { type FigureOptions, figure, type SeriesColor, validateFigure } from "../render/figure.js";
import { readLinks } from "../render/flow.js";
import { planSeries } from "../render/series.js";
import { charWidth, DEFAULT_WIDTH, textGrowth } from "../render/size.js";
import { numberFormat, stringsFor, valueFormat } from "../render/text.js";
import { texture } from "../render/texture.js";

/** Options for {@link chordDiagram}. */
export interface ChordDiagramOptions<T extends object> extends FigureOptions {
  /** One row per flow between two groups. */
  readonly data: readonly T[];
  /** The field naming where each flow comes from. */
  readonly from: KeysOfType<T, string | number>;
  /** The field naming where it goes. */
  readonly to: KeysOfType<T, string | number>;
  /** The field for how much flows: zero or more. */
  readonly value: KeysOfType<T, number>;
  /**
   * Whether a row is a flow one way (default true: a migration, a trade), so each group's arc is
   * what it sends and a ribbon's two ends differ; `false` reads each row as shared by both groups
   * (co-authorship, co-occurrence), counted on both arcs.
   */
  readonly directed?: boolean;
  /** What the value measures, for the table and hover details (default: the field's name). */
  readonly valueLabel?: string;
  readonly colors?: Readonly<Record<string, SeriesColor>>;
  readonly formatValue?: (value: number) => string;
}

const KIND = "chord";
/** The gap between groups' arcs, in radians, and the arcs' thickness as a share of the radius. */
const PAD = 0.04;
const BAND = 0.07;
const ADVICE = "draw a Sankey diagram or a heatmap of the flows";

/**
 * A chord diagram: flows among up to eight groups (migration between regions, trade between
 * countries, shared authorship between departments). Each group is an arc of the circle as long as
 * what it sends (or, undirected, what it shares), and each pair is a ribbon whose ends are as wide
 * as what flows each way, in the color of the group that sends more. Groups are named outside the
 * circle, and the data table is the matrix of flows with each group's total. Past eight groups it
 * throws: there are eight colors, and the ribbons would not read; draw a Sankey or a heatmap.
 *
 * @example
 * chordDiagram({ data: moves, from: "origin", to: "destination", value: "people", alt: "..." });
 */
export function chordDiagram<T extends object>(options: ChordDiagramOptions<T>): string {
  const { data, from, to, value } = options;
  validateFigure(KIND, options);
  const format = valueFormat(options);
  const { terms } = stringsFor(options.strings);
  const percent = numberFormat({
    ...(options.locale ? { locale: options.locale } : {}),
    style: "percent",
    maximumFractionDigits: 1,
  });
  const valueLabel = options.valueLabel ?? value;
  const directed = options.directed ?? true;
  const { links, names } = readLinks(KIND, data, from, to, value);
  if (names.length > 8)
    throw new Error(
      `${KIND}: ${names.length} groups, but a chord diagram draws at most 8; ${ADVICE}`,
    );
  const plan = planSeries(KIND, names, options.colors);
  const n = names.length;
  const at = new Map(names.map((name, i) => [name, i]));
  // matrix[i][j]: what group i sends group j.
  const matrix = names.map(() => names.map(() => 0));
  for (const l of links) {
    const i = at.get(l.source) as number;
    const j = at.get(l.target) as number;
    (matrix[i] as number[])[j] = l.value;
    if (!directed && i !== j) {
      if ((matrix[j] as number[])[i]) {
        throw new Error(
          `${KIND}: ${l.source} and ${l.target} are given twice; undirected flows are given once a pair`,
        );
      }
      (matrix[j] as number[])[i] = l.value;
    }
  }
  const sums = matrix.map((row) => row.reduce((a, b) => a + b, 0));
  const total = sums.reduce((a, b) => a + b, 0);
  if (!(total > 0)) throw new Error(`${KIND}: every flow is zero`);

  const width = options.width ?? DEFAULT_WIDTH;
  const growth = textGrowth(width);
  const char = charWidth(width);
  const span = 2 * Math.PI - PAD * n;

  // Each group's arc, and within it each subgroup (what it sends each other group), in group order.
  const groups: { a0: number; a1: number }[] = [];
  const sub = names.map(() => names.map(() => ({ a0: 0, a1: 0 })));
  let angle = 0;
  for (let i = 0; i < n; i += 1) {
    const a0 = angle;
    for (let j = 0; j < n; j += 1) {
      const sweep = (((matrix[i] as number[])[j] as number) / total) * span;
      ((sub[i] as { a0: number; a1: number }[])[j] as { a0: number; a1: number }).a0 = angle;
      angle += sweep;
      ((sub[i] as { a0: number; a1: number }[])[j] as { a0: number; a1: number }).a1 = angle;
    }
    groups.push({ a0, a1: angle });
    angle += PAD;
  }

  const lineHeight = 14 * growth;
  const place = (h: number) =>
    rimLabels(
      names,
      groups.map((g) => (g.a0 + g.a1) / 2),
      { width, height: h, char, line: lineHeight, cap: Math.min(width, h) / 2 - 4 },
    );
  // Where the names at the rim keep the circle small (a phone), the default height shrinks to fit it.
  const fit = place(400);
  const height = options.height ?? Math.min(400, Math.ceil(2 * fit.radius + 2 * lineHeight + 32));
  const rim = options.height === undefined && height === 400 ? fit : place(height);
  const cx = width / 2;
  const cy = height / 2;
  const outer = Math.max(30, rim.radius);
  const inner = outer * (1 - BAND);

  const describeGroup = (i: number): string =>
    `${format(sums[i] as number)} (${percent((sums[i] as number) / total)})`;
  const arcs = names
    .map((name, i) => {
      const g = groups[i] as { a0: number; a1: number };
      if (g.a1 <= g.a0) return "";
      return el(
        "path",
        {
          d: arcPath(cx, cy, outer, inner, g.a0, g.a1),
          fill: `var(--enarratio-series-${i + 1})`,
          ...Object.fromEntries(
            datumAttributes({
              key: markKey("group", name),
              filter: { field: from, value: name },
              series: terms.group,
              column: i,
              row: 0,
              at: name,
              shown: describeGroup(i),
            }),
          ),
        },
        el("title", {}, text(`${name}: ${describeGroup(i)}`)),
      );
    })
    .join("");

  // A ribbon for each pair (and each group's flow to itself), from one subgroup to the other
  // through the middle, colored by the group that sends more.
  const ribbons: string[] = [];
  const pairs: { i: number; j: number }[] = [];
  for (let i = 0; i < n; i += 1) {
    for (let j = i; j < n; j += 1) {
      const there = (matrix[i] as number[])[j] as number;
      const back = (matrix[j] as number[])[i] as number;
      if (there + back === 0) continue;
      pairs.push({ i, j });
      const s = (sub[i] as { a0: number; a1: number }[])[j] as { a0: number; a1: number };
      const t = (sub[j] as { a0: number; a1: number }[])[i] as { a0: number; a1: number };
      const [sx0, sy0] = polar(cx, cy, inner, s.a0);
      const [sx1, sy1] = polar(cx, cy, inner, s.a1);
      const [tx0, ty0] = polar(cx, cy, inner, t.a0);
      const [tx1, ty1] = polar(cx, cy, inner, t.a1);
      const arc = (a0: number, a1: number, x: number, y: number): string =>
        `A${n2(inner)},${n2(inner)} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${n2(x)},${n2(y)}`;
      const d =
        i === j
          ? `M${n2(sx0)},${n2(sy0)}${arc(s.a0, s.a1, sx1, sy1)}Q${n2(cx)},${n2(cy)} ${n2(sx0)},${n2(sy0)}Z`
          : `M${n2(sx0)},${n2(sy0)}${arc(s.a0, s.a1, sx1, sy1)}Q${n2(cx)},${n2(cy)} ${n2(tx0)},${n2(ty0)}${arc(t.a0, t.a1, tx1, ty1)}Q${n2(cx)},${n2(cy)} ${n2(sx0)},${n2(sy0)}Z`;
      const lead = there >= back ? i : j;
      const [a, b] = [names[i] as string, names[j] as string];
      const words =
        i === j
          ? `${a} → ${a}: ${format(there)}`
          : directed
            ? `${a} → ${b}: ${format(there)}; ${b} → ${a}: ${format(back)}`
            : `${a} – ${b}: ${format(there)}`;
      ribbons.push(
        el(
          "path",
          {
            d,
            fill: `var(--enarratio-series-${lead + 1})`,
            ...Object.fromEntries(
              datumAttributes({
                key: markKey(a, b),
                filter: { field: from, value: names[lead] as string },
                series: terms.flows,
                column: pairs.length - 1,
                row: 0,
                // A two-way ribbon's card is its whole description, both directions.
                ...(directed && i !== j
                  ? {}
                  : { at: i === j ? a : `${a} – ${b}`, shown: format(there) }),
              }),
            ),
          },
          el("title", {}, text(words)),
        ),
      );
    }
  }

  const labels = names
    .map((name, i) => {
      const p = rim.labels[i] as RimLabel;
      return el("text", { x: n2(p.x), y: n2(p.y), dy: p.dy, "text-anchor": p.anchor }, text(name));
    })
    .join("");

  const svg = texture(
    svgRoot(
      width,
      height,
      options.alt,
      "img",
      [
        el("g", { "data-enarratio-mark": "ribbon", "fill-opacity": 0.55 }, ribbons.join("")),
        el(
          "g",
          {
            "data-enarratio-mark": "arc",
            stroke: "var(--enarratio-background)",
            "stroke-width": 1,
          },
          arcs,
        ),
        el(
          "g",
          {
            "data-enarratio-mark": "arc label",
            "aria-hidden": "true",
            "pointer-events": "none",
            fill: "var(--enarratio-text)",
          },
          labels,
        ),
      ].join(""),
    ),
    JSON.stringify(options.colors ?? {}),
  );

  const corner = directed ? `${terms.source} \\ ${terms.target}` : terms.group;
  return figure(options, {
    kind: KIND,
    svg,
    description: {
      format,
      series: [
        {
          name: valueLabel,
          points: links.map((l) => ({ at: `${l.source} → ${l.target}`, value: l.value })),
        },
      ],
    },
    legend: plan.legend,
    slotColors: plan.slotColors,
    table: {
      columns: [corner, ...names, terms.total],
      rows: names.map((name, i) => [
        name,
        ...names.map((_, j) => format((matrix[i] as number[])[j] as number)),
        format(sums[i] as number),
      ]),
    },
  });
}
