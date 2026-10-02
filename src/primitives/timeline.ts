import { element, escapeHtml } from "../html.js";
import { DAY, defaultFormat, formatInstant, maxOf, minOf, requireSize } from "../render/data.js";
import { type PrimitiveTable, type PrimitiveTableOptions, primitiveTable } from "./companion.js";

/** What happened, as the theme's status colors and a shape say it. */
export type TimelineStatus = "ok" | "warning" | "error" | "unknown";

/** A time: a Date, an ISO 8601 string, or epoch milliseconds. Instants, in UTC. */
export type TimelineTime = Date | string | number;

/** An event that happened at one moment. */
export interface TimelinePoint {
  /** The lane it belongs to: a site, an agent, a service. */
  readonly lane: string;
  /** What happened, e.g. "Deploy 41". Hover details, the plain list and the table carry it. */
  readonly label: string;
  readonly status: TimelineStatus;
  readonly at: TimelineTime;
  readonly from?: never;
  readonly to?: never;
}

/** An event that lasted from one moment to another. */
export interface TimelineSpan {
  readonly lane: string;
  readonly label: string;
  readonly status: TimelineStatus;
  readonly from: TimelineTime;
  readonly to: TimelineTime;
  readonly at?: never;
}

/** One event on a {@link timeline}: a point or a span. */
export type TimelineEvent = TimelinePoint | TimelineSpan;

/** Options for {@link timeline}. */
export interface TimelineOptions {
  /** The events, in any order. */
  readonly events: readonly TimelineEvent[];
  /**
   * The lanes, top to bottom. Every event's lane must be among them. Without it, lanes are in
   * first-seen order. A lane with no events is drawn empty.
   */
  readonly lanes?: readonly string[];
  /** The start of the time window (default: the earliest event). */
  readonly start?: TimelineTime;
  /** The end of the time window (default: the latest event). */
  readonly end?: TimelineTime;
  /**
   * What the timeline shows, e.g. "Agent runs, 9 to 12 June"; it starts the generated text
   * alternative. Required unless `alt` is given.
   */
  readonly label?: string;
  /** The text alternative, instead of the one generated from `label` and the events. */
  readonly alt?: string;
  /** The drawing's width in CSS pixels (default 640). Under 30rem of room it gives way to a list. */
  readonly width?: number;
  /** Formats an instant in hover details and the plain list (default `2026-01-05 14:30 UTC`). */
  readonly formatTime?: (time: Date) => string;
}

const KIND = "timeline";
const STATUSES: Readonly<Record<TimelineStatus, { color: string; word: string }>> = {
  ok: { color: "var(--enarratio-status-good)", word: "ok" },
  warning: { color: "var(--enarratio-status-warning)", word: "warning" },
  error: { color: "var(--enarratio-status-bad)", word: "error" },
  unknown: { color: "var(--enarratio-status-unknown)", word: "unknown" },
};

/** An event with its times read and checked, and its window position clipped to the window. */
export interface PreparedEvent {
  readonly lane: string;
  readonly label: string;
  readonly status: TimelineStatus;
  readonly from: number;
  readonly to: number;
  readonly span: boolean;
  /** `from` and `to` as text, using the options' formatter. */
  readonly fromText: string;
  readonly toText: string;
  /** The event as one phrase of when: "2026-06-09 08:00 UTC" or "from ... to ...". */
  readonly when: string;
}

/** Everything the timeline, its text alternative and its companion table are computed from. */
export interface TimelineValues {
  readonly events: readonly PreparedEvent[];
  readonly lanes: readonly string[];
  readonly start: number;
  readonly end: number;
  readonly width: number;
  readonly summary: string;
  readonly alt: string;
  readonly subject: string;
}

function readTime(what: string, value: unknown): number {
  const date =
    value instanceof Date
      ? value
      : typeof value === "string" || typeof value === "number"
        ? new Date(value)
        : undefined;
  if (!date || Number.isNaN(date.getTime())) {
    throw new Error(`${KIND}: ${what} is ${JSON.stringify(value)}, not a time`);
  }
  return date.getTime();
}

