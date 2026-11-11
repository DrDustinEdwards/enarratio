import { el, svgRoot, text } from "../lite/svg.js";
import { n2 } from "../render/arc.js";
import {
  type KeysOfType,
  markKey,
  readLabel,
  readNumber,
  readNumberOrNull,
} from "../render/data.js";
import { datumAttributes } from "../render/datum.js";
import { type FigureOptions, figure, validateFigure } from "../render/figure.js";
import { charWidth, DEFAULT_WIDTH, textGrowth } from "../render/size.js";
import { stringsFor, valueFormat } from "../render/text.js";
import { checkBands, type QualitativeBand, shade } from "./gauge.js";
import { niceCeil } from "./radar.js";

/** Options for {@link bulletChart}. */
export interface BulletChartOptions<T extends object> extends FigureOptions {
  /** One row per measure. */
  readonly data: readonly T[];
  /** The field naming each measure. */
  readonly label: KeysOfType<T, string | number>;
  /** The field for the measure's value: the bar. */
  readonly value: KeysOfType<T, number>;
  /** The field for its target, marked by a line across the bar; null or missing for none. */
  readonly target?: KeysOfType<T, number | null | undefined>;
  /**
   * Two to five qualitative bands behind the bar, ascending from zero, the last ending at the
   * scale's end: the same for every row, or a function giving each row's own.
   */
  readonly bands?: readonly QualitativeBand[] | ((row: T) => readonly QualitativeBand[]);
  /** Whether low values are good, which reverses the bands' shading (dark is always worse). */
  readonly lowerIsBetter?: boolean;
  /**
   * Each row's scale end, by field; else the last band's end, else the larger of value and target
   * rounded up. Rows have scales of their own unless `sharedScale`.
   */
  readonly max?: KeysOfType<T, number>;
  /** One scale for every row, ending at the largest row's end. */
  readonly sharedScale?: boolean;
  /** What the value measures, for the table and hover details (default: the field's name). */
  readonly valueLabel?: string;
  readonly formatValue?: (value: number) => string;
}

const KIND = "bullet";

interface Row {
  readonly name: string;
  readonly value: number;
  readonly target: number | null;
  readonly bands: readonly QualitativeBand[];
  end: number;
}

/**
 * A bullet chart (Few 2013): one row per measure, each a bar for its value, a line across it for
 * the target, and behind it two to five qualitative bands in one hue, darkest for the worst, so a
 * row reads as "value against target, in this band" without color. Rows stack in little room, and
 * each has its own scale from zero unless `sharedScale`; three tick labels mark it. The value is
 * printed at the row's end, and the data table gives value, target and band.
 *
 * @example
 * bulletChart({ data: kpis, label: "measure", value: "actual", target: "goal", alt: "..." });
 */
