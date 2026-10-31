import { el, svgRoot, text } from "../lite/svg.js";
import { type KeysOfType, markKey, readLabel, readNumber } from "../render/data.js";
import { datumAttributes } from "../render/datum.js";
import { type FigureOptions, figure, type SeriesColor, validateFigure } from "../render/figure.js";
import { planSeries } from "../render/series.js";
import { DEFAULT_HEIGHT, DEFAULT_WIDTH } from "../render/size.js";
import { numberFormat, stringsFor, valueFormat } from "../render/text.js";

/** Options for {@link pieChart}. */
export interface PieChartOptions<T extends object> extends FigureOptions {
  readonly data: readonly T[];
  /** The field naming each slice. */
  readonly label: KeysOfType<T, string | number>;
  /** The field for each slice's size: zero or more. */
  readonly value: KeysOfType<T, number>;
  /** Draw a ring with a hole (a donut) instead of a full pie. */
  readonly donut?: boolean;
  /** Text in the donut's hole, such as the total ("1,284 responses"). */
  readonly centerLabel?: string;
  readonly colors?: Readonly<Record<string, SeriesColor>>;
  readonly formatValue?: (value: number) => string;
}

interface Slice {
  readonly name: string;
  readonly value: number;
  readonly share: number;
  readonly start: number;
  readonly end: number;
  readonly index: number;
}

const KIND = "pieChart";

/** The most slices a pie reads at: beyond this, angles are too close to compare (an issue). */
const MAX_SLICES = 6;
/** The most slices a pie draws at all: one color each from the theme's eight. */
const HARD_CAP = 8;
const ADVICE = 'draw a bar chart, or group the smallest into "Other"';

/** A point at an angle (0 at 12 o'clock, clockwise) and radius from the center. */
const polar = (cx: number, cy: number, r: number, angle: number): [number, number] => [
  cx + r * Math.sin(angle),
  cy - r * Math.cos(angle),
];

const n2 = (v: number): number => Math.round(v * 100) / 100;

function arcPath(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  a0: number,
  a1: number,
): string {
  // A whole circle is two half arcs: one arc cannot start and end at the same point.
  if (a1 - a0 >= 2 * Math.PI - 1e-9) {
    const ring = (r: number, sweep: 0 | 1): string => {
      const [x0, y0] = polar(cx, cy, r, 0);
      const [x1, y1] = polar(cx, cy, r, Math.PI);
      return `M${n2(x0)},${n2(y0)}A${r},${r} 0 1 ${sweep} ${n2(x1)},${n2(y1)}A${r},${r} 0 1 ${sweep} ${n2(x0)},${n2(y0)}Z`;
    };
    return inner > 0 ? `${ring(outer, 1)}${ring(inner, 0)}` : ring(outer, 1);
  }
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [ox0, oy0] = polar(cx, cy, outer, a0);
  const [ox1, oy1] = polar(cx, cy, outer, a1);
  const start = `M${n2(ox0)},${n2(oy0)}A${outer},${outer} 0 ${large} 1 ${n2(ox1)},${n2(oy1)}`;
  if (inner <= 0) return `${start}L${n2(cx)},${n2(cy)}Z`;
  const [ix1, iy1] = polar(cx, cy, inner, a1);
  const [ix0, iy0] = polar(cx, cy, inner, a0);
  return `${start}L${n2(ix1)},${n2(iy1)}A${inner},${inner} 0 ${large} 0 ${n2(ix0)},${n2(iy0)}Z`;
}

/** Moves labels on one side of the pie apart so no two are closer than `gap`, in place. */
function separate(labels: { y: number }[], gap: number, top: number, bottom: number): void {
  labels.sort((a, b) => a.y - b.y);
  for (let k = 1; k < labels.length; k += 1) {
    const prev = labels[k - 1] as { y: number };
    const cur = labels[k] as { y: number };
    if (cur.y - prev.y < gap) cur.y = prev.y + gap;
  }
  const last = labels[labels.length - 1];
  if (last && last.y > bottom) {
    const shift = last.y - bottom;
    for (const l of labels) l.y -= shift;
  }
  const first = labels[0];
  if (first && first.y < top) {
    const shift = top - first.y;
    for (const l of labels) l.y += shift;
  }
}

/**
 * A pie or donut chart of the parts of one whole, for at most six parts: past that, angles are
 * too close to compare, so seven or eight slices are reported as an issue (thrown when
 * `strict`) and more than eight throw, suggesting a bar chart or an "Other" slice. Slices start
 * at 12 o'clock and run clockwise in data order, separated by a gap, and each is labeled outside
 * the pie with its name and share, so slices are told apart by text, not only by color.
 *
 * @example
 * pieChart({ data: replies, label: "answer", value: "count", donut: true, alt: "..." });
 */
