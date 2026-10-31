import { type ColorVision, colorDifference, contrastRatio, hexOf, labelColor } from "./color.js";
import { sequentialEdges, seriesLabels } from "./shades.js";
import type { ColorScheme, HexColor, Theme, ThemeColor } from "./types.js";

/** Thresholds {@link checkTheme} measures against. Every field has a documented default. */
export interface CheckThresholds {
  /** Minimum contrast for text on the background. Default 4.5, WCAG 2.2 success criterion 1.4.3. */
  readonly text: number;
  /**
   * Minimum contrast for marks (series, status, focus ring, the darkest sequential step, and each
   * step's fill or edge) on the background. Default 3, WCAG 2.2 success criterion 1.4.11.
   */
  readonly graphics: number;
  /**
   * Minimum CIEDE2000 difference between any two series colors, with typical vision and under
   * each simulated color vision deficiency. Default 10: about ten just-noticeable differences,
   * enough to tell two small marks apart at a glance (B7).
   */
  readonly seriesDifference: number;
}

/** The thresholds used when none are given. */
export const DEFAULT_THRESHOLDS: CheckThresholds = {
  text: 4.5,
  graphics: 3,
  seriesDifference: 10,
};

/**
 * One finding. `error` means the theme fails an accessibility minimum; every check reports
 * errors, including two series colors that some readers could confuse. `warning` is kept for
 * findings that do not fail a theme; none do today.
 */
export interface CheckIssue {
  readonly severity: "error" | "warning";
  readonly scheme: "light" | "dark";
  readonly check:
    | "text-contrast"
    | "graphics-contrast"
    | "label-contrast"
    | "series-label-contrast"
    | "sequential-edge"
    | "series-difference"
    | "sequential-order";
  readonly message: string;
  /** The colors measured, as hex (a `var()` color by its fallback). */
  readonly colors: readonly HexColor[];
  /** The measured value: a contrast ratio or a CIEDE2000 difference. */
  readonly measured: number;
}

/** The result of {@link checkTheme}. `ok` is true when there are no errors; warnings may remain. */
export interface CheckReport {
  readonly theme: string;
  readonly ok: boolean;
  readonly issues: readonly CheckIssue[];
}

const VISIONS: readonly (ColorVision | undefined)[] = [
  undefined,
  "protanopia",
  "deuteranopia",
  "tritanopia",
];

const round = (n: number): number => Math.round(n * 100) / 100;

