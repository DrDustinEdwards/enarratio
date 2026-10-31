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
   * (`prefers-contrast: more`), e.g. `highContrastTheme` from `enarratio/themes` (B43, B49).
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
    // A series name written on the background (a direct label) takes a shade at 4.5:1 there (B1).
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
    // A step too pale to see on the background gets an edge at 3:1 (B1).
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

/** Dashes that tell lines 2 to 8 apart when forced colors make every line the same color. */
const LINE_DASHES = ["6 3", "2 3", "8 3 2 3", "12 4", "2 6", "4 4", "10 3 2 3 2 3"];

/** Rules that do not depend on the theme: layout, legend, data table and the enhancement layer. */
const BASE_RULES = `
.enarratio {
  margin: 0;
  color: var(--enarratio-text);
  font-family: var(--enarratio-font);
  font-size: var(--enarratio-font-size, 1rem);
}
/* The frame is the container the SVG's own font-size measures, so text grows as it shrinks (B3). */
.enarratio-frame { overflow-x: auto; container-type: inline-size; }
.enarratio-frame-wide > svg { min-width: 30rem; }
.enarratio svg {
  display: block;
  max-width: 100%;
  height: auto;
  overflow: visible;
  font-family: inherit;
}
.enarratio svg:not([font-size]) { font-size: var(--enarratio-font-size-mark, 0.75rem); }
svg.enarratio { display: inline-block; vertical-align: middle; max-width: 100%; height: auto; }
.enarratio [data-enarratio-mark$="tick label"],
.enarratio .enarratio-numeric {
  font-family: var(--enarratio-font-numeric);
  font-variant-numeric: tabular-nums;
}
.enarratio [data-enarratio-mark*="axis"] { color: var(--enarratio-text-muted); }
.enarratio [data-enarratio-mark$="grid"] { stroke: var(--enarratio-grid); stroke-opacity: 1; }
.enarratio [data-enarratio-mark="rule"] { stroke: var(--enarratio-text-muted); }
.enarratio-title {
  margin: 0 0 var(--enarratio-space, 0.5em);
  font-weight: var(--enarratio-font-weight-title, 600);
}
.enarratio-head { margin: 0 0 var(--enarratio-space, 0.5em); }
.enarratio-head p { margin: 0; }
.enarratio-head .enarratio-title { margin: 0; }
.enarratio-subtitle { color: var(--enarratio-text-muted); }
.enarratio-finding { margin-top: var(--enarratio-gap-row, 0.25em) !important; }
.enarratio-summary, .enarratio-caption, .enarratio-note, .enarratio-source {
  margin: var(--enarratio-space, 0.5em) 0 0;
  font-size: var(--enarratio-font-size-small, 0.875em);
}
.enarratio-caption, .enarratio-note, .enarratio-source { color: var(--enarratio-text-muted); }
.enarratio-source a { color: inherit; }
/* The export and embed buttons beside the CSV link read as the link does (C3, C4). */
.enarratio-source .enarratio-export {
  min-height: 24px;
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}
.enarratio-data:not([open]) .enarratio-hide, .enarratio-data[open] .enarratio-show { display: none; }
.enarratio-legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--enarratio-gap-row, 0.25em) var(--enarratio-gap, 1em);
  margin: 0 0 var(--enarratio-space, 0.5em);
  padding: 0;
  list-style: none;
  font-size: var(--enarratio-font-size-small, 0.875em);
}
.enarratio-legend li, .enarratio-legend button {
  display: inline-flex;
  align-items: center;
  gap: var(--enarratio-gap-inline, 0.4em);
}
.enarratio-legend button {
  margin: 0;
  padding: var(--enarratio-padding-button, 0.125em 0.25em);
  border: var(--enarratio-border-width, 1px) solid transparent;
  border-radius: var(--enarratio-radius, 0.25em);
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.enarratio-legend button[aria-pressed="true"] {
  border-color: currentColor;
  font-weight: var(--enarratio-font-weight-emphasis, 600);
}
.enarratio-swatch {
  display: inline-block;
  width: var(--enarratio-swatch-size, 0.8em);
  height: var(--enarratio-swatch-size, 0.8em);
  border-radius: var(--enarratio-radius-swatch, 0.15em);
  forced-color-adjust: none;
}
${Array.from(
  { length: 8 },
  (_, i) =>
    `.enarratio [data-slot="${i + 1}"] { --enarratio-slot: var(--enarratio-series-${i + 1}); --enarratio-slot-ink: var(--enarratio-series-text-${i + 1}); }
