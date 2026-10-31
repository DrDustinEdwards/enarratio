/**
 * The figure every chart is delivered in (design record 0023): a head (title, subtitle and the
 * finding in text), an overview for screen readers, a legend, the SVG named by its text
 * alternative, a summary computed from the data, the caption, notes and source line with a CSV
 * download, and the data table. All of it is in the HTML with scripts off. The accessible name
 * lives on the SVG and the figcaption, never on the figure, because `role="img"` hides its
 * descendants: naming the figure would hide the caption and table from the readers they exist for.
 */

import { element, escapeHtml } from "../html.js";
import { requireSize, safeHref } from "./data.js";
import { type ChartDescription, overview, summarize } from "./describe.js";
import { DEFAULT_WIDTH, WIDE_WIDTH } from "./size.js";
import {
  numberFormat,
  readingGrade,
  type StringOverrides,
  type Strings,
  stringsFor,
  toCsv,
} from "./text.js";

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
    | "reading-level"
    | "csv-too-large";
  readonly message: string;
}

/** Where a chart's issues go: `strict` throws, `onIssue` receives them, else they are warned. */
export interface IssueOptions {
  /**
   * Throw on the first issue instead of reporting it, so a build fails on a chart a reader would
   * struggle with: no `alt`, no title, an unlabeled axis, too many series or points, author text
   * above grade 9, or a CSV too large to inline. Set it once in a site's shared options.
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
  /** An `id` for the figure, which enhancement events carry as `chartId`. */
  readonly id?: string;
  /** The drawing's width in CSS pixels; the SVG scales down to fit narrower containers. */
  readonly width?: number;
  /** The drawing's height in CSS pixels. */
  readonly height?: number;
  /**
   * How the equivalent data table is shown: in a closed disclosure (default), or only to
   * assistive technology. It is always present.
   */
  readonly dataTable?: "details" | "visually-hidden";
  /**
   * The browser's hover title on each mark (a `<title>` inside it), on by default. `false`
   * leaves them out, for a site that shows no hover tooltips: each mark's details move to a
   * `data-enarratio-label` attribute, which `enhance()` still names its points with, and the
   * data stay in the table.
   */
  readonly hoverTitles?: boolean;
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
 * A data table as the markup a figure carries: in a closed disclosure (default), or visible only
 * to assistive technology. `caption` names the table for screen readers.
 */
export function dataTableBlock(
  table: DataTable,
  caption: string,
  display: "details" | "visually-hidden" = "details",
  strings: Strings = stringsFor(undefined),
): string {
  const markup = tableMarkup(table, caption);
  // Two labels, one shown at a time by the stylesheet: "Show data" closed, "Hide data" open.
  const label = `${element("span", { class: "enarratio-show" }, escapeHtml(strings.showData))}${element("span", { class: "enarratio-hide" }, escapeHtml(strings.hideData))}`;
  return display === "visually-hidden"
    ? element("div", { class: "enarratio-data enarratio-visually-hidden" }, markup)
    : element("details", { class: "enarratio-data" }, `${element("summary", {}, label)}${markup}`);
}

/** The longest CSV, in characters of its `data:` URL, that a figure inlines. */
const CSV_LIMIT = 100_000;

/** The source line: source (linked), byline and the CSV link, or "" when there is none. */
function sourceLine(
  kind: string,
  options: FigureOptions,
  table: DataTable,
  strings: Strings,
  name: string,
): string {
  const parts: string[] = [];
  const source = typeof options.source === "string" ? { name: options.source } : options.source;
  if (source?.name.trim()) {
    const name = escapeHtml(source.name.trim());
    const linked = source.href ? element("a", { href: safeHref(kind, source.href) }, name) : name;
    parts.push(`${escapeHtml(strings.source)}: ${linked}`);
  }
  if (options.byline?.trim()) parts.push(escapeHtml(strings.by(options.byline.trim())));
  if (options.csv !== false) {
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
    } else {
      parts.push(
        element(
          "a",
          { href, download: file, class: "enarratio-csv" },
          escapeHtml(strings.downloadCsv),
        ),
      );
    }
  }
  return parts.length > 0 ? element("p", { class: "enarratio-source" }, parts.join(" · ")) : "";
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
  for (const name of ["alt", "subtitle", "caption"] as const) {
    const text = options[name];
    // Grades of a few words swing on one long word, so only real sentences are scored, and the
    // grade is judged as the message states it, a whole number.
    const grade = text && text.split(/\s+/).length >= 15 ? Math.round(readingGrade(text)) : 0;
    if (grade > 9)
      issue("reading-level", `the ${name} reads at grade ${grade}; aim for 9 or below`);
  }
}

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
  return element(
    "ul",
    { class: "enarratio-legend" },
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
  const tableBlock = parts.tableMarkup
    ? parts.tableMarkup(strings.dataFor(name))
    : dataTableBlock(parts.table, strings.dataFor(name), options.dataTable, strings);
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
      "data-enarratio": parts.kind,
      "data-enarratio-orientation": parts.orientation,
      "data-enarratio-x-scale": parts.x ? JSON.stringify(parts.x) : undefined,
      "data-enarratio-series-field": parts.seriesField,
      "data-enarratio-colors": slotStyle(parts.slotColors),
      // Nothing in a primitive's drawing is interactive, so enhance() leaves the figure alone.
      "data-enarratio-static": parts.fixed,
    },
    [
      head ? element("figcaption", { class: "enarratio-head" }, head) : "",
      // B53: what the chart is, before it: type, series and points, axes and ranges.
      muted("enarratio-overview enarratio-visually-hidden", intro),
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
      summary && summary !== given ? muted("enarratio-summary", summary) : "",
      caption ? muted("enarratio-caption", caption) : "",
      ...notes
        .filter((n) => n.trim())
        .map((n) => muted("enarratio-note", `${strings.notes}: ${n.trim()}`)),
      sourceLine(parts.kind, options, parts.table, strings, name),
      tableBlock,
    ].join(""),
  );
}
