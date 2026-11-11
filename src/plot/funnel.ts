import { el, svgRoot, text } from "../lite/svg.js";
import { n2 } from "../render/arc.js";
import { type KeysOfType, markKey, maxOf, readLabel, readNumber } from "../render/data.js";
import { datumAttributes } from "../render/datum.js";
import { type FigureOptions, figure, validateFigure } from "../render/figure.js";
import { charWidth, DEFAULT_WIDTH, textGrowth } from "../render/size.js";
import { numberFormat, stringsFor, valueFormat } from "../render/text.js";

/** Options for {@link funnelChart}. */
export interface FunnelChartOptions<T extends object> extends FigureOptions {
  readonly data: readonly T[];
  /** The field naming each stage, in the order people pass through them. */
  readonly stage: KeysOfType<T, string | number>;
  /** The field for how many reached the stage: zero or more. */
  readonly value: KeysOfType<T, number>;
  /** What the value counts, for the table and hover details (default: the field's name). */
  readonly valueLabel?: string;
  readonly formatValue?: (value: number) => string;
}

const KIND = "funnel";
/** A stage's bar height, and the room between bars for the share that carried on. */
const BAR = 34;
const STEP_GAP = 22;

/**
 * A funnel: how many people (or orders, or samples) reached each stage of a process, as bars
 * centered on one axis, widest first. Each bar prints its count and its share of the first stage,
 * and the gap between two bars prints the share of the previous stage that carried on, so the
 * drop at each step reads as a number, not an angle. The data table holds both shares.
 *
 * @example
 * funnelChart({ data: signups, stage: "step", value: "people", alt: "..." });
 */