/** Validates the options and computes the numbers every part of a timeline is made from. */
export function prepareTimeline(options: TimelineOptions): TimelineValues {
  const { events } = options;
  if (events.length === 0) throw new Error(`${KIND}: needs at least one event`);
  const subject = options.label?.trim() ?? "";
  const given = options.alt?.trim() ?? "";
  if (subject === "" && given === "") throw new Error(`${KIND}: label or alt is required`);
  const width = options.width ?? 640;
  requireSize(KIND, "width", width);
  const text = options.formatTime ?? formatInstant;
  const at = (ms: number): string => text(new Date(ms));

  const raw = events.map((event, i) => {
    const n = `event ${i + 1}`;
    if (typeof event.lane !== "string" || event.lane === "") {
      throw new Error(`${KIND}: ${n} needs a lane`);
    }
    if (typeof event.label !== "string" || event.label.trim() === "") {
      throw new Error(`${KIND}: ${n} needs a label`);
    }
    // Own properties only: "constructor" or "toString" from JSON is not a status.
    if (typeof event.status !== "string" || !Object.hasOwn(STATUSES, event.status)) {
      throw new Error(`${KIND}: ${n} has unknown status "${String(event.status)}"`);
    }
    const span = event.from !== undefined || event.to !== undefined;
    if (span && event.at !== undefined) {
      throw new Error(`${KIND}: ${n} has both a time (at) and a span (from, to)`);
    }
    if (span) {
      if (event.from === undefined || event.to === undefined) {
        throw new Error(`${KIND}: ${n} needs both from and to for a span`);
      }
      const from = readTime(`${n} from`, event.from);
      const to = readTime(`${n} to`, event.to);
      if (to < from) throw new Error(`${KIND}: ${n} ends before it starts`);
      return { event, from, to, span };
    }
    if (event.at === undefined) throw new Error(`${KIND}: ${n} needs a time (at) or a span`);
    const t = readTime(`${n} at`, event.at);
    return { event, from: t, to: t, span };
  });

  const start =
    options.start === undefined ? Number.POSITIVE_INFINITY : readTime("start", options.start);
  const end = options.end === undefined ? Number.NEGATIVE_INFINITY : readTime("end", options.end);
  const windowStart = options.start === undefined ? minOf(raw.map((r) => r.from)) : start;
  const windowEnd = options.end === undefined ? maxOf(raw.map((r) => r.to)) : end;
  if (!(windowEnd > windowStart)) {
    throw new Error(
      `${KIND}: the time window has no length (${at(windowStart)} to ${at(windowEnd)}); give start and end`,
    );
  }

  const lanes = options.lanes ? [...options.lanes] : [...new Set(events.map((e) => e.lane))];
  if (new Set(lanes).size !== lanes.length) throw new Error(`${KIND}: lanes has a repeated name`);
  const prepared = raw.map(({ event, from, to, span }, i): PreparedEvent => {
    if (!lanes.includes(event.lane)) {
      throw new Error(`${KIND}: event ${i + 1} is in lane "${event.lane}", which lanes leaves out`);
    }
    if (to < windowStart || from > windowEnd) {
      throw new Error(
        `${KIND}: event ${i + 1} ("${event.label}") lies outside the time window ${at(windowStart)} to ${at(windowEnd)}`,
      );
    }
    return {
      lane: event.lane,
      label: event.label,
      status: event.status,
      from,
      to,
      span,
      fromText: at(from),
      toText: at(to),
      when: span ? `from ${at(from)} to ${at(to)}` : at(from),
    };
  });

  const counts: Record<TimelineStatus, number> = { ok: 0, warning: 0, error: 0, unknown: 0 };
  for (const e of prepared) counts[e.status] += 1;
  const parts = (Object.keys(counts) as TimelineStatus[])
    .filter((s) => counts[s] > 0)
    .map((s) => `${counts[s]} ${STATUSES[s].word}`);
  const laneCount = new Set(prepared.map((e) => e.lane)).size;
  const summary = `${subject === "" ? "" : `${subject}: `}${defaultFormat(prepared.length)} ${prepared.length === 1 ? "event" : "events"} in ${laneCount} ${laneCount === 1 ? "lane" : "lanes"}, ${at(windowStart)} to ${at(windowEnd)}; ${parts.join(", ")}.`;
  return {
    events: prepared,
    lanes,
    start: windowStart,
    end: windowEnd,
    width,
    summary,
    alt: given || summary,
    subject,
  };
}

/** Events in time order, ties by lane: the order of the plain list and the table. */
function sortedEvents(events: readonly PreparedEvent[]): PreparedEvent[] {
  return [...events].sort(
    (a, b) => a.from - b.from || (a.lane < b.lane ? -1 : a.lane > b.lane ? 1 : 0),
  );
}

const ROW = 18;
const LANE_PAD = 10;
const TOP = 6;
const AXIS = 26;
const RIGHT = 16;
const CHAR_WIDTH = 6.6;
const MARKER = 6;
const SPAN_HEIGHT = 8;

const round = (n: number): number => Math.round(n * 100) / 100;
const pad = (n: number): string => String(n).padStart(2, "0");

