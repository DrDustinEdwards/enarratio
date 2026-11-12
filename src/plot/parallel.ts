import { el, svgRoot, text } from "../lite/svg.js";
import { n2 } from "../render/arc.js";
import {
  type KeysOfType,
  markKey,
  type MeasuresOptions,
  maxOf,
  minOf,
  readLabel,
  readNumber,
} from "../render/data.js";
import { datumAttributes } from "../render/datum.js";
import { spreadLabels } from "../render/direct-labels.js";
import { figure, validateFigure } from "../render/figure.js";
import { planSeries } from "../render/series.js";
import { charWidth, DEFAULT_WIDTH, textGrowth } from "../render/size.js";
import { stringsFor, valueFormat } from "../render/text.js";

/** Options for {@link parallelCoordinates}. */
export interface ParallelCoordinatesOptions<T extends object> extends MeasuresOptions<T> {
  /**
   * The measures, one vertical axis each, left to right: three to twelve. Their order is the
   * chart's argument, since neighbors compare most easily; put measures that relate side by side.
   */
  readonly axes: readonly KeysOfType<T, number>[];
  /** A field grouping items, each group in a color (eight at most). */
  readonly series?: KeysOfType<T, string | number>;
  /**
   * Items to bring forward, by name: drawn last in full color and named at the right, the rest
   * faded. A static drawing cannot brush, so this is how it points at the lines that matter.
   */
  readonly highlight?: readonly string[];
}

const KIND = "parallel";
/** Past this many lines, only highlighted ones are named. */
const NAMED = 10;

/**
 * Parallel coordinates: many items over several measures, one vertical axis per measure, each
 * from its lowest value to its highest, and each item a line across them, for patterns across
 * measures (cars by price, power and mileage; samples by marker levels). Lines that run parallel
 * between two neighbors show the measures rising together; lines that cross, the one falling as
 * the other rises. Groups take colors, `highlight` brings items forward and fades the rest, and up
 * to ten lines (or the highlighted ones) are named at the right. Every value is in the data table.
 *
 * @example
 * parallelCoordinates({ data: cars, label: "model", axes: ["price", "power", "mpg"], alt: "..." });
 */
