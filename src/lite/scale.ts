/**
 * The scales, ticks and tick labels the light charts need, written to give the same numbers as
 * the Observable Plot renderer, so both draw the same chart.
 *
 * The tick, nice, band, log and UTC time algorithms are ports of d3-array, d3-scale, d3-time and
 * d3-format (ISC License, Copyright 2010-2023 Mike Bostock), and the axis rules of Observable Plot
 * (ISC License, Copyright 2020-2025 Observable, Inc.).
 */

const E10 = Math.sqrt(50);
const E5 = Math.sqrt(10);
const E2 = Math.sqrt(2);

function tickSpec(start: number, stop: number, count: number): [number, number, number] {
  const step = (stop - start) / Math.max(0, count);
  const power = Math.floor(Math.log10(step));
  const error = step / 10 ** power;
  const factor = error >= E10 ? 10 : error >= E5 ? 5 : error >= E2 ? 2 : 1;
  let i1: number;
  let i2: number;
  let inc: number;
  if (power < 0) {
    inc = 10 ** -power / factor;
    i1 = Math.round(start * inc);
    i2 = Math.round(stop * inc);
    if (i1 / inc < start) ++i1;
    if (i2 / inc > stop) --i2;
    inc = -inc;
  } else {
    inc = 10 ** power * factor;
    i1 = Math.round(start / inc);
    i2 = Math.round(stop / inc);
    if (i1 * inc < start) ++i1;
    if (i2 * inc > stop) --i2;
  }
  if (i2 < i1 && 0.5 <= count && count < 2) return tickSpec(start, stop, count * 2);
  return [i1, i2, inc];
}

/** About `count` round numbers from `start` to `stop`, as d3.ticks. */
export function ticks(start: number, stop: number, count: number): number[] {
  if (!(count > 0)) return [];
  if (start === stop) return [start];
  const reverse = stop < start;
  const [i1, i2, inc] = reverse ? tickSpec(stop, start, count) : tickSpec(start, stop, count);
  if (!(i2 >= i1)) return [];
  const n = i2 - i1 + 1;
  const out: number[] = [];
  for (let i = 0; i < n; ++i) {
    const k = reverse ? i2 - i : i1 + i;
    out.push(inc < 0 ? k / -inc : k * inc);
  }
  return out;
}

function tickIncrement(start: number, stop: number, count: number): number {
  return tickSpec(start, stop, count)[2];
}

function tickStep(start: number, stop: number, count: number): number {
  const reverse = stop < start;
  const inc = reverse ? tickIncrement(stop, start, count) : tickIncrement(start, stop, count);
  return (reverse ? -1 : 1) * (inc < 0 ? 1 / -inc : inc);
}

/** A two-number domain or range. */
export type Pair = readonly [number, number];

/** A continuous position scale: linear, log or UTC time (as epoch milliseconds). */
export interface Continuous {
  readonly type: "linear" | "log" | "utc";
  readonly domain: Pair;
  readonly range: Pair;
  (value: number): number;
}

/** A linear, log or time scale from a domain to a range. */
export function continuous(type: Continuous["type"], domain: Pair, range: Pair): Continuous {
  const t = type === "log" ? Math.log10 : (v: number) => v;
  const d0 = t(domain[0]);
  const span = t(domain[1]) - d0;
  const [r0, r1] = range;
  const scale = (value: number): number => {
    const k = span === 0 ? 0.5 : (t(value) - d0) / span;
    return r0 * (1 - k) + r1 * k;
  };
  return Object.assign(scale, { type, domain, range });
}

