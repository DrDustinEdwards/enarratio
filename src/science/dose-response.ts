import * as Plot from "@observablehq/plot";
import { dashFor } from "../plot/marks.js";
import { domainOf, type KeysOfType, maxOf, minOf, readLabel, readNumber } from "../render/data.js";
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
import { numberFormat, stringsFor, valueFormat } from "../render/text.js";
import { fitLogistic, type LogisticFit, type LogisticParameters, logistic } from "./logistic.js";

/** Options for {@link doseResponse}. */
export interface DoseResponseOptions<T extends object> extends FigureOptions, AxisUnits {
  readonly data: readonly T[];
  /** The dose or concentration: above zero, on a log axis. */
  readonly dose: KeysOfType<T, number>;
  /** The measured response at each dose, one row per replicate. */
  readonly response: KeysOfType<T, number>;
  /** A field naming curves drawn together: compounds, strains, cell lines. */
  readonly group?: KeysOfType<T, string>;
  readonly groupDomain?: readonly string[];
  /**
   * Curve parameters you already have, by group name (or under any one key without groups):
   * the curve is drawn from them instead of being fitted.
   */
  readonly parameters?: Readonly<Record<string, LogisticParameters>>;
  /** What the midpoint is called (default "EC50"; "IC50" for inhibition). */
  readonly midpointLabel?: string;
  readonly colors?: Readonly<Record<string, SeriesColor>>;
  /** The dose axis label (default the field name; `null` hides it), with `xUnit` added. */
  readonly doseLabel?: string | null;
  /** The response axis label (default the field name; `null` hides it), with `yUnit` added. */
  readonly responseLabel?: string | null;
  readonly formatValue?: (value: number) => string;
}

interface Measured {
  readonly key: string;
  readonly group: string;
  readonly dose: number;
  readonly response: number;
}

const KIND = "doseResponse";

/**
 * A dose-response curve: the measured responses as points on a log dose axis, the four-parameter
 * logistic curve through them (fitted by least squares, or drawn from parameters you give), and
 * the EC50 marked by a dashed drop line with its value. Several groups differ by color, symbol and
 * dash. The caption states each fit (EC50 with its 95% interval, Hill slope, bottom and top), and
 * the data table gives every measurement beside the curve's value at that dose.
 *
 * @example
 * doseResponse({ data: wells, dose: "concentration", response: "inhibition", group: "compound", alt: "..." });
 */