export function parallelCoordinates<T extends object>(
  options: ParallelCoordinatesOptions<T>,
): string {
  const { data, label, axes } = options;
  validateFigure(KIND, options, data);
  if (axes.length < 3 || axes.length > 12) {
    throw new Error(`${KIND}: ${axes.length} axes; parallel coordinates need 3 to 12`);
  }
  const format = valueFormat(options);
  const strings = stringsFor(options.strings);
  const names = data.map((row, i) => readLabel(KIND, row, label, i));
  if (new Set(names).size !== names.length) throw new Error(`${KIND}: two rows share a name`);
  const values = data.map((row, i) => axes.map((field) => readNumber(KIND, row, field, i)));
  const groups = options.series
    ? data.map((row, i) => readLabel(KIND, row, options.series as string, i))
    : null;
  const plan = planSeries(KIND, groups ? [...new Set(groups)] : [], options.colors);
  const highlight = new Set(options.highlight ?? []);
  for (const h of highlight) {
    if (!names.includes(h))
      throw new Error(`${KIND}: highlight names "${h}", which is not an item`);
  }
  const axisName = (field: string): string =>
    (options.axisLabels as Readonly<Record<string, string>> | undefined)?.[field] ?? field;
  const extents = axes.map((_, k) => {
    const column = values.map((v) => v[k] as number);
    return [minOf(column), maxOf(column)] as const;
  });

  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? 360;
  const growth = textGrowth(width);
  const char = charWidth(width);
  const lineHeight = 14 * growth;
  const named = names.filter(
    (n) => highlight.has(n) || (highlight.size === 0 && names.length <= NAMED),
  );
  const labelRoom = named.length > 0 ? Math.max(...named.map((n) => n.length)) * char + 10 : 0;
  const valueWidth = (k: number): number => {
    const [lo, hi] = extents[k] as readonly [number, number];
    return Math.max(format(lo).length, format(hi).length) * char;
  };
  const left = valueWidth(0) / 2 + 6;
  const right = width - Math.max(valueWidth(axes.length - 1) / 2 + 6, labelRoom + 8);
  // Axis names that collide alternate between two lines; any that still collide with the next
  // name on their line lose characters from the longer of the two. The first and last align with
  // the plot's edges.
  const xOf = (k: number): number => left + (k / (axes.length - 1)) * (right - left);
  const anchorOf = (k: number): "start" | "end" | "middle" =>
    k === 0 ? "start" : k === axes.length - 1 ? "end" : "middle";
  const nameX = (k: number): number =>
    k === 0
      ? xOf(k) - valueWidth(k) / 2
      : k === axes.length - 1
        ? xOf(k) + valueWidth(k) / 2
        : xOf(k);
  const span = (k: number, chars: number): [number, number] => {
    const w = chars * char;
    const a = anchorOf(k);
    const x = nameX(k);
    return a === "start" ? [x, x + w] : a === "end" ? [x - w, x] : [x - w / 2, x + w / 2];
  };
  const lengths = axes.map((f) => axisName(f).length);
  const clash = (k: number, step: number): boolean =>
    span(k, lengths[k] as number)[1] + 8 > span(k + step, lengths[k + step] as number)[0];
  const stagger = axes.some((_, k) => k + 1 < axes.length && clash(k, 1));
  const step = stagger ? 2 : 1;
  for (let k = 0; k + step < axes.length; k++) {
    while (clash(k, step) && Math.max(lengths[k] as number, lengths[k + step] as number) > 2) {
      const longer = (lengths[k] as number) >= (lengths[k + step] as number) ? k : k + step;
      lengths[longer] = (lengths[longer] as number) - 1;
    }
  }
  const cut = (k: number, name: string): string =>
    name.length <= (lengths[k] as number)
      ? name
      : `${name.slice(0, Math.max(1, (lengths[k] as number) - 1)).trimEnd()}…`;
  const top = lineHeight * (stagger ? 3 : 2) + 6;
  const bottom = height - lineHeight - 6;
  const yOf = (k: number, v: number): number => {
    const [lo, hi] = extents[k] as readonly [number, number];
    return hi === lo ? (top + bottom) / 2 : bottom - ((v - lo) / (hi - lo)) * (bottom - top);
  };
  const colorOf = (i: number): string =>
    groups
      ? `var(--enarratio-series-${plan.slot(groups[i] as string)})`
      : "var(--enarratio-series-1)";
  const describe = (i: number): string =>
    `${names[i]}: ${axes.map((f, k) => `${axisName(f)} ${format(values[i]?.[k] ?? 0)}`).join(", ")}`;

  const axisLines = axes
    .map((_, k) => el("line", { x1: n2(xOf(k)), x2: n2(xOf(k)), y1: n2(top), y2: n2(bottom) }))
    .join("");
  const axisText = axes
    .map((field, k) =>
      [
        el(
          "text",
          {
            x: n2(nameX(k)),
            y: n2(top - lineHeight * (stagger && k % 2 === 0 ? 2 : 1) - 6),
            "font-weight": "600",
            fill: "var(--enarratio-text)",
            "text-anchor": anchorOf(k) === "middle" ? undefined : anchorOf(k),
          },
          text(cut(k, axisName(field))),
        ),
        el(
          "text",
          { x: n2(xOf(k)), y: n2(top - 6) },
          text(format((extents[k] as readonly [number, number])[1])),
        ),
        el(
          "text",
          { x: n2(xOf(k)), y: n2(bottom + lineHeight) },
          text(format((extents[k] as readonly [number, number])[0])),
        ),
      ].join(""),
    )
    .join("");

  // Faded lines first, then the rest, so highlighted items are drawn on top.
  const order = names
    .map((_, i) => i)
    .sort(
      (a, b) =>
        Number(highlight.has(names[a] as string)) - Number(highlight.has(names[b] as string)),
    );
  const lines = order
    .map((i) => {
      const faded = highlight.size > 0 && !highlight.has(names[i] as string);
      const d = `M${axes.map((_, k) => `${n2(xOf(k))},${n2(yOf(k, values[i]?.[k] ?? 0))}`).join("L")}`;
      return el(
        "path",
        {
          d,
          stroke: faded ? "var(--enarratio-text-muted)" : colorOf(i),
          "stroke-opacity": faded ? 0.35 : undefined,
          "stroke-width": faded ? 1 : 2,
          ...Object.fromEntries(
            datumAttributes({
              key: markKey(names[i] as string),
              ...(groups
                ? {
                    filter: { field: options.series as string, value: groups[i] as string },
                    series: groups[i] as string,
                  }
                : {}),
              column: i,
              row: 0,
            }),
          ),
        },
        el("title", {}, text(describe(i))),
      );
    })
    .join("");

  const labeled = names.flatMap((n, i) => (named.includes(n) ? [i] : []));
  // Kept below the top value's label and above the bottom one's, which share the last axis.
  const ys = spreadLabels(
    labeled.map((i) =>
      Math.min(
        bottom - lineHeight * 0.5,
        Math.max(top + lineHeight * 0.6, yOf(axes.length - 1, values[i]?.[axes.length - 1] ?? 0)),
      ),
    ),
    width,
  );
  const ends = labeled
    .map((i, k) =>
      el(
        "text",
        { x: n2(right + 8), y: n2(ys[k] ?? 0), dy: "0.32em", fill: colorOf(i) },
        text(names[i] as string),
      ),
    )
    .join("");

  const svg = svgRoot(
    width,
    height,
    options.alt,
    "img",
    [
      el(
        "g",
        { "data-enarratio-mark": "axis grid", stroke: "var(--enarratio-text-muted)" },
        axisLines,
      ),
      el("g", { "data-enarratio-mark": "line", fill: "none", "stroke-linejoin": "round" }, lines),
      el(
        "g",
        {
          "data-enarratio-mark": "axis tick label",
          "aria-hidden": "true",
          fill: "var(--enarratio-text-muted)",
        },
        axisText,
      ),
      el(
        "g",
        { "data-enarratio-mark": "line label", "aria-hidden": "true", "text-anchor": "start" },
        ends,
      ),
    ].join(""),
  );

  const sentence = axes
    .map((field, k) => {
      let hi = 0;
      let lo = 0;
      values.forEach((v, i) => {
        if ((v[k] as number) > (values[hi]?.[k] as number)) hi = i;
        if ((v[k] as number) < (values[lo]?.[k] as number)) lo = i;
      });
      if (hi === lo) return "";
      return strings.spread(
        axisName(field),
        { at: names[hi] as string, value: format(values[hi]?.[k] as number) },
        { at: names[lo] as string, value: format(values[lo]?.[k] as number) },
      );
    })
    .filter(Boolean)
    .join(" ");
  return figure(options, {
    kind: KIND,
    svg,
    limits: { points: 200, advice: "highlight the lines that matter, or show a sample" },
    description: { sentence },
    ...(groups ? { legend: plan.legend, seriesField: options.series as string } : {}),
    slotColors: plan.slotColors,
    table: {
      columns: [label, ...(groups ? [options.series as string] : []), ...axes.map(axisName)],
      rows: names.map((n, i) => [
        n,
        ...(groups ? [groups[i] as string] : []),
        ...(values[i] ?? []).map(format),
      ]),
    },
  });
}
