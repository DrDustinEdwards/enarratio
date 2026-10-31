import * as Plot from "@observablehq/plot";
import { ticks } from "../lite/scale.js";
import { dashFor } from "../plot/marks.js";
import {
  domainOf,
  type KeysOfType,
  markKey,
  maxOf,
  readLabel,
  readNumber,
} from "../render/data.js";
import { valueRange } from "../render/describe.js";
import {
  type AxisUnits,
  type FigureOptions,
  figure,
  type SeriesColor,
  unitLabel,
  validateFigure,
} from "../render/figure.js";
import { keyed, renderPlot } from "../render/plot.js";
import { planSeries } from "../render/series.js";
import { DEFAULT_WIDTH } from "../render/size.js";
import { numberFormat, stringsFor } from "../render/text.js";
import { atRiskAt, kaplanMeier, type SurvivalEstimate, type SurvivalStep } from "./kaplan-meier.js";

/** Options for {@link survivalPlot}. */
export interface SurvivalPlotOptions<T extends object>
  extends FigureOptions,
    Pick<AxisUnits, "xUnit"> {
  readonly data: readonly T[];
  /** Each subject's follow-up time: to the event, or to when it was censored. */
  readonly time: KeysOfType<T, number>;
  /** Whether follow-up ended in the event: true or 1 for the event, false or 0 for censored. */
  readonly event: KeysOfType<T, boolean | number>;
  /** A field naming the groups compared: arms, cohorts, genotypes. */
  readonly group?: KeysOfType<T, string>;
  readonly groupDomain?: readonly string[];
  /** Shade each curve's 95% confidence interval (default true with one group, false with more). */
  readonly confidence?: boolean;
  /** Print the number at risk at each time tick beneath the chart (default true). */
  readonly atRisk?: boolean;
  readonly colors?: Readonly<Record<string, SeriesColor>>;
  /** The time axis label (default the field name; `null` hides it), with `xUnit` added. */
  readonly timeLabel?: string | null;
  /** The survival axis label (default "Survival probability"). */
  readonly survivalLabel?: string | null;
}

const KIND = "survivalPlot";
const ROW = 16;

interface Curve {
  readonly name: string;
  readonly k: number;
  readonly times: readonly number[];
  readonly estimate: SurvivalEstimate;
}

/**
 * Kaplan-Meier survival curves: each group's estimated survival as a step line from 1 at time
 * zero, with a mark at each censored time, its 95% confidence band (log-log, Greenwood's
 * variance) and the number at risk printed beneath the time axis. Groups differ by color, dash
 * and name. The caption gives each group's n, events and median survival; the data table gives
 * every step: time, number at risk, events, censored, survival and its interval.
 *
 * @example
 * survivalPlot({ data: patients, time: "months", event: "died", group: "arm", alt: "..." });
 */
