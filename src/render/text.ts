/**
 * The words and numbers Enarratio writes for readers: the strings table every generated sentence
 * comes from, locale-aware number and date formats, a reading-grade measure, and the figure's CSV.
 */

import { ENGLISH } from "./english.js";
import type { SparklineSentence } from "./sparkline.js";

export {
  dateFormat,
  defaultFormat,
  numberFormat,
  shareFormat,
  signed,
  valueAxis,
  valueFormat,
} from "./format.js";

/** One axis as the overview states it: its label and the range of values on it. */
export interface AxisRange {
  /** The x or y axis, point size (a bubble chart's or dot map's measure) or color (a choropleth's). */
  readonly position: "x" | "y" | "size" | "color";
  readonly label: string;
  readonly from: string;
  readonly to: string;
}

/** A value and where it is (its category, date or x), both formatted. */
export interface At {
  readonly value: string;
  readonly at: string;
}

/** The words charts write into table headers, legends, axis labels and hover details when the options name none. Translate through `strings.terms`. */
export interface Terms {
  readonly value: string;
  readonly values: string;
  readonly count: string;
  readonly density: string;
  /** A histogram bin's header suffix: "Age (bin)". */
  readonly bin: string;
  readonly interval: string;
  readonly change: string;
  readonly noChange: string;
  readonly total: string;
  readonly runningTotal: string;
  readonly increase: string;
  readonly decrease: string;
  readonly aboveZero: string;
  readonly belowZero: string;
  readonly rising: string;
  readonly falling: string;
  readonly share: string;
  readonly point: string;
  readonly points: string;
  readonly series: string;
  readonly n: string;
  readonly minimum: string;
  readonly lowerQuartile: string;
  readonly median: string;
  readonly upperQuartile: string;
  readonly maximum: string;
  readonly quartiles: string;
  readonly whiskers: string;
  readonly outlier: string;
  readonly outliers: string;
  readonly range: string;
  readonly response: string;
  readonly fitted: string;
  readonly all: string;
  readonly atRisk: string;
  readonly events: string;
  readonly censored: string;
  readonly survival: string;
  readonly survivalProbability: string;
  readonly numberAtRisk: string;
  readonly confidence95: string;
  readonly weight: string;
  readonly pooledFixed: string;
  readonly pooledRandom: string;
  readonly node: string;
  readonly parent: string;
  readonly root: string;
  readonly tip: string;
  readonly tips: string;
  readonly branchLength: string;
  readonly distanceFromRoot: string;
  readonly depth: string;
  readonly label: string;
  readonly group: string;
  readonly substitutionsPerSite: string;
  /** A missing value, in hover details and the primitives' tables. */
  readonly noData: string;
  /** A map's coordinate columns. */
  readonly longitude: string;
  readonly latitude: string;
  /** A map's region column, when the caller names none. */
  readonly region: string;
  readonly targetValue: string;
  readonly band: string;
  readonly stage: string;
  readonly shareOfFirst: string;
  readonly shareOfPrevious: string;
  readonly ofPrevious: string;
  readonly ofFirst: string;
  readonly source: string;
  readonly target: string;
  readonly flow: string;
  readonly flows: string;
  readonly incoming: string;
  readonly outgoing: string;
  readonly task: string;
  readonly milestone: string;
  readonly today: string;
  /** A Gantt chart's duration column. */
  readonly durationDays: string;
  /** After a length in days: "36 days". */
  readonly days: string;
  readonly open: string;
  readonly high: string;
  readonly low: string;
  readonly close: string;
  /** A calendar heatmap's table rows: "Week of". */
  readonly weekOf: string;
  readonly bandwidth: string;
  /** A dot map's landmarks, in the table, when the caller names none. */
  readonly landmark: string;
  /** After the highlighted landmark's name in the table: "Pump 7 (highlighted)". */
  readonly highlightedLandmark: string;
  readonly forecast: string;
  /** A table cell marking a row as forecast. */
  readonly yes: string;
  readonly lowerBound: string;
  readonly upperBound: string;
  /** A band's bound after its label: "95% PI, lower". */
  readonly lower: string;
  readonly upper: string;
  /** A highlighted range with no label of its own, in the text alternative. */
  readonly highlighted: string;
  readonly titer: string;
  readonly titers: string;
  /** Geometric mean titer. */
  readonly gmt: string;
  /** Limit of detection, as the titer plot's rule is labeled. */
  readonly lod: string;
  readonly belowLod: string;
  readonly samples: string;
  readonly feature: string;
  readonly features: string;
  readonly type: string;
  readonly track: string;
  readonly start: string;
  readonly end: string;
  readonly length: string;
  readonly position: string;
  /** The unit of a genome's positions and lengths. */
  readonly nucleotides: string;
  readonly strand: string;
  readonly forwardStrand: string;
  readonly reverseStrand: string;
  readonly noStrand: string;
  readonly nodes: string;
  readonly connectedTo: string;
  readonly connection: string;
  readonly connections: string;
  /** A node with no connections, in the network's table. */
  readonly none: string;
  readonly cell: string;
  readonly rampStep: string;
  readonly period: string;
  readonly status: string;
  readonly measure: string;
  readonly progress: string;
  readonly percent: string;
  readonly event: string;
  readonly lane: string;
  /** The uptime strip's statuses. */
  readonly up: string;
  readonly degraded: string;
  readonly down: string;
  /** The timeline's statuses. */
  readonly ok: string;
  readonly warning: string;
  readonly error: string;
  readonly unknown: string;
}

