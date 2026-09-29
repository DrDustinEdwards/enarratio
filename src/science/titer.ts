import * as Plot from "@observablehq/plot";
import { domainOf, type KeysOfType, maxOf, minOf, readLabel, readNumber } from "../render/data.js";
import { type FigureOptions, figure, type SeriesColor, validateFigure } from "../render/figure.js";
import { keyed, renderPlot } from "../render/plot.js";
import { planSeries } from "../render/series.js";
import { type GeometricSummary, geometricSummary } from "./stats.js";

/** A serial dilution series: the first dilution and the factor between steps. */
export interface DilutionSeries {
  /** The reciprocal of the first dilution tested, e.g. 10 for 1:10. */
  readonly start: number;
  /** The factor between steps, e.g. 2 for two-fold or 10 for ten-fold dilutions. */
  readonly factor: number;
}

/** Options for {@link titerPlot}. */
export interface TiterPlotOptions<T extends object> extends FigureOptions {
  readonly data: readonly T[];
  /** The field naming the group each sample belongs to: a cohort, a timepoint, a vaccine arm. */
  readonly group: KeysOfType<T, string | number>;
  /**
   * The field holding each sample's titer as a reciprocal dilution (40 for 1:40). Values below
   * the limit of detection are shown at half the limit, hollow, as is conventional.
   */
  readonly titer: KeysOfType<T, number>;
  /** The dilution series the assay used, which sets the axis ticks (default 1:10, two-fold). */
  readonly dilution?: DilutionSeries;
  /** The limit of detection as a reciprocal dilution (default: the series start). */
  readonly limitOfDetection?: number;
  /** Groups in display order. */
  readonly groupDomain?: readonly (string | number)[];
  /** Color each group as its own series (default), or all in the first series color. */
  readonly colorByGroup?: boolean;
  readonly colors?: Readonly<Record<string, SeriesColor>>;
  /** Tick labels as ratios ("1:40", default) or reciprocal titers ("40"). */
  readonly tickLabels?: "ratio" | "reciprocal";
  readonly groupLabel?: string | null;
  readonly titerLabel?: string | null;
}

interface Sample {
  readonly key: string;
  readonly group: string;
  readonly groupIndex: number;
  readonly titer: number;
  readonly plotted: number;
  readonly belowLimit: boolean;
  offset: number;
}

const KIND = "titerPlot";

const formatTiter = (value: number): string =>
  value >= 100 ? String(Math.round(value)) : String(Math.round(value * 10) / 10);

/**
 * Antibody or viral titers by group on a log dilution axis: every sample as a point, the
 * geometric mean titer (GMT) with its 95% confidence interval, and the assay's limit of
 * detection. Identical titers are spread side by side rather than drawn on top of each other,
 * so the number of samples at each dilution is visible. The GMT counts a value below the limit
 * of detection as half the limit, the usual convention, and the data table says how many there were.
 *
 * @example
 * titerPlot({
 *   data: sera,
 *   group: "timepoint",
 *   titer: "hai",
 *   dilution: { start: 10, factor: 2 },
 *   alt: "HAI titers rose from a GMT of 14 before vaccination to 160 at day 28 ...",
 * });
 */
