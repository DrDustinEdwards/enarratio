/** The size every chart draws at unless its options say otherwise, in CSS pixels. */
export const DEFAULT_WIDTH = 640;
export const DEFAULT_HEIGHT = 320;
/** Drawings this wide or wider scroll in their frame rather than shrink below 30rem (A13). */
export const WIDE_WIDTH = 480;

/**
 * The `font-size` every chart's SVG carries (B3, B47): the mark size, which follows the reader's
 * font size, raised as the drawing shrinks so its text never renders below 12 CSS pixels at
 * default zoom. A drawing `width` wide renders at its frame's width (`100cqw`), down to 30rem when
 * wide, or to 288px (a 320px screen less its gutters) when not; text of f user units renders at
 * f × rendered ÷ width. That is a reciprocal CSS cannot write, so the size grows linearly as the
 * frame narrows, reaching the size that renders at 12px at the narrowest; between the two ends
 * the product only rises.
 */
export function markFontSize(width: number): string {
  const mark = "var(--enarratio-font-size-mark, 0.75rem)";
  const narrowest = width >= WIDE_WIDTH ? WIDE_WIDTH : 288;
  if (width <= narrowest) return mark;
  const r = (n: number): number => Math.round(n * 100) / 100;
  return `clamp(${mark}, calc(${r(12 + (12 * width) / narrowest)}px - ${r(1200 / narrowest)}cqw), ${r((12 * width) / narrowest)}px)`;
}

/**
 * How much a drawing's text grows, in user units, at its narrowest rendering ({@link markFontSize}):
 * 1 for a drawing no wider than that, more for one that shrinks to it.
 */
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
 * The left margin a drawing needs for its y tick labels and, when it has one, the rotated y axis
 * title beside them, so the two never overlap at a narrow width: the tick gap (9), the widest
 * label, then the title (about one line of text, 12 units, and 4 apart) 3 from the edge. Only a
 * numeric value axis is fitted; category axes size their margins to their names already.
 */
export function leftMargin(
  base: number,
  labels: readonly string[],
  title: boolean,
  width: number,
): number {
  if (labels.length === 0 || !labels.every((l) => NUMERIC.test(l.trim()))) return base;
  const longest = Math.max(...labels.map((l) => l.length));
  const needed = Math.ceil(
    9 + longest * charWidth(width) + (title ? 4 + 12 * textGrowth(width) + 3 : 3),
  );
  return Math.max(base, needed);
}

/**
 * Where the x axis title's baseline sits, in ems below the first tick label's top, past the tick
 * labels' own lines: about one blank line between them. Both renderers set the title there.
 */
export const TITLE_LINES = 1.5;

/**
 * The bottom margin a drawing needs so its x tick labels and, when it has one, the x axis title
 * below them never overlap or leave the drawing at a narrow width: the tick gap and the space
 * below (10 together), then a line of growing text (13 units, room for a site's mark size a
 * little over 12px) for each line of tick label (two on a time axis that names a month, "24"
 * over "Oct"), and TITLE_LINES and a descender's quarter more for the title. Never less than
 * `base`.
 */
export function bottomMargin(base: number, title: boolean, width: number, lines = 1): number {
  return title
    ? Math.max(base, Math.ceil(10 + 13 * (lines + TITLE_LINES + 0.25) * textGrowth(width)))
    : base;
}

/**
 * Every nth x tick, starting from the first, so that no two labels overlap and at most `max`
 * print: all of them when they fit. A label is about 7 user units a character at the mark size,
 * more on a drawing whose text grows as it shrinks (record 0022), and needs 12 more between
 * neighbors; n labels need n - 1 such gaps. A step that lands on the last tick is preferred, so
 * 2020 to 2023 thins to 2020 and 2023, not 2020 and 2022.
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
