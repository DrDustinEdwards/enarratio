import * as Plot from "@observablehq/plot";
import { markKey, maxOf } from "../render/data.js";
import { valueRange } from "../render/describe.js";
import {
  type FigureOptions,
  figure,
  type SeriesColor,
  validateFigure,
  withUnit,
} from "../render/figure.js";
import { decorate, keyed, renderPlot } from "../render/plot.js";
import { planSeries } from "../render/series.js";
import { numberFormat, stringsFor } from "../render/text.js";

/** One annotated feature on a genome: a gene, a coding sequence, a primer, a mutation site. */
export interface GenomeFeature {
  readonly name: string;
  /** The first position, 1-based and inclusive, as in GenBank and GFF. */
  readonly start: number;
  /** The last position, inclusive. */
  readonly end: number;
  /** 1 for the forward strand, -1 for reverse, 0 or omitted for none. */
  readonly strand?: 1 | -1 | 0;
  /** The feature type (gene, CDS, UTR), which sets its color and legend entry. */
  readonly type?: string;
  /** The track (row) it belongs to, e.g. a segment or an annotation source. */
  readonly track?: string;
}

/** Options for {@link genomeTrack}. */
export interface GenomeTrackOptions extends FigureOptions {
  readonly features: readonly GenomeFeature[];
  /** The sequence length in nucleotides; the axis runs from 1 to this. */
  readonly length: number;
  /** Tracks in display order. Without it, first-seen order. */
  readonly trackDomain?: readonly string[];
  /** Feature types in color and legend order. Without it, first-seen order. */
  readonly typeDomain?: readonly string[];
  readonly colors?: Readonly<Record<string, SeriesColor>>;
  /** The coordinate axis label (default "Position (nt)"). */
  readonly positionLabel?: string | null;
  /** Print feature names (default true). Names that do not fit are left to hover and the table. */
  readonly featureLabels?: boolean;
}

interface Placed {
  readonly key: string;
  readonly feature: GenomeFeature;
  readonly type: string;
  readonly track: string;
  readonly row: string;
  /** The lane within the track, for keyboard order. */
  readonly lane: number;
}

const KIND = "genomeTrack";
const ROW_SEPARATOR = "\u0000";

/** Greedy interval packing: each feature takes the first lane of its track where it fits. */
function packLanes(
  features: readonly GenomeFeature[],
  trackOf: (f: GenomeFeature) => string,
): number[] {
  const laneEnds = new Map<string, number[]>();
  const order = features
    .map((f, i) => ({ f, i }))
    .sort((a, b) => a.f.start - b.f.start || a.i - b.i);
  const lanes = new Array<number>(features.length).fill(0);
  for (const { f, i } of order) {
    const ends = laneEnds.get(trackOf(f)) ?? [];
    let lane = ends.findIndex((end) => end < f.start);
    if (lane === -1) lane = ends.length;
    ends[lane] = f.end;
    laneEnds.set(trackOf(f), ends);
    lanes[i] = lane;
  }
  return lanes;
}

/** Pairs of features in the same track that share at least one position. */
function overlappingPairs(
  features: readonly GenomeFeature[],
  trackOf: (f: GenomeFeature) => string,
): number {
  const order = [...features].sort((a, b) => a.start - b.start);
  let pairs = 0;
  order.forEach((f, i) => {
    for (const g of order.slice(i + 1)) {
      if (g.start > f.end) break;
      if (trackOf(g) === trackOf(f)) pairs += 1;
    }
  });
  return pairs;
}

/**
 * A linear genome map: features drawn to scale along a nucleotide axis as arrows pointing in
 * the direction of their strand, one row per track, with overlapping features stacked into
 * lanes. Suited to viral genomes, segments, plasmids and amplicon maps.
 *
 * @example
 * genomeTrack({
 *   length: 1778,
 *   features: [
 *     { name: "HA1", start: 52, end: 1035, strand: 1, type: "Mature peptide" },
 *     { name: "HA2", start: 1036, end: 1698, strand: 1, type: "Mature peptide" },
 *   ],
 *   alt: "Influenza A segment 4 ...",
 * });
 */
