/**
 * The legend's textures for series 2 to 8, matching the patterns in the drawing, under `scope`:
 * a chart that shows its textures, or any chart with patterns in a media query.
 */
export function textureRules(scope: string): string {
  const stripes = (deg: number): string =>
    `repeating-linear-gradient(${deg}deg, var(--enarratio-stripes))`;
  const textures = [
    stripes(-45),
    "radial-gradient(var(--enarratio-ink) 1px, transparent 1.5px) 0 0 / 4px 4px",
    stripes(0),
    stripes(90),
    stripes(45),
    `${stripes(0)}, ${stripes(90)}`,
    `${stripes(45)}, ${stripes(-45)}`,
  ];
  return [
    `${scope} [data-slot] {
  --enarratio-ink: color-mix(in srgb, var(--enarratio-slot-ink) calc(var(--enarratio-opacity-texture, 0.6) * 100%), transparent);
  --enarratio-stripes: transparent 0 3px, var(--enarratio-ink) 3px 4.5px;
}`,
    ...textures.map((t, i) => `${scope} [data-slot="${i + 2}"] { --enarratio-texture: ${t}; }`),
  ].join("\n");
}

/**
 * Observable Plot's filled symbols in order (circle, cross, diamond, square, star, triangle, wye),
 * as clip paths for a legend swatch; the eighth series takes the circle again, as Plot does.
 */
const SYMBOL_CLIPS = [
  "circle(50%)",
  "polygon(35% 0, 65% 0, 65% 35%, 100% 35%, 100% 65%, 65% 65%, 65% 100%, 35% 100%, 35% 65%, 0 65%, 0 35%, 35% 35%)",
  "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)",
  "inset(8%)",
  "polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
  "polygon(50% 4%, 100% 92%, 0 92%)",
  "polygon(38% 0, 62% 0, 62% 44%, 98% 72%, 86% 92%, 50% 64%, 14% 92%, 2% 72%, 38% 44%)",
  "circle(50%)",
];

