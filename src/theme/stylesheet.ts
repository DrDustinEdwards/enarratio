import { CONTROL_RULES } from "./base-controls.js";
import { LAYOUT_RULES } from "./base-rules.js";
import { checkTheme } from "./check.js";
import { labelColor } from "./color.js";
import { assertCssText, defineTheme } from "./define.js";
import { sequentialEdges, seriesLabels } from "./shades.js";
import type { ColorScheme, Gridlines, Theme } from "./types.js";

/** Options for {@link stylesheet}. */
export interface StylesheetOptions {
  /**
   * Selectors under which the page is dark or light, for sites that switch themes with an
   * attribute instead of setting `color-scheme` themselves, e.g. `{ dark: '[data-theme="dark"]' }`.
   * Without them, charts follow the page's `color-scheme`, which is the preferred mechanism.
   */
  readonly colorScheme?: { readonly dark?: string; readonly light?: string };
  /**
   * A theme whose colors replace the main theme's when the reader asks for more contrast
   * (`prefers-contrast: more`), e.g. `highContrastTheme` from `enarratio/themes`.
   * Its fonts and gridlines are not used.
   */
  readonly highContrast?: Theme;
}

type Variables = ReadonlyArray<readonly [name: string, light: string, dark: string]>;

function colorVariables(light: ColorScheme, dark: ColorScheme): Variables {
  const lightLabels = seriesLabels(light);
  const darkLabels = seriesLabels(dark);
  const lightEdges = sequentialEdges(light);
  const darkEdges = sequentialEdges(dark);
  const pairs: [string, string, string][] = [
    ["background", light.background, dark.background],
    ["text", light.text, dark.text],
    ["text-muted", light.mutedText, dark.mutedText],
    ["grid", light.grid, dark.grid],
    ["focus", light.focus, dark.focus],
    ["status-good", light.status.good, dark.status.good],
    ["status-warning", light.status.warning, dark.status.warning],
    ["status-bad", light.status.bad, dark.status.bad],
    ["status-unknown", light.status.unknown, dark.status.unknown],
  ];
  light.series.forEach((color, i) => {
    const darkColor = dark.series[i] ?? color;
    pairs.push([`series-${i + 1}`, color, darkColor]);
    // A label printed on a mark (a genome feature) takes whichever of text or background reads better.
    pairs.push([
      `series-text-${i + 1}`,
      labelColor(color, light.text, light.background),
      labelColor(darkColor, dark.text, dark.background),
    ]);
    // A series name written on the background (a direct label) takes a shade at 4.5:1 there.
    pairs.push([`series-label-${i + 1}`, lightLabels[i] ?? color, darkLabels[i] ?? darkColor]);
  });
  light.sequential.forEach((color, i) => {
    const darkColor = dark.sequential[i] ?? color;
    pairs.push([`sequential-${i + 1}`, color, darkColor]);
    // A label printed on a heatmap cell takes whichever of text or background reads better there.
    pairs.push([
      `sequential-text-${i + 1}`,
      labelColor(color, light.text, light.background),
      labelColor(darkColor, dark.text, dark.background),
    ]);
    // A step too pale to see on the background gets an edge at 3:1.
    pairs.push([
      `sequential-edge-${i + 1}`,
      lightEdges[i] ?? "transparent",
      darkEdges[i] ?? "transparent",
    ]);
  });
  return pairs;
}

const HIDDEN_GRIDS: Readonly<Record<Gridlines, readonly string[]>> = {
  none: ["x-grid", "y-grid"],
  x: ["y-grid"],
  y: ["x-grid"],
  both: [],
};

/**
 * The rules that do not depend on a theme: layout, legend, data table, tooltip, focus ring and
 * animation. They refer to the color and font custom properties without defining them, so a site
 * that defines those itself needs no theme object; every size, weight, radius and timing falls
 * back to Enarratio's own value. Shipped as `enarratio/base.css`; the contract is in docs/api.md.
 * A theme also hides gridlines (see {@link stylesheet}); a site using only these rules hides them
 * itself: `.enarratio [data-enarratio-mark="x-grid"] { display: none; }`.
 */
export function baseStylesheet(): string {
  return `/* Enarratio base rules */\n${(LAYOUT_RULES + CONTROL_RULES).trim()}`;
}