export function genomeTrack(options: GenomeTrackOptions): string {
  const { features, length } = options;
  if (!Number.isInteger(length) || length < 1)
    throw new Error(`${KIND}: length must be a positive integer, is ${length}`);
  validateFigure(KIND, options);
  if (features.length === 0) throw new Error(`${KIND}: features is empty`);
  features.forEach((f, i) => {
    if (
      !Number.isInteger(f.start) ||
      !Number.isInteger(f.end) ||
      f.start < 1 ||
      f.end > length ||
      f.end < f.start
    ) {
      throw new Error(
        `${KIND}: feature ${i + 1} "${f.name}" runs ${f.start} to ${f.end}; positions must be whole numbers from 1 to ${length}, start before end`,
      );
    }
  });
  const strings = stringsFor(options.strings);
  const { terms } = strings;
  const number = numberFormat(options.locale ? { locale: options.locale } : {});
  const trackOf = (f: GenomeFeature): string => f.track ?? terms.features;
  const typeOf = (f: GenomeFeature): string => f.type ?? terms.feature;
  const tracks = options.trackDomain
    ? [...options.trackDomain]
    : [...new Set(features.map(trackOf))];
  const types = options.typeDomain ? [...options.typeDomain] : [...new Set(features.map(typeOf))];
  for (const f of features) {
    if (!tracks.includes(trackOf(f)))
      throw new Error(`${KIND}: track "${trackOf(f)}" is missing from trackDomain`);
    if (!types.includes(typeOf(f)))
      throw new Error(`${KIND}: type "${typeOf(f)}" is missing from typeDomain`);
  }
  const plan = planSeries(KIND, types, options.colors);

  const lanes = packLanes(features, trackOf);
  const placed: Placed[] = features.map((f, i) => ({
    key: markKey(trackOf(f), f.name, f.start),
    lane: lanes[i] ?? 0,
    feature: f,
    type: typeOf(f),
    track: trackOf(f),
    row: `${trackOf(f)}${ROW_SEPARATOR}${lanes[i]}`,
  }));
  // Keyboard order: along the sequence, then down the lanes.
  const byStart = new Map(
    [...placed]
      .sort((a, b) => a.feature.start - b.feature.start || a.lane - b.lane)
      .map((p, i) => [p, i]),
  );
  const rows: string[] = [];
  for (const track of tracks) {
    const laneCount = Math.max(
      0,
      maxOf(placed.filter((p) => p.track === track).map((p) => p.lane + 1)),
    );
    for (let lane = 0; lane < Math.max(1, laneCount); lane += 1)
      rows.push(`${track}${ROW_SEPARATOR}${lane}`);
  }

  const lengthOf = (f: GenomeFeature): number => f.end - f.start + 1;
  const nt = (n: number): string => `${number(n)} ${terms.nucleotides}`;
  const strandWord = (s: GenomeFeature["strand"]): string =>
    s === 1 ? terms.forwardStrand : s === -1 ? terms.reverseStrand : terms.noStrand;
  const describe = (p: Placed): string =>
    `${p.feature.name} (${p.type}): ${strings.range(number(p.feature.start), number(p.feature.end))}, ${nt(lengthOf(p.feature))}, ${strandWord(p.feature.strand)}`;
  const positionLabel =
    options.positionLabel === undefined
      ? withUnit(terms.position, terms.nucleotides)
      : options.positionLabel;

  const width = options.width ?? 720;
  const rowHeight = 30;
  const height = options.height ?? rows.length * rowHeight + 64;
  const trackLabel = (row: string): string => {
    const [track, lane] = row.split(ROW_SEPARATOR);
    return lane === "0" && tracks.length > 1 ? (track ?? "") : "";
  };
  const longestTrack = tracks.length > 1 ? maxOf(tracks.map((t) => t.length)) : 0;
  const plotLeft = tracks.length > 1 ? Math.min(160, longestTrack * 7 + 20) : 16;
  const pixelsPerNt = (width - plotLeft - 24) / length;

  // Features are drawn as rects by Plot, then reshaped into arrows pointing along their strand.
  const toArrow = (el: Element, p: Placed): void => {
    const x = Number(el.getAttribute("x"));
    const y = Number(el.getAttribute("y"));
    const w = Number(el.getAttribute("width"));
    const h = Number(el.getAttribute("height"));
    const head = p.feature.strand ? Math.min(w * 0.4, h * 0.6) : 0;
    const r = (n: number): number => Math.round(n * 100) / 100;
    const points =
      p.feature.strand === 1
        ? [
            [x, y],
            [x + w - head, y],
            [x + w, y + h / 2],
            [x + w - head, y + h],
            [x, y + h],
          ]
        : p.feature.strand === -1
          ? [
              [x + head, y],
              [x + w, y],
              [x + w, y + h],
              [x + head, y + h],
              [x, y + h / 2],
            ]
          : [
              [x, y],
              [x + w, y],
              [x + w, y + h],
              [x, y + h],
            ];
    const polygon = el.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "polygon");
    for (const name of el.getAttributeNames()) {
      if (!["x", "y", "width", "height"].includes(name))
        polygon.setAttribute(name, el.getAttribute(name) ?? "");
    }
    polygon.setAttribute(
      "points",
      points.map(([px, py]) => `${r(px ?? 0)},${r(py ?? 0)}`).join(" "),
    );
    polygon.append(...el.childNodes);
    el.replaceWith(polygon);
  };

  const showLabels = options.featureLabels ?? true;
  const fits = (p: Placed): boolean =>
    (p.feature.end - p.feature.start + 1) * pixelsPerNt >= p.feature.name.length * 7 + 12;

  const marks: Plot.Markish[] = [
    Plot.ruleY(rows, {
      y: (r: string) => r,
      x1: 1,
      x2: length,
      stroke: "var(--enarratio-grid)",
      strokeWidth: 2,
    }),
    Plot.rectX(placed, {
      x1: (p: Placed) => p.feature.start - 0.5,
      x2: (p: Placed) => p.feature.end + 0.5,
      y: "row",
      fill: "type",
      inset: 0,
      insetTop: 4,
      insetBottom: 4,
      title: describe,
      render: keyed(
        placed,
        (p) => ({
          key: p.key,
          filter: { field: "type", value: p.type },
          column: byStart.get(p) ?? 0,
          row: p.lane,
          x: String(p.feature.start),
          series: p.type,
        }),
        toArrow,
      ),
    }),
  ];
  if (showLabels) {
    const labeled = placed.filter(fits);
    marks.push(
      Plot.text(labeled, {
        x: (p: Placed) => (p.feature.start + p.feature.end) / 2,
        y: "row",
        text: (p: Placed) => p.feature.name,
        render: decorate(labeled, (el, p) => {
          el.setAttribute("fill", `var(--enarratio-series-text-${plan.slot(p.type)})`);
        }),
      }),
    );
  }

  const { svg } = renderPlot(
    {
      width,
      height,
      marginTop: 16,
      marginLeft: plotLeft,
      marginRight: 24,
      marginBottom: 44,
      x: {
        type: "linear",
        domain: [1, length],
        label: positionLabel,
        labelAnchor: "center",
        labelArrow: "none",
        grid: true,
      },
      y: {
        type: "band",
        domain: rows,
        tickFormat: trackLabel,
        label: null,
        tickSize: 0,
        padding: 0,
      },
      color: { domain: types, range: [...plan.range] },
      marks,
    },
    options.alt,
  );

  // The shortest and longest features, the first of each in sequence order.
  const bySize = [...features].sort((a, b) => lengthOf(a) - lengthOf(b) || a.start - b.start);
  const shortest = bySize[0] as GenomeFeature;
  const longest = bySize.reduce((best, f) => (lengthOf(f) > lengthOf(best) ? f : best));
  const strands = (s: GenomeFeature["strand"]): string =>
    number(features.filter((f) => (f.strand ?? 0) === s).length);
  return figure(options, {
    kind: "genome",
    svg,
    // The sequence as the axis, and the features in words: lengths, strands and overlaps.
    description: {
      axes: [valueRange("x", positionLabel, [1, length], number)],
      sentence: strings.genomeSummary({
        features: number(features.length),
        shortest: { value: nt(lengthOf(shortest)), at: shortest.name },
        longest: { value: nt(lengthOf(longest)), at: longest.name },
        forward: strands(1),
        reverse: strands(-1),
        unstranded: strands(0),
        overlaps: number(overlappingPairs(features, trackOf)),
      }),
    },
    legend: plan.legend,
    seriesField: "type",
    slotColors: plan.slotColors,
    table: {
      columns: [
        terms.feature,
        terms.type,
        ...(tracks.length > 1 ? [terms.track] : []),
        terms.start,
        terms.end,
        withUnit(terms.length, terms.nucleotides) as string,
        terms.strand,
      ],
      rows: placed
        .slice()
        .sort(
          (a, b) =>
            tracks.indexOf(a.track) - tracks.indexOf(b.track) || a.feature.start - b.feature.start,
        )
        .map((p) => [
          p.feature.name,
          p.type,
          ...(tracks.length > 1 ? [p.track] : []),
          String(p.feature.start),
          String(p.feature.end),
          String(lengthOf(p.feature)),
          p.feature.strand === 1 ? "+" : p.feature.strand === -1 ? "-" : "",
        ]),
    },
  });
}