/** Widens a linear domain to round numbers, as d3's linear `nice()`. */
export function niceLinear(domain: Pair, count = 10): Pair {
  let [start, stop] = domain;
  const reverse = stop < start;
  if (reverse) [start, stop] = [stop, start];
  let prestep: number | undefined;
  for (let i = 0; i < 10; i++) {
    const step = tickIncrement(start, stop, count);
    if (step === prestep) return reverse ? [stop, start] : [start, stop];
    if (step > 0) {
      start = Math.floor(start / step) * step;
      stop = Math.ceil(stop / step) * step;
    } else if (step < 0) {
      start = Math.ceil(start * step) / step;
      stop = Math.floor(stop * step) / step;
    } else break;
    prestep = step;
  }
  return domain;
}

/** A power of ten, written so that 10 ** -3 is exactly 0.001. */
const pow10 = (x: number): number => (Number.isFinite(x) ? Number(`1e${x}`) : x < 0 ? 0 : x);

/** Widens a log domain to powers of ten. */
export function niceLog(domain: Pair): Pair {
  const [a, b] = domain;
  const reverse = b < a;
  const [lo, hi] = reverse ? [b, a] : [a, b];
  const nice: Pair = [pow10(Math.floor(Math.log10(lo))), pow10(Math.ceil(Math.log10(hi)))];
  return reverse ? [nice[1], nice[0]] : nice;
}

/** Log ticks: every whole multiple of each power of ten in the domain, when few enough. */
export function logTicks(domain: Pair, count: number): number[] {
  let [u, v] = domain;
  const reverse = v < u;
  if (reverse) [u, v] = [v, u];
  let i = Math.log10(u);
  let j = Math.log10(v);
  let z: number[] = [];
  if (j - i < count) {
    i = Math.floor(i);
    j = Math.ceil(j);
    for (; i <= j; ++i) {
      for (let k = 1; k < 10; ++k) {
        const t = i < 0 ? k / pow10(-i) : k * pow10(i);
        if (t < u) continue;
        if (t > v) break;
        z.push(t);
      }
    }
    if (z.length * 2 < count) z = ticks(u, v, count);
  } else {
    z = ticks(i, j, Math.min(j - i, count)).map(pow10);
  }
  return reverse ? z.reverse() : z;
}

/** d3's minus sign. */
const MINUS = "−";

const group3 = (digits: string): string => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** `value` with `precision` decimals and thousands separators, as d3.format(",.{precision}f"). */
function fixed(value: number, precision: number): string {
  let negative = value < 0 || 1 / value < 0;
  const text = Math.abs(value).toFixed(precision);
  if (negative && Number(text) === 0) negative = false;
  const [whole = "", fraction] = text.split(".");
  return `${negative ? MINUS : ""}${group3(whole)}${fraction === undefined ? "" : `.${fraction}`}`;
}

/** The decimal exponent of a number, as d3-format reads it: NaN for zero or a non-finite number. */
const exponentOf = (value: number): number =>
  Number.isFinite(value) && value !== 0
    ? Number(Math.abs(value).toExponential().split("e")[1])
    : Number.NaN;

/** The tick labels of a linear scale: as many decimals as the tick step needs. */
export function linearTickFormat(domain: Pair, count: number): (value: number) => string {
  const step = tickStep(domain[0], domain[1], count);
  // d3-format reads a missing precision as 6 and holds a fixed precision to 0 through 20.
  const precision = Math.min(20, Math.max(0, -exponentOf(step)));
  return (value) => fixed(value, Number.isNaN(precision) ? 6 : precision);
}

const PREFIXES = [
  "y",
  "z",
  "a",
  "f",
  "p",
  "n",
  "µ",
  "m",
  "",
  "k",
  "M",
  "G",
  "T",
  "P",
  "E",
  "Z",
  "Y",
];