/** A theme's colors as custom properties: light, then light and dark where `light-dark()` works. */
function colorRules(theme: Theme): string {
  const variables = colorVariables(theme.light, theme.dark);
  return `.enarratio, .enarratio-tooltip {\n${declarations(
    variables.map(([name, light]) => [name, light]),
  )}\n}\n@supports (color: light-dark(#000, #fff)) {\n  .enarratio, .enarratio-tooltip {\n${declarations(
    variables.map(([name, light, dark]) => [name, `light-dark(${light}, ${dark})`]),
    "    ",
  )}\n  }\n}`;
}

function declarations(entries: ReadonlyArray<readonly [string, string]>, indent = "  "): string {
  return entries.map(([name, value]) => `${indent}--enarratio-${name}: ${value};`).join("\n");
}

/**
 * The CSS a page includes once to style every Enarratio chart with a theme. Charts hold references
 * to the custom properties defined here, not colors, so the same markup follows the theme and
 * switches between light and dark without a re-render. Light or dark follows the page's
 * `color-scheme` through `light-dark()`; browsers without it get light. Throws when a theme fails
 * {@link checkTheme}.
 */
export function stylesheet(theme: Theme, options: StylesheetOptions = {}): string {
  // Everything written into the CSS is checked first, so a theme from data cannot break out of the
  // stylesheet; the scheme selectors are trusted but may not contain what would end a rule.
  for (const t of [theme, options.highContrast]) {
    if (!t) continue;
    // A theme that fails the checks would draw charts some readers cannot read.
    const errors = checkTheme(defineTheme(t))
      .issues.filter((i) => i.severity === "error")
      .map((i) => i.message);
    if (errors.length > 0)
      throw new Error(`theme "${t.name}" fails checkTheme: ${errors.join("; ")}`);
  }
  for (const [which, selector] of Object.entries(options.colorScheme ?? {})) {
    if (selector !== undefined) assertCssText(`colorScheme.${which} selector`, selector);
  }
  const fonts: [string, string][] = [
    ["font", theme.fonts.body],
    ["font-numeric", theme.fonts.numeric ?? theme.fonts.body],
  ];
  const hidden = HIDDEN_GRIDS[theme.gridlines]
    .map((grid) => `.enarratio [data-enarratio-mark="${grid}"] { display: none; }`)
    .join("\n");
  const schemeRules = [
    options.colorScheme?.dark
      ? `:where(${options.colorScheme.dark}) .enarratio { color-scheme: dark; }`
      : "",
    options.colorScheme?.light
      ? `:where(${options.colorScheme.light}) .enarratio { color-scheme: light; }`
      : "",
  ].filter(Boolean);

  const more = options.highContrast;
  return [
    `/* Enarratio theme: ${theme.name} */`, // safe: defineTheme refused comment and tag syntax
    `.enarratio, .enarratio-tooltip {\n${declarations(fonts)}\n}`,
    colorRules(theme),
    more ? `@media (prefers-contrast: more) {\n${colorRules(more)}\n}` : "",
    ...schemeRules,
    baseStylesheet(),
    hidden,
  ]
    .filter(Boolean)
    .join("\n");
}

/** One per-chart override as the server writes it: series slots and checked color values. */
const COLOR_OVERRIDE =
  /^--enarratio-series-[1-8]: [#a-z0-9(),.%\s-]+(?:; --enarratio-series-[1-8]: [#a-z0-9(),.%\s-]+)*$/i;

/**
 * The CSS for the per-chart color overrides (`colors`, `color`) in some chart markup, one rule per
 * distinct override. Charts carry them in a `data-enarratio-colors` attribute, never `style`, so a
 * page under a hash-based CSP adds these rules to its own stylesheet.
 *
 * @example
 * const html = barChart({ ..., colors: { Talks: "#8a4a1b" } });
 * const css = colorStyles(html); // into the page's stylesheet
 */
export function colorStyles(markup: string): string {
  const rules = new Set<string>();
  for (const [, value = ""] of markup.matchAll(/data-enarratio-colors="([^"]*)"/g)) {
    if (!COLOR_OVERRIDE.test(value) || /url\s*\(/i.test(value)) {
      throw new Error(`"${value}" is not a color override Enarratio writes`);
    }
    // Series names written on the background follow the override, mixed toward the text color.
    const labels = [...value.matchAll(/--enarratio-series-([1-8]): ([^;]+)/g)].map(
      ([, n, color]) =>
        `--enarratio-series-label-${n}: color-mix(in srgb, ${color} 55%, var(--enarratio-text))`,
    );
    rules.add(`.enarratio[data-enarratio-colors="${value}"] { ${[value, ...labels].join("; ")}; }`);
  }
  return [...rules].join("\n");
}
