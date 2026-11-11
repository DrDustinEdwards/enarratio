/**
 * The figure every chart is delivered in (design record 0023): a head (title, subtitle and the
 * finding in text), an overview for screen readers, a legend, the SVG named by its text
 * alternative, a summary computed from the data, the caption, notes and source line, and the
 * data table, visually hidden for screen readers and AI agents. A toolbar above the drawing holds
 * the CSV download (record 0035). All of it is in the HTML with scripts off. The accessible name
 * lives on the SVG and the figcaption, never on the figure, because `role="img"` hides its
 * descendants: naming the figure would hide the caption and table from the readers they exist for.
 */

import { BRUSH_SCALES, ENHANCE_STRINGS, type ICONS } from "../controls.js";
import { element, escapeHtml } from "../html.js";
import { requireSize, safeHref } from "./data.js";
import { type ChartDescription, overview, summarize } from "./describe.js";
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
   * struggle with: no `alt`, no title, an unlabeled axis, too many series or points, or a CSV too
   * large to inline. Set it once in a site's shared options.
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
  /** A line under the title saying what the chart shows or how to read it (B17). */
  readonly subtitle?: string;
  /** A visible caption below the chart: method, caveats. */
  readonly caption?: string;
  /** Notes under the chart: definitions of the measures, exclusions (B23, C2). */
  readonly notes?: string | readonly string[];
  /** Where the data come from, linked when `href` is given (C2). */
  readonly source?: Source;
  /** Who made the chart, in the source line (C2). */
  readonly byline?: string;
  /**
   * The summary under the chart. By default it is computed from the data: each series' trend,
   * the highest and lowest values, values far from the rest and the interval drawn (B39, B24).
   * A string replaces it; `false` leaves it out.
   */
  readonly summary?: string | false;
  /**
   * The "Download CSV" link: built from the data table as a `data:` URL (default), or `false` to
   * leave it out. A table too large to inline gets no link and an issue; give `csvHref` then.
   */
  readonly csv?: boolean;
  /** A CSV file the site serves for this chart, linked instead of the inline one. */
  readonly csvHref?: string;
  /** The BCP 47 locale for generated numbers and text (default `"en-US"`). */
  readonly locale?: string;
  /** Translations of the generated strings, kinds and terms; the rest stay English. */
  readonly strings?: StringOverrides;
  /**
   * The language of the figure, a BCP 47 tag such as `"de"`, written as its `lang` attribute so a
   * screen reader switches voice for the generated text, controls and table when it differs from
   * the page's (WCAG 2.2 SC 3.1.2). Set it with `strings` and `locale` when they translate the
   * figure; leave it out when the figure is in the page's language.
   */
  readonly lang?: string;
  /** An `id` for the figure, which enhancement events carry as `chartId`. */
  readonly id?: string;
  /** The drawing's width in CSS pixels; the SVG scales down to fit narrower containers. */
  readonly width?: number;
  /** The drawing's height in CSS pixels. */
  readonly height?: number;
  /**
   * The browser's hover title on each mark (a `<title>` inside it), on by default. `false`
   * leaves them out, for a site that shows no hover tooltips: each mark's details move to a
   * `data-enarratio-label` attribute, which `enhance()` still names its points with, and the
   * data stay in the table.
   */
  readonly hoverTitles?: boolean;
  /**
   * The toolbar controls `enhance()` adds with its default options (Sound, Range and the Download
   * menu's SVG, PNG, tactile SVG and Copy embed), written into the markup ahead of it, inert, so
   * the page does not shift when the layer arrives (D5, records 0033, 0035). With scripts off they
   * stay hidden. On by default; `false` leaves them out, for a page that never enhances or turns
   * those controls off. "Download CSV" is a link and works without script, so it stays either way.
   */
  readonly controls?: boolean;
}

/**
 * The SVG without its marks' hover titles: each `<title>` becomes its mark's
 * `data-enarratio-label`, so the enhancement layer can still name the point.
 */
function withoutTitles(svg: string): string {
  return svg
    .replace(
      /<([a-zA-Z]+)((?:\s[^<>]*)?)(?<!\/)><title>([^<]*)<\/title>/g,
      (_, tag: string, attrs: string, text: string) =>
        `<${tag}${attrs} data-enarratio-label="${text.replaceAll('"', "&quot;")}">`,
    )
    .replace(/<title>[^<]*<\/title>/g, "");
}

/** Units for a chart's axes, added to the axis labels and table headers: "Weight (kg)" (B23). */
export interface AxisUnits {
  readonly xUnit?: string;
  readonly yUnit?: string;
}

