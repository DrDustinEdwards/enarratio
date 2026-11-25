import { readdirSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { basename, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ENHANCE_STRINGS } from "enarratio/enhance";
import { root } from "./site.ts";

// Capsomer's chart frame imports "enarratio" and "enarratio/redraw", its peer; here that is this
// package itself.
const selfExports = (
  JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
    exports: Record<string, string | { default: string }>;
  }
).exports;
const self = (specifier: string): string => {
  if (specifier !== "enarratio" && !specifier.startsWith("enarratio/")) return specifier;
  const entry = selfExports[`.${specifier.slice("enarratio".length)}`];
  const file = typeof entry === "string" ? entry : entry?.default;
  return file ? fileURLToPath(new URL(`../../${file}`, import.meta.url)) : specifier;
};
/**
 * The width each example is redrawn at for a phone: the frame's on a 320 px screen. Under 30rem the
 * gallery swaps it in (enarratio/redraw's narrow spec) so the drawing fits with 12 px text.
 */
export const NARROW_WIDTH = 228;
/** 30rem at the default 16 px rem: a wide drawing keeps this width in a narrower column. */
const WIDE_PX = 480;
/** A drawing's viewBox size: the svg in its frame, not the toolbar's 16-unit icons ahead of it. */
function viewBox(markup: string): { width: number; height: number } | undefined {
  const frame = markup.indexOf('class="enarratio-frame');
  const box = /<svg[^>]*\sviewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(
    frame === -1 ? markup : markup.slice(frame),
  );
  return box ? { width: Number(box[1]), height: Number(box[2]) } : undefined;
}
/**
 * The height the server's drawing shows in a phone's column: a wide drawing keeps 30rem and
 * scrolls, so it shows H * 480 / W; a narrower one scales to the column.
 */
export function shownHeight(markup: string): number | undefined {
  const box = viewBox(markup);
  if (!box) return undefined;
  const shown = markup.includes("enarratio-frame-wide") ? WIDE_PX : NARROW_WIDTH;
  return Math.round(((box.height * shown) / box.width) * 100) / 100;
}
/**
 * Examples whose rows set their height and do not fit in the height their wide drawing shows on a
 * phone. Their narrow drawing keeps its own height, and the page reserves it (reserveCss).
 */
const KEEP_HEIGHT = new Set([
  "horizontal-bar",
  "slope",
  "genome",
  "tree",
  "funnel",
  "bullet",
  "radar",
  "forest",
  "waterfall",
  "dot",
  "range",
  "dumbbell",
  "small-multiples",
  "small-multiples-bar",
  "bubble",
  "gantt",
  "calendar",
  "ridgeline",
]);
/**
 * The maps. A map keeps its shape, so drawn 228 wide it is far shorter than its wide drawing at
 * 30rem: the narrow one keeps its own height, and under 30rem the wide one scales into the column
 * at that height (reserveCss), so the swap does not move the page.
 */
const MAPS = new Set(["dot-map", "choropleth"]);
/**
 * The options an example passes, drawn at NARROW_WIDTH and at the height its wide drawing shows, so
 * the swap does not move the page. A chart that adds to the height it is given (the survival
 * curve's at-risk rows) is drawn again with that much less.
 */
const narrowDraw =
  <O extends object>(draw: (options: O) => string, id: string) =>
  (options: O): string => {
    const at = (height?: number) =>
      draw({ ...options, width: NARROW_WIDTH, ...(height === undefined ? {} : { height }) });
    const target = KEEP_HEIGHT.has(id) || MAPS.has(id) ? undefined : shownHeight(draw(options));
    const first = at(target);
    if (target === undefined) return first;
    const extra = (viewBox(first)?.height ?? target) - target;
    return Math.abs(extra) < 0.5 ? first : at(target - extra);
  };
