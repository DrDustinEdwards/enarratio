/**
 * The per-figure palette overrides, in a module of their own so a drawing that only needs them
 * (a sparkline in a browser bundle) does not bundle the figure's toolbar, table and strings.
 */

import type { SeriesColor } from "./figure.js";

/** What a caller-supplied color may contain: enough for hex, color functions and var(), not url(). */
const SAFE_COLOR = /^[#a-z0-9(),.%\s-]+$/i;

function cssColor(value: string): string {
  if (!SAFE_COLOR.test(value) || /url\s*\(/i.test(value)) {
    throw new Error(`"${value}" is not an allowed color; use hex, a color function or var(--name)`);
  }
  return value;
}

/**
 * Per-figure palette overrides as CSS declarations, or undefined when there are none. Charts carry
 * them in `data-enarratio-colors`, never a `style` attribute; {@link colorStyles} turns them into
 * rules for the page's stylesheet (D4).
 */
export function slotStyle(
  colors: ReadonlyMap<number, SeriesColor> | undefined,
): string | undefined {
  if (!colors || colors.size === 0) return undefined;
  return [...colors]
    .map(([slot, color]) => {
      const value =
        typeof color === "string"
          ? cssColor(color)
          : `light-dark(${cssColor(color.light)}, ${cssColor(color.dark)})`;
      return `--enarratio-series-${slot}: ${value}`;
    })
    .join("; ");
}
