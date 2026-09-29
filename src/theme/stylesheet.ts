import { labelColor } from "./color.js";
import { assertCssText, defineTheme } from "./define.js";
import type { ColorScheme, Gridlines, HexColor, Theme } from "./types.js";

/** Options for {@link stylesheet}. */
export interface StylesheetOptions {
  /**
   * Selectors under which the page is dark or light, for sites that switch themes with an
   * attribute instead of setting `color-scheme` themselves, e.g. `{ dark: '[data-theme="dark"]' }`.
   * Without them, charts follow the page's `color-scheme`, which is the preferred mechanism.
   */
  readonly colorScheme?: { readonly dark?: string; readonly light?: string };
}

type Variables = ReadonlyArray<readonly [name: string, light: string, dark: string]>;

function colorVariables(light: ColorScheme, dark: ColorScheme): Variables {
  const pairs: [string, HexColor, HexColor][] = [
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
  });
  return pairs;
}

const HIDDEN_GRIDS: Readonly<Record<Gridlines, readonly string[]>> = {
  none: ["x-grid", "y-grid"],
  x: ["y-grid"],
  y: ["x-grid"],
  both: [],
};

/** Rules that do not depend on the theme: layout, legend, data table and the enhancement layer. */
const BASE_RULES = `
.enarratio {
  margin: 0;
  color: var(--enarratio-text);
  font-family: var(--enarratio-font);
  font-size: 1rem;
}
.enarratio-frame { overflow-x: auto; }
.enarratio-frame-wide > svg { min-width: 30rem; }
.enarratio svg {
  display: block;
  max-width: 100%;
  height: auto;
  overflow: visible;
  font-family: inherit;
  font-size: 12px;
}
svg.enarratio { display: inline-block; vertical-align: middle; }
.enarratio [data-enarratio-mark$="tick label"],
.enarratio .enarratio-numeric {
  font-family: var(--enarratio-font-numeric);
  font-variant-numeric: tabular-nums;
}
.enarratio [data-enarratio-mark*="axis"] { color: var(--enarratio-text-muted); }
.enarratio [data-enarratio-mark$="grid"] { stroke: var(--enarratio-grid); stroke-opacity: 1; }
.enarratio [data-enarratio-mark="rule"] { stroke: var(--enarratio-text-muted); }
.enarratio-title { margin: 0 0 0.5em; font-weight: 600; }
.enarratio-caption { margin: 0.5em 0 0; color: var(--enarratio-text-muted); font-size: 0.875em; }
.enarratio-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25em 1em;
  margin: 0 0 0.5em;
  padding: 0;
  list-style: none;
  font-size: 0.875em;
}
.enarratio-legend li, .enarratio-legend button { display: inline-flex; align-items: center; gap: 0.4em; }
.enarratio-legend button {
  margin: 0;
  padding: 0.125em 0.25em;
  border: 1px solid transparent;
  border-radius: 0.25em;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.enarratio-legend button[aria-pressed="true"] { border-color: currentColor; font-weight: 600; }
.enarratio-swatch {
  display: inline-block;
  width: 0.8em;
  height: 0.8em;
  border-radius: 0.15em;
  forced-color-adjust: none;
}
${Array.from(
  { length: 8 },
  (_, i) =>
    `.enarratio [data-slot="${i + 1}"] { --enarratio-slot: var(--enarratio-series-${i + 1}); }`,
).join("\n")}
${Array.from(
  { length: 5 },
  (_, i) =>
    `.enarratio [data-step="${i + 1}"] { --enarratio-slot: var(--enarratio-sequential-${i + 1}); }`,
).join("\n")}
.enarratio-swatch { background: var(--enarratio-slot); }
.enarratio-data { margin: 0.5em 0 0; font-size: 0.875em; }
.enarratio-data summary { cursor: pointer; color: var(--enarratio-text-muted); }
.enarratio-data table { border-collapse: collapse; margin-top: 0.5em; }
.enarratio-data th, .enarratio-data td {
  padding: 0.2em 0.75em 0.2em 0;
  border-bottom: 1px solid var(--enarratio-grid);
  text-align: left;
}
.enarratio-data td { font-variant-numeric: tabular-nums; text-align: right; }
.enarratio-visually-hidden {
  position: absolute !important;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
.enarratio-tooltip {
  position: absolute;
  z-index: 10;
  max-width: 18em;
  padding: 0.35em 0.6em;
  border: 1px solid var(--enarratio-grid);
  border-radius: 0.3em;
  background: var(--enarratio-background);
  color: var(--enarratio-text);
  font-family: var(--enarratio-font);
  font-size: 0.8125rem;
  line-height: 1.35;
  box-shadow: 0 2px 8px rgb(0 0 0 / 15%);
}
.enarratio-tooltip[hidden] { display: none; }
.enarratio [data-enarratio-key] { transition: opacity 150ms ease-out; }
.enarratio[data-enarratio-interactive] [data-enarratio-field] { cursor: pointer; }
.enarratio [data-enarratio-dimmed] { opacity: 0.25; }
.enarratio [data-enarratio-key]:focus { outline: none; }
/* The focus ring: a background-colored ring inside a focus-colored one, so one of the two always
   contrasts with whatever mark or background is next to it. */
.enarratio-focus-ring { pointer-events: none; fill: none; }
.enarratio-focus-ring-inner { stroke: var(--enarratio-background); stroke-width: 5px; }
.enarratio-focus-ring-outer { stroke: var(--enarratio-focus); stroke-width: 2.5px; }
/* Invisible targets that make small marks at least 24 CSS pixels to point at. */
.enarratio-hit { fill: transparent; stroke: none; }
.enarratio svg:focus-visible, .enarratio-legend button:focus-visible {
  outline: 3px solid var(--enarratio-focus);
  outline-offset: 2px;
}
.enarratio-brush { fill: var(--enarratio-focus); fill-opacity: 0.15; stroke: var(--enarratio-focus); }
@keyframes enarratio-grow { from { transform: scaleY(0); } }
@keyframes enarratio-grow-x { from { transform: scaleX(0); } }
@keyframes enarratio-draw { from { stroke-dashoffset: var(--enarratio-length); } }
@keyframes enarratio-fade { from { opacity: 0; } }
.enarratio[data-enarratio-entering] [data-enarratio-mark="bar"] > * {
  transform-box: fill-box;
  transform-origin: bottom;
  animation: enarratio-grow 600ms cubic-bezier(0.2, 0.7, 0.3, 1) both;
}
.enarratio[data-enarratio-entering][data-enarratio-orientation="horizontal"] [data-enarratio-mark="bar"] > * {
  transform-origin: left;
  animation-name: enarratio-grow-x;
}
.enarratio[data-enarratio-entering] [data-enarratio-mark="dot"] > *,
.enarratio[data-enarratio-entering] [data-enarratio-mark="area"] > *,
.enarratio[data-enarratio-entering] [data-enarratio-mark="cell"] > * {
  animation: enarratio-fade 500ms ease-out both;
}
.enarratio[data-enarratio-entering] [data-enarratio-mark="line"] > path {
  stroke-dasharray: var(--enarratio-length);
  animation: enarratio-draw 800ms ease-out both;
}
@media (prefers-reduced-motion: reduce) {
  .enarratio *, .enarratio-tooltip { animation: none !important; transition: none !important; }
}
`;

