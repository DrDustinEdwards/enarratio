import { LINE_DASHES } from "./dashes.js";
import { textureRules } from "./base-rules.js";

/** A dash pattern ("8 3 2 3", in px) as a horizontal gradient in the forced text color. */
const dashGradient = (dash: string): string => {
  let at = 0;
  const stops = dash
    .split(" ")
    .map(Number)
    .map((length, i) => {
      const stop = `${i % 2 === 0 ? "CanvasText" : "transparent"} ${at}px ${at + length}px`;
      at += length;
      return stop;
    });
  return `repeating-linear-gradient(90deg, ${stops.join(", ")})`;
};

export const CONTROL_RULES = `/* The toolbar above the drawing (record 0035): Sound, Range and Download, each an icon and a
   word, on one row that never wraps. Its panels (the range form, the Download menu) open under
   it, over the drawing, so opening one never moves the page. It is the container its narrow rule
   measures, and sits above the frame so a panel paints over the chart. */
.enarratio-controls {
  position: relative;
  z-index: var(--enarratio-z-controls, 2);
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: var(--enarratio-gap-controls, 0.375em);
  margin: var(--enarratio-space, 0.5em) 0;
  font-size: var(--enarratio-font-size-small, 0.875em);
  container-type: inline-size;
}
.enarratio-controls > :is(button, details) { flex: none; }
.enarratio-controls > button, .enarratio-controls > details > summary {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: var(--enarratio-gap-icon, 0.375em);
  min-height: var(--enarratio-control-height, 2.25em);
  padding: var(--enarratio-padding-control, 0.25em 0.75em);
  border: var(--enarratio-border-width, 1px) solid var(--enarratio-grid);
  border-radius: var(--enarratio-radius-control, 0.5em);
  background: var(--enarratio-background);
  color: inherit;
  font: inherit;
  line-height: 1.2;
  white-space: nowrap;
  cursor: pointer;
  list-style: none;
}
.enarratio-controls > details > summary::-webkit-details-marker { display: none; }
.enarratio-controls > button:hover, .enarratio-controls > details > summary:hover,
.enarratio-controls > details[open] > summary, .enarratio-controls > button[aria-pressed="true"] {
  background: color-mix(in srgb, var(--enarratio-text) 8%, var(--enarratio-background));
}
.enarratio-controls > button[aria-pressed="true"] { border-color: var(--enarratio-text-muted); }
/* Written as svg.enarratio-icon under .enarratio so it outranks the drawing rules above, which set
   an svg's display, size and font size. */
.enarratio svg.enarratio-icon {
  flex: none;
  display: inline-block;
  width: 1em;
  height: 1em;
  max-width: none;
  overflow: visible;
  font-size: inherit;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
/* The two panels: a card under the toolbar, as wide as its content and never wider. */
.enarratio-panel {
  position: absolute;
  top: calc(100% + var(--enarratio-gap-controls, 0.375em));
  left: 0;
  box-sizing: border-box;
  max-width: 100%;
  padding: var(--enarratio-padding-panel, 0.5em);
  border: var(--enarratio-border-width, 1px) solid var(--enarratio-grid);
  border-radius: var(--enarratio-radius-control, 0.5em);
  background: var(--enarratio-background);
  box-shadow: var(--enarratio-panel-shadow, 0 4px 16px rgb(0 0 0 / 15%));
}
.enarratio-range form {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--enarratio-gap-row, 0.25em) var(--enarratio-gap-inline, 0.4em);
}
/* The range panel is as wide as two date fields and its buttons, or the toolbar when narrower. */
.enarratio-range > .enarratio-panel { inline-size: min(100%, 34em); }
.enarratio-range label { display: grid; flex: 1 1 10em; gap: 0.25em; }
.enarratio-range :is(input, button) {
  box-sizing: border-box;
  min-height: var(--enarratio-control-height, 2.25em);
  padding: var(--enarratio-padding-control, 0.25em 0.75em);
  border: var(--enarratio-border-width, 1px) solid var(--enarratio-text-muted);
  border-radius: var(--enarratio-radius, 0.25em);
  background: var(--enarratio-background);
  color: inherit;
  font: inherit;
}
.enarratio-range input { inline-size: 100%; min-inline-size: 0; }
.enarratio-range button { cursor: pointer; }
.enarratio-menu { display: grid; min-inline-size: 12em; }
.enarratio-menu > :is(a, button) {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  min-height: var(--enarratio-control-height, 2.25em);
  margin: 0;
  padding: var(--enarratio-padding-control, 0.25em 0.75em);
  border: 0;
  border-radius: var(--enarratio-radius, 0.25em);
  background: none;
  color: inherit;
  font: inherit;
  line-height: 1.2;
  text-align: start;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
}
.enarratio-menu > :is(a, button):is(:hover, :focus-visible) {
  background: color-mix(in srgb, var(--enarratio-text) 8%, var(--enarratio-background));
}
/* Narrow containers keep the one row, in steps: the buttons tighten; then Download shows its icon
   and chevron without its word; then, so narrow that even that does not fit (200% text), every
   control shows its icon alone. A hidden word stays as screen-reader text, so every name stays.
   The thresholds are where three and four controls stop fitting (Sound, Range, Download, and
   Expand); a container query cannot read a custom property. */
@container (width < 23em) {
  .enarratio-controls:not(:has(> :nth-child(4))) { gap: 0.25em; }
  .enarratio-controls:not(:has(> :nth-child(4))) > :is(button, details > summary) { padding-inline: 0.5em; }
}
@container (width < 21.75em) {
  .enarratio-controls:not(:has(> :nth-child(4))) > .enarratio-download .enarratio-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
}
@container (width < 17.25em) {
  .enarratio-controls:not(:has(> :nth-child(4))) .enarratio-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
}
@container (width < 30em) {
  .enarratio-controls:has(> :nth-child(4)) { gap: 0.25em; }
  .enarratio-controls:has(> :nth-child(4)) > :is(button, details > summary) { padding-inline: 0.5em; }
}
@container (width < 26.75em) {
  .enarratio-controls:has(> :nth-child(4)) > .enarratio-download .enarratio-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
}
@container (width < 22.25em) {
  .enarratio-controls:has(> :nth-child(4)) .enarratio-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
}
.enarratio-legend button { min-height: 24px; }
.enarratio-legend button { box-sizing: border-box; }
/* The controls the server writes ahead of enhance() (figure.ts): with scripts off, nothing
   replaces them, so they are not shown. */
@media (scripting: none) {
  .enarratio [data-enarratio-pending] { display: none; }
}
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
.enarratio svg:focus-visible, .enarratio button:focus-visible, .enarratio-controls summary:focus-visible,
.enarratio-controls :is(a, input):focus-visible, .enarratio-frame:focus-visible,
.enarratio-table-chart:focus-visible, .enarratio-data a:focus-visible {
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
    padding: 0 0 0 var(--enarratio-timeline-list-indent, 2.25em);
    overflow: visible;
    clip-path: none;
    white-space: normal;
  }
  .enarratio-timeline-list li { margin: 0 0 var(--enarratio-space, 0.5em); }
  /* Proportional marker figures: a tabular period is a full figure wide ("1 ."). */
  .enarratio-timeline-list li::marker { font-variant-numeric: proportional-nums; }
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
  .enarratio[data-enarratio] .enarratio-texture { stroke-opacity: 1; }
${textureRules(".enarratio:has(pattern)")}
  .enarratio [data-enarratio-mark="bar"] [data-enarratio-key] { stroke-width: 2px; }
  .enarratio [data-enarratio-mark$="grid"] { stroke: var(--enarratio-text-muted); }
  .enarratio-swatch { outline: 1px solid var(--enarratio-text); }
}
/* Forced colors (Windows High Contrast): every color becomes one of the reader's system colors.
   Series are all CanvasText, told apart by textures, line dashes, symbols and labels; the
   sequential ramp becomes steps between Canvas and CanvasText. Set on the drawing and legend
   themselves, so they win over a theme or a per-chart override set on the figure (B57, D3). */
@media (forced-colors: active) {
  /* The icon strokes in the button's text color; a pressed toggle shows by its Highlight border. */
  .enarratio-controls > button[aria-pressed="true"] { border: 2px solid Highlight; }
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
  .enarratio[data-enarratio] .enarratio-texture { stroke-opacity: 1; }
${textureRules(".enarratio:has(pattern)")}
  .enarratio [data-enarratio-mark="area"] { fill-opacity: 1; }
${LINE_DASHES.map(
  (dash, i) =>
    `  .enarratio [data-enarratio-mark="line"] [stroke="var(--enarratio-series-${i + 2})"] { stroke-dasharray: ${dash}; }`,
).join("\n")}
${LINE_DASHES.map(
  (dash, i) =>
    `  .enarratio-legend[data-enarratio-legend="line"] [data-slot="${i + 2}"] .enarratio-swatch { background: ${dashGradient(dash)}; }`,
).join("\n")}
}
/* Print: the light scheme, the whole drawing on one page, and no toolbar or interactive overlays
   (C5). */
@media print {
  .enarratio, .enarratio-tooltip { color-scheme: light; }
  .enarratio[data-enarratio] .enarratio-texture { stroke-opacity: var(--enarratio-opacity-texture, 0.6); }
${textureRules(".enarratio:has(pattern)")}
  .enarratio { break-inside: avoid; }
  .enarratio-frame { overflow: visible; background: none; }
  .enarratio-frame-wide > svg { min-width: 0; }
  .enarratio-tooltip, .enarratio-brush, .enarratio [data-enarratio-control], .enarratio-controls {
    display: none !important;
  }
}
`;