/** A count of one status, as the primitives' summaries list them: "3 up". */
interface StatusCount {
  readonly n: string;
  readonly status: string;
}

/** One fitted dose-response curve, as {@link Strings.logisticMethod} states it. */
interface LogisticStatement {
  readonly name?: string;
  readonly midpoint: string;
  readonly ec50: string;
  readonly lower?: string;
  readonly upper?: string;
  readonly hill: string;
  readonly bottom: string;
  readonly top: string;
}

/**
 * Every string Enarratio generates. Pass a partial table as `strings` to translate some or all of
 * them; the rest stay English. Functions take values already formatted for the locale.
 */
export interface Strings {
  /** The data table's accessible caption. */
  readonly dataFor: (name: string) => string;
  /** The name of a wide chart's scrolling frame. */
  readonly scrollsSideways: (name: string) => string;
  /** The frame's name when the chart has no title. */
  readonly chart: string;
  readonly downloadCsv: string;
  /** Introduces the source line's name ("Source: ..."). */
  readonly source: string;
  readonly by: (name: string) => string;
  readonly notes: string;
  /** What each chart kind is called, by its `data-enarratio` value. */
  readonly kinds: Readonly<Record<string, string>>;
  /** The first sentence of the overview read before the chart; `series` only for charts with series. */
  readonly overview: (kind: string, points: string, series?: string) => string;
  readonly axis: (axis: AxisRange) => string;
  /**
   * One series from its first to its last value, with the peak or low between them when that
   * stands out more than either end.
   */
  readonly trend: (
    series: string,
    direction: "up" | "down" | "flat",
    from: At,
    to: At,
    turn?: { readonly kind: "peak" | "low"; readonly point: At },
  ) => string;
  readonly highest: (point: At) => string;
  readonly lowest: (point: At) => string;
  readonly outliers: (values: readonly string[]) => string;
  readonly interval: (
    series: string,
    label: string,
    at: string,
    lower: string,
    upper: string,
  ) => string;
  readonly correlation: (
    strength: "strong" | "moderate" | "weak",
    sign: "up" | "down",
    r: string,
  ) => string;
  /** One measure's highest and lowest items, in parallel coordinates. */
  readonly spread: (measure: string, high: At, low: At) => string;
  /** A box plot's medians, by group. */
  readonly medians: (points: readonly At[]) => string;
  /** Two values as a range: "3.1 to 4.2". */
  readonly range: (from: string, to: string) => string;
  /** A span of time, in a timeline's hover details and list: "from 08:00 to 09:30". */
  readonly fromTo: (from: string, to: string) => string;
  /** A heatmap's lowest and highest legend steps: "below 10", "40 or more". */
  readonly below: (value: string) => string;
  readonly orMore: (value: string) => string;
  /** What a chart's annotations say, added to its `alt`. */
  readonly notesOnChart: (notes: readonly string[]) => string;
  /** A titer under the limit of detection, in hover details. */
  readonly belowLimit: (limit: string) => string;
  /** A titer plot's geometric mean titers by group, each with its 95% interval when it has one. */
  readonly geometricMeans: (
    groups: readonly {
      readonly at: string;
      readonly value: string;
      readonly lower?: string;
      readonly upper?: string;
    }[],
  ) => string;
  /** A titer plot's limit of detection and how many samples fall below it. */
  readonly limitOfDetection: (limit: string, below: string, samples: string) => string;
  /** A genome track's features: how many, the shortest and longest, strands and overlaps. */
  readonly genomeSummary: (genome: {
    readonly features: string;
    readonly shortest: At;
    readonly longest: At;
    readonly forward: string;
    readonly reverse: string;
    readonly unstranded: string;
    /** Pairs of features in one track that share positions. */
    readonly overlaps: string;
  }) => string;
  /** A network's nodes and links, its most connected nodes and its separate parts. */
  readonly networkSummary: (network: {
    readonly nodes: string;
    readonly links: string;
    /** The most connected nodes: each one's label and number of connections. */
    readonly hubs: readonly At[];
    readonly components: string;
  }) => string;
  /** A dot map's landmarks: how many, what they are, and the one highlighted. */
  readonly landmarks: (count: string, name: string, highlighted?: string) => string;
  /** The primitives' generated text alternatives; `subject` is the label, or "". */
  readonly sparklineSummary: (sparkline: SparklineSentence) => string;
  readonly heatStripSummary: (strip: {
    readonly subject: string;
    readonly cells: string;
    readonly first: string;
    readonly last: string;
    readonly lowest: string;
    readonly highest: string;
    /** Cells with no data, when there are any. */
    readonly missing?: string;
  }) => string;
  readonly uptimeSummary: (strip: {
    readonly subject: string;
    readonly periods: string;
    readonly counts: readonly StatusCount[];
    /** The share of measured periods up or degraded; undefined when none was measured. */
    readonly available?: string;
  }) => string;
  readonly progressSummary: (ring: {
    readonly subject: string;
    /** The value and total; undefined when the total is 1 and the percentage says it all. */
    readonly value?: string;
    readonly max?: string;
    readonly percent: string;
    readonly over: boolean;
  }) => string;
  readonly timelineSummary: (timeline: {
    readonly subject: string;
    readonly events: string;
    readonly lanes: string;
    readonly from: string;
    readonly to: string;
    readonly counts: readonly StatusCount[];
  }) => string;
  readonly terms: Terms;
  /** The caption sentence of a histogram's density curve. */
  readonly histogramDensity: string;
  /** The caption sentence of a density plot: n and bandwidth by series. */
  readonly densityMethod: (
    groups: readonly { readonly name?: string; readonly n: string; readonly bandwidth: string }[],
  ) => string;
  /** The caption sentence of a dose-response chart: each curve's fit, or the curves given. */
  readonly logisticMethod: (fitted: boolean, curves: readonly LogisticStatement[]) => string;
  /** The caption sentence of a survival plot: n, events and median survival by group. */
  readonly survivalMethod: (
    bands: boolean,
    groups: readonly {
      readonly name?: string;
      readonly n: string;
      readonly events: string;
      readonly median?: string;
    }[],
  ) => string;
  /** The caption sentence of a forest plot's pooled estimate: method and heterogeneity. */
  readonly poolingMethod: (
    method: "fixed" | "random",
    log: boolean,
    q: string,
    i2: string,
    tau2?: string,
  ) => string;
}

