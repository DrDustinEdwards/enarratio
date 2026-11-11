import { el, svgRoot, text } from "../lite/svg.js";
import { arcPath, n2, polar } from "../render/arc.js";
import { type KeysOfType, markKey, readLabel, readNumber } from "../render/data.js";
import { datumAttributes } from "../render/datum.js";
import { type FigureOptions, figure, type SeriesColor, validateFigure } from "../render/figure.js";
import { planSeries } from "../render/series.js";
import { charWidth, cutText, DEFAULT_HEIGHT, DEFAULT_WIDTH, textGrowth } from "../render/size.js";
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
  const char = charWidth(width);
  const labelText = (s: Slice): string => `${s.name} ${percent(s.share)}`;
  // Room beside the pie for the longest label, at about 7 pixels a character.
  const room = Math.max(...slices.map((s) => labelText(s).length)) * 7 + 36;
  // Where the labels beside the pie would leave it under 40 units across (a phone's drawing), they
  // are listed under it instead, each with a swatch of its slice's color, in the slices' clockwise
  // order from 12 o'clock (record 0041).
  const listed = width / 2 - room < 40;
  const line = 16 * textGrowth(width);
  const listHeight = listed ? slices.length * line + 12 : 0;
  const cx = width / 2;
  const cy = listed ? 8 + Math.min((width - 16) / 2, (height - listHeight - 16) / 2) : height / 2;
  const outer = listed
    ? Math.max(20, cy - 8)
    : Math.max(20, Math.min(height / 2 - 24, width / 2 - room));
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
  const listRoom = Math.max(4, Math.floor((width - 16 - 18) / char));
  const listTop = cy + outer + 12;
  const labels = listed
    ? slices
        .map((s, i) => {
          const y = listTop + i * line + line / 2;
          return [
            el("rect", {
              x: 8,
              y: n2(y - 5),
              width: 10,
              height: 10,
              rx: 2,
              fill: plan.range[s.index],
            }),
            el(
              "text",
              { x: 26, y: n2(y), dy: "0.32em", "text-anchor": "start" },
              text(cutText(labelText(s), listRoom)),
            ),
          ].join("");
        })
        .join("")
    : placed
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
              text(labelText(p.s)),
            ),
          ].join("");
        })
        .join("");
  // The center label sits on the hole, painted in the background color, with a halo of it where
  // the label is wider than the hole, so it is read, and measured, against the background (B1).
  const center =
    options.donut && options.centerLabel
      ? el("circle", {
          cx: n2(cx),
          cy: n2(cy),
          r: n2(Math.max(0, inner - 1)),
          fill: "var(--enarratio-background)",
          "aria-hidden": "true",
        }) +
        el(
          "text",
          {
            x: n2(cx),
            y: n2(cy),
            dy: "0.32em",
            "font-weight": "600",
            // A halo in the background color, for a label wider than the hole.
            stroke: "var(--enarratio-background)",
            "stroke-width": 4,
            "stroke-linejoin": "round",
            "paint-order": "stroke",
          },
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