/** A number with an SI prefix and no trailing zeros, as d3.format("~s"). */
function si(value: number): string {
  if (value === 0) return "0";
  const [digits = "", exp = "0"] = Math.abs(value).toExponential(5).split("e");
  const coefficient = digits.replace(".", "");
  const exponent = Number(exp);
  const prefix = Math.max(-8, Math.min(8, Math.floor(exponent / 3)));
  const i = exponent - prefix * 3 + 1;
  const n = coefficient.length;
  let out =
    i === n
      ? coefficient
      : i > n
        ? coefficient + "0".repeat(i - n)
        : i > 0
          ? `${coefficient.slice(0, i)}.${coefficient.slice(i)}`
          : `0.${"0".repeat(-i)}${coefficient}`;
  if (out.includes(".")) out = out.replace(/\.?0+$/, "");
  return `${value < 0 ? MINUS : ""}${out}${PREFIXES[8 + prefix]}`;
}

/** The tick labels of a log scale: SI numbers, blank between powers of ten when crowded. */
export function logTickFormat(domain: Pair, count: number): (value: number) => string {
  const k = Math.max(1, (10 * count) / logTicks(domain, 10).length);
  return (d) => {
    let i = d / pow10(Math.round(Math.log10(d)));
    if (i * 10 < 10 - 0.5) i *= 10;
    return i <= k ? si(d) : "";
  };
}

/** A band scale: equal slots across a range, as d3.scaleBand with Plot's rounding rule. */
export interface Band {
  readonly step: number;
  readonly bandwidth: number;
  /** The start of slot `i`. */
  at(i: number): number;
}

/**
 * Slots for `n` categories across `range`. Rounded to whole pixels when that wastes no more than
 * 30 pixels, as Plot does.
 */