/**
 * A label with its unit, "Weight (kg)"; a hidden (null) label stays hidden, and a label that
 * already names its unit as a word ("Reads per sample", unit "reads") is not repeated.
 */
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
  /**
   * Whether the chart's filled series are not all named on the drawing, so its textures show
   * (record 0036): otherwise they show only for readers who ask for them.
   */
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
   * The most series and points before the figure reports an issue (defaults 6 and 1000), and
   * what to do instead, when the chart knows better than the general advice.
   */
  readonly limits?: {
    readonly series?: number;
    readonly points?: number;
    readonly advice?: string;
  };
  /** A sentence the chart writes about how it computed what it draws, shown with the caption. */
  readonly method?: string;
  /**
   * The figure's table as markup, for a chart whose drawing is its table (`tableChart`), given
   * the table's accessible caption: shown in place of the drawing and the data table, so there is
   * one table, which `enhance()` sorts. `table` still gives the overview and CSV their rows.
   */
  readonly tableMarkup?: (caption: string) => string;
}

/** Sends an issue where the options say: thrown when strict, to `onIssue`, or warned. */
export function report(options: IssueOptions, issue: ChartIssue): void {
  if (options.strict) throw new Error(`${issue.chart}: ${issue.message}`);
  if (options.onIssue) options.onIssue(issue);
  else console.warn(`enarratio: ${issue.chart}: ${issue.message}`);
}

/**
 * Checks the options every chart shares before anything is drawn: a positive finite width and
 * height when given (A7, F15). A missing `alt` is reported by {@link figure}, which can generate one.
 */
export function validateFigure(kind: string, options: FigureOptions): void {
  requireSize(kind, "width", options.width);
  requireSize(kind, "height", options.height);
  if (options.lang !== undefined) {
    try {
      Intl.getCanonicalLocales(options.lang);
    } catch {
      throw new Error(`${kind}: lang "${options.lang}" is not a BCP 47 language tag, such as "de"`);
    }
  }
}

/** What a caller-supplied color may contain: enough for hex, color functions and var(), not url(). */
const SAFE_COLOR = /^[#a-z0-9(),.%\s-]+$/i;

function cssColor(value: string): string {
  if (!SAFE_COLOR.test(value) || /url\s*\(/i.test(value)) {
    throw new Error(`"${value}" is not an allowed color; use hex, a color function or var(--name)`);
  }
  return value;
}

/**
 * Per-figure palette overrides as CSS declarations, or undefined when there are none. Charts carry
 * them in `data-enarratio-colors`, never a `style` attribute; {@link colorStyles} turns them into
 * rules for the page's stylesheet (D4).
 */
export function slotStyle(
  colors: ReadonlyMap<number, SeriesColor> | undefined,
): string | undefined {
  if (!colors || colors.size === 0) return undefined;
  return [...colors]
    .map(([slot, color]) => {
      const value =
        typeof color === "string"
          ? cssColor(color)
          : `light-dark(${cssColor(color.light)}, ${cssColor(color.dark)})`;
      return `--enarratio-series-${slot}: ${value}`;
    })
    .join("; ");
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
 * A data table as the markup a figure carries: visually hidden, in the HTML right after the
 * drawing, for screen readers and AI agents (record 0035). Sighted readers get the values from
 * the hover and focus details, the summary and "Download CSV". `caption` names the table.
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

/** A toolbar icon: an empty span the stylesheet draws, hidden from assistive technology. */
function iconMarkup(name: keyof typeof ICONS): string {
  return element("span", { class: "enarratio-icon", "data-icon": name, "aria-hidden": "true" });
}

/** A toolbar control's face: its icon and its word, which is also its name. */
function face(name: keyof typeof ICONS, text: string): string {
  return iconMarkup(name) + element("span", { class: "enarratio-label" }, escapeHtml(text));
}

/**
 * The toolbar above the drawing (record 0035), as `enhance()` builds it with its default options
 * (chart.ts attachControls, export.ts): Sound when there are two or more marks, Range on a chart
 * with a continuous x scale, then the Download menu: "Download CSV", then the drawing's files and,
 * for a figure with an id, Copy embed. What only the layer can do is written inert and hidden
 * with scripts off; "Download CSV" is a link in a native disclosure, so it works without script.
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

/** The checks a figure makes as it renders, each reported as an issue (B18, B19, B21, B25). */
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
 * Kinds whose series are lines, and kinds whose series are told apart by symbol: their legend
 * swatches are drawn as a line (dashed as the line is in forced colors) or as the symbol, so the
 * legend matches the marks without color (B57).
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
  // shift (D5, records 0033, 0035).
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
      // A frame that scrolls sideways on narrow screens instead of shrinking the text (A13).
      // Drawings 30rem or wider keep that width and scroll; narrower ones scale as usual. A wide
      // frame is the one that can scroll, so a keyboard can reach it (tabindex), and the group
      // role lets it carry a name. Markup cannot know whether it overflows, so every wide frame
      // gets both; enhance() drops the tab stop once the marks take focus. The name is the title,
      // not the alt, which the SVG inside already reads.
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
      // The data table, visually hidden, straight after the drawing it repeats (record 0035); a
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