.enarratio [data-enarratio-mark="bar label"] [fill="var(--enarratio-series-text-${i + 1})"] { stroke: var(--enarratio-series-${i + 1}); }`,
).join("\n")}
${Array.from(
  { length: 5 },
  (_, i) =>
    `.enarratio [data-step="${i + 1}"] { --enarratio-slot: var(--enarratio-sequential-${i + 1}); --enarratio-slot-ink: var(--enarratio-sequential-text-${i + 1}); }`,
).join("\n")}
/* Series names written on the background (direct labels, curve labels, at-risk rows) take the
   series' label shade, at 4.5:1 on the background (B1). A site defining only the series colors
   gets a mix toward the text color instead; colorStyles() gives a chart's own override the same. */
${Array.from({ length: 8 }, (_, i) => {
  const n = i + 1;
  const mix = `color-mix(in srgb, var(--enarratio-series-${n}) 55%, var(--enarratio-text))`;
  return `.enarratio text[fill="var(--enarratio-series-${n})"], .enarratio g[fill="var(--enarratio-series-${n})"] > text { fill: var(--enarratio-series-label-${n}, ${mix}); }`;
}).join("\n")}
/* Each ramp step's cells and swatches carry an edge at 3:1 on the background where the step's own
   fill is paler than that (B1); transparent where it is not. A site defining only the ramp gets
   the muted text color round the three palest steps. */
${Array.from({ length: 5 }, (_, i) => {
  const n = i + 1;
  const edge = `var(--enarratio-sequential-edge-${n}, ${n <= 3 ? "var(--enarratio-text-muted)" : "transparent"})`;
  return `.enarratio [fill="var(--enarratio-sequential-${n})"] { stroke: ${edge}; stroke-width: var(--enarratio-cell-edge-width, 1px); }
