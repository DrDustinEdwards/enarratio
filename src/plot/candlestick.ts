import * as Plot from "@observablehq/plot";
import {
  calendarDates,
  dateText,
  type KeysOfType,
  markKey,
  minOf,
  readDate,
  readNumber,
} from "../render/data.js";
import { valueRange } from "../render/describe.js";
import {
  type AxisUnits,
  type FigureOptions,
  figure,
  unitLabel,
  validateFigure,
} from "../render/figure.js";
import { keyed, renderPlot } from "../render/plot.js";
import { DEFAULT_HEIGHT, DEFAULT_WIDTH } from "../render/size.js";
import { signed, stringsFor, valueFormat } from "../render/text.js";
import { named } from "./marks.js";

type When = Date | string | number;

/** Options for {@link candlestickChart}. */
export interface CandlestickChartOptions<T extends object> extends FigureOptions, AxisUnits {
  /** One row per period (a day, a week), in any order. */
  readonly data: readonly T[];
  /** The field for the period: a Date, an ISO 8601 string or a timestamp. */
  readonly x: KeysOfType<T, When>;
  readonly open: KeysOfType<T, number>;
  readonly high: KeysOfType<T, number>;
  readonly low: KeysOfType<T, number>;
  readonly close: KeysOfType<T, number>;
  /** The time axis title (default none: dates name themselves). */
  readonly xLabel?: string | null;
  readonly yLabel?: string | null;
  readonly formatValue?: (value: number) => string;
}

const KIND = "candlestickChart";

interface Candle {
  readonly i: number;
  readonly at: Date;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly rising: boolean;
}

/**
 * A candlestick chart: one candle per period on a time axis, its body from open to close and its
 * wick from low to high. A period that closed above its open is a hollow body outlined in the first
 * series color; one that closed below is a solid body in the second, so rising and falling differ
 * by fill as well as hue (WCAG 1.4.1). Every candle is reached by hover, focus and the keys, the
 * time axis takes the Range control, and the data table gives each period's four prices and change.
 *
 * @example
 * candlestickChart({ data: days, x: "date", open: "o", high: "h", low: "l", close: "c", alt: "..." });
 */
export function candlestickChart<T extends object>(options: CandlestickChartOptions<T>): string {
  const { data } = options;
  validateFigure(KIND, options);
  if (data.length === 0) throw new Error(`${KIND}: data is empty`);
  const format = valueFormat(options);
  const strings = stringsFor(options.strings);
  const { terms } = strings;
  const read = data.map((row, i) => readDate(KIND, row, options.x, i));
  const at = calendarDates(read);
  const candles: Candle[] = data
    .map((row, i): Candle => {
      const open = readNumber(KIND, row, options.open, i);
      const high = readNumber(KIND, row, options.high, i);
      const low = readNumber(KIND, row, options.low, i);
      const close = readNumber(KIND, row, options.close, i);
      if (low > Math.min(open, close) || high < Math.max(open, close)) {
        throw new Error(
          `${KIND}: row ${i + 1} has open ${open} and close ${close} outside low ${low} to high ${high}`,
        );
      }
      return { i, at: at[i] as Date, open, high, low, close, rising: close >= open };
    })
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map((c, i) => ({ ...c, i }));
  for (let i = 1; i < candles.length; i += 1) {
    if ((candles[i] as Candle).at.getTime() === (candles[i - 1] as Candle).at.getTime()) {
      throw new Error(`${KIND}: two rows for the same period`);
    }
  }
  const dates = dateText(
    candles.map((c) => c.at),
    options.locale,
  );
  const xLabel = options.xLabel ?? null;
  const yLabel = unitLabel(options.yLabel, terms.close, options.yUnit);
  // Bodies are 60% of the closest spacing between periods, so neighbors never touch.
  const gaps = candles.slice(1).map((c, i) => c.at.getTime() - (candles[i] as Candle).at.getTime());
  const half = (gaps.length > 0 ? minOf(gaps) : 86_400_000) * 0.3;
  const change = (c: Candle): string => signed(format, c.close - c.open);
  const shown = (c: Candle): string =>
    `${terms.close.toLowerCase()} ${format(c.close)} (${terms.open.toLowerCase()} ${format(c.open)}, ${terms.high.toLowerCase()} ${format(c.high)}, ${terms.low.toLowerCase()} ${format(c.low)})`;
  const color = (c: Candle): string => `var(--enarratio-series-${c.rising ? 1 : 2})`;
  const datum = (c: Candle) => ({
    key: markKey(dates.key(c.at)),
    filter: { field: terms.change, value: c.rising ? terms.rising : terms.falling },
    series: c.rising ? terms.rising : terms.falling,
    x: String(c.at.getTime()),
    column: c.i,
    row: 0,
    at: dates.text(c.at),
    shown: shown(c),
  });
  const width = options.width ?? DEFAULT_WIDTH;
  const lo = new Date(candles[0]?.at.getTime() ?? 0);
  const hi = new Date(candles.at(-1)?.at.getTime() ?? 0);
  const rendered = renderPlot(
    {
      width,
      height: options.height ?? DEFAULT_HEIGHT,
      marginTop: 20,
      marginLeft: 48,
      marginRight: 16,
      marginBottom: 44,
      x: {
        type: "utc",
        domain: [new Date(lo.getTime() - 2 * half), new Date(hi.getTime() + 2 * half)],
        label: xLabel,
      },
      y: { label: yLabel, grid: true, nice: true },
      marks: [
        Plot.ruleX(candles, {
          x: "at",
          y1: "low",
          y2: "high",
          stroke: color,
          strokeWidth: 1.5,
          render: named("wick"),
        }),
        Plot.rectY(candles, {
          x1: (c: Candle) => new Date(c.at.getTime() - half),
          x2: (c: Candle) => new Date(c.at.getTime() + half),
          y1: "open",
          y2: "close",
          fill: (c: Candle) => (c.rising ? "var(--enarratio-background)" : color(c)),
          stroke: color,
          strokeWidth: 1.5,
          title: (c: Candle) =>
            `${dates.text(c.at)}: ${shown(c)}, ${terms.change.toLowerCase()} ${change(c)}`,
          render: named("candle", keyed(candles, datum)),
        }),
      ],
    },
    options.alt,
  );
  const prices = candles.flatMap((c) => [c.low, c.high]);
  return figure(options, {
    kind: "candlestick",
    svg: rendered.svg,
    ...(rendered.x ? { x: rendered.x } : {}),
    legend: [
      { label: terms.rising, slot: 1 },
      { label: terms.falling, slot: 2 },
    ],
    description: {
      axes: [
        {
          position: "x",
          label: xLabel ?? "",
          from: dates.text(lo),
          to: dates.text(hi),
        },
        valueRange("y", yLabel, prices, format),
      ],
      ordered: true,
      format,
      series: [
        {
          name: yLabel ?? terms.close,
          points: candles.map((c) => ({ at: dates.text(c.at), value: c.close })),
        },
      ],
    },
    table: {
      columns: [
        xLabel ?? terms.period,
        terms.open,
        terms.high,
        terms.low,
        terms.close,
        terms.change,
      ],
      rows: candles.map((c) => [
        dates.text(c.at),
        format(c.open),
        format(c.high),
        format(c.low),
        format(c.close),
        change(c),
      ]),
    },
  });
}
