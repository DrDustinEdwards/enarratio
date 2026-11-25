/**
 * The figure every chart is delivered in: head, overview for screen readers, legend, the SVG named
 * by its text alternative, summary, caption, notes, source line, and the data table, visually
 * hidden. All of it is in the HTML with scripts off. The accessible name lives on the SVG and the
 * figcaption, never on the figure: `role="img"` would hide the caption and table from their readers.
 */

import { BRUSH_SCALES, ENHANCE_STRINGS, ICONS } from "../controls.js";
import { element, escapeHtml } from "../html.js";
import { requireSize, safeHref } from "./data.js";
import { type ChartDescription, overview, summarize } from "./describe.js";
import { slotStyle } from "./slot-style.js";
import { DEFAULT_WIDTH, WIDE_WIDTH } from "./size.js";
import { numberFormat, type StringOverrides, type Strings, stringsFor, toCsv } from "./text.js";

/** A color for one series: any CSS color, or a pair for light and dark. */
export type SeriesColor = string | { readonly light: string; readonly dark: string };

/** A problem with a chart that a reader would meet, reported while it renders. */
export interface ChartIssue {
  /** The chart's kind, as in `data-enarratio`. */
  readonly chart: string;
  readonly code:
    | "alt-missing"
    | "title-missing"
    | "axis-label-missing"
    | "too-many-series"
    | "too-many-points"
    | "csv-too-large";
  readonly message: string;
}

/** Where a chart's issues go: `strict` throws, `onIssue` receives them, else they are warned. */
export interface IssueOptions {
  /**
   * Throw on the first issue instead of reporting it, so a build fails on a chart a reader would
   * struggle with. Set it once in a site's shared options.
   */
  readonly strict?: boolean;
  /** Receives each issue instead of `console.warn`, e.g. to collect them and fail a build. */
  readonly onIssue?: (issue: ChartIssue) => void;
}

/** A chart's source, with a link when it has one. */
export type Source = string | { readonly name: string; readonly href?: string };

/** Options every chart accepts. */
export interface FigureOptions extends IssueOptions {
  /**
   * What the chart shows, including its finding, written for someone who cannot see it:
   * "Publications rose from 2 in 2015 to 11 in 2024", not "Bar chart of publications". It names
   * the SVG and is shown as the finding under the title. Without it the chart names itself from
   * its overview and summary and reports an `alt-missing` issue (thrown when `strict`).
   */
  readonly alt?: string;
  /** A visible title above the chart. Every chart should have one; without it, an issue. */
  readonly title?: string;
  /** A line under the title saying what the chart shows or how to read it. */
  readonly subtitle?: string;
  /** A visible caption below the chart: method, caveats. */
  readonly caption?: string;
  /** Notes under the chart: definitions of the measures, exclusions. */
  readonly notes?: string | readonly string[];
  /** Where the data come from, linked when `href` is given. */
  readonly source?: Source;
  /** Who made the chart, in the source line. */
  readonly byline?: string;
  /**
   * The summary under the chart, computed from the data by default. A string replaces it; `false`
   * leaves it out.
   */
  readonly summary?: string | false;
  /**
   * The "Download CSV" link, a `data:` URL built from the table (default); `false` leaves it out. A
   * table too large to inline gets no link and an issue; give `csvHref` then.
   */
  readonly csv?: boolean;
  /** A CSV file the site serves for this chart, linked instead of the inline one. */
  readonly csvHref?: string;
  /** The BCP 47 locale for generated numbers and text (default `"en-US"`). */
  readonly locale?: string;
  /** Translations of the generated strings, kinds and terms; the rest stay English. */
  readonly strings?: StringOverrides;
  /**
   * The figure's language, a BCP 47 tag such as `"de"`, written as its `lang` attribute so a screen
   * reader switches voice for the generated text when it differs from the page's (WCAG 2.2 SC
   * 3.1.2). Set it with `strings` and `locale` when they translate the figure.
   */
  readonly lang?: string;
  /** An `id` for the figure, which enhancement events carry as `chartId`. */
  readonly id?: string;
  /** The drawing's width in CSS pixels; the SVG scales down to fit narrower containers. */
  readonly width?: number;
  /** The drawing's height in CSS pixels. */
  readonly height?: number;
  /**
   * The browser's hover title on each mark (a `<title>`), on by default. `false` moves each mark's
   * details to a `data-enarratio-label` attribute, which `enhance()` still names its points with.
   */
  readonly hoverTitles?: boolean;
  /**
   * The toolbar controls `enhance()` adds with its default options, written into the markup ahead
   * of it, inert, so the page does not shift when the layer arrives; hidden with scripts off. On by
   * default. "Download CSV" is a link and works without script, so it stays either way.
   */
  readonly controls?: boolean;
}