export function titerPlot<T extends object>(options: TiterPlotOptions<T>): string {
  const { data, group, titer } = options;
  validateFigure(KIND, options);
  if (data.length === 0) throw new Error(`${KIND}: data is empty`);
  const dilution = options.dilution ?? { start: 10, factor: 2 };
  if (!(dilution.start > 0) || !(dilution.factor > 1)) {
    throw new Error(`${KIND}: dilution needs start above 0 and factor above 1`);
  }
  const lod = options.limitOfDetection ?? dilution.start;
  const groupLabel = options.groupLabel === undefined ? group : options.groupLabel;
  const titerLabel = options.titerLabel === undefined ? "Titer" : options.titerLabel;
  const asRatio = (options.tickLabels ?? "ratio") === "ratio";
  const tick = (v: number): string => (asRatio ? `1:${formatTiter(v)}` : formatTiter(v));

  const rawGroups = data.map((row, i) => readLabel(KIND, row, group, i));
  const groups = domainOf(KIND, group, rawGroups, options.groupDomain?.map(String));
  const samples = data.map((row, i): Sample => {
    const value = readNumber(KIND, row, titer, i);
    if (value <= 0)
      throw new Error(`${KIND}: row ${i + 1} titer is ${value}; titers are positive reciprocals`);
    const g = rawGroups[i] as string;
    const belowLimit = value < lod;
    return {
      key: String(i),
      group: g,
      groupIndex: groups.indexOf(g),
      titer: value,
      plotted: belowLimit ? lod / 2 : value,
      belowLimit,
      offset: 0,
    };
  });

  // Spread samples that share a group and titer across the group's width, centered.
  const stacks = new Map<string, Sample[]>();
  for (const s of samples) {
    const id = `${s.group}|${s.plotted}`;
    stacks.set(id, [...(stacks.get(id) ?? []), s]);
  }
  const widest = maxOf([...stacks.values()].map((s) => s.length));
  const spacing = Math.min(0.08, 0.7 / Math.max(1, widest - 1));
  for (const stack of stacks.values()) {
    stack.forEach((s, k) => {
      s.offset = (k - (stack.length - 1) / 2) * spacing;
    });
  }

  // Keyboard order within a group: lowest titer first, then left to right.
  const withinGroup = new Map<Sample, number>();
  for (const g of groups) {
    samples
      .filter((s) => s.group === g)
      .sort((a, b) => a.plotted - b.plotted || a.offset - b.offset)
      .forEach((s, i) => {
        withinGroup.set(s, i);
      });
  }
  const summaries = new Map<string, GeometricSummary>(
    groups.map((g) => [
      g,
      geometricSummary(samples.filter((s) => s.group === g).map((s) => s.plotted)),
    ]),
  );
  const colorByGroup = options.colorByGroup ?? true;
  const plan = planSeries(KIND, colorByGroup ? groups : ["Samples"], options.colors);
  const colorOf = (s: Sample): string => (colorByGroup ? s.group : "Samples");

  const all = samples.map((s) => s.plotted);
  const top = Math.max(maxOf(all), lod);
  const ticks: number[] = [];
  for (let v = dilution.start; v <= top * dilution.factor; v *= dilution.factor) {
    ticks.push(v);
    // A step this fine is not a dilution series, and would draw thousands of ticks (F15).
    if (ticks.length > 40) {
      throw new Error(
        `${KIND}: dilution factor ${dilution.factor} needs over 40 steps from ${dilution.start} to ${top}`,
      );
    }
  }
  if (lod / 2 < dilution.start) ticks.unshift(lod / 2);

  const summaryRows = groups.map((g, i) => ({ g, i, s: summaries.get(g) as GeometricSummary }));
  const intervalRows = summaryRows.filter(
    (r) => r.s.lower !== undefined && r.s.upper !== undefined,
  );
  const describe = (s: Sample): string =>
    `${groupLabel ?? group} ${s.group}: ${s.belowLimit ? `below the limit of detection (<${tick(lod)})` : tick(s.titer)}`;

  const marks: Plot.Markish[] = [
    Plot.ruleY([lod], { strokeDasharray: "4,3" }),
    Plot.text([lod], {
      y: (d: number) => d,
      text: () => "LOD",
      frameAnchor: "right",
      textAnchor: "end",
      dy: -6,
    }),
    Plot.link(intervalRows, {
      x1: (r: (typeof intervalRows)[number]) => r.i,
      x2: (r: (typeof intervalRows)[number]) => r.i,
      y1: (r: (typeof intervalRows)[number]) => r.s.lower ?? r.s.mean,
      y2: (r: (typeof intervalRows)[number]) => r.s.upper ?? r.s.mean,
      stroke: "var(--abscissa-text)",
      strokeWidth: 1.5,
    }),
    Plot.link(summaryRows, {
      x1: (r: (typeof summaryRows)[number]) => r.i - 0.28,
      x2: (r: (typeof summaryRows)[number]) => r.i + 0.28,
      y1: (r: (typeof summaryRows)[number]) => r.s.mean,
      y2: (r: (typeof summaryRows)[number]) => r.s.mean,
      stroke: "var(--abscissa-text)",
      strokeWidth: 2.5,
    }),
    Plot.dot(samples, {
      x: (s: Sample) => s.groupIndex + s.offset,
      y: "plotted",
      r: 4,
      stroke: colorOf,
      fill: colorOf,
      strokeWidth: 1.5,
      fillOpacity: 0.85,
      title: describe,
      render: keyed(
        samples,
        (s) => ({
          key: s.key,
          filter: { field: group, value: s.group },
          column: s.groupIndex,
          row: withinGroup.get(s) ?? 0,
          x: s.group,
          series: s.group,
        }),
        // Below the limit of detection is hollow: a shape difference, not only a color one.
        (el, s) => {
          if (s.belowLimit) el.setAttribute("fill", "var(--abscissa-background)");
        },
      ),
    }),
  ];

  const { svg } = renderPlot(
    {
      width: options.width ?? 640,
      height: options.height ?? 360,
      marginTop: 20,
      marginLeft: titerLabel === null ? 56 : 72,
      marginBottom: 44,
      x: {
        type: "linear",
        domain: [-0.5, groups.length - 0.5],
        ticks: groups.map((_, i) => i),
        tickFormat: (i: number) => groups[i] ?? "",
        label: groupLabel,
        labelAnchor: "center",
        labelArrow: "none",
      },
      y: {
        type: "log",
        base: dilution.factor,
        domain: [minOf(ticks), maxOf(ticks)],
        ticks,
        tickFormat: tick,
        label: titerLabel,
        labelAnchor: "center",
        labelArrow: "none",
        grid: true,
      },
      color: { domain: plan.names, range: [...plan.range] },
      marks,
    },
    options.alt,
  );

  return figure(options, {
    kind: "titer",
    svg,
    legend: [],
    slotColors: plan.slotColors,
    table: {
      columns: [groupLabel ?? group, "n", "GMT", "95% CI", "Below LOD", "Titers"],
      rows: summaryRows.map(({ g, s }) => {
        const members = samples.filter((x) => x.group === g);
        return [
          g,
          String(s.n),
          formatTiter(s.mean),
          s.lower === undefined || s.upper === undefined
            ? ""
            : `${formatTiter(s.lower)} to ${formatTiter(s.upper)}`,
          String(members.filter((x) => x.belowLimit).length),
          members
            .map((x) => (x.belowLimit ? `<${formatTiter(lod)}` : formatTiter(x.titer)))
            .join(", "),
        ];
      }),
    },
  });
}
