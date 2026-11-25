import { seriesModel, type SeriesModel } from "./line-model.js";
import { type SeriesPlan } from "./series.js";
import { prepare, type Prepared, type SeriesChartOptions } from "./series-prepare.js";
import { shareFormat } from "./text.js";

const AREA = "areaChart";

/** The fill opacity of an area chart's bands: light, so the gridlines show through and a stack reads as layers. */
export const AREA_OPACITY = 0.3;

/** Options for `areaChart`, from `enarratio/plot` or `enarratio/lite`. */
export interface AreaChartOptions<T extends object> extends SeriesChartOptions<T> {
  /**
   * Stack each x to 100%: every series is drawn, described and tabled as its percentage of that
   * x's total. The y label defaults to "Share of total (%)".
   */
  readonly percent?: boolean;
}

/** The rows as shares of each x's total, in percent; an x whose total is zero stays at zero. */
function asShares(prepared: Prepared): Prepared {
  const totals = new Map<number, number>();
  for (const p of prepared.points) totals.set(p.at, (totals.get(p.at) ?? 0) + (p.value ?? 0));
  return {
    ...prepared,
    points: prepared.points.map((p) => {
      const total = totals.get(p.at) ?? 0;
      return p.value === null ? p : { ...p, value: total > 0 ? (100 * p.value) / total : 0 };
    }),
  };
}

/** Every value is zero or more, as stacked areas need. */
function checkStackable(kind: string, prepared: Prepared): void {
  for (const p of prepared.points) {
    if (p.value !== null && p.value < 0) {
      throw new Error(
        `${kind}: stacked areas need values of zero or more; ${p.series} at ${p.xText} is ${p.value}`,
      );
    }
  }
}

const STREAM = "streamgraph";

/** Reads and checks a streamgraph's options, a series chart's with a `series` field; `finish` names the layers. */
export function streamModel<T extends object>(
  options: SeriesChartOptions<T>,
  finish: (svg: string, plan: SeriesPlan) => { svg: string; labeled: boolean },
): SeriesModel {
  const prepared = prepare(STREAM, options);
  if (options.series === undefined) {
    throw new Error(
      `${STREAM}: a streamgraph needs a series field; for one series draw an area chart`,
    );
  }
  return seriesModel(
    STREAM,
    "streamgraph",
    options,
    prepared,
    () => checkStackable(STREAM, prepared),
    finish,
  );
}

/** Reads and checks an area chart's options. Throws on anything it cannot draw. */
export function areaModel<T extends object>(given: AreaChartOptions<T>): SeriesModel {
  const percent = shareFormat(given);
  const options: AreaChartOptions<T> = given.percent
    ? {
        ...given,
        yLabel: given.yLabel === undefined ? "Share of total (%)" : given.yLabel,
        formatValue: given.formatValue ?? ((v: number) => percent(v / 100)),
      }
    : given;
  const read = prepare(AREA, options);
  const prepared = options.percent ? asShares(read) : read;
  return seriesModel(AREA, "area", options, prepared, () => checkStackable(AREA, read));
}