/** The SVG without its marks' hover titles: each `<title>` becomes its `data-enarratio-label`. */
function withoutTitles(svg: string): string {
  return svg
    .replace(
      /<([a-zA-Z]+)((?:\s[^<>]*)?)(?<!\/)><title>([^<]*)<\/title>/g,
      (_, tag: string, attrs: string, text: string) =>
        `<${tag}${attrs} data-enarratio-label="${text.replaceAll('"', "&quot;")}">`,
    )
    .replace(/<title>[^<]*<\/title>/g, "");
}

/** Units for a chart's axes, added to the axis labels and table headers: "Weight (kg)". */
export interface AxisUnits {
  readonly xUnit?: string;
  readonly yUnit?: string;
}

/** The options of a chart on x and y axes. */
export interface AxesOptions extends FigureOptions, AxisUnits {
  /** Color overrides by series name. */
  readonly colors?: Readonly<Record<string, SeriesColor>>;
  /** The x axis label; defaults to the field name; `null` hides it. */
  readonly xLabel?: string | null;
  /** The y axis label; defaults to the field name; `null` hides it. */
  readonly yLabel?: string | null;
  /** Formats values in hover details and the data table. */
  readonly formatValue?: (value: number) => string;
}

/** The options of a chart on x and y axes with series: bars, lines, areas and scatter plots. */
export interface SeriesAxesOptions extends AxesOptions {
  /** Every series in display and color order. Without it, first-seen order. */
  readonly seriesDomain?: readonly string[];
}

/** A label with its unit, "Weight (kg)"; a hidden (null) label stays hidden, and a unit the label already names is not repeated. */
export function withUnit(label: string | null, unit: string | undefined): string | null {
  const u = unit?.trim();
  if (label === null || !u) return label;
  const word = new RegExp(
    `(^|[^\\p{L}\\p{N}])${u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`,
    "iu",
  );
  return word.test(label) ? label : `${label} (${u})`;
}

/** An axis label: the caller's (`null` hides it), else the field's name, with its unit. */
export function unitLabel(
  given: string | null | undefined,
  fallback: string,
  unit: string | undefined,
): string | null {
  return withUnit(given === undefined ? fallback : given, unit);
}

/** A scale as the enhancement layer needs it to turn a pointer position back into data. */
export interface ScaleDescription {
  readonly type: string;
  readonly domain: readonly (number | string)[];
  readonly range: readonly number[];
}

/** A table of the values a chart draws. The first column holds row headers. */
export interface DataTable {
  readonly columns: readonly string[];
  readonly rows: readonly (readonly string[])[];
  /** A link for each row's header cell, by row, where the chart's marks are links. */
  readonly links?: readonly (string | undefined)[];
}

/** One legend entry. */
export interface LegendItem {
  readonly label: string;
  /** The palette slot, 1 to 8. */
  readonly slot: number;
}

/** One step of a sequential color legend. */
export interface RampItem {
  readonly label: string;
  /** The ramp step, 1 to 5. */
  readonly step: number;
}

