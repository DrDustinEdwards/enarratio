import { el, svgRoot, text } from "../lite/svg.js";
import { n2 } from "../render/arc.js";
import {
  calendarDates,
  DAY,
  dateText,
  type KeysOfType,
  markKey,
  maxOf,
  minOf,
  rampStep,
  rampThresholds,
  readDate,
  readNumberOrNull,
} from "../render/data.js";
import { datumAttributes } from "../render/datum.js";
import { type FigureOptions, figure, type RampItem, validateFigure } from "../render/figure.js";
import { charWidth, DEFAULT_WIDTH, textGrowth } from "../render/size.js";
import { stringsFor, valueFormat } from "../render/text.js";

type When = Date | string | number;

/** Options for {@link calendarHeatmap}. */
export interface CalendarHeatmapOptions<T extends object> extends FigureOptions {
  /** One row per day; days between the first and last with no row are drawn empty. */
  readonly data: readonly T[];
  /** The field for the day: a Date, an ISO 8601 date or a timestamp at midnight UTC. */
  readonly date: KeysOfType<T, When>;
  /** The field colored on the theme's sequential ramp. `null` is an empty day, not zero. */
  readonly value: KeysOfType<T, number | null | undefined>;
  /** Four ascending thresholds splitting values into the ramp's five steps (default equal steps). */
  readonly thresholds?: readonly [number, number, number, number];
  /**
   * The first day of each week, as `Date.getUTCDay()` counts (0 Sunday, 1 Monday). Defaults to
   * the locale's first day, and Monday when no locale is given.
   */
  readonly weekStart?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** What the value measures, for hover details and the summary. */
  readonly valueLabel?: string;
  readonly formatValue?: (value: number) => string;
}

const KIND = "calendarHeatmap";