export function survivalPlot<T extends object>(options: SurvivalPlotOptions<T>): string {
  const { data, time, event, group } = options;
  validateFigure(KIND, options);
  if (data.length === 0) throw new Error(`${KIND}: data is empty`);
  const strings = stringsFor(options.strings);
  const { terms } = strings;
  const locale = options.locale ? { locale: options.locale } : {};
  const number = numberFormat(locale);
  // Probabilities to three places, always printed, so a column of them lines up.
  const fixed = new Intl.NumberFormat(options.locale ?? "en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
  const probability = (v: number): string => fixed.format(v);
  const timeLabel = unitLabel(options.timeLabel, time, options.xUnit);
  const survivalLabel =
    options.survivalLabel === undefined ? terms.survivalProbability : options.survivalLabel;
  const groupOf = (row: T, i: number): string =>
    group === undefined ? terms.all : readLabel(KIND, row, group, i);
  const names =
    group === undefined
      ? [terms.all]
      : domainOf(KIND, group, data.map(groupOf), options.groupDomain);
  const plan = planSeries(KIND, names, options.colors);
  const subjects = data.map((row, i) => {
    const t = readNumber(KIND, row, time, i);
    const e: unknown = (row as Record<string, unknown>)[event];
    if (!(e === true || e === false || e === 0 || e === 1)) {
      throw new Error(
        `${KIND}: row ${i + 1} field "${event}" is ${String(e)}, not true, false, 1 or 0`,
      );
    }
    return { group: groupOf(row, i), time: t, event: e === true || e === 1 };
  });
  const curves: Curve[] = names.map((name, k) => {
    const own = subjects.filter((s) => s.group === name);
    if (own.length === 0) throw new Error(`${KIND}: group "${name}" has no subjects`);
    const times = own.map((s) => s.time);
    return {
      name,
      k,
      times,
      estimate: kaplanMeier(
        times,
        own.map((s) => s.event),
      ),
    };
  });
  const multi = group !== undefined;
  const showBand = options.confidence ?? !multi;
  const showAtRisk = options.atRisk ?? true;
  const end = maxOf(curves.map((c) => c.estimate.end));
  const xTicks = ticks(0, end, 6);

  // Each curve as a step line from (0, 1) through every step to the end of follow-up.
  const path = curves.flatMap((c) => {
    const last = c.estimate.steps[c.estimate.steps.length - 1];
    return [
      { name: c.name, k: c.k, t: 0, s: 1, lower: 1, upper: 1 },
      ...c.estimate.steps.map((s) => ({
        name: c.name,
        k: c.k,
        t: s.time,
        s: s.survival,
        lower: s.lower,
        upper: s.upper,
      })),
      {
        name: c.name,
        k: c.k,
        t: c.estimate.end,
        s: last?.survival ?? 1,
        lower: last?.lower ?? 1,
        upper: last?.upper ?? 1,
      },
    ];
  });
  const survivalAt = (c: Curve, t: number): number => {
    let s = 1;
    for (const step of c.estimate.steps) if (step.time <= t) s = step.survival;
    return s;
  };
  const censors = curves.flatMap((c) =>
    c.estimate.censorTimes.map((t) => ({ name: c.name, k: c.k, t, s: survivalAt(c, t) })),
  );
  type StepRow = SurvivalStep & { readonly name: string; readonly k: number; readonly i: number };
  const steps: StepRow[] = curves.flatMap((c) =>
    c.estimate.steps.map((s, i) => ({ ...s, name: c.name, k: c.k, i })),
  );
  const ci = (s: { readonly lower: number; readonly upper: number }): string =>
    strings.range(probability(s.lower), probability(s.upper));
  const describe = (s: StepRow): string =>
    `${multi ? `${s.name}, ` : ""}${timeLabel ?? time} ${number(s.time)}: ${terms.survival.toLowerCase()} ${probability(s.survival)} (${terms.confidence95} ${ci(s)}), ${terms.atRisk.toLowerCase()} ${number(s.atRisk)}, ${terms.events.toLowerCase()} ${number(s.events)}`;

  const marks: Plot.Markish[] = [];
  if (showBand) {
    for (const c of curves) {
      marks.push(
        Plot.areaY(
          path.filter((p) => p.name === c.name),
          {
            x: "t",
            y1: "lower",
            y2: "upper",
            curve: "step-after",
            fill: plan.range[c.k] as string,
            fillOpacity: 0.15,
          },
        ),
      );
    }
  }
  for (const c of curves) {
    marks.push(
      Plot.line(
        path.filter((p) => p.name === c.name),
        {
          x: "t",
          y: "s",
          curve: "step-after",
          stroke: plan.range[c.k] as string,
          strokeWidth: 2,
          ...dashFor(c.k),
        },
      ),
    );
  }
  marks.push(
    Plot.dot(censors, {
      x: "t",
      y: "s",
      symbol: "plus",
      r: 4,
      stroke: (c: (typeof censors)[number]) => plan.range[c.k],
      strokeWidth: 1.5,
    }),
    Plot.dot(steps, {
      x: "time",
      y: "survival",
      r: 4,
      fill: (s: StepRow) => plan.range[s.k],
      fillOpacity: 0,
      title: describe,
      render: keyed(steps, (s) => ({
        key: markKey(s.name, s.time),
        ...(multi && group ? { filter: { field: group, value: s.name }, series: s.name } : {}),
        x: String(s.time),
        column: s.i,
        row: s.k,
      })),
    }),
  );
  if (multi) {
    marks.push(
      Plot.text(curves, {
        x: (c: Curve) => c.estimate.end,
        y: (c: Curve) => survivalAt(c, c.estimate.end),
        text: "name",
        textAnchor: "start",
        dx: 6,
        fill: (c: Curve) => plan.range[c.k],
      }),
    );
  }
  const atRiskRows = showAtRisk ? curves.length + 1 : 0;
  if (showAtRisk) {
    const counts = curves.flatMap((c) => xTicks.map((t) => ({ c, t, n: atRiskAt(c.times, t) })));
    marks.push(
      Plot.text([terms.numberAtRisk], {
        frameAnchor: "bottom-left",
        textAnchor: "start",
        dy: 52,
        dx: -56,
        fontWeight: 600,
      }),
      ...curves.map((c) =>
        Plot.text(
          counts.filter((n) => n.c === c),
          {
            x: "t",
            text: (n: (typeof counts)[number]) => String(n.n),
            frameAnchor: "bottom",
            dy: 52 + ROW * (c.k + 1),
            fill: plan.range[c.k] as string,
          },
        ),
      ),
      ...(multi
        ? curves.map((c) =>
            Plot.text([c.name], {
              frameAnchor: "bottom-left",
              textAnchor: "end",
              dx: -12,
              dy: 52 + ROW * (c.k + 1),
            }),
          )
        : []),
    );
  }
  const longest = Math.max(...names.map((n) => n.length));
  const { svg } = renderPlot(
    {
      width: options.width ?? DEFAULT_WIDTH,
      height: (options.height ?? 320) + atRiskRows * ROW,
      marginTop: 20,
      marginLeft: Math.max(64, multi && showAtRisk ? longest * 7 + 20 : 0),
      marginRight: multi ? Math.min(160, longest * 7 + 16) : 24,
      marginBottom: 44 + atRiskRows * ROW,
      x: {
        domain: [0, xTicks[xTicks.length - 1] ?? end],
        ticks: xTicks,
        label: timeLabel,
        labelAnchor: "center",
        labelArrow: "none",
        labelOffset: 34,
      },
      y: {
        domain: [0, 1],
        label: survivalLabel,
        labelAnchor: "center",
        labelArrow: "none",
        grid: true,
      },
      marks,
    },
    options.alt,
  );
  const method = strings.survivalMethod(
    showBand,
    curves.map((c) => ({
      ...(multi ? { name: c.name } : {}),
      n: number(c.estimate.n),
      events: number(c.estimate.events),
      ...(c.estimate.median === undefined ? {} : { median: number(c.estimate.median) }),
    })),
  );
  return figure(options, {
    kind: "survival",
    svg,
    method,
    // Each group's survival from 1 at time zero, step by step, with its interval at the end.
    description: {
      axes: [
        valueRange("x", timeLabel, [0, end], number),
        valueRange("y", survivalLabel, [0, 1], number),
      ],
      ordered: true,
      format: probability,
      interval: terms.confidence95,
      series: curves.map((c) => ({
        name: c.name,
        points: [
          { at: `${timeLabel ?? time} ${number(0)}`, value: 1 },
          ...c.estimate.steps.map((s) => ({
            at: `${timeLabel ?? time} ${number(s.time)}`,
            value: s.survival,
            lower: s.lower,
            upper: s.upper,
          })),
        ],
      })),
    },
    legend: multi ? plan.legend : [],
    ...(multi && group ? { seriesField: group } : {}),
    slotColors: plan.slotColors,
    table: {
      columns: [
        ...(multi ? [group] : []),
        timeLabel ?? time,
        terms.atRisk,
        terms.events,
        terms.censored,
        terms.survival,
        terms.confidence95,
      ],
      rows: steps.map((s) => [
        ...(multi ? [s.name] : []),
        number(s.time),
        number(s.atRisk),
        number(s.events),
        number(s.censored),
        probability(s.survival),
        ci(s),
      ]),
    },
  });
}
