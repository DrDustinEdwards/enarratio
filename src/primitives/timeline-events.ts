import { formatInstant, maxOf, minOf, requireSize, parseDateValue } from "../render/data.js";
import { DEFAULT_WIDTH } from "../render/size.js";
import type { Terms } from "../render/text.js";
import { type PrimitiveFigureOptions, primitiveText } from "./companion.js";

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
export interface TimelineOptions extends PrimitiveFigureOptions {
  /** The events, in any order. */
  readonly events: readonly TimelineEvent[];
  /** The lanes, top to bottom; every event's lane must be among them. Default first-seen order. A lane with no events is drawn empty. */
  readonly lanes?: readonly string[];
  /** The start of the time window (default: the earliest event). */
  readonly start?: TimelineTime;
  /** The end of the time window (default: the latest event). */
  readonly end?: TimelineTime;
  /** What the timeline shows, e.g. "Agent runs, 9 to 12 June"; it starts the generated text alternative. Required unless `alt` is given. */
  readonly label?: string;
  /** The text alternative, instead of the one generated from `label` and the events. */
  readonly alt?: string;
  /** The drawing's width in CSS pixels (default 640). Under 30rem of room it gives way to a list. */
  readonly width?: number;
  /** Formats an instant in hover details and the plain list (default `2026-01-05 14:30 UTC`). */
  readonly formatTime?: (time: Date) => string;
}

const KIND = "timeline";
export const STATUSES: Readonly<Record<TimelineStatus, { color: string; word: keyof Terms }>> = {
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
  /** The status as readers see it, from the strings table. */
  readonly word: string;
  readonly from: number;
  readonly to: number;
  readonly span: boolean;
  /** `from` and `to` as text, using the options' formatter. */
  readonly fromText: string;
  readonly toText: string;
  /** The event as one phrase of when: "2026-06-09 08:00 UTC" or "from ... to ...". */
  readonly when: string;
}

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
  const date = parseDateValue(value);
  if (!date) {
    throw new Error(`${KIND}: ${what} is ${JSON.stringify(value)}, not a time`);
  }
  return date.getTime();
}

export function prepareTimeline(options: TimelineOptions): TimelineValues {
  const { events } = options;
  if (events.length === 0) throw new Error(`${KIND}: needs at least one event`);
  const subject = options.label?.trim() ?? "";
  const given = options.alt?.trim() ?? "";
  if (subject === "" && given === "") throw new Error(`${KIND}: label or alt is required`);
  const width = options.width ?? DEFAULT_WIDTH;
  requireSize(KIND, "width", width);
  const text = options.formatTime ?? formatInstant;
  const { strings, count } = primitiveText(options);
  const { terms } = strings;
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
      word: terms[STATUSES[event.status].word],
      from,
      to,
      span,
      fromText: at(from),
      toText: at(to),
      when: span ? strings.fromTo(at(from), at(to)) : at(from),
    };
  });

  const counts: Record<TimelineStatus, number> = { ok: 0, warning: 0, error: 0, unknown: 0 };
  for (const e of prepared) counts[e.status] += 1;
  const summary = strings.timelineSummary({
    subject,
    events: count(prepared.length),
    lanes: count(new Set(prepared.map((e) => e.lane)).size),
    from: at(windowStart),
    to: at(windowEnd),
    counts: (Object.keys(counts) as TimelineStatus[])
      .filter((s) => counts[s] > 0)
      .map((s) => ({ n: count(counts[s]), status: terms[STATUSES[s].word] })),
  });
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
export function sortedEvents(events: readonly PreparedEvent[]): PreparedEvent[] {
  return [...events].sort(
    (a, b) => a.from - b.from || (a.lane < b.lane ? -1 : a.lane > b.lane ? 1 : 0),
  );
}
