import { element, escapeHtml } from "../html.js";

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
  up: { color: "var(--abscissa-status-good)", height: 1, word: "up" },
  degraded: { color: "var(--abscissa-status-warning)", height: 0.66, word: "degraded" },
  down: { color: "var(--abscissa-status-bad)", height: 0.33, word: "down" },
  unknown: { color: "var(--abscissa-status-unknown)", height: 1, word: "no data" },
};

const round = (n: number): number => Math.round(n * 100) / 100;

/**
 * A row of ticks, one per period, showing whether a service was up, degraded, down or unmeasured.
 * Status is carried by tick height and outline as well as color, and the text alternative
 * summarizes the counts and availability.
 *
 * @example
 * uptimeStrip({ slots: ["up", "up", "degraded", "down", "up"], label: "Site, last 5 hours" });
 */
export function uptimeStrip(options: UptimeStripOptions): string {
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
  const step = width / slots.length;
  const gap = step > 4 ? 1 : 0;

  const counts: Record<UptimeStatus, number> = { up: 0, degraded: 0, down: 0, unknown: 0 };
  const ticks = slots.map((slot, i) => {
    const status = typeof slot === "string" ? slot : slot.status;
    // Own properties only: "constructor" or "toString" from JSON is not a status (F15).
    if (typeof status !== "string" || !Object.hasOwn(STATUS, status)) {
      throw new Error(`uptimeStrip: slot ${i + 1} has unknown status "${String(status)}"`);
    }
    const spec = STATUS[status];
    counts[status] += 1;
    const h = height * spec.height;
    const title =
      typeof slot === "string" || !slot.label
        ? `Period ${i + 1}: ${spec.word}`
        : `${slot.label}: ${spec.word}`;
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

  const measured = counts.up + counts.degraded + counts.down;
  const availability =
    measured === 0
      ? "no measurements"
      : `${round(((counts.up + counts.degraded) / measured) * 100)}% available`;
  const parts = (Object.keys(counts) as UptimeStatus[])
    .filter((s) => counts[s] > 0)
    .map((s) => `${counts[s]} ${STATUS[s].word}`);
  const alt = given || `${subject}: ${slots.length} periods, ${parts.join(", ")}; ${availability}.`;

  return element(
    "svg",
    {
      class: "abscissa abscissa-uptime-strip",
      "data-abscissa": "uptime-strip",
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
