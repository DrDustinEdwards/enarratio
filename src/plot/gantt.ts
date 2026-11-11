import * as Plot from "@observablehq/plot";
import {
  DAY,
  dateText,
  domainOf,
  type KeysOfType,
  markKey,
  maxOf,
  minOf,
  parseDateValue,
  readDate,
  readLabel,
} from "../render/data.js";
import { categoryRange } from "../render/describe.js";
import {
  type FigureOptions,
  figure,
  type SeriesColor,
  slotStyle,
  validateFigure,
} from "../render/figure.js";
import { keyed, renderPlot } from "../render/plot.js";
import { planSeries } from "../render/series.js";
import { charWidth, DEFAULT_WIDTH, textGrowth } from "../render/size.js";
import { numberFormat, stringsFor } from "../render/text.js";
import { texture } from "../render/texture.js";
import { named } from "./marks.js";

type When = Date | string | number;

/** Options for {@link ganttChart}. */
export interface GanttChartOptions<T extends object> extends FigureOptions {
  /** One row per task or milestone, drawn top to bottom in this order. */
  readonly data: readonly T[];
  /** The field naming each task. */
  readonly task: KeysOfType<T, string | number>;
  /** The field for when it starts: a Date, an ISO 8601 string or a timestamp. */
  readonly start: KeysOfType<T, When>;
  /** The field for when it ends. A row with no end, or one equal to its start, is a milestone. */
  readonly end?: KeysOfType<T, When | null | undefined>;
  /** A field grouping tasks (a team, a phase), each group in its own color with a legend. */
  readonly group?: KeysOfType<T, string>;
  readonly groupDomain?: readonly string[];
  readonly colors?: Readonly<Record<string, SeriesColor>>;
  /** A labeled line at this time: today, or the date the chart reports on. */
  readonly today?: When;
  /** The line's label (default "Today"). */
  readonly todayLabel?: string;
  /** The time axis title (default none: dates name themselves). */
  readonly xLabel?: string | null;
}

const KIND = "ganttChart";

interface Task {
  readonly i: number;
  readonly name: string;
  readonly group: string;
  readonly start: Date;
  /** Null for a milestone. */
  readonly end: Date | null;
}

/**
 * A Gantt chart: tasks as rows and bars running from start to end on a time axis, milestones as
 * diamonds, and a labeled line for today. Each task is named beside its bar, or above it on a
 * narrow drawing, and groups (teams, phases) take colors with a legend. Every bar and milestone is
 * reached by hover, focus and the keys, and the data table gives each task's start, end and length
 * in days.
 *
 * @example
 * ganttChart({ data: plan, task: "task", start: "from", end: "to", group: "team", alt: "..." });
 */
