/**
 * A color in hexadecimal notation (`#rgb` or `#rrggbb`). Themes are measured in hex, not
 * arbitrary CSS, so that Enarratio can check contrast and color-vision differences before
 * anything is drawn.
 */
export type HexColor = `#${string}`;

/**
 * A theme color: a hex color, or a site's own custom property with a hex fallback,
 * `var(--site-token, #rrggbb)`. The stylesheet writes the value as given, so the chart follows the
 * site's token; {@link checkTheme} and the shades Enarratio derives (labels, edges) measure the
 * fallback, so the fallback should be the token's value.
 */
export type ThemeColor = HexColor | `var(--${string}, #${string})`;

/**
 * Eight categorical colors, assigned to series in order. The length is fixed so that every chart
 * can rely on every slot existing: a chart never silently draws a series in an undefined color.
 */
export type SeriesPalette = readonly [
  ThemeColor,
  ThemeColor,
  ThemeColor,
  ThemeColor,
  ThemeColor,
  ThemeColor,
  ThemeColor,
  ThemeColor,
];

/**
 * Five steps of one hue for quantities (heatmaps, surveillance maps), from least to most. In a
 * dark scheme "most" is usually the lightest step, because it must stand out from the background.
 */
export type SequentialRamp = readonly [ThemeColor, ThemeColor, ThemeColor, ThemeColor, ThemeColor];

/** Colors for states that are not series: an uptime strip, a threshold, a warning band. */
export interface StatusColors {
  readonly good: ThemeColor;
  readonly warning: ThemeColor;
  readonly bad: ThemeColor;
  /** No data. Drawn with a pattern as well as this color, so it never relies on hue alone. */
  readonly unknown: ThemeColor;
}

/** Every color a chart uses, for one of light or dark. */
export interface ColorScheme {
  /** The surface charts sit on. Charts do not paint it; it is what contrast is measured against. */
  readonly background: ThemeColor;
  /** Titles, direct labels and values. */
  readonly text: ThemeColor;
  /** Axis labels, tick labels and captions. Still body-text contrast. */
  readonly mutedText: ThemeColor;
  /** Gridlines and axis rules. Decorative, so it is not held to a contrast minimum. */
  readonly grid: ThemeColor;
  /** The keyboard focus ring drawn by the enhancement layer. */
  readonly focus: ThemeColor;
  readonly series: SeriesPalette;
  readonly sequential: SequentialRamp;
  readonly status: StatusColors;
  /**
   * The color series names are written in when they sit on the background (direct labels, curve
   * labels), each at 4.5:1 or more on it. Optional: left out, the stylesheet darkens or lightens
   * each series color until it reaches 4.5:1. Give them when the series are `var()` tokens, so
   * the labels follow the site too.
   */
  readonly seriesLabels?: SeriesPalette;
  /**
   * The edge drawn round each cell of a sequential step (heatmap, heat strip), so a pale step
   * still reaches 3:1 against the background. Optional: left out, a step that reaches 3:1 itself
   * has no edge, and one that does not gets its own color darkened or lightened until it does.
   */
  readonly sequentialEdges?: SequentialRamp;
}

/** Which gridlines a theme shows. Charts always draw them; the theme's stylesheet hides the rest. */
export type Gridlines = "none" | "x" | "y" | "both";

/**
 * A site's visual identity for charts. A theme is pure data: charts render the same markup under
 * every theme, and {@link stylesheet} turns a theme into the CSS custom properties that markup reads.
 */
export interface Theme {
  /** A short identifier, used in check reports and the gallery. */
  readonly name: string;
  readonly fonts: {
    /** A CSS `font-family` list for chart text. */
    readonly body: string;
    /** A CSS `font-family` list for numbers, defaulting to `body`. Tabular figures are always on. */
    readonly numeric?: string;
  };
  readonly gridlines: Gridlines;
  readonly light: ColorScheme;
  readonly dark: ColorScheme;
}