export function pieChart<T extends object>(options: PieChartOptions<T>): string {
  const { data, label, value } = options;
  validateFigure(KIND, options);
  if (data.length === 0) throw new Error(`${KIND}: data is empty`);
  if (data.length > HARD_CAP) {
    throw new Error(
      `${KIND}: ${data.length} slices, but a pie reads at ${MAX_SLICES} or fewer and draws at most ${HARD_CAP}; ${ADVICE}`,
    );
  }
  const format = valueFormat(options);
  const { terms } = stringsFor(options.strings);
  const percent = numberFormat({
    ...(options.locale ? { locale: options.locale } : {}),
    style: "percent",
    maximumFractionDigits: 1,
  });
  const names = data.map((row, i) => readLabel(KIND, row, label, i));
  if (new Set(names).size !== names.length) throw new Error(`${KIND}: two slices share a name`);
  const values = data.map((row, i) => {
    const v = readNumber(KIND, row, value, i);
    if (v < 0) throw new Error(`${KIND}: row ${i + 1} value is ${v}; a slice cannot be negative`);
    return v;
  });
  const total = values.reduce((a, b) => a + b, 0);
  if (!(total > 0))
    throw new Error(`${KIND}: the values add up to zero; there is no whole to divide`);
  const plan = planSeries(KIND, names, options.colors);
  let angle = 0;
  const slices = names.map((name, index): Slice => {
    const share = (values[index] as number) / total;
    const start = angle;
    angle += share * 2 * Math.PI;
    return { name, value: values[index] as number, share, start, end: angle, index };
  });

  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? DEFAULT_HEIGHT;
  const cx = width / 2;
  const cy = height / 2;
  // Room beside the pie for the longest label, at about 7 pixels a character.
  const room = Math.max(...slices.map((s) => `${s.name} ${percent(s.share)}`.length)) * 7 + 36;
  const outer = Math.max(20, Math.min(height / 2 - 24, width / 2 - room));
  const inner = options.donut ? outer * 0.58 : 0;
  const describe = (s: Slice): string => `${s.name}: ${format(s.value)} (${percent(s.share)})`;

  const paths = slices
    .filter((s) => s.value > 0)
    .map((s) =>
      el(
        "path",
        {
          d: arcPath(cx, cy, outer, inner, s.start, s.end),
          fill: plan.range[s.index],
          ...Object.fromEntries(
            datumAttributes({
              key: markKey(s.name),
              filter: { field: label, value: s.name },
              x: s.name,
              series: s.name,
              column: s.index,
              row: 0,
            }),
          ),
        },
        el("title", {}, text(describe(s))),
      ),
    )
    .join("");

  // Labels outside the pie, left or right of it by where the slice's middle points, joined to
  // their slice by a leader line.
  const placed = slices.map((s) => {
    const mid = (s.start + s.end) / 2;
    const [ax, ay] = polar(cx, cy, outer, mid);
    const [bx, by] = polar(cx, cy, outer + 12, mid);
    return { s, mid, ax, ay, bx, by, right: Math.sin(mid) >= 0, y: by };
  });
  for (const right of [true, false]) {
    separate(
      placed.filter((p) => p.right === right),
      16,
      10,
      height - 10,
    );
  }
  const labels = placed
    .map((p) => {
      const tx = p.right ? cx + outer + 24 : cx - outer - 24;
      return [
        el("path", {
          d: `M${n2(p.ax)},${n2(p.ay)}L${n2(p.bx)},${n2(p.by)}L${n2(tx + (p.right ? -4 : 4))},${n2(p.y)}`,
          fill: "none",
          stroke: "var(--enarratio-text-muted)",
        }),
        el(
          "text",
          { x: n2(tx), y: n2(p.y), dy: "0.32em", "text-anchor": p.right ? "start" : "end" },
          text(`${p.s.name} ${percent(p.s.share)}`),
        ),
      ].join("");
    })
    .join("");
  const center =
    options.donut && options.centerLabel
      ? el(
          "text",
          { x: n2(cx), y: n2(cy), dy: "0.32em", "font-weight": "600" },
          text(options.centerLabel),
        )
      : "";
  const svg = svgRoot(
    width,
    height,
    options.alt,
    "img",
    [
      el(
        "g",
        {
          "data-enarratio-mark": "slice",
          // A gap in the background color between slices, so neighbors never merge.
          stroke: "var(--enarratio-background)",
          "stroke-width": 2,
          "stroke-linejoin": "round",
        },
        paths,
      ),
      el("g", { "data-enarratio-mark": "slice label", "aria-hidden": "true" }, labels),
      center,
    ].join(""),
  );
  return figure(options, {
    kind: "pie",
    svg,
    // Slices are the points of one series; past six, the figure reports it (B21).
    limits: { points: MAX_SLICES, advice: ADVICE },
    description: {
      format: percent,
      series: [{ name: value, points: slices.map((s) => ({ at: s.name, value: s.share })) }],
    },
    legend: plan.legend,
    slotColors: plan.slotColors,
    table: {
      columns: [label, value, terms.share],
      rows: [
        ...slices.map((s) => [s.name, format(s.value), percent(s.share)]),
        [terms.total, format(total), percent(1)],
      ],
    },
  });
}