export const LAYOUT_RULES = `
.enarratio {
  margin: 0;
  color: var(--enarratio-text);
  font-family: var(--enarratio-font);
  font-size: var(--enarratio-font-size, 1rem);
}
.enarratio-frame { overflow-x: auto; container-type: inline-size; }
.enarratio-frame-wide > svg { min-width: 30rem; }
.enarratio-frame-wide {
  --enarratio-scroll-shadow: color-mix(in srgb, var(--enarratio-text) 30%, transparent);
  background:
    linear-gradient(to right, var(--enarratio-background) 40%, transparent) left / 1.5rem 100% no-repeat local,
    linear-gradient(to left, var(--enarratio-background) 40%, transparent) right / 1.5rem 100% no-repeat local,
    radial-gradient(farthest-side at 0 50%, var(--enarratio-scroll-shadow), transparent) left / 0.75rem 100% no-repeat scroll,
    radial-gradient(farthest-side at 100% 50%, var(--enarratio-scroll-shadow), transparent) right / 0.75rem 100% no-repeat scroll;
}
.enarratio svg {
  display: block;
  max-width: 100%;
  height: auto;
  overflow: visible;
  font-family: inherit;
}
.enarratio svg:not([font-size]) { font-size: var(--enarratio-font-size-mark, 0.75rem); }
svg.enarratio { display: inline-block; vertical-align: middle; max-width: 100%; height: auto; }
.enarratio [data-enarratio-mark$="tick label"] { font-family: var(--enarratio-font-numeric); }
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
.enarratio-legend li {
  box-sizing: border-box;
  min-height: 24px;
  padding: var(--enarratio-padding-button, 0.125em 0.25em);
  border: var(--enarratio-border-width, 1px) solid transparent;
}
.enarratio-legend li:has(> button) { min-height: 0; padding: 0; border: 0; }
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
.enarratio-legend[data-enarratio-legend="line"] .enarratio-swatch {
  width: 1.4em;
  height: 0.2em;
  border: 0;
  border-radius: 0;
}
.enarratio-legend[data-enarratio-legend="symbol"] .enarratio-swatch { border-radius: 0; }
.enarratio-legend[data-enarratio-legend="hollow"] [data-slot="1"] .enarratio-swatch {
  background: transparent;
  box-shadow: inset 0 0 0 0.15em var(--enarratio-series-1);
}
${SYMBOL_CLIPS.map(
  (clip, i) =>
    `.enarratio-legend[data-enarratio-legend="symbol"] [data-slot="${i + 1}"] .enarratio-swatch { clip-path: ${clip}; }`,
).join("\n")}
${Array.from(
  { length: 8 },
  (_, i) =>
    `.enarratio [data-slot="${i + 1}"] { --enarratio-slot: var(--enarratio-series-${i + 1}); --enarratio-slot-ink: var(--enarratio-series-text-${i + 1}); }`,
).join("\n")}
${Array.from(
  { length: 5 },
  (_, i) =>
    `.enarratio [data-step="${i + 1}"] { --enarratio-slot: var(--enarratio-sequential-${i + 1}); --enarratio-slot-ink: var(--enarratio-sequential-text-${i + 1}); }`,
).join("\n")}
${Array.from({ length: 8 }, (_, i) => {
  const n = i + 1;
  const mix = `color-mix(in srgb, var(--enarratio-series-${n}) 55%, var(--enarratio-text))`;
  return `.enarratio text[fill="var(--enarratio-series-${n})"], .enarratio g[fill="var(--enarratio-series-${n})"] > text { fill: var(--enarratio-series-label-${n}, ${mix}); }`;
}).join("\n")}
${Array.from({ length: 5 }, (_, i) => {
  const n = i + 1;
  const edge = `var(--enarratio-sequential-edge-${n}, ${n <= 3 ? "var(--enarratio-text-muted)" : "transparent"})`;
  return `.enarratio [fill="var(--enarratio-sequential-${n})"] { stroke: ${edge}; stroke-width: var(--enarratio-cell-edge-width, 1px); }
