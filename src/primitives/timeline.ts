import { element, escapeHtml } from "../html.js";
import { DAY, maxOf } from "../render/data.js";
import { charWidth, markFontSize, textGrowth } from "../render/size.js";
import {
  type PrimitiveTable,
  primitiveFigure,
  primitiveTable,
  primitiveText,
} from "./companion.js";
import {
  prepareTimeline,
  sortedEvents,
  STATUSES,
  type TimelineOptions,
  type TimelineStatus,
} from "./timeline-events.js";

const ROW = 18;
const LANE_PAD = 10;
const TOP = 6;
const AXIS = 26;
const RIGHT = 16;
const MARKER = 6;
const SPAN_HEIGHT = 8;

const round = (n: number): number => Math.round(n * 100) / 100;
const pad = (n: number): string => String(n).padStart(2, "0");

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
 * An event timeline: one lane for each site, agent or service, with spans and point events over a
 * time window. Status is carried by the theme's status colors and by shape (circle ok, triangle
 * warning, square error, dashed hollow circle unknown), so it reads without hue. Overlapping events
 * in a lane stack in rows.
 *
 * The result is a container: the drawing, named by its text alternative, and a plain list of the
 * same events, which with CSS is read beside the drawing and replaces it under 30rem of room.
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
  // The text grows as the drawing shrinks toward 30rem, so it never renders under 12 px; lane labels and axis make room.
  const growth = textGrowth(p.width);
  const ch = charWidth(p.width) * 0.94;
  const left = Math.round(Math.min(180 * growth, Math.max(64, longest * ch + 20)));
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
  const height = plotBottom + Math.round(AXIS + 12 * (growth - 1));
  const axis = ticks(p.start, p.end);

  const maxChars = Math.floor((left - 12) / ch);
  const parts: string[] = [element("title", {}, escapeHtml(p.alt))];
  // Gridlines first, then lane labels, so marks draw over them.
  for (const t of axis) {
    const x = xOf(t.at);
    // A label centered on a tick near the drawing's edge would run past it, so it ends (or starts)
    // at its tick instead.
    const half = (t.label.length * ch) / 2;
    const anchor = x + half > p.width - 2 ? "end" : x - half < 2 ? "start" : "middle";
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
          y: round(plotBottom + 4 + 12 * growth),
          "text-anchor": anchor,
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
        escapeHtml(`${event.lane}: ${event.label}, ${event.word}, ${event.when}`),
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
      "font-size": markFontSize(p.width),
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
          `<strong>${escapeHtml(e.lane)}</strong>: ${escapeHtml(e.label)}, ${escapeHtml(e.word)}, ${escapeHtml(e.when)}`,
        ),
      )
      .join(""),
  );
  const drawing = element(
    "div",
    { class: "enarratio enarratio-timeline", "data-enarratio": "timeline" },
    `${svg}${list}`,
  );
  return primitiveFigure("timeline", drawing, p.alt, options.label?.trim() ?? "", options, () =>
    timelineTable(options),
  );
}

/**
 * A timeline's events as a table and a summary sentence with the counts, computed from the same
 * events as the drawing and its plain list so they cannot disagree. Takes the same options as
 * {@link timeline}. Without `label` the summary is the given `alt`.
 *
 * @example
 * const { table } = timelineTable({ label: "Agent runs", events });
 */
export function timelineTable(options: TimelineOptions): PrimitiveTable {
  const p = prepareTimeline(options);
  const { strings } = primitiveText(options);
  const { terms } = strings;
  return primitiveTable(
    p.summary,
    {
      columns: [terms.event, terms.lane, terms.status, terms.start, terms.end],
      rows: sortedEvents(p.events).map((e) => [
        e.label,
        e.lane,
        e.word,
        e.fromText,
        e.span ? e.toText : "",
      ]),
    },
    p.subject || p.alt,
    strings,
  );
}