/** Tick times (epoch milliseconds) and their labels, about six, aligned to UTC calendar units. */
function ticks(start: number, end: number): { at: number; label: string }[] {
  const MINUTE = 60_000;
  const fixed = [1, 5, 15, 30, 60, 180, 360, 720, 1440, 2880, 10_080].map((m) => m * MINUTE);
  const span = end - start;
  const step = fixed.find((s) => span / s <= 7);
  const out: { at: number; label: string }[] = [];
  if (step !== undefined) {
    for (let t = Math.ceil(start / step) * step; t <= end; t += step) {
      const d = new Date(t);
      const midnight = t % DAY === 0;
      out.push({
        at: t,
        label:
          step >= DAY
            ? d.toISOString().slice(5, 10)
            : midnight
              ? d.toISOString().slice(5, 10)
              : `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
      });
    }
    return out;
  }
  // Longer than about seven weeks: whole calendar months, quarters, half years or years.
  const first = new Date(start);
  for (const months of [1, 3, 6, 12, 24, 60, 120]) {
    const list: number[] = [];
    let t = Date.UTC(first.getUTCFullYear(), Math.ceil(first.getUTCMonth() / months) * months, 1);
    while (t <= end) {
      list.push(t);
      const d = new Date(t);
      t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1);
    }
    if (list.length <= 7) {
      return list.map((at) => ({
        at,
        label: new Date(at).toISOString().slice(0, months >= 12 ? 4 : 7),
      }));
    }
  }
  return out;
}

/** The shape that says a status without color: circle, triangle, square, hollow dashed circle. */
function marker(status: TimelineStatus, cx: number, cy: number): string {
  const color = STATUSES[status].color;
  const ring = { stroke: "var(--enarratio-background)", "stroke-width": 1.5 };
  switch (status) {
    case "ok":
      return element("circle", { cx, cy, r: 5, fill: color, ...ring });
    case "warning":
      return element("polygon", {
        points: `${cx},${cy - MARKER} ${cx + MARKER},${cy + 5} ${cx - MARKER},${cy + 5}`,
        fill: color,
        ...ring,
      });
    case "error":
      return element("rect", {
        x: cx - 4.5,
        y: cy - 4.5,
        width: 9,
        height: 9,
        fill: color,
        ...ring,
      });
    case "unknown":
      return element("circle", {
        cx,
        cy,
        r: 4.5,
        fill: "var(--enarratio-background)",
        stroke: color,
        "stroke-width": 1.5,
        "stroke-dasharray": "2,1.5",
      });
  }
}

/**
 * An event timeline: one lane for each site, agent or service, with spans (things that lasted) and
 * point events over a time window. Status is carried by the theme's status colors and by shape (a
 * circle for ok, a triangle for warning, a square for error, a dashed hollow circle for unknown),
 * so it reads without hue. Events that overlap in a lane stack in rows.
 *
 * The result is a container: the drawing, named by its text alternative, and a plain list of the
 * same events. With stylesheet or `enarratio/base.css`, the list is read by screen readers beside
 * the drawing, and replaces it when there is less than 30rem of room. Without CSS both show.
 *
 * @example
 * timeline({
 *   label: "Agent runs",
 *   events: [
 *     { lane: "Agent A", label: "Nightly run", status: "ok", from: "2026-06-09T01:00Z", to: "2026-06-09T02:10Z" },
 *     { lane: "Agent B", label: "Timeout", status: "error", at: "2026-06-09T03:30Z" },
 *   ],
 * });
 */
export function timeline(options: TimelineOptions): string {
  const p = prepareTimeline(options);
  const longest = Math.max(maxOf(p.lanes.map((l) => l.length)), 1);
  const left = Math.round(Math.min(180, Math.max(64, longest * CHAR_WIDTH + 20)));
  const plotWidth = Math.max(40, p.width - left - RIGHT);
  const xOf = (t: number): number =>
    round(
      left + (Math.min(Math.max(t, p.start), p.end) - p.start) * (plotWidth / (p.end - p.start)),
    );

  // Pack each lane's events into rows so overlapping ones do not draw over each other.
  const packed = p.lanes.map((lane) => {
    const own = p.events.filter((e) => e.lane === lane).sort((a, b) => a.from - b.from);
    const rowEnds: number[] = [];
    const placed = own.map((event) => {
      const a = xOf(event.from) - MARKER - 1;
      const b = event.span ? xOf(event.to) + 2 : xOf(event.from) + MARKER + 1;
      let row = rowEnds.findIndex((end) => end <= a);
      if (row === -1) row = rowEnds.length;
      rowEnds[row] = b;
      return { event, row };
    });
    return { lane, placed, rows: Math.max(1, rowEnds.length) };
  });
  const laneTop: number[] = [];
  let y = TOP;
  for (const lane of packed) {
    laneTop.push(y);
    y += lane.rows * ROW + LANE_PAD;
  }
  const plotBottom = y;
  const height = plotBottom + AXIS;
  const axis = ticks(p.start, p.end);

  const maxChars = Math.floor((left - 12) / CHAR_WIDTH);
  const parts: string[] = [element("title", {}, escapeHtml(p.alt))];
  // Gridlines first, then lane labels, so marks draw over them.
  for (const t of axis) {
    const x = xOf(t.at);
    parts.push(
      element("line", {
        x1: x,
        x2: x,
        y1: TOP,
        y2: plotBottom,
        stroke: "var(--enarratio-grid)",
        "stroke-width": 1,
      }),
      element(
        "text",
        {
          x,
          y: plotBottom + 16,
          "text-anchor": "middle",
          fill: "var(--enarratio-text-muted)",
          class: "enarratio-numeric",
        },
        escapeHtml(t.label),
      ),
    );
  }
  packed.forEach((lane, i) => {
    const top = laneTop[i] as number;
    const mid = top + (lane.rows * ROW + LANE_PAD) / 2;
    const shown = lane.lane.length > maxChars ? `${lane.lane.slice(0, maxChars - 1)}…` : lane.lane;
    parts.push(
      element("line", {
        x1: left,
        x2: left + plotWidth,
        y1: top + lane.rows * ROW + LANE_PAD,
        y2: top + lane.rows * ROW + LANE_PAD,
        stroke: "var(--enarratio-grid)",
        "stroke-width": 1,
      }),
      element(
        "text",
        {
          x: left - 8,
          y: mid,
          "text-anchor": "end",
          "dominant-baseline": "central",
          fill: "var(--enarratio-text)",
        },
        `${escapeHtml(shown)}${shown === lane.lane ? "" : element("title", {}, escapeHtml(lane.lane))}`,
      ),
    );
    for (const { event, row } of lane.placed) {
      const cy = top + LANE_PAD / 2 + row * ROW + ROW / 2;
      const title = element(
        "title",
        {},
        escapeHtml(`${event.lane}: ${event.label}, ${STATUSES[event.status].word}, ${event.when}`),
      );
      const x0 = xOf(event.from);
      const bar = event.span
        ? element("rect", {
            x: x0,
            y: cy - SPAN_HEIGHT / 2,
            width: Math.max(2, round(xOf(event.to) - x0)),
            height: SPAN_HEIGHT,
            rx: 2,
            fill: event.status === "unknown" ? "none" : STATUSES[event.status].color,
            ...(event.status === "unknown"
              ? { stroke: STATUSES.unknown.color, "stroke-dasharray": "3,2" }
              : {}),
          })
        : "";
      parts.push(
        element(
          "g",
          { "data-enarratio-mark": "event", "data-status": event.status },
          `${title}${bar}${marker(event.status, x0, cy)}`,
        ),
      );
    }
  });

  const svg = element(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: `0 0 ${p.width} ${height}`,
      width: p.width,
      height,
      role: "img",
      "aria-label": p.alt,
    },
    parts.join(""),
  );
  const list = element(
    "ol",
    { class: "enarratio-timeline-list" },
    sortedEvents(p.events)
      .map((e) =>
        element(
          "li",
          {},
          `<strong>${escapeHtml(e.lane)}</strong>: ${escapeHtml(e.label)}, ${STATUSES[e.status].word}, ${escapeHtml(e.when)}`,
        ),
      )
      .join(""),
  );
  return element(
    "div",
    { class: "enarratio enarratio-timeline", "data-enarratio": "timeline" },
    `${svg}${list}`,
  );
}

/**
 * A timeline's events as a table (event, lane, status, start and end, the end blank for a point
 * event) in time order, and a summary sentence with the counts, computed from the same events
 * as the drawing and its plain list so they cannot disagree. Takes the same options as
 * {@link timeline}. Without `label` the summary is the given `alt`.
 *
 * @example
 * const { table } = timelineTable({ label: "Agent runs", events });
 */
export function timelineTable(
  options: TimelineOptions,
  display?: PrimitiveTableOptions,
): PrimitiveTable {
  const p = prepareTimeline(options);
  return primitiveTable(
    p.summary,
    {
      columns: ["Event", "Lane", "Status", "Start", "End"],
      rows: sortedEvents(p.events).map((e) => [
        e.label,
        e.lane,
        STATUSES[e.status].word,
        e.fromText,
        e.span ? e.toText : "",
      ]),
    },
    p.subject || p.alt,
    display,
  );
}