/** Everything a chart hands to {@link figure}. */
export interface FigureParts {
  readonly kind: string;
  readonly svg: string;
  readonly table: DataTable;
  readonly legend?: readonly LegendItem[];
  /** A legend for a sequential ramp (heatmaps, maps), shown instead of a series legend. */
  readonly ramp?: readonly RampItem[];
  /** The data field series come from, which legend filters report. */
  readonly seriesField?: string;
  readonly x?: ScaleDescription;
  /** Whether the filled series are not all named on the drawing, so textures show; otherwise only for readers who ask. */
  readonly textured?: boolean;
  /** Which way bars run, for the entrance animation. */
  readonly orientation?: "vertical" | "horizontal";
  /** Per-figure overrides of palette slots, as CSS custom property declarations. */
  readonly slotColors?: ReadonlyMap<number, SeriesColor>;
  /** The chart's axes and values, for the overview and the generated summary. */
  readonly description?: ChartDescription;
  /** A drawing that keeps its own small size and never scrolls sideways (the primitives). */
  readonly fixed?: boolean;
  /**
   * The most series and points before the figure reports an issue (defaults 6 and 1000), and what
   * to do instead.
   */
  readonly limits?: {
    readonly series?: number;
    readonly points?: number;
    readonly advice?: string;
  };
  /** A sentence the chart writes about how it computed what it draws, shown with the caption. */
  readonly method?: string;
  /**
   * The figure's table as markup, for a chart whose drawing is its table (`tableChart`): shown in
   * place of the drawing and the data table, so there is one table. `table` still gives the
   * overview and CSV their rows.
   */
  readonly tableMarkup?: (caption: string) => string;
}

/** Sends an issue where the options say: thrown when strict, to `onIssue`, or warned. */
function report(options: IssueOptions, issue: ChartIssue): void {
  if (options.strict) throw new Error(`${issue.chart}: ${issue.message}`);
  if (options.onIssue) options.onIssue(issue);
  else console.warn(`enarratio: ${issue.chart}: ${issue.message}`);
}

/**
 * Checks the options every chart shares before drawing: a positive finite width and height when
 * given, and at least one row when the chart passes its `data`.
 */
export function validateFigure(
  kind: string,
  options: FigureOptions,
  data?: readonly unknown[],
): void {
  requireSize(kind, "width", options.width);
  requireSize(kind, "height", options.height);
  if (options.lang !== undefined) {
    try {
      Intl.getCanonicalLocales(options.lang);
    } catch {
      throw new Error(`${kind}: lang "${options.lang}" is not a BCP 47 language tag, such as "de"`);
    }
  }
  if (data?.length === 0) throw new Error(`${kind}: data is empty`);
}

function tableMarkup(table: DataTable, caption: string): string {
  const head = element(
    "tr",
    {},
    table.columns.map((c) => element("th", { scope: "col" }, escapeHtml(c))).join(""),
  );
  const body = table.rows
    .map((row, r) =>
      element(
        "tr",
        {},
        row
          .map((cell, i) => {
            if (i > 0) return element("td", {}, escapeHtml(cell));
            const href = table.links?.[r];
            const name = escapeHtml(cell);
            return element("th", { scope: "row" }, href ? element("a", { href }, name) : name);
          })
          .join(""),
      ),
    )
    .join("");
  return element(
    "table",
    {},
    `${element("caption", { class: "enarratio-visually-hidden" }, escapeHtml(caption))}${element("thead", {}, head)}${element("tbody", {}, body)}`,
  );
}

/**
 * A data table as the markup a figure carries: visually hidden, right after the drawing, for
 * screen readers and AI agents. `caption` names the table.
 */
export function dataTableBlock(table: DataTable, caption: string): string {
  return element(
    "div",
    { class: "enarratio-data enarratio-visually-hidden" },
    tableMarkup(table, caption),
  );
}

/** Markup the enhancement layer replaces when it runs: inert until then, hidden with scripts off. */
function pending(tag: string, attrs: Record<string, string | undefined>, content: string): string {
  return element(tag, { ...attrs, "data-enarratio-pending": true, inert: true }, content);
}