export function ganttChart<T extends object>(options: GanttChartOptions<T>): string {
  const { data } = options;
  validateFigure(KIND, options);
  if (data.length === 0) throw new Error(`${KIND}: data is empty`);
  const strings = stringsFor(options.strings);
  const { terms } = strings;
  const groupOf = (row: T, i: number): string =>
    options.group === undefined ? terms.task : readLabel(KIND, row, options.group, i);
  const groups = domainOf(
    KIND,
    options.group ?? "group",
    data.map((row, i) => groupOf(row, i)),
    options.groupDomain,
  );
  const tasks: Task[] = data.map((row, i) => {
    const start = readDate(KIND, row, options.start, i);
    const raw =
      options.end === undefined ? undefined : (row as Record<string, unknown>)[options.end];
    const end =
      raw === null || raw === undefined || raw === ""
        ? null
        : readDate(KIND, row, options.end as string, i);
    if (end !== null && end.getTime() < start.getTime()) {
      throw new Error(`${KIND}: row ${i + 1} ends before it starts`);
    }
    return {
      i,
      name: readLabel(KIND, row, options.task, i),
      group: groupOf(row, i),
      start,
      end: end !== null && end.getTime() === start.getTime() ? null : end,
    };
  });
  if (new Set(tasks.map((t) => t.name)).size !== tasks.length) {
    throw new Error(`${KIND}: two rows share a task name`);
  }
  const today = options.today === undefined ? undefined : parseDateValue(options.today);
  if (options.today !== undefined && !today) {
    throw new Error(`${KIND}: today is ${JSON.stringify(options.today)}, not a date`);
  }
  const plan = planSeries(KIND, groups, options.colors);
  const multi = options.group !== undefined;
  const times = tasks.flatMap((t) => [t.start, ...(t.end ? [t.end] : [])]);
  const dates = dateText([...times, ...(today ? [today] : [])], options.locale);
  const days = numberFormat({
    ...(options.locale ? { locale: options.locale } : {}),
    maximumFractionDigits: 1,
  });
  const length = (t: Task): number => (t.end ? (t.end.getTime() - t.start.getTime()) / DAY : 0);
  const shown = (t: Task): string =>
    t.end
      ? `${strings.range(dates.text(t.start), dates.text(t.end))}, ${days(length(t))} ${terms.days}`
      : `${terms.milestone.toLowerCase()}, ${dates.text(t.start)}`;

  const width = options.width ?? DEFAULT_WIDTH;
  const growth = textGrowth(width);
  const char = charWidth(width);
  const longest = Math.max(...tasks.map((t) => t.name.length)) * char;
  // Names beside the bars while they take no more than a third of the width; past that (a phone)
  // they go above each bar, and the bars keep the whole width.
  const stacked = longest + 12 > width / 3;
  const pitch = (stacked ? 40 : 28) * growth;
  const top = (today ? 30 : 12) * growth;
  const plotHeight = tasks.length * pitch;
  const height = options.height ?? Math.ceil(plotHeight + top + 44 * growth);
  const lo = minOf([...times, ...(today ? [today] : [])].map(Number));
  const hi = maxOf([...times, ...(today ? [today] : [])].map(Number));
  const pad = (hi - lo || DAY) * 0.02;
  const fill = (t: Task): string => `var(--enarratio-series-${plan.slot(t.group)})`;
  const datum = (t: Task) => ({
    key: markKey(t.name),
    ...(multi && options.group ? { filter: { field: options.group, value: t.group } } : {}),
    ...(multi ? { series: t.group } : {}),
    x: dates.key(t.start),
    column: t.i,
    row: 0,
    at: t.name,
    shown: shown(t),
  });
  const spans = tasks.filter((t) => t.end !== null);
  const milestones = tasks.filter((t) => t.end === null);
  const title = (t: Task): string => `${t.name}${multi ? ` (${t.group})` : ""}: ${shown(t)}`;
  const marks: Plot.Markish[] = [
    Plot.barX(spans, {
      x1: "start",
      x2: "end",
      y: "name",
      fill,
      rx: 3,
      title,
      render: named("bar", keyed(spans, datum)),
    }),
    Plot.dot(milestones, {
      x: "start",
      y: "name",
      symbol: "diamond2",
      r: 8,
      fill,
      stroke: "var(--enarratio-background)",
      strokeWidth: 1.5,
      title,
      render: named("milestone", keyed(milestones, datum)),
    }),
  ];
  if (stacked) {
    marks.push(
      Plot.text(tasks, {
        y: "name",
        text: "name",
        frameAnchor: "left",
        textAnchor: "start",
        // Bottom-anchored just above the bar's top edge (a band padded 0.55 leaves the bar under
        // a quarter of the pitch either side of center), so a name never touches its bar.
        lineAnchor: "bottom",
        dy: -(pitch * 0.25 + 2),
        fill: "var(--enarratio-text)",
        stroke: "var(--enarratio-background)",
        strokeWidth: 3,
        paintOrder: "stroke",
        render: named("y-axis tick label"),
      }),
    );
  }
  if (today) {
    const line = [{ x: today, label: options.todayLabel ?? terms.today }];
    marks.push(
      Plot.ruleX(line, {
        x: "x",
        stroke: "var(--enarratio-text)",
        strokeDasharray: "4,3",
        render: named("today"),
      }),
      Plot.text(line, {
        x: "x",
        text: "label",
        frameAnchor: "top",
        textAnchor: "middle",
        dy: -10 * growth,
        fill: "var(--enarratio-text)",
        stroke: "var(--enarratio-background)",
        strokeWidth: 3,
        paintOrder: "stroke",
        render: named("today label"),
      }),
    );
  }

  const rendered = renderPlot(
    {
      width,
      height,
      marginTop: top,
      // A tick label is centered on its tick, so the frame keeps room for half of one at each end.
      marginLeft: stacked ? Math.ceil(2.5 * char) : Math.ceil(longest + 12),
      marginRight: Math.ceil(2.5 * char),
      marginBottom: 44,
      x: {
        type: "utc",
        domain: [new Date(lo - pad), new Date(hi + pad)],
        label: options.xLabel ?? null,
        grid: true,
        ticks: Math.max(2, Math.floor((width - (stacked ? 20 : longest + 28)) / (80 * growth))),
      },
      y: {
        type: "band",
        domain: tasks.map((t) => t.name),
        padding: stacked ? 0.55 : 0.3,
        label: null,
        ...(stacked ? { axis: null } : {}),
      },
      marks,
    },
    options.alt,
  );
  // Groups are named only in the legend, so their bars take textures (record 0036).
  const svg = multi ? texture(rendered.svg, slotStyle(plan.slotColors)) : rendered.svg;
  const first = dates.text(new Date(minOf(times.map(Number))));
  const last = dates.text(new Date(maxOf(times.map(Number))));
  return figure(options, {
    kind: "gantt",
    svg,
    orientation: "horizontal",
    ...(multi ? { textured: true } : {}),
    ...(rendered.x ? { x: rendered.x } : {}),
    legend: multi ? plan.legend : [],
    ...(multi && options.group ? { seriesField: options.group } : {}),
    slotColors: plan.slotColors,
    limits: { points: 200 },
    description: {
      axes: [
        { position: "x", label: options.xLabel ?? "", from: first, to: last },
        categoryRange(
          "y",
          terms.task,
          tasks.map((t) => t.name),
        ),
      ],
      format: (v: number) => `${days(v)} ${terms.days}`,
      series: [
        {
          name: terms.durationDays,
          points: spans.map((t) => ({ at: t.name, value: length(t) })),
        },
      ],
    },
    table: {
      columns: [
        terms.task,
        ...(multi ? [options.group as string] : []),
        terms.start,
        terms.end,
        terms.durationDays,
      ],
      rows: tasks.map((t) => [
        t.name,
        ...(multi ? [t.group] : []),
        dates.text(t.start),
        t.end ? dates.text(t.end) : "",
        t.end ? days(length(t)) : terms.milestone,
      ]),
    },
  });
}