.enarratio [data-step="${n}"] { --enarratio-slot-edge: ${edge}; }`;
}).join("\n")}
.enarratio, .enarratio-tooltip { --enarratio-texture: none; --enarratio-slot-edge: transparent; }
.enarratio-swatch { box-sizing: border-box; border: var(--enarratio-border-width, 1px) solid var(--enarratio-slot-edge); }
.enarratio-swatch { background: var(--enarratio-texture), var(--enarratio-slot); }
/* Filled series 2 to 8 carry a texture as well as a color (B5); the legend shows the same ones. */
.enarratio-texture { stroke-opacity: var(--enarratio-opacity-texture, 0.6); }
.enarratio:has(pattern) [data-slot] {
  --enarratio-ink: color-mix(in srgb, var(--enarratio-slot-ink) calc(var(--enarratio-opacity-texture, 0.6) * 100%), transparent);
  --enarratio-stripes: transparent 0 3px, var(--enarratio-ink) 3px 4.5px;
}
.enarratio:has(pattern) [data-slot="2"] { --enarratio-texture: repeating-linear-gradient(-45deg, var(--enarratio-stripes)); }
.enarratio:has(pattern) [data-slot="3"] { --enarratio-texture: radial-gradient(var(--enarratio-ink) 1px, transparent 1.5px) 0 0 / 4px 4px; }
.enarratio:has(pattern) [data-slot="4"] { --enarratio-texture: repeating-linear-gradient(0deg, var(--enarratio-stripes)); }
.enarratio:has(pattern) [data-slot="5"] { --enarratio-texture: repeating-linear-gradient(90deg, var(--enarratio-stripes)); }
.enarratio:has(pattern) [data-slot="6"] { --enarratio-texture: repeating-linear-gradient(45deg, var(--enarratio-stripes)); }
.enarratio:has(pattern) [data-slot="7"] {
  --enarratio-texture: repeating-linear-gradient(0deg, var(--enarratio-stripes)), repeating-linear-gradient(90deg, var(--enarratio-stripes));
}
.enarratio:has(pattern) [data-slot="8"] {
  --enarratio-texture: repeating-linear-gradient(45deg, var(--enarratio-stripes)), repeating-linear-gradient(-45deg, var(--enarratio-stripes));
}
/* A grid-colored edge, so adjacent bars and stacked segments never touch (B6). It is decoration,
   like a gridline, so a contrast check reads a bar by its fill, not by this edge (0026). */
.enarratio [data-enarratio-mark="bar"] [data-enarratio-key] {
  stroke: var(--enarratio-grid);
  stroke-width: var(--enarratio-bar-gap, 1px);
}
/* Names printed on bars keep a halo of their bar's color over its texture. */
.enarratio [data-enarratio-mark="bar label"] text {
  paint-order: stroke;
  stroke-width: var(--enarratio-halo-width, 3px);
  stroke-linejoin: round;
}
.enarratio-data {
  margin: var(--enarratio-space, 0.5em) 0 0;
  font-size: var(--enarratio-font-size-small, 0.875em);
}
.enarratio-data summary { cursor: pointer; color: var(--enarratio-text-muted); }
.enarratio-data table { border-collapse: collapse; margin-top: var(--enarratio-space, 0.5em); }
.enarratio-data th, .enarratio-data td {
  padding: var(--enarratio-cell-padding, 0.2em 0.75em 0.2em 0);
  border-bottom: var(--enarratio-border-width, 1px) solid var(--enarratio-grid);
  text-align: left;
}
.enarratio-data td { font-variant-numeric: tabular-nums; text-align: right; }
/* tableChart's cells: heat on the ramp step, and a bar beside the number it repeats. */
.enarratio-data .enarratio-heat { background: var(--enarratio-slot); color: var(--enarratio-slot-ink); }
.enarratio .enarratio-cell-bar {
  display: inline-block;
  width: 6em;
  height: 0.75em;
  margin-inline-start: 0.5em;
  vertical-align: middle;
}
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
  z-index: var(--enarratio-z-tooltip, 10);
  max-width: var(--enarratio-tooltip-max-width, 18em);
  padding: var(--enarratio-tooltip-padding, 0.35em 0.6em);
  border: var(--enarratio-border-width, 1px) solid var(--enarratio-grid);
  border-radius: var(--enarratio-radius-tooltip, 0.3em);
  background: var(--enarratio-background);
  color: var(--enarratio-text);
  font-family: var(--enarratio-font);
  font-size: var(--enarratio-font-size-tooltip, 0.8125rem);
  line-height: var(--enarratio-line-height-tooltip, 1.35);
  box-shadow: var(--enarratio-tooltip-shadow, 0 2px 8px rgb(0 0 0 / 15%));
}
.enarratio-tooltip[hidden] { display: none; }
.enarratio [data-enarratio-key] {
  transition: opacity var(--enarratio-duration-hover, 150ms) var(--enarratio-ease-out, ease-out);
}
.enarratio[data-enarratio-interactive] [data-enarratio-field] { cursor: pointer; }
.enarratio[data-enarratio-enhanced] [data-enarratio-href] { cursor: pointer; }
.enarratio [data-enarratio-dimmed] { opacity: var(--enarratio-opacity-dimmed, 0.25); }
.enarratio [data-enarratio-key]:focus { outline: none; }
/* The enhancement layer's points: a native control over each mark, for keyboards and screen
   readers (pointers use the marks). Focused, it draws a background-colored ring inside a
   focus-colored one, so one of the two always contrasts with whatever is next to it, above
   every mark. */
.enarratio-frame, .enarratio[data-enarratio-enhanced] { position: relative; }
.enarratio-points { position: absolute; pointer-events: none; }
.enarratio-points > * {
  position: absolute;
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
}
.enarratio .enarratio-points > :focus { outline: none; }
.enarratio .enarratio-points > :focus-visible {
  outline: var(--enarratio-focus-width-outer, 2.5px) solid var(--enarratio-focus);
  outline-offset: calc(var(--enarratio-focus-width-inner, 5px) / 2);
  box-shadow: 0 0 0 calc(var(--enarratio-focus-width-inner, 5px) / 2) var(--enarratio-background);
}
.enarratio [data-enarratio-faded] { opacity: var(--enarratio-opacity-faded, 0.5); }
/* The keys, shown while a point has focus and read as the points' description otherwise. */
.enarratio-frame:not(:focus-within) + .enarratio-hint {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.enarratio-hint {
  margin: var(--enarratio-space, 0.5em) 0 0;
  color: var(--enarratio-text-muted);
  font-size: var(--enarratio-font-size-small, 0.875em);
}
.enarratio-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: var(--enarratio-gap-row, 0.25em) var(--enarratio-gap-inline, 0.4em);
  margin: var(--enarratio-space, 0.5em) 0 0;
  font-size: var(--enarratio-font-size-small, 0.875em);
}
.enarratio-controls button, .enarratio-controls input, .enarratio-range summary {
  min-height: 24px;
  padding: var(--enarratio-padding-button, 0.125em 0.25em);
  border: var(--enarratio-border-width, 1px) solid var(--enarratio-text-muted);
  border-radius: var(--enarratio-radius, 0.25em);
  background: var(--enarratio-background);
  color: inherit;
  font: inherit;
}
.enarratio-controls button, .enarratio-range summary { cursor: pointer; }
.enarratio-range summary { width: fit-content; }
.enarratio-range form {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--enarratio-gap-row, 0.25em) var(--enarratio-gap-inline, 0.4em);
  margin-top: var(--enarratio-gap-row, 0.25em);
}
.enarratio-legend button { min-height: 24px; }
.enarratio-data th button {
  min-height: 24px;
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: inherit;
  cursor: pointer;
}
.enarratio-data th[aria-sort="ascending"] button::after { content: " \\2191" / ""; }
.enarratio-data th[aria-sort="descending"] button::after { content: " \\2193" / ""; }
.enarratio[data-enarratio-view-table] > :is(.enarratio-legend, .enarratio-frame, .enarratio-hint),
.enarratio[data-enarratio-view-table] .enarratio-range { display: none; }
.enarratio[data-enarratio-expanded] {
  position: fixed;
  inset: 0;
  z-index: var(--enarratio-z-expanded, 20);
  overflow: auto;
  padding: var(--enarratio-padding-expanded, 1rem);
  background: var(--enarratio-background);
}
/* Invisible targets that make small marks at least 24 CSS pixels to point at. */
.enarratio-hit { fill: transparent; stroke: none; }
.enarratio svg:focus-visible, .enarratio button:focus-visible, .enarratio-range summary:focus-visible,
.enarratio-controls input:focus-visible, .enarratio-frame:focus-visible {
  outline: var(--enarratio-focus-outline-width, 3px) solid var(--enarratio-focus);
  outline-offset: var(--enarratio-focus-outline-offset, 2px);
}
.enarratio-brush {
  fill: var(--enarratio-focus);
  fill-opacity: var(--enarratio-opacity-brush, 0.15);
  stroke: var(--enarratio-focus);
}
/* The timeline's plain list: read by screen readers beside the drawing, and shown in its place
   when the container has under 30rem. The threshold is a container query, which cannot use a
   custom property. */
.enarratio-timeline { container-type: inline-size; }
.enarratio-timeline-list {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
@container (max-width: 30rem) {
  .enarratio-timeline > svg { display: none; }
  .enarratio-timeline-list {
    position: static;
    width: auto;
    height: auto;
    margin: 0;
    padding: 0 0 0 var(--enarratio-timeline-list-indent, 1.25em);
    overflow: visible;
    clip-path: none;
    white-space: normal;
  }
  .enarratio-timeline-list li { margin: 0 0 var(--enarratio-space, 0.5em); }
}
@keyframes enarratio-grow { from { transform: scaleY(0); } }
@keyframes enarratio-grow-x { from { transform: scaleX(0); } }
@keyframes enarratio-draw { from { stroke-dashoffset: var(--enarratio-length); } }
@keyframes enarratio-fade { from { opacity: 0; } }
.enarratio[data-enarratio-entering] [data-enarratio-mark="bar"] > * {
  transform-box: fill-box;
  transform-origin: bottom;
  animation: enarratio-grow min(var(--enarratio-duration-grow, 600ms), 5s)
    var(--enarratio-ease-grow, cubic-bezier(0.2, 0.7, 0.3, 1)) both;
}
.enarratio[data-enarratio-entering][data-enarratio-orientation="horizontal"] [data-enarratio-mark="bar"] > * {
  transform-origin: left;
  animation-name: enarratio-grow-x;
}
.enarratio[data-enarratio-entering] [data-enarratio-mark="dot"] > *,
.enarratio[data-enarratio-entering] [data-enarratio-mark="area"] > *,
.enarratio[data-enarratio-entering] [data-enarratio-mark="cell"] > * {
  animation: enarratio-fade min(var(--enarratio-duration-fade, 500ms), 5s)
    var(--enarratio-ease-out, ease-out) both;
}
.enarratio[data-enarratio-entering] [data-enarratio-mark="line"] > path {
  stroke-dasharray: var(--enarratio-length);
  animation: enarratio-draw min(var(--enarratio-duration-draw, 800ms), 5s)
    var(--enarratio-ease-out, ease-out) both;
}
@media (prefers-reduced-motion: reduce) {
  .enarratio *, .enarratio-tooltip { animation: none !important; transition: none !important; }
}
/* More contrast: full-strength textures, wider gaps, and gridlines in the muted text color (B43). */
@media (prefers-contrast: more) {
  .enarratio-texture { stroke-opacity: 1; }
  .enarratio [data-enarratio-mark="bar"] [data-enarratio-key] { stroke-width: 2px; }
  .enarratio [data-enarratio-mark$="grid"] { stroke: var(--enarratio-text-muted); }
  .enarratio-swatch { outline: 1px solid var(--enarratio-text); }
}
/* Forced colors (Windows High Contrast): every color becomes one of the reader's system colors.
   Series are all CanvasText, told apart by textures, line dashes, symbols and labels; the
   sequential ramp becomes steps between Canvas and CanvasText. Set on the drawing and legend
   themselves, so they win over a theme or a per-chart override set on the figure (B57, D3). */
@media (forced-colors: active) {
  .enarratio svg, svg.enarratio { forced-color-adjust: none; }
  .enarratio svg, svg.enarratio, .enarratio-legend, .enarratio-tooltip {
    --enarratio-background: Canvas;
    --enarratio-text: CanvasText;
    --enarratio-text-muted: CanvasText;
    --enarratio-grid: GrayText;
    --enarratio-focus: Highlight;
    --enarratio-status-good: CanvasText;
    --enarratio-status-warning: CanvasText;
    --enarratio-status-bad: CanvasText;
    --enarratio-status-unknown: GrayText;
${Array.from(
  { length: 8 },
  (_, i) =>
    `    --enarratio-series-${i + 1}: CanvasText;\n    --enarratio-series-text-${i + 1}: Canvas;\n    --enarratio-series-label-${i + 1}: CanvasText;`,
).join("\n")}
${[10, 25, 40, 70, 100]
  .map(
    (mix, i) =>
      `    --enarratio-sequential-${i + 1}: color-mix(in srgb, CanvasText ${mix}%, Canvas);\n    --enarratio-sequential-text-${i + 1}: ${i < 3 ? "CanvasText" : "Canvas"};\n    --enarratio-sequential-edge-${i + 1}: CanvasText;`,
  )
  .join("\n")}
  }
  .enarratio-texture { stroke-opacity: 1; }
  .enarratio [data-enarratio-mark="area"] { fill-opacity: 1; }
${LINE_DASHES.map(
  (dash, i) =>
    `  .enarratio [data-enarratio-mark="line"] [stroke="var(--enarratio-series-${i + 2})"] { stroke-dasharray: ${dash}; }`,
).join("\n")}
}
/* Print: the light scheme, the whole drawing on one page, the data table open and no
   interactive overlays (C5). */
@media print {
  .enarratio, .enarratio-tooltip { color-scheme: light; }
  .enarratio { break-inside: avoid; }
  .enarratio-frame { overflow: visible; }
  .enarratio-frame-wide > svg { min-width: 0; }
  .enarratio-data::details-content { content-visibility: visible; block-size: auto; }
  .enarratio-tooltip, .enarratio-brush, .enarratio [data-enarratio-control], .enarratio-export {
    display: none !important;
  }
}
`;

