import { element, escapeHtml } from "../html.js";
import { type PrimitiveTable, type PrimitiveTableOptions, primitiveTable } from "./companion.js";

/** The state of one period in an {@link uptimeStrip}. */
export type UptimeStatus = "up" | "degraded" | "down" | "unknown";

/** One period: a status, or a status with its own hover label (e.g. "Mon 14:00, 2 failed probes"). */
export type UptimeSlot = UptimeStatus | { readonly status: UptimeStatus; readonly label?: string };

/** Options for {@link uptimeStrip}. */
export interface UptimeStripOptions {
  /** The periods, oldest first. */
  readonly slots: readonly UptimeSlot[];
  /**
   * What is monitored and over what window, e.g. "API, last 7 days"; it starts the generated
   * text alternative. Required unless `alt` is given.
   */
  readonly label?: string;
  /** The text alternative, instead of the one generated from `label` and the counts (F18). */
  readonly alt?: string;
  /** The strip's width in CSS pixels (default 240). */
  readonly width?: number;
  /** The strip's height in CSS pixels (default 24). */
  readonly height?: number;
}

const STATUS: Readonly<Record<UptimeStatus, { color: string; height: number; word: string }>> = {
  // Height encodes status as well as color, so the strip reads without hue: a shorter tick is worse.
  up: { color: "var(--enarratio-status-good)", height: 1, word: "up" },
  degraded: { color: "var(--enarratio-status-warning)", height: 0.66, word: "degraded" },
  down: { color: "var(--enarratio-status-bad)", height: 0.33, word: "down" },
  unknown: { color: "var(--enarratio-status-unknown)", height: 1, word: "no data" },
};

const round = (n: number): number => Math.round(n * 100) / 100;

/** One period, checked, with the name it carries in hover details and the companion table. */
export interface PreparedSlot {
  readonly status: UptimeStatus;
  /** The slot's own label, or "Period 3". */
  readonly name: string;
  readonly word: string;
}

/** Everything the strip, its text alternative and its companion table are computed from. */
export interface UptimeStripValues {
  readonly slots: readonly PreparedSlot[];
  readonly counts: Readonly<Record<UptimeStatus, number>>;
  readonly width: number;
  readonly height: number;
  /** The sentence generated from the counts, or "" when only `alt` names the strip. */
  readonly summary: string;
  readonly alt: string;
  readonly subject: string;
}

/** Validates the options and computes the numbers every part of an uptime strip is made from. */
export function prepareUptimeStrip(options: UptimeStripOptions): UptimeStripValues {
  const { slots } = options;
  if (slots.length === 0) throw new Error("uptimeStrip: needs at least one slot");
  const subject = options.label?.trim() ?? "";
  const given = options.alt?.trim() ?? "";
  if (subject === "" && given === "") throw new Error("uptimeStrip: label or alt is required");
  const width = options.width ?? 240;
  const height = options.height ?? 24;
  for (const [name, n] of [
    ["width", width],
    ["height", height],
  ] as const) {
    if (!(Number.isFinite(n) && n > 0)) {
      throw new Error(`uptimeStrip: ${name} must be a positive number, is ${n}`);
    }
  }
  const counts: Record<UptimeStatus, number> = { up: 0, degraded: 0, down: 0, unknown: 0 };
  const prepared = slots.map((slot, i): PreparedSlot => {
    const status = typeof slot === "string" ? slot : slot.status;
    // Own properties only: "constructor" or "toString" from JSON is not a status (F15).
    if (typeof status !== "string" || !Object.hasOwn(STATUS, status)) {
      throw new Error(`uptimeStrip: slot ${i + 1} has unknown status "${String(status)}"`);
    }
    counts[status] += 1;
    const own = typeof slot === "string" ? undefined : slot.label;
    return { status, name: own ? own : `Period ${i + 1}`, word: STATUS[status].word };
  });
  const measured = counts.up + counts.degraded + counts.down;
  const availability =
    measured === 0
      ? "no measurements"
      : `${round(((counts.up + counts.degraded) / measured) * 100)}% available`;
  const parts = (Object.keys(counts) as UptimeStatus[])
    .filter((s) => counts[s] > 0)
    .map((s) => `${counts[s]} ${STATUS[s].word}`);
  const summary =
    subject === ""
      ? ""
      : `${subject}: ${slots.length} periods, ${parts.join(", ")}; ${availability}.`;
  return {
    slots: prepared,
    counts,
    width,
    height,
    summary,
    alt: given || summary,
    subject,
  };
}

/**
 * A row of ticks, one per period, showing whether a service was up, degraded, down or unmeasured.
 * Status is carried by tick height and outline as well as color, and the text alternative
 * summarizes the counts and availability.
 *
 * @example
 * uptimeStrip({ slots: ["up", "up", "degraded", "down", "up"], label: "Site, last 5 hours" });
 */
export function uptimeStrip(options: UptimeStripOptions): string {
  const { slots, width, height, alt } = prepareUptimeStrip(options);
  const step = width / slots.length;
  const gap = step > 4 ? 1 : 0;

  const ticks = slots.map((slot, i) => {
    const spec = STATUS[slot.status];
    const { status } = slot;
    const h = height * spec.height;
    const title = `${slot.name}: ${spec.word}`;
    const common = {
      x: round(i * step),
      y: round(height - h),
      width: round(step - gap),
      height: round(h),
    };
    return element(
      "rect",
      status === "unknown"
        ? {
            ...common,
            x: round(i * step + 0.5),
            width: round(step - gap - 1),
            y: 0.5,
            height: height - 1,
            fill: "none",
            stroke: spec.color,
            "stroke-dasharray": "2,2",
          }
        : { ...common, fill: spec.color, "data-status": status },
      element("title", {}, escapeHtml(title)),
    );
  });

  return element(
    "svg",
    {
      class: "enarratio enarratio-uptime-strip",
      "data-enarratio": "uptime-strip",
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: `0 0 ${width} ${height}`,
      width,
      height,
      role: "img",
      "aria-label": alt,
    },
    ticks.join(""),
  );
}

/**
 * An uptime strip's periods as a table (period and status) and a summary sentence with the counts
 * and availability, computed from the same slots as the drawing so the two cannot disagree. Takes
 * the same options as {@link uptimeStrip}. Without `label` the summary is the given `alt`.
 *
 * @example
 * const { summary, table } = uptimeStripTable({ slots: ["up", "down"], label: "Site, last 2 hours" });
 */
export function uptimeStripTable(
  options: UptimeStripOptions,
  display?: PrimitiveTableOptions,
): PrimitiveTable {
  const p = prepareUptimeStrip(options);
  return primitiveTable(
    p.summary || p.alt,
    { columns: ["Period", "Status"], rows: p.slots.map((s) => [s.name, s.word]) },
    p.subject || p.alt,
    display,
  );
}
