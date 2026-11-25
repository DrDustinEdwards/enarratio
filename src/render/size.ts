/** The size every chart draws at unless its options say otherwise, in CSS pixels. */

import { maxOf, minOf } from "./data.js";
export const DEFAULT_WIDTH = 640;
export const DEFAULT_HEIGHT = 320;
/** Drawings this wide or wider scroll in their frame rather than shrink below 30rem. */
export const WIDE_WIDTH = 480;

/**
 * The `font-size` every chart's SVG carries: the mark size, which follows the reader's font size,
 * raised as the drawing shrinks so its text never renders below 12 CSS pixels at default zoom. A
 * drawing `width` wide renders at its frame's width (`100cqw`), down to 30rem when wide, or 288px
 * when not. Text of f user units renders at f x rendered / width, a reciprocal CSS cannot write,
 * so the size grows linearly as the frame narrows, reaching 12px at the narrowest.
 */
export function markFontSize(width: number): string {
  const mark = "var(--enarratio-font-size-mark, 0.75rem)";
  const narrowest = width >= WIDE_WIDTH ? WIDE_WIDTH : 288;
  if (width <= narrowest) return mark;
  const r = (n: number): number => Math.round(n * 100) / 100;
  return `clamp(${mark}, calc(${r(12 + (12 * width) / narrowest)}px - ${r(1200 / narrowest)}cqw), ${r((12 * width) / narrowest)}px)`;
}

/** How much a drawing's text grows, in user units, at its narrowest rendering ({@link markFontSize}): 1 for one no wider than that. */
export function textGrowth(width: number): number {
  return Math.max(1, width / (width >= WIDE_WIDTH ? WIDE_WIDTH : 288));
}

/** About how wide a character of mark text is, in user units, at the drawing's narrowest. */
export function charWidth(width: number): number {
  return 7 * textGrowth(width);
}

/** Labels a value axis prints: numbers, with grouping, signs, units of scale or percent. */
const NUMERIC = /^[-−+]?[$€£¥]?[\d.,   ]+(?:[%kKMBTGµ]|e[-−+]?\d+)?$/;

/**
 * The left margin a drawing needs for its y tick labels so they never leave it at a narrow width:
 * the tick gap (9), the widest label, then 3 from the edge. Only a numeric value axis is fitted;
 * the y axis title sits above the labels and takes no room here.
 */
export function leftMargin(base: number, labels: readonly string[], width: number): number {
  if (labels.length === 0 || !labels.every((l) => NUMERIC.test(l.trim()))) return base;
  const longest = Math.max(...labels.map((l) => l.length));
  return Math.max(base, Math.ceil(9 + longest * charWidth(width) + 3));
}

/**
 * The top margin a drawing needs for a y axis title above its tick labels: the title's line from 3
 * units below the top edge, half a line for the top tick label (centered on the frame's edge) and
 * 4 between them, in text that grows as the drawing shrinks. Never less than `base`.
 */
export function topMargin(base: number, title: boolean, width: number): number {
  return title ? Math.max(base, Math.ceil(3 + 4 + 13 * 1.5 * textGrowth(width))) : base;
}

/** Where the x axis title's baseline sits, in ems below the first tick label's top: about one blank line past the tick labels. */
export const TITLE_LINES = 1.5;

/**
 * The bottom margin a drawing needs so its x tick labels and x axis title never overlap or leave
 * the drawing at a narrow width: the tick gap and space below (10 together), a line of growing
 * text (13 units) per line of tick label (two on a time axis that names a month), and
 * TITLE_LINES and a descender's quarter more for the title. Never less than `base`.
 */
export function bottomMargin(
  base: number,
  title: boolean,
  width: number,
  lines = 1,
  titleLines = 1,
): number {
  if (title) {
    return Math.max(
      base,
      Math.ceil(
        10 +
          13 * (lines + TITLE_LINES + 0.25 + (titleLines - 1) * TITLE_LEADING) * textGrowth(width),
      ),
    );
  }
  // Without a title, tick labels wrapped onto more lines still need their room: the tick gap and
  // a line of 12 for each.
  return lines > 1 ? Math.max(base, Math.ceil(9 + 12 * lines * textGrowth(width))) : base;
}

/** How many lines an x axis title takes at a drawing's narrowest (fitTitle): 1 or 2. */
export const titleLines = (title: string | null | undefined, width: number): number =>
  title ? fitTitle(title, width / 2, width).lines.length : 1;

/** The line height, in ems, of an x axis title wrapped onto a second line. */
export const TITLE_LEADING = 1.2;

/** Text cut to `room` characters, ending in an ellipsis when it was longer. */
export const cutText = (text: string, room: number): string =>
  text.length <= room ? text : `${text.slice(0, Math.max(1, room - 1)).trimEnd()}…`;

/**
 * An x axis title fitted to a drawing `width` wide at its narrowest: centered under the plot at
 * `center` while it fits, else on the drawing, else wrapped at the space that best balances two
 * lines (the second cut short if it still overruns). Each line keeps 3 units from either edge.
 */