/**
 * The rules that do not depend on a theme: layout, legend, data table, tooltip, focus ring and
 * animation. They refer to the color and font custom properties (`--enarratio-text`,
 * `--enarratio-series-1` and the rest) without defining them, so a site that defines those itself
 * (or a generated theme) needs no theme object. Every size, weight, radius and timing is a
 * custom property whose fallback is Enarratio's own value, so setting none of them changes
 * nothing. The same rules ship as `enarratio/base.css`. The full contract is in docs/api.md.
 *
 * The one thing a theme adds beyond properties is hiding gridlines (see {@link stylesheet}); a
 * site using only the base rules hides them itself, e.g.
 * `.enarratio [data-enarratio-mark="x-grid"] { display: none; }`.
 */
export function baseStylesheet(): string {
  return `/* Enarratio base rules */\n${BASE_RULES.trim()}`;
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
 * The CSS a page includes once to style every Enarratio chart with a theme. Charts contain no
 * colors of their own, only references to the custom properties defined here, so the same
 * server-rendered markup follows the theme and switches between light and dark without a re-render.
 *
 * Light or dark follows the page's `color-scheme` through CSS `light-dark()`; browsers without it
 * get the light scheme. Throws when a theme fails {@link checkTheme}, so a chart is never drawn in
 * colors some readers cannot tell apart.
 */
export function stylesheet(theme: Theme, options: StylesheetOptions = {}): string {
  // Everything written into the CSS is checked first, so a theme from data cannot break out of
  // the stylesheet (F10). The scheme selectors are the page's own, trusted, but still may not
  // contain what would end a rule.
  for (const t of [theme, options.highContrast]) {
    if (!t) continue;
    // A theme that fails the checks would draw charts some readers cannot read (B1, B7).
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
 * The CSS for the per-chart color overrides (`colors`, `color`) in some chart markup: one rule per
 * distinct override. Charts carry overrides in a `data-enarratio-colors` attribute, never a
 * `style` attribute, so a page under a hash-based Content-Security-Policy adds these rules to its
 * own stylesheet, or to a `<style>` whose hash it allows (D4).
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
    // Series names written on the background follow the override, mixed toward the text color
    // as the base rules do for a site that defines no label shades (B1).
    const labels = [...value.matchAll(/--enarratio-series-([1-8]): ([^;]+)/g)].map(
      ([, n, color]) =>
        `--enarratio-series-label-${n}: color-mix(in srgb, ${color} 55%, var(--enarratio-text))`,
    );
    rules.add(`.enarratio[data-enarratio-colors="${value}"] { ${[value, ...labels].join("; ")}; }`);
  }
  return [...rules].join("\n");
}
