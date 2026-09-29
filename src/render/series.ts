import type { LegendItem, SeriesColor } from "./figure.js";

/** The number of palette slots every theme defines, and so the most series one chart can show. */
const MAX_SERIES = 8;

/** How a chart's series map onto palette slots. */
export interface SeriesPlan {
  readonly names: readonly string[];
  /** The CSS color reference for each series, in order, for Plot's color scale range. */
  readonly range: readonly string[];
  readonly legend: readonly LegendItem[];
  readonly slotColors: ReadonlyMap<number, SeriesColor>;
  slot(name: string): number;
}

/** A CSS reference to a palette slot. */
function slotColor(slot: number): string {
  return `var(--enarratio-series-${slot})`;
}

/**
 * Assigns series to palette slots in order, and applies per-series color overrides to their
 * slots. Throws when there are more series than slots or an override names no series, because
 * both would otherwise draw a chart that is quietly wrong.
 */
export function planSeries(
  kind: string,
  names: readonly string[],
  colors: Readonly<Record<string, SeriesColor>> | undefined,
): SeriesPlan {
  if (names.length > MAX_SERIES) {
    throw new Error(
      `${kind}: ${names.length} series, but a theme has ${MAX_SERIES} colors; group the smallest series into "Other"`,
    );
  }
  const slots = new Map(names.map((name, i) => [name, i + 1]));
  const slotColors = new Map<number, SeriesColor>();
  for (const [name, color] of Object.entries(colors ?? {})) {
    const slot = slots.get(name);
    if (slot === undefined) {
      throw new Error(
        `${kind}: colors names "${name}", which is not a series (${names.join(", ")})`,
      );
    }
    slotColors.set(slot, color);
  }
  return {
    names,
    range: names.map((_, i) => slotColor(i + 1)),
    legend: names.map((label, i) => ({ label, slot: i + 1 })),
    slotColors,
    slot(name) {
      const slot = slots.get(name);
      if (slot === undefined) throw new Error(`${kind}: unknown series "${name}"`);
      return slot;
    },
  };
}