function declarations(entries: ReadonlyArray<readonly [string, string]>, indent = "  "): string {
  return entries.map(([name, value]) => `${indent}--enarratio-${name}: ${value};`).join("\n");
}

/**
 * The CSS a page includes once to style every Enarratio chart with a theme. Charts contain no
 * colors of their own, only references to the custom properties defined here, so the same
 * server-rendered markup follows the theme and switches between light and dark without a re-render.
 *
 * Light or dark follows the page's `color-scheme` through CSS `light-dark()`; browsers without it
 * get the light scheme.
 */
export function stylesheet(theme: Theme, options: StylesheetOptions = {}): string {
  // Everything written into the CSS is checked first, so a theme from data cannot break out of
  // the stylesheet (F10). The scheme selectors are the page's own, trusted, but still may not
  // contain what would end a rule.
  defineTheme(theme);
  for (const [which, selector] of Object.entries(options.colorScheme ?? {})) {
    if (selector !== undefined) assertCssText(`colorScheme.${which} selector`, selector);
  }
  const variables = colorVariables(theme.light, theme.dark);
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

  return [
    `/* Enarratio theme: ${theme.name} */`, // safe: defineTheme refused comment and tag syntax
    `.enarratio, .enarratio-tooltip {\n${declarations(fonts)}\n${declarations(
      variables.map(([name, light]) => [name, light]),
    )}\n}`,
    `@supports (color: light-dark(#000, #fff)) {\n  .enarratio, .enarratio-tooltip {\n${declarations(
      variables.map(([name, light, dark]) => [name, `light-dark(${light}, ${dark})`]),
      "    ",
    )}\n  }\n}`,
    ...schemeRules,
    BASE_RULES.trim(),
    hidden,
  ]
    .filter(Boolean)
    .join("\n");
}
