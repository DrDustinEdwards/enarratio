/**
 * The light charts (`enarratio/lite`) draw what the Observable Plot charts (`enarratio/plot`)
 * draw: for the same options, the same figure, element for element and attribute for attribute,
 * with coordinates equal to the hundredth of a pixel. Attribute order is not compared; it does
 * not change the drawing.
 */
import { describe, expect, it, vi } from "vitest";
import * as lite from "../src/lite/index.js";
import * as plot from "../src/plot/index.js";
import { parse } from "./helpers.js";

/** A figure as comparable lines: each element with its attributes sorted, and text. */
function canonical(markup: string): string[] {
  const lines: string[] = [];
  const walk = (node: Node, depth: number): void => {
    if (node.nodeType === 3) {
      const value = node.textContent ?? "";
      if (value !== "") lines.push(`${"  ".repeat(depth)}"${value}"`);
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as Element;
    const attrs = el
      .getAttributeNames()
      .map((name) => `${name}=${el.getAttribute(name) ?? ""}`)
      .sort();
    lines.push(`${"  ".repeat(depth)}<${el.localName} ${attrs.join(" ")}>`);
    for (const child of el.childNodes) walk(child, depth + 1);
  };
  walk(parse(markup), 0);
  return lines;
}

function same(a: string, b: string): void {
  expect(canonical(a)).toEqual(canonical(b));
}

const GALLERY = [
  "stacked-bar",
  "years",
  "runs",
  "grouped-bar",
  "horizontal-bar",
  "line",
  "forecast",
  "area",
  "percent-area",
  "error-bars",
  "annotations",
];

describe("light charts draw the gallery as the Plot charts do", () => {
  it.each(GALLERY)("%s", async (id) => {
    vi.resetModules();
    const drawn = (await import(`../examples/${id}.ts`)) as { default: string };
    vi.doMock("enarratio/plot", () => import("../src/lite/index.js"));
    const light = (await import(`../examples/${id}.ts`)) as { default: string };
    vi.doUnmock("enarratio/plot");
    expect(light.default).not.toBe("");
    same(light.default, drawn.default);
  });
});

const sales = [
  { region: "North", quarter: "Q1", amount: 120 },
  { region: "North", quarter: "Q2", amount: -30 },
  { region: "South", quarter: "Q1", amount: 80 },
  { region: "South", quarter: "Q2", amount: 45.5 },
  { region: "East", quarter: "Q1", amount: 0 },
  { region: "West", quarter: "Q2", amount: 12 },
];

const barCases: [string, Parameters<typeof plot.barChart<(typeof sales)[number]>>[0]][] = [
  ["one series", { data: sales, x: "region", y: "amount", alt: "Sales" }],
  [
    "stacked with negatives",
    { data: sales, x: "region", y: "amount", series: "quarter", alt: "Sales" },
  ],
  [
    "grouped",
    { data: sales, x: "region", y: "amount", series: "quarter", layout: "grouped", alt: "Sales" },
  ],
  [
    "grouped with an empty category",
    {
      data: sales,
      x: "region",
      y: "amount",
      series: "quarter",
      layout: "grouped",
      xDomain: ["North", "Central", "South", "East", "West"],
      alt: "Sales",
    },
  ],
  [
    "horizontal",
    { data: sales, x: "region", y: "amount", orientation: "horizontal", alt: "Sales" },
  ],
  [
    "horizontal stacked",
    {
      data: sales,
      x: "region",
      y: "amount",
      series: "quarter",
      orientation: "horizontal",
      xLabel: "Region",
      alt: "Sales",
    },
  ],
  [
    "horizontal grouped",
    {
      data: sales,
      x: "region",
      y: "amount",
      series: "quarter",
      layout: "grouped",
      orientation: "horizontal",
      alt: "Sales",
    },
  ],
  [
    "horizontal grouped with an empty category and thinned labels",
    {
      data: sales,
      x: "region",
      y: "amount",
      series: "quarter",
      layout: "grouped",
      orientation: "horizontal",
      xDomain: ["North", "Central", "South", "East", "West"],
      maxXTicks: 2,
      alt: "Sales",
    },
  ],
  ["counted", { data: sales, x: "region", series: "quarter", alt: "Rows" }],
  [
    "counted, grouped, sized and labeled",
    {
      data: sales,
      x: "quarter",
      series: "region",
      layout: "grouped",
      width: 300,
      height: 200,
      xLabel: null,
      yLabel: null,
      alt: "Rows",
    },
  ],
  [
    "direct labels, links and colors",
    {
      data: sales.filter((s) => s.amount > 0),
      x: "region",
      y: "amount",
      series: "quarter",
      directLabels: true,
      href: (x) => `/regions/${x}`,
      colors: { Q2: { light: "#335", dark: "#ccd" } },
      title: "Sales",
      caption: "By quarter",
      alt: "Sales",
    },
  ],
  [
    "small values",
    {
      data: sales.map((s) => ({ ...s, amount: Math.abs(s.amount) / 1000 })),
      x: "region",
      y: "amount",
      alt: "Sales",
    },
  ],
  [
    "large values",
    {
      data: sales.map((s) => ({ ...s, amount: s.amount * 123456 })),
      x: "region",
      y: "amount",
      orientation: "horizontal",
      alt: "Sales",
    },
  ],
];

// Error bars and annotations (record 0024), drawn by both renderers from the same scales.
const measured = [
  { site: "North", arm: "A", mean: 12, lo: 9, hi: 15.5 },
  { site: "North", arm: "B", mean: 8, lo: 6.5, hi: 9 },
  { site: "South", arm: "A", mean: 14, lo: null, hi: null },
  { site: "South", arm: "B", mean: 11, lo: 7, hi: 13 },
];
const errorBars = { lower: "lo", upper: "hi", label: "95% CI" } as const;
const notes = [
  { type: "note", x: "South", y: 11, text: "Lowest arm", dx: 30, dy: -24 },
  { type: "range", axis: "x", from: "North", to: "North", label: "Pilot" },
  { type: "range", axis: "y", from: 8, to: 10 },
] as const;
const one = measured.filter((m) => m.arm === "B");
const intervalCases: [string, Parameters<typeof plot.barChart<(typeof measured)[number]>>[0]][] = [
  ["error bars", { data: one, x: "site", y: "mean", errorBars, alt: "Means" }],
  [
    "grouped error bars with a missing interval",
    { data: measured, x: "site", y: "mean", series: "arm", layout: "grouped", errorBars, alt: "M" },
  ],
  [
    "horizontal grouped error bars",
    {
      data: measured,
      x: "site",
      y: "mean",
      series: "arm",
      layout: "grouped",
      orientation: "horizontal",
      errorBars,
      alt: "Means",
    },
  ],
  ["annotations", { data: one, x: "site", y: "mean", errorBars, annotations: notes, alt: "M" }],
  [
    "horizontal annotations",
    { data: one, x: "site", y: "mean", orientation: "horizontal", annotations: notes, alt: "M" },
  ],
];

describe("light barChart", () => {
  it.each(barCases)("matches the Plot chart: %s", (_, options) => {
    same(lite.barChart(options), plot.barChart(options));
  });

  it.each(intervalCases)("matches the Plot chart: %s", (_, options) => {
    same(lite.barChart(options), plot.barChart(options));
  });

  const runs = Array.from({ length: 40 }, (_, i) => ({
    at: new Date(Date.UTC(2026, 0, 1) + i * 7_200_000 * 7).toISOString(),
    site: i % 3 === 0 ? "A" : "B",
  }));
  it.each(["hour", "day", "week", "month", "year"] as const)(
    "matches the Plot chart on a time axis by %s",
    (interval) => {
      const options = {
        data: runs,
        x: "at" as const,
        xType: "time" as const,
        interval,
        alt: "Runs",
      };
      same(lite.barChart(options), plot.barChart(options));
      const series = { ...options, series: "site" as const };
      same(lite.barChart(series), plot.barChart(series));
    },
  );

  it("draws values that are all zero as bars of no height on a 0 to 1 axis, as Plot does (B41)", () => {
    const options = {
      data: [
        { a: "x", v: 0 },
        { a: "y", v: 0 },
      ],
      x: "a",
      y: "v",
      alt: "Zero",
    } as const;
    // Before 0.4.0 Plot's zero-width domain drew full bars (design record 0017); both now agree.
    for (const chart of [lite.barChart(options), plot.barChart(options)]) {
      const bars = [...parse(chart).querySelectorAll("rect")];
      expect(bars.map((b) => b.getAttribute("height"))).toEqual(["0", "0"]);
    }
  });

  it("throws the Plot chart's errors", () => {
    expect(() => lite.barChart({ data: [] as typeof sales, x: "region", alt: "Sales" })).toThrow(
      "barChart: data is empty",
    );
    expect(() =>
      lite.barChart({ data: sales, x: "region", href: () => "javascript:alert(1)", alt: "Sales" }),
    ).toThrow("is not a relative or http(s) link");
  });
});

const H = 3_600_000;
const D = 24 * H;
const t0 = Date.UTC(2025, 0, 6);
const wave = (i: number, k = 1) => Math.round(50 + 40 * Math.sin(i / 3) * k);
const weekly = ["A", "B", "C"].flatMap((s, k) =>
  Array.from({ length: 16 }, (_, i) => ({
    at: new Date(t0 + i * 7 * D),
    s,
    v: s === "B" && (i === 0 || i === 6 || i === 8) ? null : wave(i, k + 1),
  })),
);
const numeric = Array.from({ length: 12 }, (_, i) => ({
  dose: i * 0.25,
  v: (i - 5) * 1.5,
  s: "a",
}));
const years = Array.from({ length: 30 }, (_, i) => ({ year: 1995 + i, v: wave(i) }));
const spans = (step: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({ at: t0 + i * step, v: wave(i) }));
const growth = Array.from({ length: 10 }, (_, i) => ({
  day: i,
  v: 3 * 2.4 ** i,
  lo: 2 * 2.4 ** i,
  hi: 4 * 2.4 ** i,
}));

const lineCases: [string, () => [string, string]][] = [
  [
    "series over weeks with gaps",
    () => {
      const o = { data: weekly, x: "at", y: "v", series: "s", alt: "Weekly" } as const;
      return [lite.lineChart(o), plot.lineChart(o)];
    },
  ],
  [
    "references, markers, direct labels and no points",
    () => {
      const o = {
        data: weekly,
        x: "at",
        y: "v",
        series: "s",
        references: [{ y: 120, label: "Limit" }],
        markers: [
          { x: "2025-02-17", label: "Deploy" },
          { x: new Date(t0 + 70 * D), label: "Holiday" },
        ],
        directLabels: true,
        points: false,
        alt: "Weekly",
      } as const;
      return [lite.lineChart(o), plot.lineChart(o)];
    },
  ],
  [
    "a linear x with negatives and decimals",
    () => {
      const o = { data: numeric, x: "dose", y: "v", zero: false, alt: "Dose" } as const;
      return [lite.lineChart(o), plot.lineChart(o)];
    },
  ],
  [
    "years, hidden labels and a custom size",
    () => {
      const o = {
        data: years,
        x: "year",
        y: "v",
        xLabel: null,
        yLabel: null,
        width: 420,
        height: 260,
        alt: "Years",
      } as const;
      return [lite.lineChart(o), plot.lineChart(o)];
    },
  ],
  [
    "a log axis with a band",
    () => {
      const o = {
        data: growth,
        x: "day",
        y: "v",
        yType: "log",
        band: { lower: "lo", upper: "hi" },
        markers: [{ x: 4, label: "Lockdown" }],
        alt: "Growth",
      } as const;
      return [lite.lineChart(o), plot.lineChart(o)];
    },
  ],
  [
    "a narrow log axis",
    () => {
      const o = {
        data: growth.slice(0, 3).map((g) => ({ ...g, v: g.v / 1000 })),
        x: "day",
        y: "v",
        yType: "log",
        alt: "Growth",
      } as const;
      return [lite.lineChart(o), plot.lineChart(o)];
    },
  ],
  [
    "a forecast with a band in two series",
    () => {
      const data = ["North", "South"].flatMap((s, k) =>
        Array.from({ length: 20 }, (_, i) => ({
          day: new Date(t0 + i * D),
          s,
          v: 100 + i * (k + 2),
          lo: i > 12 ? 100 + i * (k + 2) - (i - 12) * 3 : null,
          hi: i > 12 ? 100 + i * (k + 2) + (i - 12) * 3 : null,
        })),
      );
      const o = {
        data,
        x: "day",
        y: "v",
        series: "s",
        band: { lower: "lo", upper: "hi", label: "80% interval" },
        forecastFrom: new Date(t0 + 12 * D),
        points: true,
        formatValue: (v: number) => `${v} visits`,
        formatX: (v: number | Date) => `day ${Number(v)}`,
        alt: "Forecast",
      } as const;
      return [lite.lineChart(o), plot.lineChart(o)];
    },
  ],
];

lineCases.push([
  "annotations on a time axis",
  () => {
    const o = {
      data: weekly,
      x: "at",
      y: "v",
      series: "s",
      annotations: [
        { type: "note", x: "2025-02-17", y: 50, text: "Peak", dx: -20, dy: -20 },
        { type: "range", axis: "x", from: new Date(t0 + 21 * D), to: new Date(t0 + 42 * D) },
        { type: "range", axis: "y", from: 20, to: 40, label: "Band" },
      ],
      alt: "Weekly",
    } as const;
    return [lite.lineChart(o), plot.lineChart(o)];
  },
]);

for (const [step, n, label] of [
  [1000, 40, "seconds"],
  [15_000, 50, "seconds by fifteen"],
  [5 * 60_000, 30, "minutes"],
  [H, 30, "hours"],
  [3 * H, 40, "three-hour steps"],
  [D, 10, "days"],
  [D, 50, "days over months"],
  [7 * D, 60, "weeks over a year"],
  [30 * D, 40, "months over years"],
  [365 * D, 40, "years over decades"],
  [400 * D, 400, "centuries"],
  [7, 30, "milliseconds"],
] as const) {
  lineCases.push([
    `time ticks: ${label}`,
    () => {
      const o = { data: spans(step, n), x: "at", y: "v", xType: "time", alt: "Time" } as const;
      return [lite.lineChart(o), plot.lineChart(o)];
    },
  ]);
}

const areaCases: [string, () => [string, string]][] = [
  [
    "stacked series with a gap",
    () => {
      const data = weekly.map((w) => ({ ...w, v: w.v === null ? null : Math.abs(w.v) }));
      const o = { data, x: "at", y: "v", series: "s", alt: "Weekly" } as const;
      return [lite.areaChart(o), plot.areaChart(o)];
    },
  ],
  [
    "one series on a linear x, with annotations",
    () => {
      const o = {
        data: numeric.map((d) => ({ ...d, v: Math.abs(d.v) })),
        x: "dose",
        y: "v",
        references: [{ y: 4, label: "Target" }],
        markers: [{ x: 1.3, label: "Switch" }],
        yLabel: null,
        alt: "Dose",
      } as const;
      return [lite.areaChart(o), plot.areaChart(o)];
    },
  ],
  [
    "years",
    () => {
      const o = { data: years, x: "year", y: "v", alt: "Years" } as const;
      return [lite.areaChart(o), plot.areaChart(o)];
    },
  ],
  [
    "stacked to 100%",
    () => {
      const data = weekly.map((w) => ({ ...w, v: w.v === null ? null : Math.abs(w.v) }));
      const o = { data, x: "at", y: "v", series: "s", percent: true, alt: "Shares" } as const;
      return [lite.areaChart(o), plot.areaChart(o)];
    },
  ],
];

lineCases.push(
  [
    "a single row",
    () => {
      const o = { data: [{ at: "2026-01-05", v: 3 }], x: "at", y: "v", alt: "One" } as const;
      return [lite.lineChart(o), plot.lineChart(o)];
    },
  ],
  [
    "epoch milliseconds, a series of only gaps, and an empty reference label",
    () => {
      const data = [
        ...spans(D, 8).map((d) => ({ ...d, s: "kept" })),
        ...spans(D, 8).map((d) => ({ ...d, s: "empty", v: null })),
      ];
      const o = {
        data,
        x: "at",
        y: "v",
        series: "s",
        xType: "time",
        references: [{ y: 70, label: "" }],
        alt: "Gaps",
      } as const;
      return [lite.lineChart(o), plot.lineChart(o)];
    },
  ],
);
areaCases.push([
  "series that start late and skip rows",
  () => {
    const data = [
      ...spans(30 * D, 12)
        .map((d) => ({ ...d, s: "late" }))
        .slice(4),
      ...spans(30 * D, 12)
        .map((d) => ({ ...d, s: "early" }))
        .filter((_, i) => i % 3 !== 1),
    ];
    const o = {
      data,
      x: "at",
      y: "v",
      series: "s",
      seriesDomain: ["early", "late"],
      alt: "Late",
    } as const;
    return [lite.areaChart(o), plot.areaChart(o)];
  },
]);

/** Edge cases of the ported scales: degenerate domains, extreme precision, years before 100. */
const at = (iso: string): Date => new Date(iso);
lineCases.push(
  [
    "a single point and empty axis labels",
    () => {
      const o = { data: [{ t: 1, v: 5 }], x: "t", y: "v", xLabel: "", alt: "One" } as const;
      return [lite.lineChart(o), plot.lineChart(o)];
    },
  ],
  [
    "a flat line without zero",
    () => {
      const data = [
        { t: 1, v: 5 },
        { t: 2, v: 5 },
      ];
      const o = { data, x: "t", y: "v", zero: false, alt: "Flat" } as const;
      return [lite.lineChart(o), plot.lineChart(o)];
    },
  ],
  [
    "values too small for twenty decimals",
    () => {
      const data = [
        { t: 1, v: 1e-300 },
        { t: 2, v: 2e-300 },
      ];
      const o = { data, x: "t", y: "v", alt: "Tiny" } as const;
      return [lite.lineChart(o), plot.lineChart(o)];
    },
  ],
  ...(
    [
      ["months in the year 50", "0050-01-01T00:00:00Z", "0050-09-01T00:00:00Z"],
      ["days in the year 50", "0050-01-01T00:00:00Z", "0050-01-20T00:00:00Z"],
      ["centuries before year 1", "-000500-01-01T00:00:00Z", "-000100-01-01T00:00:00Z"],
    ] as const
  ).map(([name, from, to]): [string, () => [string, string]] => [
    name,
    () => {
      const data = [
        { t: at(from), v: 1 },
        { t: at(to), v: 3 },
      ];
      const o = { data, x: "t", y: "v", alt: "Ancient" } as const;
      return [lite.lineChart(o), plot.lineChart(o)];
    },
  ]),
);

describe("light lineChart and areaChart", () => {
  it.each([...lineCases, ...areaCases])("matches the Plot chart: %s", (_, draw) => {
    const [light, drawn] = draw();
    same(light, drawn);
  });

  it("throws the Plot chart's errors", () => {
    expect(() =>
      lite.lineChart({ data: growth, x: "day", y: "v", yType: "log", zero: true, alt: "G" }),
    ).not.toThrow();
    expect(() =>
      lite.lineChart({
        data: [...growth, { day: 11, v: 0, lo: 1, hi: 2 }],
        x: "day",
        y: "v",
        yType: "log",
        alt: "G",
      }),
    ).toThrow("which a log axis cannot show");
    expect(() => lite.areaChart({ data: numeric, x: "dose", y: "v", alt: "Dose" })).toThrow(
      "stacked areas need values of zero or more",
    );
  });
});