export function doseResponse<T extends object>(options: DoseResponseOptions<T>): string {
  const { data, dose, response, group } = options;
  validateFigure(KIND, options);
  if (data.length === 0) throw new Error(`${KIND}: data is empty`);
  const format = valueFormat(options);
  const strings = stringsFor(options.strings);
  const locale = options.locale ? { locale: options.locale } : {};
  // Three significant digits: how fitted parameters are printed.
  const sig = numberFormat({ ...locale, maximumSignificantDigits: 3 });
  const midpoint = options.midpointLabel ?? "EC50";
  const doseLabel = unitLabel(options.doseLabel, dose, options.xUnit);
  const responseLabel = unitLabel(options.responseLabel, response, options.yUnit);
  const sole = strings.terms.response;
  const groupOf = (row: T, i: number): string =>
    group === undefined ? sole : readLabel(KIND, row, group, i);
  const names =
    group === undefined ? [sole] : domainOf(KIND, group, data.map(groupOf), options.groupDomain);
  const plan = planSeries(KIND, names, options.colors);
  const points = data.map((row, i): Measured => {
    const d = readNumber(KIND, row, dose, i);
    if (d <= 0) {
      throw new Error(
        `${KIND}: row ${i + 1} dose is ${d}, which a log axis cannot show; draw controls as a reference`,
      );
    }
    return {
      key: String(i),
      group: groupOf(row, i),
      dose: d,
      response: readNumber(KIND, row, response, i),
    };
  });
  const given = options.parameters;
  const curves = names.map((name) => {
    const own = points.filter((p) => p.group === name);
    const supplied =
      given?.[name] ?? (group === undefined && given ? Object.values(given)[0] : undefined);
    if (supplied && !(supplied.ec50 > 0))
      throw new Error(`${KIND}: ${name} ec50 must be above zero`);
    const fit: LogisticParameters | LogisticFit =
      supplied ??
      fitLogistic(
        own.map((p) => p.dose),
        own.map((p) => p.response),
      );
    return { name, fit, fitted: supplied === undefined };
  });
  const lo = minOf(points.map((p) => p.dose));
  const hi = maxOf(points.map((p) => p.dose));
  const steps = 120;
  const line = curves.flatMap((c, k) =>
    Array.from({ length: steps + 1 }, (_, i) => {
      const d = lo * (hi / lo) ** (i / steps);
      return { name: c.name, k, dose: d, y: logistic(c.fit, d) };
    }),
  );
  const multi = group !== undefined;
  const plain = numberFormat(locale);
  const describe = (p: Measured): string =>
    `${multi ? `${p.group}, ` : ""}${doseLabel ?? dose} ${format(p.dose)}: ${responseLabel ?? response} ${format(p.response)}`;
  const order = [...points].sort(
    (a, b) => a.dose - b.dose || names.indexOf(a.group) - names.indexOf(b.group),
  );
  const rank = new Map(order.map((p, i) => [p, i]));
  const midpoints = curves.map((c, k) => ({ ...c, k, y: (c.fit.bottom + c.fit.top) / 2 }));
  const inRange = midpoints.filter((m) => m.fit.ec50 >= lo && m.fit.ec50 <= hi);

  const marks: Plot.Markish[] = [
    ...curves.map((c, k) =>
      Plot.line(
        line.filter((l) => l.name === c.name),
        {
          x: "dose",
          y: "y",
          stroke: plan.range[k] as string,
          strokeWidth: 2,
          ...dashFor(k),
        },
      ),
    ),
    Plot.ruleX(inRange, {
      x: (m: (typeof inRange)[number]) => m.fit.ec50,
      y1: (m: (typeof inRange)[number]) => Math.min(m.fit.bottom, m.fit.top),
      y2: "y",
      stroke: "var(--enarratio-text-muted)",
      strokeDasharray: "3,3",
    }),
    // Labels sit left of and below each midpoint, a line lower for every other curve, so two
    // curves' labels do not collide.
    ...[0, 1].map((parity) =>
      Plot.text(
        inRange.filter((m) => m.k % 2 === parity),
        {
          x: (m: (typeof inRange)[number]) => m.fit.ec50,
          y: "y",
          text: (m: (typeof inRange)[number]) =>
            `${multi ? `${m.name} ` : ""}${midpoint} ${sig(m.fit.ec50)}`,
          textAnchor: "end",
          dx: -6,
          dy: parity === 0 ? 14 : 30,
          fill: "var(--enarratio-text)",
          stroke: "var(--enarratio-background)",
          strokeWidth: 3,
          paintOrder: "stroke",
        },
      ),
    ),
    Plot.dot(points, {
      x: "dose",
      y: "response",
      r: 4,
      fill: "group",
      stroke: "group",
      fillOpacity: 0.5,
      ...(multi ? { symbol: "group" } : {}),
      title: describe,
      render: keyed(points, (p) => ({
        key: p.key,
        ...(multi && group ? { filter: { field: group, value: p.group }, series: p.group } : {}),
        x: String(p.dose),
        column: rank.get(p) ?? 0,
        row: 0,
      })),
    }),
  ];
  const { svg } = renderPlot(
    {
      width: options.width ?? DEFAULT_WIDTH,
      height: options.height ?? 360,
      marginTop: 24,
      marginLeft: responseLabel === null ? 48 : 64,
      marginRight: 24,
      marginBottom: 44,
      x: {
        type: "log",
        label: doseLabel,
        labelAnchor: "center",
        labelArrow: "none",
        grid: true,
        // Powers of ten as plain numbers (0.01, not Plot's 10m), the ticks between unlabeled.
        tickFormat: (v: number) =>
          Math.abs(Math.log10(v) - Math.round(Math.log10(v))) < 1e-9 ? plain(v) : "",
      },
      y: {
        label: responseLabel,
        labelAnchor: "center",
        labelArrow: "none",
        grid: true,
        nice: true,
      },
      color: { domain: names, range: [...plan.range] },
      ...(multi ? { symbol: { domain: names } } : {}),
      marks,
    },
    options.alt,
  );
  const method = strings.logisticMethod(
    curves.every((c) => c.fitted),
    curves.map((c) => {
      const f = c.fit as LogisticFit;
      return {
        ...(multi ? { name: c.name } : {}),
        midpoint,
        ec50: sig(c.fit.ec50),
        ...(f.ec50Lower !== undefined && f.ec50Upper !== undefined
          ? { lower: sig(f.ec50Lower), upper: sig(f.ec50Upper) }
          : {}),
        hill: sig(c.fit.hill),
        bottom: sig(c.fit.bottom),
        top: sig(c.fit.top),
      };
    }),
  );
  const fitOf = new Map(curves.map((c) => [c.name, c.fit]));
  return figure(options, {
    kind: "dose-response",
    svg,
    method,
    // Each group's measured responses in dose order, judged on the log dose axis as drawn.
    description: {
      axes: [
        valueRange(
          "x",
          doseLabel,
          points.map((p) => p.dose),
          format,
        ),
        valueRange(
          "y",
          responseLabel,
          points.map((p) => p.response),
          format,
        ),
      ],
      ordered: true,
      format,
      series: names.map((name) => ({
        name,
        points: order
          .filter((p) => p.group === name)
          .map((p) => ({ at: `${doseLabel ?? dose} ${format(p.dose)}`, value: p.response })),
      })),
    },
    legend: multi ? plan.legend : [],
    ...(multi && group ? { seriesField: group } : {}),
    slotColors: plan.slotColors,
    table: {
      columns: [
        ...(multi ? [group] : []),
        doseLabel ?? dose,
        responseLabel ?? response,
        strings.terms.fitted,
      ],
      rows: order.map((p) => [
        ...(multi ? [p.group] : []),
        format(p.dose),
        format(p.response),
        sig(logistic(fitOf.get(p.group) as LogisticParameters, p.dose)),
      ]),
    },
  });
}
