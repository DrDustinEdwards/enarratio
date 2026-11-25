import { calendarDates, DAY, markKey, maxOf, minOf, readDate } from "./data.js";
import { KIND, type BarChartOptions, type BarPoint } from "./bar-options.js";

type Interval = NonNullable<BarChartOptions<object>["interval"]>;

const pad = (n: number): string => String(n).padStart(2, "0");

function floorTo(t: number, interval: Interval): number {
  const d = new Date(t);
  switch (interval) {
    case "hour":
      return Math.floor(t / 3_600_000) * 3_600_000;
    case "day":
      return Math.floor(t / DAY) * DAY;
    case "week": {
      const day = Math.floor(t / DAY) * DAY;
      const sinceMonday = (new Date(day).getUTCDay() + 6) % 7;
      return day - sinceMonday * DAY;
    }
    case "month":
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    case "year":
      return Date.UTC(d.getUTCFullYear(), 0, 1);
  }
}

/** The start of the interval after the one starting at `start`. */
function nextAfter(start: number, interval: Interval): number {
  const d = new Date(start);
  switch (interval) {
    case "hour":
      return start + 3_600_000;
    case "day":
      return start + DAY;
    case "week":
      return start + 7 * DAY;
    case "month":
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
    case "year":
      return Date.UTC(d.getUTCFullYear() + 1, 0, 1);
  }
}

function labelFor(start: number, interval: Interval): string {
  const iso = new Date(start).toISOString();
  switch (interval) {
    case "hour":
      return `${iso.slice(0, 10)} ${pad(new Date(start).getUTCHours())}:00 UTC`;
    case "day":
    case "week":
      return iso.slice(0, 10);
    case "month":
      return iso.slice(0, 7);
    case "year":
      return iso.slice(0, 4);
  }
}

/** The most bars a time axis will draw, so a typo in a date cannot ask for millions. */
const MAX_PERIODS = 2000;

export function timeAxis<T extends object>(
  data: readonly T[],
  x: string,
  options: BarChartOptions<T>,
): { starts: number[]; names: string[]; byRow: string[] } {
  const interval = options.interval ?? "day";
  const rows = calendarDates(data.map((row, i) => readDate(KIND, row, x, i)));
  const starts = rows.map((d) => floorTo(d.getTime(), interval));
  const label = (start: number): string =>
    options.formatX ? options.formatX(new Date(start)) : labelFor(start, interval);
  const first = minOf(starts);
  const last = maxOf(starts);
  const periods: number[] = [];
  for (let t = first; t <= last; t = nextAfter(t, interval)) {
    periods.push(t);
    if (periods.length > MAX_PERIODS) {
      throw new Error(
        `${KIND}: the time axis would need more than ${MAX_PERIODS} bars between the first and last row; use a longer interval`,
      );
    }
  }
  const names = periods.map(label);
  if (new Set(names).size !== names.length) {
    throw new Error(`${KIND}: formatX gives two intervals the same label`);
  }
  return { starts: periods, names, byRow: starts.map(label) };
}

/** Throws unless `maxXTicks`, when given, is a whole number of 1 or more. */
export function requireMaxXTicks(max: number | undefined): void {
  if (max !== undefined && !(Number.isInteger(max) && max >= 1))
    throw new Error(`${KIND}: maxXTicks must be a whole number of 1 or more`);
}

const STEPS = [1, 2, 5];

export function countTicks(points: readonly BarPoint[], grouped: boolean): number[] {
  const totals = new Map<string, number>();
  for (const p of points) {
    const id = grouped ? markKey(p.x, p.series) : p.x;
    totals.set(id, (totals.get(id) ?? 0) + p.value);
  }
  const max = Math.max(1, maxOf(totals.values()));
  let step = 1;
  for (let magnitude = 1; ; magnitude *= 10) {
    const found = STEPS.map((s) => s * magnitude).find((s) => max / s <= 6);
    if (found !== undefined) {
      step = found;
      break;
    }
  }
  const ticks: number[] = [];
  for (let t = 0; t < max + step; t += step) ticks.push(t);
  return ticks;
}