export function band(n: number, range: Pair, paddingInner: number, paddingOuter: number): Band {
  const [r0, r1] = range;
  const length = Math.abs(r1 - r0);
  const m = n - paddingInner;
  const raw = length / Math.max(1, m + paddingOuter * 2);
  const round = (raw - Math.floor(raw)) * m <= 30;
  const step = round ? Math.floor(raw) : raw;
  let start = Math.min(r0, r1) + (length - step * m) * 0.5;
  let bandwidth = step * (1 - paddingInner);
  if (round) {
    start = Math.round(start);
    bandwidth = Math.round(bandwidth);
  }
  return { step, bandwidth, at: (i) => start + step * i };
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

/** A UTC time interval on epoch milliseconds, as d3-time's. */
interface Interval {
  floor(t: number): number;
  offset(t: number, step: number): number;
}

const date = (t: number): Date => new Date(t);

/**
 * Midnight UTC on the first of a month, for any year. Date.UTC reads years 0 to 99 as 1900 to
 * 1999, so the year is set on its own, as d3-time does.
 */
function utcStart(year: number, month: number): number {
  const d = new Date(0);
  d.setUTCFullYear(year, month, 1);
  return d.getTime();
}

function every(base: Interval, test: (t: number) => boolean): Interval {
  return {
    floor(t) {
      let d = base.floor(t);
      while (!test(d)) d = base.floor(d - 1);
      return d;
    },
    offset(t, step) {
      let d = t;
      for (let i = 0; i < step; i++) {
        do d = base.offset(d, 1);
        while (!test(d));
      }
      return d;
    },
  };
}

const fixedInterval = (ms: number): Interval => ({
  floor: (t) => Math.floor(t / ms) * ms,
  offset: (t, step) => t + step * ms,
});

const utcSecond = fixedInterval(SECOND);
const utcMinute = fixedInterval(MINUTE);
const utcHour = fixedInterval(HOUR);
const unixDay = fixedInterval(DAY);
const utcSunday: Interval = {
  floor: (t) => {
    const day = Math.floor(t / DAY) * DAY;
    return day - date(day).getUTCDay() * DAY;
  },
  offset: (t, step) => t + step * WEEK,
};
const utcMonth: Interval = {
  floor: (t) => utcStart(date(t).getUTCFullYear(), date(t).getUTCMonth()),
  offset: (t, step) => {
    const d = date(t);
    d.setUTCMonth(d.getUTCMonth() + step);
    return d.getTime();
  },
};
const utcYear: Interval = {
  floor: (t) => utcStart(date(t).getUTCFullYear(), 0),
  offset: (t, step) => {
    const d = date(t);
    d.setUTCFullYear(d.getUTCFullYear() + step);
    return d.getTime();
  },
};

function yearsEvery(k: number): Interval {
  return {
    floor: (t) => utcStart(Math.floor(date(t).getUTCFullYear() / k) * k, 0),
    offset: (t, step) => {
      const d = date(t);
      d.setUTCFullYear(d.getUTCFullYear() + step * k);
      return d.getTime();
    },
  };
}

/** Every `k`th unit of an interval, counted by a calendar field (seconds, hours, months). */
function fieldEvery(base: Interval, field: (t: number) => number, k: number): Interval {
  return k === 1 ? base : every(base, (t) => field(t) % k === 0);
}

const TICK_INTERVALS: [string, number, number][] = [
  ["second", 1, SECOND],
  ["second", 5, 5 * SECOND],
  ["second", 15, 15 * SECOND],
  ["second", 30, 30 * SECOND],
  ["minute", 1, MINUTE],
  ["minute", 5, 5 * MINUTE],
  ["minute", 15, 15 * MINUTE],
  ["minute", 30, 30 * MINUTE],
  ["hour", 1, HOUR],
  ["hour", 3, 3 * HOUR],
  ["hour", 6, 6 * HOUR],
  ["hour", 12, 12 * HOUR],
  ["day", 1, DAY],
  ["day", 2, 2 * DAY],
  ["week", 1, WEEK],
  ["month", 1, MONTH],
  ["month", 3, 3 * MONTH],
  ["year", 1, YEAR],
];

function tickInterval(start: number, stop: number, count: number): Interval {
  const target = Math.abs(stop - start) / count;
  let i = TICK_INTERVALS.findIndex(([, , step]) => step > target);
  if (i === -1) i = TICK_INTERVALS.length;
  if (i === TICK_INTERVALS.length) {
    return yearsEvery(tickStep(start / YEAR, stop / YEAR, count));
  }
  if (i === 0) {
    const k = Math.max(tickStep(start, stop, count), 1);
    return fixedInterval(k);
  }
  const before = TICK_INTERVALS[i - 1] as [string, number, number];
  const after = TICK_INTERVALS[i] as [string, number, number];
  const [name, k] = target / before[2] < after[2] / target ? before : after;
  switch (name) {
    case "second":
      return fieldEvery(utcSecond, (t) => date(t).getUTCSeconds(), k);
    case "minute":
      return fieldEvery(utcMinute, (t) => date(t).getUTCMinutes(), k);
    case "hour":
      return fieldEvery(utcHour, (t) => date(t).getUTCHours(), k);
    case "day":
      return fieldEvery(unixDay, (t) => t / DAY, k);
    case "week":
      return utcSunday;
    case "month":
      return fieldEvery(utcMonth, (t) => date(t).getUTCMonth(), k);
    default:
      return utcYear;
  }
}

/** UTC time ticks from `start` to `stop` (epoch milliseconds), about `count` of them. */
export function timeTicks(start: number, stop: number, count: number): number[] {
  const reverse = stop < start;
  const [lo, hi] = reverse ? [stop, start] : [start, stop];
  const interval = tickInterval(lo, hi, count);
  const out: number[] = [];
  const end = hi + 1;
  let t = interval.offset(interval.floor(lo - 1), 1);
  t = interval.floor(t);
  while (t < end) {
    out.push(t);
    const next = interval.floor(interval.offset(t, 1));
    if (!(next > t)) break;
    t = next;
  }
  return reverse ? out.reverse() : out;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Zero-padded, with the sign ahead of the zeros, as d3-time-format pads. */
const pad = (n: number, width = 2): string =>
  `${n < 0 ? "-" : ""}${String(Math.abs(n)).padStart(width, "0")}`;

/** The parts of d3.utcFormat that time axes use. */
const part = {
  year: (t: number) => pad(date(t).getUTCFullYear() % 10000, 4),
  month: (t: number) => MONTHS[date(t).getUTCMonth()] ?? "",
  day: (t: number) => String(date(t).getUTCDate()),
  hour12: (t: number) => String(date(t).getUTCHours() % 12 || 12),
  ampm: (t: number) => (date(t).getUTCHours() >= 12 ? "PM" : "AM"),
  minute: (t: number) => pad(date(t).getUTCMinutes()),
  second: (t: number) => pad(date(t).getUTCSeconds()),
  milli: (t: number) => pad(date(t).getUTCMilliseconds(), 3),
};

type Format = (t: number) => string;

/** The two-level formats Plot puts on time axes: a fine label, and a coarse one when it changes. */
const TIME_FORMATS: Record<string, [Format, Format]> = {
  millisecond: [(t) => `.${part.milli(t)}`, (t) => `:${part.minute(t)}:${part.second(t)}`],
  second: [(t) => `:${part.second(t)}`, (t) => `${part.hour12(t)}:${part.minute(t)}`],
  minute: [(t) => `${part.hour12(t)}:${part.minute(t)}`, part.ampm],
  hour: [(t) => `${part.hour12(t)} ${part.ampm(t)}`, (t) => `${part.month(t)} ${part.day(t)}`],
  day: [part.day, part.month],
  month: [part.month, part.year],
};

/** An instant as ISO 8601, as the isoformat package writes it. */
function isoFormat(t: number): string {
  const d = date(t);
  const year = d.getUTCFullYear();
  const [h, m, s, ms] = [
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds(),
    d.getUTCMilliseconds(),
  ];
  const y = year < 0 ? `-${pad(-year, 6)}` : year > 9999 ? `+${pad(year, 6)}` : pad(year, 4);
  const time =
    h || m || s || ms
      ? `T${pad(h)}:${pad(m)}${s || ms ? `:${pad(s)}${ms ? `.${pad(ms, 3)}` : ""}` : ""}Z`
      : "";
  return `${y}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}${time}`;
}

const FORMAT_INTERVALS: [string, Interval, number][] = [
  ["year", utcYear, Number.POSITIVE_INFINITY],
  ["month", utcMonth, Number.POSITIVE_INFINITY],
  ["day", unixDay, 6 * MONTH],
  ["hour", utcHour, 3 * DAY],
  ["minute", utcMinute, 6 * HOUR],
  ["second", utcSecond, 30 * MINUTE],
];

/**
 * The labels of time ticks on a bottom axis, each a line or two: the finest unit every tick is
 * aligned to, with the coarser unit beneath where it changes ("Jan" over "2026").
 */
export function timeTickLabels(ticks: readonly number[]): string[] {
  let step: number | undefined;
  for (let i = 1; i < ticks.length; i++) {
    const gap = Math.abs((ticks[i] as number) - (ticks[i - 1] as number));
    if (step === undefined || gap > step) step = gap;
  }
  let name: string | undefined;
  if (step !== undefined && step < 1000) name = "millisecond";
  else {
    for (const [n, interval, maxStep] of FORMAT_INTERVALS) {
      if (step !== undefined && step > maxStep) break;
      if (n === "hour" && !step) break;
      if (ticks.every((t) => interval.floor(t) >= t)) {
        name = n;
        break;
      }
    }
  }
  if (name === undefined) return ticks.map(isoFormat);
  if (name === "year") return ticks.map(part.year);
  const [fine, coarse] = TIME_FORMATS[name] as [Format, Format];
  return ticks.map((t, i) => {
    const previous = ticks[i - 1];
    const f1 = fine(t);
    const f2 = coarse(t);
    return previous !== undefined && f2 === coarse(previous) ? f1 : `${f1}\n${f2}`;
  });
}