function checkScheme(
  which: "light" | "dark",
  scheme: ColorScheme,
  t: CheckThresholds,
): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const bg = scheme.background;

  const contrast = (
    name: string,
    color: ThemeColor,
    minimum: number,
    check: "text-contrast" | "graphics-contrast" | "series-label-contrast",
  ): void => {
    const ratio = contrastRatio(color, bg);
    if (ratio < minimum) {
      issues.push({
        severity: "error",
        scheme: which,
        check,
        message: `${which} ${name} ${color} has contrast ${round(ratio)}:1 on ${bg}; needs ${minimum}:1`,
        colors: [hexOf(color), hexOf(bg)],
        measured: round(ratio),
      });
    }
  };

  contrast("text", scheme.text, t.text, "text-contrast");
  contrast("mutedText", scheme.mutedText, t.text, "text-contrast");
  contrast("focus", scheme.focus, t.graphics, "graphics-contrast");
  scheme.series.forEach((c, i) => {
    contrast(`series ${i + 1}`, c, t.graphics, "graphics-contrast");
  });
  contrast("status.good", scheme.status.good, t.graphics, "graphics-contrast");
  contrast("status.warning", scheme.status.warning, t.graphics, "graphics-contrast");
  contrast("status.bad", scheme.status.bad, t.graphics, "graphics-contrast");
  // No data is drawn with a pattern too, but the mark must still be seen (B1).
  contrast("status.unknown", scheme.status.unknown, t.graphics, "graphics-contrast");
  contrast("sequential step 5", scheme.sequential[4], t.graphics, "graphics-contrast");

  // Series names written on the background (direct labels, curve labels) are text (B1).
  seriesLabels(scheme).forEach((c, i) => {
    contrast(`series ${i + 1} label`, c, t.text, "series-label-contrast");
  });

  // Every ramp step's cells must be seen against the background, by their fill or their edge.
  const edges = sequentialEdges(scheme);
  scheme.sequential.forEach((fill, i) => {
    const edge = edges[i] ?? "transparent";
    const ratio = Math.max(
      contrastRatio(fill, bg),
      edge === "transparent" ? 0 : contrastRatio(edge, bg),
    );
    if (ratio < t.graphics) {
      issues.push({
        severity: "error",
        scheme: which,
        check: "sequential-edge",
        message: `${which} sequential step ${i + 1} ${fill} and its edge ${edge} reach ${round(ratio)}:1 on ${bg}; one needs ${t.graphics}:1`,
        colors: [hexOf(fill), hexOf(bg)],
        measured: round(ratio),
      });
    }
  });

  // Text printed on marks (heatmap values, genome feature names, bar labels) takes the color
  // labelColor picks for each fill; it must reach body-text contrast there (F8).
  const fills: [string, ThemeColor][] = [
    ...scheme.series.map((c, i): [string, ThemeColor] => [`series ${i + 1}`, c]),
    ...scheme.sequential.map((c, i): [string, ThemeColor] => [`sequential step ${i + 1}`, c]),
  ];
  for (const [name, fill] of fills) {
    const label = labelColor(fill, scheme.text, scheme.background);
    const ratio = contrastRatio(label, fill);
    if (ratio < t.text) {
      issues.push({
        severity: "error",
        scheme: which,
        check: "label-contrast",
        message: `${which} labels on ${name} ${fill} (${label}) have contrast ${round(ratio)}:1; needs ${t.text}:1`,
        colors: [hexOf(label), hexOf(fill)],
        measured: round(ratio),
      });
    }
  }

  // Each step must stand further from the background than the one before, or "more" reads as less.
  for (let i = 1; i < scheme.sequential.length; i += 1) {
    const previous = scheme.sequential[i - 1] as ThemeColor;
    const current = scheme.sequential[i] as ThemeColor;
    if (contrastRatio(current, bg) <= contrastRatio(previous, bg)) {
      issues.push({
        severity: "error",
        scheme: which,
        check: "sequential-order",
        message: `${which} sequential step ${i + 1} ${current} does not contrast more with the background than step ${i} ${previous}`,
        colors: [hexOf(previous), hexOf(current)],
        measured: round(contrastRatio(current, bg)),
      });
    }
  }

  for (let i = 0; i < scheme.series.length; i += 1) {
    for (let j = i + 1; j < scheme.series.length; j += 1) {
      const a = scheme.series[i] as ThemeColor;
      const b = scheme.series[j] as ThemeColor;
      // One finding per pair, at the vision under which the two are hardest to tell apart.
      let worst = {
        difference: Number.POSITIVE_INFINITY,
        vision: undefined as ColorVision | undefined,
      };
      for (const vision of VISIONS) {
        const difference = colorDifference(a, b, vision);
        if (difference < worst.difference) worst = { difference, vision };
      }
      if (worst.difference < t.seriesDifference) {
        issues.push({
          severity: "error",
          scheme: which,
          check: "series-difference",
          message: `${which} series ${i + 1} ${a} and ${j + 1} ${b} differ by ${round(worst.difference)} (CIEDE2000) with ${worst.vision ?? "typical vision"}; needs ${t.seriesDifference}`,
          colors: [hexOf(a), hexOf(b)],
          measured: round(worst.difference),
        });
      }
    }
  }
  return issues;
}

/**
 * Measures a theme against accessibility minimums, in light and dark: text and mark contrast on
 * the background, series names written on the background (each series' label shade), every ramp
 * step by its fill or its edge, the order of the sequential ramp, and whether any two series colors could be
 * confused with typical vision or with protanopia, deuteranopia or tritanopia (simulated after
 * Machado et al. 2009, compared with CIEDE2000).
 *
 * It reports rather than throws; `stylesheet()` throws on any error, so a failing theme never
 * reaches a page.
 */
export function checkTheme(theme: Theme, thresholds: Partial<CheckThresholds> = {}): CheckReport {
  const t: CheckThresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const issues = [...checkScheme("light", theme.light, t), ...checkScheme("dark", theme.dark, t)];
  return { theme: theme.name, ok: issues.every((i) => i.severity !== "error"), issues };
}
