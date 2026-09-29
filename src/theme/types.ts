/**
 * A color in hexadecimal notation (`#rgb` or `#rrggbb`). Themes use hex, not arbitrary CSS, so
 * that Enarratio can measure contrast and color-vision differences before anything is drawn.
 */
export type HexColor = `#${string}`;

/**
 * Eight categorical colors, assigned to series in order. The length is fixed so that every chart
 * can rely on every slot existing: a chart never silently draws a series in an undefined color.
 */
export type SeriesPalette = readonly [
  HexColor,
  HexColor,
  HexColor,
  HexColor,
  HexColor,
  HexColor,
  HexColor,
  HexColor,
];

/**
 * Five steps of one hue for quantities (heatmaps, surveillance maps), from least to most. In a
 * dark scheme "most" is usually the lightest step, because it must stand out from the background.
 */
export type SequentialRamp = readonly [HexColor, HexColor, HexColor, HexColor, HexColor];

/** Colors for states that are not series: an uptime strip, a threshold, a warning band. */
export interface StatusColors {
  readonly good: HexColor;
  readonly warning: HexColor;
  readonly bad: HexColor;
  /** No data. Drawn with a pattern as well as this color, so it never relies on hue alone. */
  readonly unknown: HexColor;
}

/** Every color a chart uses, for one of light or dark. */
export interface ColorScheme {
  /** The surface charts sit on. Charts do not paint it; it is what contrast is measured against. */
  readonly background: HexColor;
  /** Titles, direct labels and values. */
  readonly text: HexColor;
  /** Axis labels, tick labels and captions. Still body-text contrast. */
  readonly mutedText: HexColor;
  /** Gridlines and axis rules. Decorative, so it is not held to a contrast minimum. */
  readonly grid: HexColor;
  /** The keyboard focus ring drawn by the enhancement layer. */
  readonly focus: HexColor;
  readonly series: SeriesPalette;
  readonly sequential: SequentialRamp;
  readonly status: StatusColors;
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