export function fitTitle(
  title: string,
  center: number,
  width: number,
): { readonly x: number; readonly lines: readonly string[] } {
  const char = charWidth(width);
  const room = Math.floor((width - 6) / char);
  if (title.length * char <= 2 * Math.min(center - 3, width - 3 - center)) {
    return { x: center, lines: [title] };
  }
  if (title.length <= room) return { x: width / 2, lines: [title] };
  return { x: width / 2, lines: wrapTwo(title, room) };
}

/**
 * Text in at most two lines of `room` characters: broken at the space that best balances them,
 * the second cut short if it still runs over; one cut line when no space breaks it.
 */
export function wrapTwo(value: string, room: number): string[] {
  if (value.length <= room) return [value];
  const words = value.split(" ");
  let best: [string, string] | undefined;
  for (let i = 1; i < words.length; i++) {
    const first = words.slice(0, i).join(" ");
    const rest = words.slice(i).join(" ");
    if (first.length > room) break;
    if (
      best === undefined ||
      Math.max(first.length, rest.length) < Math.max(best[0].length, best[1].length)
    )
      best = [first, rest];
  }
  return best ? [best[0], cutText(best[1], room)] : [cutText(value, room)];
}

/**
 * A group's label on a category axis whose slots are `slot` units apart: whole while it fits, else
 * filled word by word onto up to three lines, the last cut short if it still runs over.
 */
export function axisLabel(name: string, slot: number, width: number): string {
  const room = Math.max(3, Math.floor((slot - 4) / charWidth(width)));
  if (name.length <= room) return name;
  const lines: string[] = [];
  let line = "";
  for (const word of name.split(" ")) {
    if (line === "" || `${line} ${word}`.length <= room)
      line = line === "" ? word : `${line} ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  const kept = lines.slice(0, 3);
  const rest = lines.slice(2).join(" ");
  if (lines.length > 3) kept[2] = rest;
  return kept.map((l) => cutText(l, room)).join("\n");
}

/**
 * Every nth x tick, from the first, so that no two labels overlap and at most `max` print. A label
 * is about 7 user units a character (more where text grows as the drawing shrinks) and needs 12
 * more between neighbors. A step that lands on the last tick is preferred, so 2020 to 2023 thins
 * to 2020 and 2023, not 2020 and 2022.
 */
export function fitTicks<T>(
  ticks: readonly T[],
  label: (t: T) => string,
  width: number,
  plotWidth: number,
  max?: number,
): T[] {
  const longest = Math.max(1, ...ticks.map((t) => label(t).length));
  const fit = Math.max(2, Math.floor(plotWidth / (longest * charWidth(width) + 12)) + 1);
  const limit = Math.max(1, Math.min(fit, max ?? fit));
  if (ticks.length <= limit) return [...ticks];
  if (limit === 1) return ticks.slice(0, 1);
  const last = ticks.length - 1;
  const least = Math.ceil(last / (limit - 1));
  let step = least;
  while (step < last && last % step !== 0) step++;
  // No step ends on the last tick without leaving only the two ends: take that only when the
  // least step would print no more than two either.
  if (step === last && Math.floor(last / least) + 1 > 2) step = least;
  return ticks.filter((_, i) => i % step === 0);
}

/**
 * Month ticks, in milliseconds, for a time axis over `ats` on a plot under 240 across, where one
 * tick per 80 pixels prints one or two: every 1, 2, 3, 4, 6 or 12 months, the fewest that leave
 * each label room. Null on a wider plot or a span under two months, which is labeled by day.
 */
export function monthTicks(
  ats: readonly number[],
  width: number,
  plotWidth: number,
  max?: number,
): number[] | null {
  if (plotWidth >= 240 || ats.length === 0) return null;
  const lo = new Date(minOf(ats));
  const hi = new Date(maxOf(ats));
  const span =
    (hi.getUTCFullYear() - lo.getUTCFullYear()) * 12 + hi.getUTCMonth() - lo.getUTCMonth();
  if (span < 2) return null;
  const fit = Math.max(2, Math.floor(plotWidth / (4 * charWidth(width) + 12)) + 1);
  const step = [1, 2, 3, 4, 6, 12].find((k) => Math.floor(span / k) + 1 <= fit) ?? 12;
  const out: number[] = [];
  // From the first month start on or after the first point, on months the step divides.
  const year = lo.getUTCFullYear();
  let month = lo.getUTCMonth() + (lo.getTime() > Date.UTC(year, lo.getUTCMonth(), 1) ? 1 : 0);
  month = Math.ceil(month / step) * step;
  for (;;) {
    const at = Date.UTC(year + Math.floor(month / 12), month % 12, 1);
    if (at > hi.getTime()) break;
    out.push(at);
    month += step;
  }
  // maxXTicks stays the most labels to print.
  return out.length >= 2 && out.length <= (max ?? Infinity) ? out : null;
}