.enarratio [data-step="${n}"] { --enarratio-slot-edge: ${edge}; }`;
}).join("\n")}
.enarratio, .enarratio-tooltip { --enarratio-texture: none; --enarratio-slot-edge: transparent; }
.enarratio-swatch { box-sizing: border-box; border: var(--enarratio-border-width, 1px) solid var(--enarratio-slot-edge); }
.enarratio-swatch { background: var(--enarratio-texture), var(--enarratio-slot); }
.enarratio-texture { stroke-opacity: 0; }
.enarratio[data-enarratio-textured] .enarratio-texture {
  stroke-opacity: var(--enarratio-opacity-texture, 0.6);
}
${textureRules(".enarratio[data-enarratio-textured]")}
.enarratio [data-enarratio-mark="bar"] [data-enarratio-key] {
  stroke: var(--enarratio-background);
  stroke-width: var(--enarratio-bar-gap, 2px);
}
.enarratio [data-enarratio-mark="bar label"] text { font-variant-numeric: tabular-nums; }
.enarratio-data {
  margin: var(--enarratio-space, 0.5em) 0 0;
  font-size: var(--enarratio-font-size-small, 0.875em);
}
.enarratio .enarratio-data.enarratio-table-chart { overflow-x: auto; }
.enarratio .enarratio-data.enarratio-table-chart > table { display: table; overflow: visible; max-inline-size: none; margin-top: 0; }
.enarratio-data table { border-collapse: collapse; margin-top: var(--enarratio-space, 0.5em); }
.enarratio-data th, .enarratio-data td {
  padding: var(--enarratio-cell-padding, 0.2em 0.75em 0.2em 0);
  border-bottom: var(--enarratio-border-width, 1px) solid var(--enarratio-grid);
  text-align: left;
}
.enarratio-data td { font-variant-numeric: tabular-nums; text-align: right; }
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
.enarratio-data.enarratio-visually-hidden > table {
  display: table;
  overflow: visible;
  max-inline-size: none;
}
.enarratio-data.enarratio-visually-hidden:focus-within {
  position: static !important;
  width: auto;
  height: auto;
  margin: var(--enarratio-space, 0.5em) 0 0;
  overflow-x: auto;
  clip-path: none;
  white-space: normal;
}
.enarratio-tooltip {
  position: absolute;
  z-index: var(--enarratio-z-tooltip, 10);
  max-width: var(--enarratio-tooltip-max-width, 18em);
  min-width: var(--enarratio-tooltip-min-width, 8em);
  padding: var(--enarratio-tooltip-padding, 0.5em 0.65em);
  border: var(--enarratio-border-width, 1px) solid var(--enarratio-grid);
  border-radius: var(--enarratio-radius-tooltip, 0.5em);
  background: var(--enarratio-background);
  color: var(--enarratio-text);
  font-family: var(--enarratio-font);
  font-size: var(--enarratio-font-size-tooltip, 0.8125rem);
  line-height: var(--enarratio-line-height-tooltip, 1.35);
  box-shadow: var(--enarratio-tooltip-shadow, 0 2px 8px rgb(0 0 0 / 15%));
}
.enarratio-tooltip[hidden] { display: none; }
.enarratio-tooltip p { margin: 0; }
.enarratio-tip-at {
  margin-bottom: var(--enarratio-gap-row, 0.25em) !important;
  color: var(--enarratio-text-muted);
}
.enarratio-tip-row {
  display: grid;
  grid-template-columns: auto auto 1fr;
  align-items: center;
  gap: var(--enarratio-gap-inline, 0.4em);
}
.enarratio-tip-row b {
  font-weight: var(--enarratio-font-weight-emphasis, 600);
  font-variant-numeric: tabular-nums;
}
.enarratio-tip-row span:last-child:not(.enarratio-tip-key) { color: var(--enarratio-text-muted); }
.enarratio-tip-key {
  display: inline-block;
  width: 0.75em;
  height: 0.25em;
  border-radius: 0.125em;
  forced-color-adjust: none;
}
.enarratio [data-enarratio-key],
.enarratio svg :is([fill^="var(--enarratio-series-"], [stroke^="var(--enarratio-series-"], [fill^="url(#enarratio-"]) {
  transition: opacity var(--enarratio-duration-hover, 150ms) var(--enarratio-ease-out, ease-out);
}
.enarratio[data-enarratio-enhanced] .enarratio-frame:not(.enarratio-frame-wide) > svg { touch-action: pan-y; }
.enarratio-crosshair line { stroke: var(--enarratio-text-muted); stroke-width: 1px; }
.enarratio-crosshair circle { stroke: var(--enarratio-background); stroke-width: 2px; }
${Array.from({ length: 8 }, (_, i) => {
  const n = i + 1;
  return `.enarratio[data-enarratio-spotlight="${n}"] svg :is([fill^="var(--enarratio-series-"], [stroke^="var(--enarratio-series-"], [fill^="url(#enarratio-"]):not([fill="var(--enarratio-series-${n})"], [stroke="var(--enarratio-series-${n})"], [fill$="-${n})"]) { opacity: var(--enarratio-opacity-dimmed, 0.25); }`;
}).join("\n")}
.enarratio[data-enarratio-interactive] [data-enarratio-field] { cursor: pointer; }
.enarratio[data-enarratio-enhanced] [data-enarratio-href] { cursor: pointer; }
.enarratio [data-enarratio-dimmed] { opacity: var(--enarratio-opacity-dimmed, 0.25); }
.enarratio [data-enarratio-key]:focus { outline: none; }
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
.enarratio [data-enarratio-faded] { opacity: var(--enarratio-opacity-faded, 0.35); }
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
`;
