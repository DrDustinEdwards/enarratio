/**
 * The words and numbers Enarratio writes for readers: the strings table every generated sentence
 * comes from (English by default, replaceable for another language), locale-aware number and date
 * formats, the reading-grade score the summaries are held to, and the CSV a figure links to.
 */

export type { DateFormatOptions, NumberFormatOptions } from "./format.js";
export {
  dateFormat,
  defaultFormat,
  numberFormat,
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

/**
 * The words charts write into table headers, legends, axis labels and hover details when the
 * options name none. Every one can be translated through `strings.terms`.
 */
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
export interface LogisticStatement {
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
  /** The data disclosure's label while closed and open. */
  readonly showData: string;
  readonly hideData: string;
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
  readonly sparklineSummary: (sparkline: {
    readonly subject: string;
    readonly values: string;
    readonly first: string;
    readonly last: string;
    readonly lowest: string;
    readonly highest: string;
  }) => string;
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

/** Joins a few short phrases as a sentence would: "a, b and c". */
function and(items: readonly string[]): string {
  return items.length < 2
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

const plural = (n: string, one: string, many: string): string => `${n} ${n === "1" ? one : many}`;

/** The English strings, the default. */
export const ENGLISH: Strings = {
  showData: "Show data",
  hideData: "Hide data",
  dataFor: (name) => `Data for: ${name}`,
  scrollsSideways: (name) => `${name}, scrolls sideways`,
  chart: "Chart",
  downloadCsv: "Download CSV",
  source: "Source",
  by: (name) => `By ${name}`,
  notes: "Notes",
  kinds: {
    bar: "Bar chart",
    line: "Line chart",
    area: "Area chart",
    scatter: "Scatter plot",
    heatmap: "Heatmap",
    titer: "Titer plot",
    genome: "Genome track",
    network: "Network",
    sparkline: "Sparkline",
    "progress-ring": "Progress ring",
    "uptime-strip": "Uptime strip",
    "heat-strip": "Heat strip",
    timeline: "Timeline",
    histogram: "Histogram",
    density: "Density plot",
    strip: "Strip plot",
    box: "Box plot",
    dot: "Dot plot",
    range: "Range plot",
    dumbbell: "Dumbbell plot",
    slope: "Slope chart",
    pie: "Pie chart",
    waterfall: "Waterfall chart",
    "small-multiples": "Small multiples",
    table: "Table",
    "dose-response": "Dose-response curve",
    survival: "Survival curve",
    forest: "Forest plot",
    tree: "Phylogenetic tree",
    "dot-map": "Dot map",
    choropleth: "Choropleth map",
  },
  overview: (kind, points, series) =>
    `${kind} with ${series === undefined ? "" : `${plural(series, "series", "series")} and `}${plural(points, "point", "points")}.`,
  axis: (a) =>
    `${a.position === "size" ? "Point size" : a.position === "color" ? "Color" : `${a.position.toUpperCase()} axis`}${a.label ? `, ${a.label}` : ""}: ${a.from} to ${a.to}.`,
  trend: (series, direction, from, to, turn) => {
    const end = `${to.value} (${to.at})`;
    if (turn) {
      const [there, back] = turn.kind === "peak" ? ["rose", "fell"] : ["fell", "rose"];
      return `${series} ${there} from ${from.value} (${from.at}) to a ${turn.kind} of ${turn.point.value} (${turn.point.at}), then ${back} to ${end}.`;
    }
    if (direction === "flat")
      return `${series} stayed near ${from.value} from ${from.at} to ${to.at}.`;
    return `${series} ${direction === "up" ? "rose" : "fell"} from ${from.value} (${from.at}) to ${end}.`;
  },
  highest: (p) => `The highest value is ${p.value} (${p.at}).`,
  lowest: (p) => `The lowest is ${p.value} (${p.at}).`,
  outliers: (values) =>
    values.length === 1
      ? `One value stands out: ${values[0]}.`
      : `Values that stand out: ${and(values)}.`,
  interval: (series, label, at, lower, upper) =>
    `${series ? `For ${series}, the` : "The"} ${label} for ${at} is ${lower} to ${upper}.`,
  correlation: (strength, sign, r) =>
    strength === "weak"
      ? `The two values show little link (r = ${r}).`
      : `As one value goes up, the other tends to go ${sign} (${strength} link, r = ${r}).`,
  medians: (points) =>
    `${points.length === 1 ? "The median is" : "Medians:"} ${points.map((p) => `${p.value} (${p.at})`).join(", ")}.`,
  range: (from, to) => `${from} to ${to}`,
  fromTo: (from, to) => `from ${from} to ${to}`,
  below: (value) => `below ${value}`,
  orMore: (value) => `${value} or more`,
  notesOnChart: (notes) => `Notes on the chart: ${notes.join("; ")}.`,
  belowLimit: (limit) => `below the limit of detection (<${limit})`,
  geometricMeans: (groups) =>
    `Geometric mean titers: ${groups
      .map(
        (g) =>
          `${g.value} (${g.at}${g.lower && g.upper ? `, 95% CI ${g.lower} to ${g.upper}` : ""})`,
      )
      .join(", ")}.`,
  limitOfDetection: (limit, below, samples) =>
    `The limit of detection is ${limit}; ${below === "0" ? "no sample is" : `${below} of ${samples} samples ${below === "1" ? "is" : "are"}`} below it.`,
  genomeSummary: (g) => {
    const one = g.shortest.at === g.longest.at && g.shortest.value === g.longest.value;
    const strands = [
      ...(g.forward === "0" ? [] : [`${g.forward} forward`]),
      ...(g.reverse === "0" ? [] : [`${g.reverse} reverse`]),
      ...(g.unstranded === "0" ? [] : [`${g.unstranded} with no strand`]),
    ];
    return [
      one
        ? `${plural(g.features, "feature", "features")}, ${g.longest.value} long (${g.longest.at}).`
        : `${plural(g.features, "feature", "features")}, from ${g.shortest.value} (${g.shortest.at}) to ${g.longest.value} (${g.longest.at}) long.`,
      `Strands: ${and(strands)}.`,
      g.overlaps === "0"
        ? "No features overlap."
        : `${plural(g.overlaps, "pair of features overlaps", "pairs of features overlap")}.`,
    ].join(" ");
  },
  networkSummary: (n) =>
    [
      `${plural(n.nodes, "node", "nodes")} and ${plural(n.links, "link", "links")}.`,
      n.hubs.length > 0
        ? `Most connections: ${and(n.hubs.map((h) => `${h.at} (${h.value})`))}.`
        : "",
      n.components === "1"
        ? "Every node is linked to the rest."
        : `They form ${n.components} separate parts.`,
    ]
      .filter(Boolean)
      .join(" "),
  landmarks: (count, name, highlighted) =>
    `${count === "1" ? "A square marks a landmark" : `${count} squares mark landmarks`} (${name})${highlighted ? `; the filled square is ${highlighted}` : ""}.`,
  sparklineSummary: (s) =>
    `${s.subject ? `${s.subject}: ` : ""}${s.values} values, from ${s.first} to ${s.last}; lowest ${s.lowest}, highest ${s.highest}.`,
  heatStripSummary: (s) =>
    `${s.subject ? `${s.subject}: ` : ""}${s.cells} cells, from ${s.first} to ${s.last}; lowest ${s.lowest}, highest ${s.highest}${s.missing ? `; ${s.missing} with no data` : ""}.`,
  uptimeSummary: (s) =>
    `${s.subject ? `${s.subject}: ` : ""}${s.periods} periods, ${s.counts.map((c) => `${c.n} ${c.status}`).join(", ")}; ${s.available === undefined ? "no measurements" : `${s.available} available`}.`,
  progressSummary: (r) => {
    const over = r.over ? ", more than the total" : "";
    return `${r.subject ? `${r.subject}: ` : ""}${r.value === undefined ? `${r.percent}${over}` : `${r.value} of ${r.max} (${r.percent}${over})`}`;
  },
  timelineSummary: (t) =>
    `${t.subject ? `${t.subject}: ` : ""}${t.events} ${t.events === "1" ? "event" : "events"} in ${t.lanes} ${t.lanes === "1" ? "lane" : "lanes"}, ${t.from} to ${t.to}; ${t.counts.map((c) => `${c.n} ${c.status}`).join(", ")}.`,
  terms: {
    value: "Value",
    values: "Values",
    count: "Count",
    density: "Density",
    bin: "bin",
    interval: "Interval",
    change: "Change",
    noChange: "No change",
    total: "Total",
    runningTotal: "Running total",
    increase: "Increase",
    decrease: "Decrease",
    aboveZero: "Above zero",
    belowZero: "Below zero",
    rising: "Rising",
    falling: "Falling",
    share: "Share",
    point: "Point",
    points: "Points",
    series: "Series",
    n: "n",
    minimum: "Minimum",
    lowerQuartile: "Lower quartile",
    median: "Median",
    upperQuartile: "Upper quartile",
    maximum: "Maximum",
    quartiles: "quartiles",
    whiskers: "Whiskers",
    outlier: "outlier",
    outliers: "Outliers",
    range: "Range",
    response: "Response",
    fitted: "Fitted",
    all: "All",
    atRisk: "At risk",
    events: "Events",
    censored: "Censored",
    survival: "Survival",
    survivalProbability: "Survival probability",
    numberAtRisk: "Number at risk",
    confidence95: "95% CI",
    weight: "Weight",
    pooledFixed: "Pooled (fixed effect)",
    pooledRandom: "Pooled (random effects)",
    node: "Node",
    parent: "Parent",
    root: "Root",
    tip: "Tip",
    tips: "Tips",
    branchLength: "Branch length",
    distanceFromRoot: "Distance from root",
    depth: "Depth",
    label: "Label",
    group: "Group",
    substitutionsPerSite: "Substitutions per site",
    noData: "no data",
    longitude: "Longitude",
    latitude: "Latitude",
    region: "Region",
    landmark: "Landmark",
    highlightedLandmark: "highlighted",
    forecast: "Forecast",
    yes: "Yes",
    lowerBound: "Lower bound",
    upperBound: "Upper bound",
    lower: "lower",
    upper: "upper",
    highlighted: "highlighted",
    titer: "Titer",
    titers: "Titers",
    gmt: "GMT",
    lod: "LOD",
    belowLod: "Below LOD",
    samples: "Samples",
    feature: "Feature",
    features: "Features",
    type: "Type",
    track: "Track",
    start: "Start",
    end: "End",
    length: "Length",
    position: "Position",
    nucleotides: "nt",
    strand: "Strand",
    forwardStrand: "forward strand",
    reverseStrand: "reverse strand",
    noStrand: "no strand",
    nodes: "Nodes",
    connectedTo: "Connected to",
    connection: "connection",
    connections: "connections",
    none: "none",
    cell: "Cell",
    rampStep: "Ramp step",
    period: "Period",
    status: "Status",
    measure: "Measure",
    progress: "Progress",
    percent: "Percent",
    event: "Event",
    lane: "Lane",
    up: "up",
    degraded: "degraded",
    down: "down",
    ok: "ok",
    warning: "warning",
    error: "error",
    unknown: "unknown",
  },
  histogramDensity:
    "The line is a Gaussian kernel density estimate (Silverman's bandwidth), scaled to counts.",
  densityMethod: (groups) =>
    `Gaussian kernel density, ${groups
      .map((g) => `${g.name ? `${g.name}: ` : ""}n ${g.n}, bandwidth ${g.bandwidth}`)
      .join("; ")}.`,
  logisticMethod: (fitted, curves) =>
    `${fitted ? "Four-parameter logistic fit by least squares" : "Four-parameter logistic curve"}: ${curves
      .map(
        (c) =>
          `${c.name ? `${c.name}: ` : ""}${c.midpoint} ${c.ec50}${c.lower && c.upper ? ` (95% CI ${c.lower} to ${c.upper})` : ""}, Hill slope ${c.hill}, bottom ${c.bottom}, top ${c.top}`,
      )
      .join("; ")}.`,
  survivalMethod: (bands, groups) =>
    `Kaplan-Meier estimates; + marks a censored subject${bands ? "; bands are 95% confidence intervals (log-log)" : ""}. ${groups
      .map(
        (g) =>
          `${g.name ? `${g.name}: ` : ""}n ${g.n}, ${g.events} events, median survival ${g.median ?? "not reached"}`,
      )
      .join("; ")}.`,
  poolingMethod: (method, log, q, i2, tau2) =>
    `Pooled by inverse-variance weighting, ${method === "random" ? "random effects (DerSimonian-Laird)" : "fixed effect"}${log ? " on the log scale" : ""}: Q ${q}, I² ${i2}${tau2 === undefined ? "" : `, τ² ${tau2}`}.`,
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

/** Syllables in an English word, by vowel groups; good enough to grade a sentence. */
function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w === "") return 1;
  const groups = w.replace(/(?:[^laeiouy]es|[^laeiouy]ed|[^laeiouy]e)$/, "").match(/[aeiouy]+/g);
  return Math.max(1, groups?.length ?? 1);
}

/**
 * The Flesch-Kincaid grade level of English text: about the school year a reader needs. Numbers
 * count as one-syllable words. Enarratio's generated summaries stay at 9 or below (B19), and
 * charts report author text above it.
 */
export function readingGrade(text: string): number {
  const words = text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  if (words.length === 0) return 0;
  const sentences = Math.max(1, text.split(/[.!?;:]+(?:\s|$)/).filter((s) => s.trim()).length);
  const total = words.reduce((n, w) => n + syllables(w), 0);
  return 0.39 * (words.length / sentences) + 11.8 * (total / words.length) - 15.59;
}

/**
 * One CSV field (RFC 4180): quoted when it holds a comma, quote or line break. A field a
 * spreadsheet would run as a formula (starting with =, @, a tab or carriage return, or with + or -
 * not followed by a number) gets a leading apostrophe, so a downloaded file cannot run one.
 */
export function csvField(value: string): string {
  const safe = /^[=@\t\r]|^[+-](?![\d.])/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Rows of fields as CSV text, lines ending in CRLF. */
export function toCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map(csvField).join(",")).join("\r\n");
}