/** The locale's first day of the week as `getUTCDay()` counts, where the runtime knows it. */
function localeWeekStart(locale: string | undefined): number {
  if (!locale) return 1;
  try {
    const l = new Intl.Locale(locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    const first = (l.getWeekInfo?.() ?? l.weekInfo)?.firstDay;
    return first === undefined ? 1 : first % 7;
  } catch {
    return 1;
  }
}

interface Day {
  readonly at: Date;
  readonly value: number | null;
  /** Weeks from the first week's start, and the day's place in its week. */
  readonly week: number;
  readonly weekday: number;
}

/**
 * A calendar heatmap: one cell per day, weeks as columns and weekdays as rows, colored on the
 * theme's sequential ramp in five labeled steps, with the months named above. A day with no value
 * is outlined with a dashed line, never colored as zero. On a narrow drawing the calendar turns, so
 * weeks run down the page and the cells stay large enough to see and touch. Every day with a value
 * is reached by hover, focus and the keys, and the data table gives one row per week.
 *
 * @example
 * calendarHeatmap({ data: daily, date: "day", value: "samples", alt: "..." });
 */
export function calendarHeatmap<T extends object>(options: CalendarHeatmapOptions<T>): string {
  const { data } = options;
  validateFigure(KIND, options);
  if (data.length === 0) throw new Error(`${KIND}: data is empty`);
  const format = valueFormat(options);
  const strings = stringsFor(options.strings);
  const { terms } = strings;
  const valueLabel = options.valueLabel ?? options.value;
  const read = calendarDates(data.map((row, i) => readDate(KIND, row, options.date, i)));
  const byDay = new Map<number, number | null>();
  read.forEach((d, i) => {
    const t = d.getTime();
    if (t % DAY !== 0) {
      throw new Error(`${KIND}: row ${i + 1} has a time of day; give one row per calendar day`);
    }
    if (byDay.has(t)) throw new Error(`${KIND}: two rows for ${d.toISOString().slice(0, 10)}`);
    byDay.set(t, readNumberOrNull(KIND, data[i] as T, options.value, i));
  });
  const present = [...byDay.values()].filter((v): v is number => v !== null);
  if (present.length === 0) throw new Error(`${KIND}: every value is empty`);
  const weekStart = options.weekStart ?? localeWeekStart(options.locale);
  const first = minOf(byDay.keys());
  const last = maxOf(byDay.keys());
  const place = (t: number): number => (new Date(t).getUTCDay() - weekStart + 7) % 7;
  const origin = first - place(first) * DAY;
  const days: Day[] = [];
  for (let t = first; t <= last; t += DAY) {
    days.push({
      at: new Date(t),
      value: byDay.get(t) ?? null,
      week: Math.floor((t - origin) / (7 * DAY)),
      weekday: place(t),
    });
  }
  const weeks = (days.at(-1)?.week ?? 0) + 1;
  const min = minOf(present);
  const max = maxOf(present);
  const thresholds = rampThresholds(KIND, min, max, options.thresholds);
  const dates = dateText(
    days.map((d) => d.at),
    options.locale,
  );
  const locale = options.locale ?? "en-US";
  const weekdayName = (style: "short" | "long" | "narrow") => {
    const f = new Intl.DateTimeFormat(locale, { weekday: style, timeZone: "UTC" });
    // 4 January 2026 is a Sunday.
    return (k: number): string => f.format(new Date(Date.UTC(2026, 0, 4 + ((k + weekStart) % 7))));
  };
  const monthName = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });

  const width = options.width ?? DEFAULT_WIDTH;
  const growth = textGrowth(width);
  const char = charWidth(width);
  const line = 14 * growth;
  const labelRoom = Math.ceil(
    Math.max(...[0, 1, 2, 3, 4, 5, 6].map((k) => weekdayName("short")(k).length)) * char + 8,
  );
  const across = (width - labelRoom - 4) / weeks;
  // Too many weeks for cells a reader can see and touch: the calendar turns, weeks running down.
  const upright = across < 11 * growth;
  const monthRoom = Math.ceil(3.5 * char + 8);
  const cell = upright
    ? Math.min(18 * growth, (width - monthRoom - 4) / 7)
    : Math.min(24 * growth, across);
  const left = upright ? monthRoom : labelRoom;
  const top = line + 6;
  const height = options.height ?? Math.ceil(top + (upright ? weeks : 7) * cell + 4);
  const cellAt = (d: Day): [number, number] =>
    upright
      ? [left + d.weekday * cell, top + d.week * cell]
      : [left + d.week * cell, top + d.weekday * cell];
  const describe = (d: Day): string =>
    `${dates.text(d.at)}: ${d.value === null ? terms.noData : `${format(d.value)} ${valueLabel}`}`;

  const filled = days.filter((d) => d.value !== null);
  const empty = days.filter((d) => d.value === null);
  const cells = filled
    .map((d) => {
      const [x, y] = cellAt(d);
      const step = rampStep(d.value as number, thresholds);
      return el(
        "rect",
        {
          x: n2(x + 1),
          y: n2(y + 1),
          width: n2(cell - 2),
          height: n2(cell - 2),
          rx: 2,
          fill: `var(--enarratio-sequential-${step})`,
          ...Object.fromEntries(
            datumAttributes({
              key: markKey(dates.key(d.at)),
              x: dates.key(d.at),
              // The keys follow the drawing: Right moves right, and Up moves up a row.
              column: upright ? d.weekday : d.week,
              row: upright ? weeks - 1 - d.week : 6 - d.weekday,
              at: dates.text(d.at),
              shown: format(d.value as number),
            }),
          ),
        },
        el("title", {}, text(describe(d))),
      );
    })
    .join("");
  const blanks = empty
    .map((d) => {
      const [x, y] = cellAt(d);
      return el(
        "rect",
        {
          x: n2(x + 1.5),
          y: n2(y + 1.5),
          width: n2(cell - 3),
          height: n2(cell - 3),
          rx: 2,
        },
        el("title", {}, text(describe(d))),
      );
    })
    .join("");
  // Each month named at the week holding its first day, unless the next month's name would
  // touch it (a month that starts the calendar on its last days).
  const starts = days.filter((d, i) => i === 0 || d.at.getUTCDate() === 1);
  const room = upright ? line : 3.5 * char;
  const months = starts
    .filter((d, i) => {
      const next = starts[i + 1];
      return !next || (next.week - d.week) * cell >= room;
    })
    .map((d) =>
      upright
        ? el(
            "text",
            {
              x: n2(left - 6),
              y: n2(top + d.week * cell + cell / 2),
              dy: "0.32em",
              "text-anchor": "end",
            },
            text(monthName.format(d.at)),
          )
        : el(
            "text",
            { x: n2(left + d.week * cell), y: n2(top - 6), "text-anchor": "start" },
            text(monthName.format(d.at)),
          ),
    )
    .join("");
  const weekdayLabels = upright
    ? [0, 1, 2, 3, 4, 5, 6]
        .map((k) =>
          el(
            "text",
            { x: n2(left + k * cell + cell / 2), y: n2(top - 6), "text-anchor": "middle" },
            text(weekdayName("narrow")(k)),
          ),
        )
        .join("")
    : // Every other weekday, as a wall calendar's margin does, so the names fit the cells' height.
      [0, 2, 4, 6]
        .map((k) =>
          el(
            "text",
            {
              x: n2(left - 6),
              y: n2(top + k * cell + cell / 2),
              dy: "0.32em",
              "text-anchor": "end",
            },
            text(weekdayName("short")(k)),
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
        {
          "data-enarratio-mark": "empty",
          fill: "none",
          stroke: "var(--enarratio-status-unknown)",
          "stroke-dasharray": "3,2",
        },
        blanks,
      ),
      el("g", { "data-enarratio-mark": "cell" }, cells),
      el(
        "g",
        {
          "data-enarratio-mark": "month label",
          "aria-hidden": "true",
          fill: "var(--enarratio-text)",
        },
        months,
      ),
      el(
        "g",
        {
          "data-enarratio-mark": "weekday label",
          "aria-hidden": "true",
          fill: "var(--enarratio-text-muted)",
        },
        weekdayLabels,
      ),
    ].join(""),
  );

  const edges = [min, ...thresholds, max];
  const ramp: RampItem[] = [1, 2, 3, 4, 5].map((step) => ({
    step,
    label:
      step === 1
        ? strings.below(format(edges[1] as number))
        : step === 5
          ? strings.orMore(format(edges[4] as number))
          : strings.range(format(edges[step - 1] as number), format(edges[step] as number)),
  }));
  const longName = weekdayName("long");
  const rows = Array.from({ length: weeks }, (_, w) => {
    const own = days.filter((d) => d.week === w);
    return [
      dates.text(new Date(origin + w * 7 * DAY)),
      ...[0, 1, 2, 3, 4, 5, 6].map((k) => {
        const d = own.find((o) => o.weekday === k);
        return d?.value === null || d === undefined ? "" : format(d.value);
      }),
    ];
  });
  return figure(options, {
    kind: "calendar",
    svg,
    ramp,
    limits: { points: 1500 },
    description: {
      axes: [
        {
          position: "x",
          label: "",
          from: dates.text(days[0]?.at ?? new Date(first)),
          to: dates.text(days.at(-1)?.at ?? new Date(last)),
        },
      ],
      // Days run in order, but a first-to-last trend misreads a weekly cycle: the summary names the
      // highest and lowest days.
      format,
      series: [
        {
          name: valueLabel,
          points: days.map((d) => ({ at: dates.text(d.at), value: d.value })),
        },
      ],
    },
    table: {
      columns: [terms.weekOf, ...[0, 1, 2, 3, 4, 5, 6].map(longName)],
      rows,
    },
  });
}
