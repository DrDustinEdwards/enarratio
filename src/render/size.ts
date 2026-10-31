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