Object.assign(globalThis, { enarratioGalleryNarrow: narrowDraw });
registerHooks({
  resolve: (specifier, context, next) => next(self(specifier), context),
  // An example imported with ?narrow draws through narrowDraw: its options with the width and height set.
  load: (url, context, next) => {
    const loaded = next(url, context);
    if (!url.endsWith("?narrow")) return loaded;
    const source = String(loaded.source).replace(
      /export default (\w+)\(/,
      `export default globalThis.enarratioGalleryNarrow($1, ${JSON.stringify(basename(url.slice(0, -"?narrow".length), ".ts"))})(`,
    );
    return { ...loaded, source };
  },
});
export const { frameHtml } = await import("capsomer/behavior/chart-frame");

export const examplesDir = join(root, "examples");

export interface Example {
  readonly id: string;
  readonly name: string;
  /** The module it imports: enarratio, enarratio/plot, enarratio/science or enarratio/map. */
  readonly module: string;
  readonly source: string;
  readonly markup: string;
  /** The chart's drawing at NARROW_WIDTH (its `.enarratio-frame`), when the example is wider. */
  readonly narrow?: string | undefined;
  /** The narrow drawing's height, when it is taller than the wide one shows on a phone. */
  readonly reserve?: number | undefined;
  /** A map's narrow drawing's height, which its wide drawing scales to under 30rem. */
  readonly fit?: number | undefined;
}

/** Gallery order, with each example's short name. Every example must be listed, so a new one cannot be left out. */
const NAMES: Record<string, string> = {
  "stacked-bar": "Stacked bars",
  years: "Bars by year",
  runs: "Runs per day",
  "grouped-bar": "Grouped bars",
  "horizontal-bar": "Horizontal bars",
  "diverging-bar": "Diverging bars",
  "error-bars": "Error bars",
  waterfall: "Waterfall",
  line: "Line",
  forecast: "Forecast",
  annotations: "Annotations",
  area: "Stacked areas",
  "percent-area": "100% stacked areas",
  streamgraph: "Streamgraph",
  "small-multiples": "Small multiples",
  "small-multiples-bar": "Small multiples, bars",
  scatter: "Scatter",
  bubble: "Bubbles",
  histogram: "Histogram",
  density: "Density",
  ridgeline: "Ridgeline plot",
  box: "Box plot",
  violin: "Violin plot",
  beeswarm: "Beeswarm",
  dot: "Dot plot",
  range: "Range plot",
  dumbbell: "Dumbbell",
  slope: "Slope chart",
  donut: "Donut",
  treemap: "Treemap",
  sunburst: "Sunburst",
  funnel: "Funnel",
  sankey: "Sankey",
  chord: "Chord",
  radar: "Radar",
  gauge: "Gauge",
  bullet: "Bullet chart",
  parallel: "Parallel coordinates",
  heatmap: "Heatmap",
  calendar: "Calendar heatmap",
  gantt: "Gantt chart",
  candlestick: "Candlestick",
  "table-chart": "Table with graphics",
  network: "Network",
  titer: "Titers",
  genome: "Genome map",
  "dose-response": "Dose-response",
  survival: "Survival",
  forest: "Forest plot",
  tree: "Phylogenetic tree",
  "dot-map": "Dot map",
  choropleth: "Choropleth map",
  sparkline: "Sparklines",
  primitives: "Rings and uptime",
  "heat-strip": "Heat strip",
  timeline: "Timeline",
  "primitive-tables": "Primitives as tables",
};
const ORDER = Object.keys(NAMES);

export async function loadExamples(): Promise<Example[]> {
  const found = readdirSync(examplesDir)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => basename(f, ".ts"));
  const unlisted = found.filter((id) => !ORDER.includes(id));
  const missing = ORDER.filter((id) => !found.includes(id));
  if (unlisted.length > 0 || missing.length > 0) {
    throw new Error(
      `gallery ORDER is out of date: unlisted ${unlisted.join(", ")}; missing ${missing.join(", ")}`,
    );
  }
  const files = ORDER.map((id) => `${id}.ts`);
  const examples: Example[] = [];
  for (const file of files) {
    const path = join(examplesDir, file);
    const module = (await import(pathToFileURL(path).href)) as { default: unknown };
    if (typeof module.default !== "string") throw new Error(`${file} must export a string`);
    const source = readFileSync(path, "utf8");
    const id = basename(file, ".ts");
    const from = /from "(enarratio[^"]*)"/.exec(source)?.[1] ?? "enarratio";
    const drawnWidth = viewBox(module.default)?.width ?? 0;
    const narrow =
      /export default \w+\(/.test(source) && drawnWidth > NARROW_WIDTH
        ? frameOf(
            ((await import(`${pathToFileURL(path).href}?narrow`)) as { default: string }).default,
          )
        : undefined;
    const narrowBox = narrow ? viewBox(narrow) : undefined;
    const shown = shownHeight(module.default) ?? 0;
    examples.push({
      id,
      reserve:
        narrowBox && !MAPS.has(id) && narrowBox.height > shown + 0.5 ? narrowBox.height : undefined,
      fit: narrowBox && MAPS.has(id) ? narrowBox.height : undefined,
      name: NAMES[id] ?? id,
      module: from,
      source,
      markup: withExpand(module.default),
      narrow,
    });
  }
  return examples;
}

/** Where the Download menu starts in the toolbar the figure writes ahead of enhance(). */
const DOWNLOAD_MENU = '<details class="enarratio-download"';

/** Expand as enhance() writes it (controls.ts expander), inert until the layer replaces it. */
const PENDING_EXPAND = `<button type="button" aria-pressed="false" data-enarratio-pending inert><span class="enarratio-icon" data-icon="expand" aria-hidden="true"></span><span class="enarratio-label">${ENHANCE_STRINGS.expand}</span></button>`;

/**
 * A figure's markup with Expand in its toolbar: the gallery enhances with `expand: true`
 * (site/gallery.js), so the toolbar is written with it and does not change.
 */
export function withExpand(markup: string): string {
  // A primitive's figure is never expanded (enhance/chart.ts), so it gets no Expand.
  if (!markup.includes('class="enarratio-controls"') || markup.includes("data-enarratio-static")) {
    return markup;
  }
  if (!markup.includes(DOWNLOAD_MENU))
    throw new Error("the toolbar's Download menu changed its markup");
  return markup.replace(DOWNLOAD_MENU, `${PENDING_EXPAND}${DOWNLOAD_MENU}`);
}

/**
 * Under 30rem (the frame is the container), each wide drawing takes the height its narrow drawing
 * will, so the swap does not move the page. A KEEP_HEIGHT example keeps its scale, centered; a
 * map's scales into the column at that height. Scripts on only.
 */
export function reserveCss(examples: readonly Example[]): string {
  const rules = examples.flatMap((e) => {
    const svg = `[data-example="${e.id}"] .enarratio-frame-wide > svg`;
    if (e.fit !== undefined) return [`  ${svg} { min-width: 0; width: 100%; height: ${e.fit}px; }`];
    return e.reserve !== undefined ? [`  ${svg} { min-height: ${e.reserve}px; }`] : [];
  });
  // Without scripts nothing is swapped, so the wide drawings stay as they are.
  return rules.length > 0
    ? `@media (scripting: enabled) {\n@container (width < 30rem) {\n${rules.join("\n")}\n}\n}`
    : "";
}

export function frameOf(markup: string): string | undefined {
  const start = markup.indexOf('<div class="enarratio-frame');
  const end = markup.indexOf("</svg></div>", start);
  return start === -1 || end === -1 ? undefined : markup.slice(start, end + "</svg></div>".length);
}