/** A toolbar icon: an inline SVG stroked in the button's color, hidden from assistive technology. */
function iconMarkup(name: keyof typeof ICONS): string {
  return element(
    "svg",
    { class: "enarratio-icon", viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false" },
    element("path", { d: ICONS[name] }),
  );
}

/** A toolbar control's face: its icon and its word, which is also its name. */
function face(name: keyof typeof ICONS, text: string): string {
  return iconMarkup(name) + element("span", { class: "enarratio-label" }, escapeHtml(text));
}

/**
 * The toolbar above the drawing, as `enhance()` builds it with its default options: Sound with two
 * or more marks, Range on a continuous x scale, then the Download menu. What only the layer can do
 * is written inert and hidden with scripts off; "Download CSV" is a link in a native disclosure.
 * Returns "" when there is nothing to put in it.
 */
function toolbarMarkup(
  options: FigureOptions,
  parts: FigureParts,
  svg: string,
  csv: string,
): string {
  const s = ENHANCE_STRINGS;
  const layer = !parts.fixed && !parts.tableMarkup && options.controls !== false;
  const bar: string[] = [];
  if (layer && (svg.match(/\sdata-enarratio-key=/g) ?? []).length > 1) {
    bar.push(
      pending("button", { type: "button", "aria-pressed": "false" }, face("sound", s.sound)),
    );
  }
  if (layer && parts.x && BRUSH_SCALES.includes(parts.x.type)) {
    bar.push(
      pending(
        "details",
        { class: "enarratio-range" },
        element("summary", {}, face("range", s.range)),
      ),
    );
  }
  // A primitive (parts.fixed) has no Sound or Range, but its drawing saves as any chart's does.
  const files = !parts.tableMarkup && options.controls !== false;
  const exports = files
    ? [s.downloadSvg, s.downloadPng, s.downloadTactile, ...(options.id ? [s.copyEmbed] : [])]
    : [];
  if (csv || exports.length > 0) {
    const items =
      csv + exports.map((text) => pending("button", { type: "button" }, escapeHtml(text))).join("");
    const menu = `${element("summary", {}, face("download", s.download) + iconMarkup("chevron"))}${element("div", { class: "enarratio-panel enarratio-menu" }, items)}`;
    // With no CSV link, nothing in the menu works without script, so the whole menu waits for it.
    bar.push(
      csv
        ? element("details", { class: "enarratio-download" }, menu)
        : pending("details", { class: "enarratio-download" }, menu),
    );
  }
  return bar.length > 0
    ? element(
        "div",
        { class: "enarratio-controls", role: "toolbar", "aria-label": s.controls },
        bar.join(""),
      )
    : "";
}

/** The longest CSV, in characters of its `data:` URL, that a figure inlines. */
const CSV_LIMIT = 100_000;

/** The source line: source (linked) and byline, or "" when there is none. */
function sourceLine(kind: string, options: FigureOptions, strings: Strings): string {
  const parts: string[] = [];
  const source = typeof options.source === "string" ? { name: options.source } : options.source;
  if (source?.name.trim()) {
    const name = escapeHtml(source.name.trim());
    const linked = source.href ? element("a", { href: safeHref(kind, source.href) }, name) : name;
    parts.push(`${escapeHtml(strings.source)}: ${linked}`);
  }
  if (options.byline?.trim()) parts.push(escapeHtml(strings.by(options.byline.trim())));
  return parts.length > 0 ? element("p", { class: "enarratio-source" }, parts.join(" · ")) : "";
}

/** The "Download CSV" link, for the toolbar's Download menu, or "" when there is none. */
function csvLink(
  kind: string,
  options: FigureOptions,
  table: DataTable,
  strings: Strings,
  name: string,
): string {
  if (options.csv === false) return "";
  const file = `${
    name
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || kind
  }.csv`;
  // The byte order mark lets spreadsheets read the file as UTF-8.
  const href = options.csvHref
    ? safeHref(kind, options.csvHref)
    : `data:text/csv;charset=utf-8,%EF%BB%BF${encodeURIComponent(toCsv([table.columns, ...table.rows]))}`;
  if (href.length > CSV_LIMIT) {
    report(options, {
      chart: kind,
      code: "csv-too-large",
      message: `the data table is too large to inline as a CSV link (${href.length} characters); serve the file and pass csvHref, or csv: false`,
    });
    return "";
  }
  return element(
    "a",
    { href, download: file, class: "enarratio-csv" },
    escapeHtml(strings.downloadCsv),
  );
}

/** The checks a figure makes as it renders, each reported as an issue. */
function checkFigure(options: FigureOptions, parts: FigureParts, title: string | undefined): void {
  const issue = (code: ChartIssue["code"], message: string): void =>
    report(options, { chart: parts.kind, code, message });
  if (!title) issue("title-missing", "no title; give every chart a visible title");
  for (const axis of parts.description?.axes ?? []) {
    if (!axis.label && !title) {
      issue(
        "axis-label-missing",
        `the ${axis.position} axis has no label and no title says what it shows`,
      );
    }
  }
  const series = parts.description?.series;
  const limits = { series: 6, points: 1000, ...parts.limits };
  if (series && series.length > limits.series) {
    issue(
      "too-many-series",
      `${series.length} series is more than ${limits.series} a reader can tell apart; ${limits.advice ?? "show the largest and group the rest, or use small multiples or a table"}`,
    );
  }
  const points = series ? series.reduce((n, s) => n + s.points.length, 0) : parts.table.rows.length;
  if (points > limits.points) {
    issue(
      "too-many-points",
      `${points} points is more than ${limits.points}; ${limits.advice ?? "summarize the data first, or use small multiples or a table"}`,
    );
  }
}

/**
 * Kinds whose series are lines, and kinds told apart by symbol: their legend swatches are drawn as
 * a line (dashed in forced colors) or as the symbol, so the legend matches the marks without color.
 */
const LINE_KINDS = new Set([
  "line",
  "density",
  "survival",
  "dose-response",
  "slope",
  "radar",
  "parallel",
]);
const SYMBOL_KINDS = new Set(["scatter", "dot", "tree", "network"]);
/** Charts whose first series is drawn hollow (a candlestick's rising candles). */
const HOLLOW_KINDS = new Set(["candlestick"]);

function legendMarkup(parts: FigureParts): string {
  const swatch = element("span", { class: "enarratio-swatch", "aria-hidden": "true" });
  if (parts.ramp && parts.ramp.length > 0) {
    return element(
      "ul",
      { class: "enarratio-legend enarratio-ramp" },
      parts.ramp
        .map((item) =>
          element("li", { "data-step": item.step }, `${swatch}${escapeHtml(item.label)}`),
        )
        .join(""),
    );
  }
  if (!parts.legend || parts.legend.length === 0) return "";
  const mark = LINE_KINDS.has(parts.kind)
    ? "line"
    : SYMBOL_KINDS.has(parts.kind)
      ? "symbol"
      : HOLLOW_KINDS.has(parts.kind)
        ? "hollow"
        : undefined;
  return element(
    "ul",
    { class: "enarratio-legend", "data-enarratio-legend": mark },
    parts.legend
      .map((item) =>
        element(
          "li",
          { "data-enarratio-series": item.label, "data-slot": item.slot },
          `${swatch}${escapeHtml(item.label)}`,
        ),
      )
      .join(""),
  );
}

/** Assembles the figure markup for a chart. */
export function figure(options: FigureOptions, parts: FigureParts): string {
  const strings = stringsFor(options.strings);
  const title = options.title?.trim();
  const subtitle = options.subtitle?.trim();
  const caption = [options.caption?.trim(), parts.method].filter(Boolean).join(" ");
  const given = options.alt?.trim();
  const count = numberFormat({ locale: options.locale ?? "en-US", maximumFractionDigits: 0 });
  const description = parts.description;
  const intro = overview(
    description?.kind ?? parts.kind,
    description,
    parts.table.rows.length,
    strings,
    count,
  );
  const computed = description ? summarize(description, strings) : "";
  const summary = options.summary === false ? "" : (options.summary?.trim() ?? computed);

  checkFigure(options, parts, title);
  // B52: a chart without alt still gets a name, generated from what it shows, and an issue.
  const alt = given || `${intro} ${computed}`.trim();
  if (!given) {
    report(options, {
      chart: parts.kind,
      code: "alt-missing",
      message:
        "alt is missing, so the description was generated; write one that states the finding",
    });
  }
  const drawn = options.hoverTitles === false ? withoutTitles(parts.svg) : parts.svg;
  const svg = given
    ? drawn
    : drawn.replace(/^(<svg\b[^>]*?\saria-label=)"[^"]*"/, `$1"${escapeHtml(alt)}"`);

  const legend = legendMarkup(parts);
  const wide = !parts.fixed && (options.width ?? DEFAULT_WIDTH) >= WIDE_WIDTH;
  const name = title ?? alt;
  // The toolbar, with the controls enhance() will add written ahead of it so the page does not
  // shift.
  const controls = toolbarMarkup(
    options,
    parts,
    svg,
    csvLink(parts.kind, options, parts.table, strings, name),
  );
  const source = sourceLine(parts.kind, options, strings);
  const tableBlock = parts.tableMarkup
    ? parts.tableMarkup(strings.dataFor(name))
    : dataTableBlock(parts.table, strings.dataFor(name));
  const notes = typeof options.notes === "string" ? [options.notes] : (options.notes ?? []);
  const muted = (cls: string, text: string): string =>
    element("p", { class: cls }, escapeHtml(text));

  // The head names the figure. The finding repeats the SVG's name for sighted readers, so it is
  // hidden from assistive technology, which reads it once, on the SVG; a table has no SVG.
  const head = [
    title ? muted("enarratio-title", title) : "",
    subtitle ? muted("enarratio-subtitle", subtitle) : "",
    given
      ? element(
          "p",
          { class: "enarratio-finding", "aria-hidden": parts.tableMarkup ? undefined : "true" },
          escapeHtml(given),
        )
      : "",
  ].join("");

  return element(
    "figure",
    {
      class: "enarratio",
      id: options.id,
      lang: options.lang?.trim() || undefined,
      "data-enarratio": parts.kind,
      "data-enarratio-orientation": parts.orientation,
      "data-enarratio-x-scale": parts.x ? JSON.stringify(parts.x) : undefined,
      "data-enarratio-series-field": parts.seriesField,
      "data-enarratio-colors": slotStyle(parts.slotColors),
      "data-enarratio-textured": parts.textured,
      // Nothing in a primitive's drawing is interactive, so enhance() leaves the figure alone.
      "data-enarratio-static": parts.fixed,
    },
    [
      head ? element("figcaption", { class: "enarratio-head" }, head) : "",
      // B53: what the chart is, before it: type, series and points, axes and ranges.
      muted("enarratio-overview enarratio-visually-hidden", intro),
      // Record 0035: the toolbar above the drawing, under the head.
      controls,
      legend,
      // A frame that scrolls sideways on narrow screens instead of shrinking the text. Drawings 30rem
      // or wider keep that width and scroll, so a wide frame gets a tabindex (a keyboard can reach
      // it) and a group role (it carries the title as its name, not the alt the SVG already reads).
      // enhance() drops the tab stop once the marks take focus.
      parts.tableMarkup
        ? ""
        : element(
            "div",
            wide
              ? {
                  class: "enarratio-frame enarratio-frame-wide",
                  tabindex: "0",
                  role: "group",
                  "aria-label": strings.scrollsSideways(title || strings.chart),
                }
              : { class: "enarratio-frame" },
            svg,
          ),
      // The data table, visually hidden, straight after the drawing it repeats; a
      // table chart's table is the chart, visible, after the source as before.
      parts.tableMarkup ? "" : tableBlock,
      summary && summary !== given ? muted("enarratio-summary", summary) : "",
      caption ? muted("enarratio-caption", caption) : "",
      ...notes
        .filter((n) => n.trim())
        .map((n) => muted("enarratio-note", `${strings.notes}: ${n.trim()}`)),
      source,
      parts.tableMarkup ? tableBlock : "",
    ].join(""),
  );
}
