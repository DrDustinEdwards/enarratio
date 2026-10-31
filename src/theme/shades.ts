import { contrastRatio, readableShade } from "./color.js";
import type { ColorScheme, ThemeColor } from "./types.js";

/**
 * What the derived shades aim for: a tenth over the WCAG minimum (4.5:1 for text, 3:1 for
 * graphics), so a page whose background is a shade off the theme's does not drop them under it.
 */
const LABEL_TARGET = 4.6;
const EDGE_TARGET = 3.1;
const EDGE_MINIMUM = 3;

/**
 * The colors a scheme writes series names on the background in: its own `seriesLabels`, or each
 * series color darkened or lightened until it reaches 4.5:1 (B1).
 */
export function seriesLabels(scheme: ColorScheme): readonly ThemeColor[] {
  return (
    scheme.seriesLabels ??
    scheme.series.map((c) => readableShade(c, scheme.background, LABEL_TARGET))
  );
}

/**
 * The edge round each sequential step's cells: its own `sequentialEdges`, `transparent` for a step
 * that reaches 3:1 on the background by itself, or the step darkened or lightened until it does.
 */
export function sequentialEdges(scheme: ColorScheme): readonly (ThemeColor | "transparent")[] {
  return (
    scheme.sequentialEdges ??
    scheme.sequential.map((c) =>
      contrastRatio(c, scheme.background) >= EDGE_MINIMUM
        ? "transparent"
        : readableShade(c, scheme.background, EDGE_TARGET),
    )
  );
}