export function bulletChart<T extends object>(options: BulletChartOptions<T>): string {
  const { data, label, value } = options;
  validateFigure(KIND, options);
  if (data.length === 0) throw new Error(`${KIND}: data is empty`);
  const format = valueFormat(options);
  const { terms } = stringsFor(options.strings);
  const valueLabel = options.valueLabel ?? value;
  const rows: Row[] = data.map((row, i) => {
    const name = readLabel(KIND, row, label, i);
    const v = readNumber(KIND, row, value, i);
    if (v < 0)
      throw new Error(`${KIND}: row ${i + 1} value is ${v}; a bullet's scale starts at zero`);
    const t = options.target === undefined ? null : readNumberOrNull(KIND, row, options.target, i);
    const bands = typeof options.bands === "function" ? options.bands(row) : (options.bands ?? []);
    const given = options.max === undefined ? undefined : readNumber(KIND, row, options.max, i);
    const end = given ?? bands.at(-1)?.to ?? niceCeil(Math.max(v, t ?? 0));
    if (bands.length > 0) checkBands(`${KIND} row ${i + 1}`, bands, 0, end);
    if (v > end || (t !== null && t > end)) {
      throw new Error(`${KIND}: row ${i + 1} passes its scale's end (${end})`);
    }
    return { name, value: v, target: t, bands, end };
  });
  if (new Set(rows.map((r) => r.name)).size !== rows.length) {
    throw new Error(`${KIND}: two rows share a name`);
  }
  if (options.sharedScale) {
    const end = Math.max(...rows.map((r) => r.end));
    for (const r of rows) {
      if (r.bands.length > 0 && r.end !== end) {
        throw new Error(`${KIND}: a shared scale needs every row's bands to end at ${end}`);
      }
      r.end = end;
    }
  }

  const width = options.width ?? DEFAULT_WIDTH;
  const growth = textGrowth(width);
  const char = charWidth(width);
  const band = 20 * growth;
  const tickLine = 14 * growth;
  const gap = 12 * growth;
  const longest = Math.max(...rows.map((r) => r.name.length)) * char + 14;
  const stacked = longest > width * 0.35;
  const nameLine = stacked ? 16 * growth : 0;
  const pitch = nameLine + band + tickLine + gap;
  const height = options.height ?? Math.ceil(rows.length * pitch + 4);
  const valueRoom = Math.max(...rows.map((r) => format(r.value).length)) * char + 10;
  const left = stacked ? 4 : longest;
  const plotWidth = Math.max(40, width - left - valueRoom - 4);
  const top = (i: number): number => 4 + i * pitch + nameLine;
  const xOf = (r: Row, v: number): number => left + (v / r.end) * plotWidth;
  const band3 = (r: Row): QualitativeBand | undefined => r.bands.find((b) => r.value <= b.to);

  const ranges = rows
    .map((r, i) => {
      let from = 0;
      return r.bands
        .map((b, k) => {
          const x0 = xOf(r, from);
          from = b.to;
          return el("rect", {
            x: n2(x0),
            y: n2(top(i)),
            width: n2(xOf(r, b.to) - x0),
            height: n2(band),
            fill: `var(--enarratio-sequential-${shade(k, r.bands.length, options.lowerIsBetter)})`,
          });
        })
        .join("");
    })
    .join("");
  const shown = (r: Row): string =>
    r.target === null
      ? format(r.value)
      : `${format(r.value)} (${terms.targetValue} ${format(r.target)})`;
  const bars = rows
    .map((r, i) => {
      const b = band3(r);
      return el(
        "rect",
        {
          x: n2(left),
          y: n2(top(i) + band / 3),
          width: n2(Math.max(1, xOf(r, r.value) - left)),
          height: n2(band / 3),
          fill: "var(--enarratio-text)",
          ...Object.fromEntries(
            datumAttributes({
              key: markKey(r.name),
              x: r.name,
              column: i,
              row: 0,
              at: r.name,
              shown: b ? `${shown(r)}, ${b.label}` : shown(r),
            }),
          ),
        },
        el("title", {}, text(`${r.name}: ${shown(r)}${b ? `, ${b.label}` : ""}`)),
      );
    })
    .join("");
  const targets = rows
    .map((r, i) =>
      r.target === null
        ? ""
        : el("line", {
            x1: n2(xOf(r, r.target)),
            x2: n2(xOf(r, r.target)),
            y1: n2(top(i) + band * 0.15),
            y2: n2(top(i) + band * 0.85),
          }),
    )
    .join("");
  const names = rows
    .map((r, i) =>
      stacked
        ? el("text", { x: n2(left), y: n2(top(i) - 5), "text-anchor": "start" }, text(r.name))
        : el(
            "text",
            { x: n2(left - 10), y: n2(top(i) + band / 2), dy: "0.32em", "text-anchor": "end" },
            text(r.name),
          ),
    )
    .join("");
  const values = rows
    .map((r, i) =>
      el(
        "text",
        {
          x: n2(left + plotWidth + 8),
          y: n2(top(i) + band / 2),
          dy: "0.32em",
          "font-weight": "600",
        },
        text(format(r.value)),
      ),
    )
    .join("");
  const ticks = rows
    .map((r, i) =>
      [0, r.end / 2, r.end]
        .map((v, k) =>
          el(
            "text",
            {
              x: n2(xOf(r, v)),
              y: n2(top(i) + band + tickLine * 0.85),
              "text-anchor": k === 0 ? "start" : k === 2 ? "end" : "middle",
            },
            text(format(v)),
          ),
        )
        .join(""),
    )
    .join("");

  const svg = svgRoot(
    width,
    height,
    options.alt,
    "img",
    [
      el("g", { "data-enarratio-mark": "band", "aria-hidden": "true" }, ranges),
      el("g", { "data-enarratio-mark": "bar" }, bars),
      el(
        "g",
        {
          "data-enarratio-mark": "target",
          "aria-hidden": "true",
          stroke: "var(--enarratio-text)",
          "stroke-width": 3,
        },
        targets,
      ),
      el(
        "g",
        {
          "data-enarratio-mark": "y-axis tick label",
          "aria-hidden": "true",
          fill: "var(--enarratio-text)",
        },
        names,
      ),
      el(
        "g",
        {
          "data-enarratio-mark": "bar label",
          "aria-hidden": "true",
          "text-anchor": "start",
          fill: "var(--enarratio-text)",
        },
        values,
      ),
      el(
        "g",
        {
          "data-enarratio-mark": "x-axis tick label",
          "aria-hidden": "true",
          fill: "var(--enarratio-text-muted)",
        },
        ticks,
      ),
    ].join(""),
  );

  const withTargets = rows.some((r) => r.target !== null);
  const withBands = rows.some((r) => r.bands.length > 0);
  return figure(options, {
    kind: KIND,
    svg,
    orientation: "horizontal",
    description: {
      format,
      series: [{ name: valueLabel, points: rows.map((r) => ({ at: r.name, value: r.value })) }],
    },
    table: {
      columns: [
        label,
        valueLabel,
        ...(withTargets ? [terms.targetValue] : []),
        ...(withBands ? [terms.band] : []),
        terms.maximum,
      ],
      rows: rows.map((r) => [
        r.name,
        format(r.value),
        ...(withTargets ? [r.target === null ? "" : format(r.target)] : []),
        ...(withBands ? [band3(r)?.label ?? ""] : []),
        format(r.end),
      ]),
    },
  });
}
