import { englishSparklineSentence } from "./sparkline.js";
import type { Strings } from "./text.js";

/** Joins a few short phrases as a sentence would: "a, b and c". */
function and(items: readonly string[]): string {
  return items.length < 2
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

const plural = (n: string, one: string, many: string): string => `${n} ${n === "1" ? one : many}`;

/** The English strings, the default. */
export const ENGLISH: Strings = {
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
    treemap: "Treemap",
    sunburst: "Sunburst chart",
    funnel: "Funnel chart",
    sankey: "Sankey diagram",
    chord: "Chord diagram",
    radar: "Radar chart",
    gauge: "Gauge",
    bullet: "Bullet chart",
    parallel: "Parallel coordinates",
    gantt: "Gantt chart",
    candlestick: "Candlestick chart",
    calendar: "Calendar heatmap",
    streamgraph: "Streamgraph",
    violin: "Violin plot",
    ridgeline: "Ridgeline plot",
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
  spread: (measure, high, low) =>
    `${measure} is highest for ${high.at} (${high.value}) and lowest for ${low.at} (${low.value}).`,
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
  sparklineSummary: englishSparklineSentence,
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
    targetValue: "Target",
    band: "Band",
    stage: "Stage",
    shareOfFirst: "Share of first",
    shareOfPrevious: "Share of previous",
    ofPrevious: "of previous",
    ofFirst: "of first",
    source: "From",
    target: "To",
    flow: "Flow",
    flows: "Flows",
    incoming: "In",
    outgoing: "Out",
    task: "Task",
    milestone: "Milestone",
    today: "Today",
    durationDays: "Duration (days)",
    days: "days",
    open: "Open",
    high: "High",
    low: "Low",
    close: "Close",
    weekOf: "Week of",
    bandwidth: "Bandwidth",
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