/** What `strings` takes: any of the strings, and any of the kinds and terms, to replace. */
export type StringOverrides = Partial<Omit<Strings, "terms">> & {
  readonly terms?: Partial<Terms>;
};

/** The English strings with the caller's replacements. */
export function stringsFor(strings: StringOverrides | undefined): Strings {
  if (!strings) return ENGLISH;
  return {
    ...ENGLISH,
    ...strings,
    kinds: { ...ENGLISH.kinds, ...strings.kinds },
    terms: { ...ENGLISH.terms, ...strings.terms },
  };
}

function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w === "") return 1;
  const groups = w.replace(/(?:[^laeiouy]es|[^laeiouy]ed|[^laeiouy]e)$/, "").match(/[aeiouy]+/g);
  return Math.max(1, groups?.length ?? 1);
}

/** The Flesch-Kincaid grade level of English text, with numbers as one-syllable words. A measure a caller can use; no chart checks text against it. */
export function readingGrade(text: string): number {
  const words = text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  if (words.length === 0) return 0;
  const sentences = Math.max(1, text.split(/[.!?;:]+(?:\s|$)/).filter((s) => s.trim()).length);
  const total = words.reduce((n, w) => n + syllables(w), 0);
  return 0.39 * (words.length / sentences) + 11.8 * (total / words.length) - 15.59;
}

/**
 * One CSV field (RFC 4180): quoted when it holds a comma, quote or line break. A field a
 * spreadsheet would run as a formula (starting with =, @, a tab or carriage return, or + or -
 * unless the whole cell is a number) gets a leading apostrophe.
 */
function csvField(value: string): string {
  const safe = /^[\t\r]|^\s*[=@]|^\s*[+-](?![\d.,]+%?$)/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Rows of fields as CSV text, lines ending in CRLF. */
export function toCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map(csvField).join(",")).join("\r\n");
}