export function funnelChart<T extends object>(options: FunnelChartOptions<T>): string {
  const { data, stage, value } = options;
  validateFigure(KIND, options);
  if (data.length === 0) throw new Error(`${KIND}: data is empty`);
  const format = valueFormat(options);
  const { terms } = stringsFor(options.strings);
  const percent = numberFormat({
    ...(options.locale ? { locale: options.locale } : {}),
    style: "percent",
    maximumFractionDigits: 1,
  });
  const names = data.map((row, i) => readLabel(KIND, row, stage, i));
  if (new Set(names).size !== names.length) throw new Error(`${KIND}: two stages share a name`);
  const values = data.map((row, i) => {
    const v = readNumber(KIND, row, value, i);
    if (v < 0) throw new Error(`${KIND}: row ${i + 1} value is ${v}; a count cannot be negative`);
    return v;
  });
  const first = values[0] as number;
  if (!(first > 0))
    throw new Error(`${KIND}: the first stage is ${first}; a funnel starts above zero`);
  const max = maxOf(values);
  const valueLabel = options.valueLabel ?? value;
  const share = (i: number): number => (values[i] as number) / first;
  const carried = (i: number): number | null => {
    const prev = values[i - 1];
    return i > 0 && prev !== undefined && prev > 0 ? (values[i] as number) / prev : null;
  };

  const width = options.width ?? DEFAULT_WIDTH;
  const growth = textGrowth(width);
  const char = charWidth(width);
  const bar = BAR * growth;
  const gap = STEP_GAP * growth;
  // Stage names in a column left of the bars, or, when that column would take more than a third
  // of the drawing (a phone), on a line above each bar.
  const longest = Math.max(...names.map((n) => n.length)) * char + 16;
  const stacked = longest > width * 0.35;
  const nameLine = stacked ? 16 * growth : 0;
  const rows = names.length;
  const height = options.height ?? Math.ceil(rows * (nameLine + bar) + (rows - 1) * gap + 8);
  const pitch = rows > 1 ? (height - 8 - rows * (nameLine + bar)) / (rows - 1) : 0;
  const left = stacked ? 4 : longest;
  const plotWidth = width - left - (stacked ? 4 : 8);
  const mid = left + plotWidth / 2;
  const top = (i: number): number => 4 + i * (nameLine + bar + pitch) + nameLine;
  const shown = (i: number): string => `${format(values[i] as number)} (${percent(share(i))})`;

  const bars = names
    .map((name, i) => {
      const w = Math.max(1, ((values[i] as number) / max) * plotWidth);
      return el(
        "rect",
        {
          x: n2(mid - w / 2),
          y: n2(top(i)),
          width: n2(w),
          height: n2(bar),
          rx: 3,
          fill: "var(--enarratio-series-1)",
          ...Object.fromEntries(
            datumAttributes({
              key: markKey(name),
              x: name,
              column: i,
              row: 0,
              at: name,
              shown: shown(i),
            }),
          ),
        },
        el(
          "title",
          {},
          text(
            `${name}: ${format(values[i] as number)} ${valueLabel}, ${percent(share(i))} ${terms.ofFirst}`,
          ),
        ),
      );
    })
    .join("");

  const stageLabels = names
    .map((name, i) =>
      stacked
        ? el("text", { x: n2(mid), y: n2(top(i) - 5) }, text(name))
        : el("text", { x: n2(left - 12), y: n2(top(i) + bar / 2), dy: "0.32em" }, text(name)),
    )
    .join("");
  // The count and share inside the bar when they fit, else beside it: right of its end, or left
  // of its start when the right has no room.
  const valueLabels = names
    .map((_, i) => {
      const w = ((values[i] as number) / max) * plotWidth;
      const label = shown(i);
      const wide = label.length * char;
      const inside = wide + 12 <= w;
      const right = mid + w / 2 + 6 + wide <= width - 2;
      return el(
        "text",
        {
          x: n2(inside ? mid : right ? mid + w / 2 + 6 : mid - w / 2 - 6),
          y: n2(top(i) + bar / 2),
          dy: "0.32em",
          "text-anchor": inside ? "middle" : right ? "start" : "end",
          fill: inside ? "var(--enarratio-series-text-1)" : "var(--enarratio-text)",
        },
        text(label),
      );
    })
    .join("");
  const steps = names
    .map((_, i) => {
      const c = carried(i);
      if (c === null) return "";
      return el(
        "text",
        { x: n2(mid), y: n2(top(i) - nameLine - pitch / 2), dy: "0.32em" },
        text(`${percent(c)} ${terms.ofPrevious}`),
      );
    })
    .join("");

  const svg = svgRoot(
    width,
    height,
    options.alt,
    "img",
    [
      el("g", { "data-enarratio-mark": "bar" }, bars),
      el(
        "g",
        {
          "data-enarratio-mark": "y-axis tick label",
          "aria-hidden": "true",
          "text-anchor": stacked ? "middle" : "end",
          fill: "var(--enarratio-text)",
        },
        stageLabels,
      ),
      el(
        "g",
        { "data-enarratio-mark": "bar label", "aria-hidden": "true", "pointer-events": "none" },
        valueLabels,
      ),
      el(
        "g",
        {
          "data-enarratio-mark": "step label",
          "aria-hidden": "true",
          "pointer-events": "none",
          fill: "var(--enarratio-text-muted)",
        },
        steps,
      ),
    ].join(""),
  );

  return figure(options, {
    kind: KIND,
    svg,
    orientation: "horizontal",
    description: {
      ordered: true,
      format,
      axes: [{ position: "y", label: stage, from: names[0] ?? "", to: names.at(-1) ?? "" }],
      series: [
        { name: valueLabel, points: names.map((n, i) => ({ at: n, value: values[i] as number })) },
      ],
    },
    table: {
      columns: [stage, valueLabel, terms.shareOfFirst, terms.shareOfPrevious],
      rows: names.map((n, i) => {
        const c = carried(i);
        return [n, format(values[i] as number), percent(share(i)), c === null ? "" : percent(c)];
      }),
    },
  });
}
