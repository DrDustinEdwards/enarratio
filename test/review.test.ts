/**
 * Regression tests for the findings of the two reviews of PR #1 (Fable 5.1: A1 to A17; Claude
 * Opus 5.5: F1 to F23). Each test names the finding it guards. Browser-only findings are in
 * test/browser/review.test.ts.
 */
import { afterEach, describe, expect, it } from "vitest";
import { exampleTheme } from "../examples/themes/example.js";
import {
  checkTheme,
  colorDifference,
  contrastRatio,
  defineTheme,
  progressRing,
  sparkline,
  stylesheet,
  type Theme,
  uptimeStrip,
} from "../src/index.js";
import { areaChart, barChart, heatmap, lineChart, scatterPlot } from "../src/plot/index.js";
import { titerPlot } from "../src/science/index.js";
import { labelColor } from "../src/theme/color.js";
import { defaultTheme } from "../src/themes/index.js";
import { keyedMarks, parse } from "./helpers.js";

const tickLabels = (fig: Element, axis: "x" | "y"): string[] =>
  [...fig.querySelectorAll(`[data-enarratio-mark="${axis}-axis tick label"] text`)].map(
    (t) => t.textContent ?? "",
  );

describe("A1: the default palette and direct labels", () => {
  it("keeps series 1 to 6 at least 10 CIEDE2000 apart for every simulated vision, in both schemes", () => {
    const visions = [undefined, "protanopia", "deuteranopia", "tritanopia"] as const;
    for (const scheme of [defaultTheme.light, defaultTheme.dark]) {
      const six = scheme.series.slice(0, 6);
      for (let i = 0; i < six.length; i += 1) {
        for (let j = i + 1; j < six.length; j += 1) {
          for (const vision of visions) {
            expect(
              colorDifference(six[i] as string, six[j] as string, vision),
            ).toBeGreaterThanOrEqual(10);
          }
        }
      }
    }
    const coreWarnings = checkTheme(defaultTheme).issues.filter((i) => {
      const pair = /series (\d) #\w+ and (\d) /.exec(i.message);
      return i.check === "series-difference" && Number(pair?.[1]) <= 6 && Number(pair?.[2]) <= 6;
    });
    expect(coreWarnings).toEqual([]);
  });

  it("prints series names inside stacked bars that fit, and refuses them on grouped bars", () => {
    const data = Array.from({ length: 12 }, (_, i) => ({
      year: 2020 + (i % 2),
      type: i < 8 ? "Papers" : "Talks",
    }));
    const fig = parse(barChart({ data, x: "year", series: "type", directLabels: true, alt: "a" }));
    const labels = [...fig.querySelectorAll('[data-enarratio-mark="bar label"] text')];
    expect(labels.map((t) => t.textContent)).toContain("Papers");
    expect(labels[0]?.getAttribute("fill")).toMatch(/^var\(--enarratio-series-text-\d\)$/);
    expect(
      fig.querySelector('[data-enarratio-mark="bar label"]')?.getAttribute("aria-hidden"),
    ).toBe("true");
    expect(() =>
      barChart({
        data,
        x: "year",
        series: "type",
        layout: "grouped",
        directLabels: true,
        alt: "a",
      }),
    ).toThrow(/directLabels needs the stacked layout/);
  });
});

describe("A2: count axes end at their last tick", () => {
  it.each([11, 13])("draws every tick inside the plot for %i rows", (n) => {
    const fig = parse(
      barChart({ data: Array.from({ length: n }, () => ({ k: "a" })), x: "k", alt: "a" }),
    );
    const ys = [...fig.querySelectorAll('[data-enarratio-mark="y-axis tick label"] text')].map(
      (t) => Number(/translate\([\d.]+,(-?[\d.]+)\)/.exec(t.getAttribute("transform") ?? "")?.[1]),
    );
    for (const y of ys) expect(y).toBeGreaterThanOrEqual(0);
  });
});

describe("A3: local-midnight Dates are calendar dates", () => {
  const original = process.env["TZ"];
  afterEach(() => {
    if (original === undefined) delete process.env["TZ"];
    else process.env["TZ"] = original;
  });

  it("keeps new Date(2025, 0, 6) as 6 January east of UTC", () => {
    process.env["TZ"] = "Asia/Tokyo";
    const data = [
      { d: new Date(2025, 0, 6), v: 1 },
      { d: new Date(2025, 0, 7), v: 2 },
    ];
    const fig = parse(lineChart({ data, x: "d", y: "v", alt: "a" }));
    expect([...fig.querySelectorAll("tbody th")].map((th) => th.textContent)).toEqual([
      "2025-01-06",
      "2025-01-07",
    ]);
  });
});

describe("A7 and F15: empty and impossible input throws", () => {
  it("refuses empty bar data, all-empty series and non-positive sizes", () => {
    expect(() => barChart({ data: [] as { k: string }[], x: "k", alt: "a" })).toThrow(
      /data is empty/,
    );
    expect(() => lineChart({ data: [{ t: 1, v: null }], x: "t", y: "v", alt: "a" })).toThrow(
      /every value is empty/,
    );
    for (const size of [0, -100, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => barChart({ data: [{ k: "a" }], x: "k", width: size, alt: "a" })).toThrow(
        /width/,
      );
      expect(() =>
        scatterPlot({ data: [{ a: 1, b: 2 }], x: "a", y: "b", height: size, alt: "a" }),
      ).toThrow(/height/);
      expect(() => sparkline({ values: [1, 2], width: size })).toThrow(/width/);
      expect(() => uptimeStrip({ slots: ["up"], label: "x", height: size })).toThrow(/height/);
    }
  });

  it("refuses statuses that are only Object.prototype names", () => {
    for (const status of ["constructor", "toString", "__proto__"]) {
      expect(() => uptimeStrip({ slots: ["up", status as never], label: "x" })).toThrow(
        /unknown status/,
      );
    }
  });

  it("draws a sparkline of 200,000 values without overflowing the stack", () => {
    const values = Array.from({ length: 200_000 }, (_, i) => Math.sin(i / 1000));
    expect(parse(sparkline({ values })).getAttribute("aria-label")).toMatch(/200,000 values/);
  });

  it("refuses a dilution factor too fine to be a dilution series", () => {
    expect(() =>
      titerPlot({
        data: [{ g: "a", t: 1000 }],
        group: "g",
        titer: "t",
        dilution: { start: 10, factor: 1.001 },
        alt: "a",
      }),
    ).toThrow(/over 40 steps/);
  });
});

describe("A8: a number and its text are one category", () => {
  it("draws 2022 and '2022' as one bar and one table row", () => {
    const fig = parse(
      barChart({
        data: [{ y: 2022 }, { y: "2022" }] as { y: number | string }[],
        x: "y",
        alt: "a",
      }),
    );
    expect(keyedMarks(fig)).toHaveLength(1);
    expect(fig.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(fig.querySelector("tbody td")?.textContent).toBe("2");
  });
});

describe("A9 and F14: keys cannot collide", () => {
  it("keeps x 'a|b' in series 'c' apart from x 'a' in series 'b|c'", () => {
    const fig = parse(
      barChart({
        data: [
          { x: "a|b", s: "c" },
          { x: "a", s: "b|c" },
        ],
        x: "x",
        series: "s",
        alt: "a",
      }),
    );
    const keys = keyedMarks(fig).map((m) => m.getAttribute("data-enarratio-key"));
    expect(new Set(keys).size).toBe(2);
  });
});

describe("A10 and F10: theme text cannot break out of CSS", () => {
  const hostile = [
    "x */ body{display:none} /*",
    "x </style><script>alert(1)</script>",
    "x; } body { color: red",
  ];
  it.each(hostile)("refuses %s as a theme name, font, or scheme selector", (payload) => {
    const named = { ...defaultTheme, name: payload } as Theme;
    expect(() => defineTheme(named)).toThrow(/not allowed in CSS/);
    expect(() => stylesheet(named)).toThrow(/not allowed in CSS/);
    const font = { ...defaultTheme, fonts: { body: payload } } as Theme;
    expect(() => stylesheet(font)).toThrow(/not allowed in CSS/);
    expect(() => stylesheet(defaultTheme, { colorScheme: { dark: payload } })).toThrow(
      /not allowed in CSS/,
    );
  });

  it("still accepts ordinary names, font stacks and selectors", () => {
    expect(() =>
      stylesheet(
        {
          ...defaultTheme,
          name: "Lab (2026)",
          fonts: { body: '"Source Serif 4", Georgia, serif' },
        },
        { colorScheme: { dark: '[data-theme="dark"]' } },
      ),
    ).not.toThrow();
  });
});

describe("A11: protocol-relative links are refused", () => {
  it.each(["//evil.example/x", "\\\\evil.example/x", "/\\evil.example", " //evil.example"])(
    "refuses %s",
    (href) => {
      expect(() => barChart({ data: [{ k: "a" }], x: "k", href: () => href, alt: "a" })).toThrow(
        /not a relative or http\(s\) link/,
      );
    },
  );

  it("still accepts root-relative and relative links", () => {
    for (const href of ["/cv?year=1", "cv", "?y=1", "#a"]) {
      expect(() =>
        barChart({ data: [{ k: "a" }], x: "k", href: () => href, alt: "a" }),
      ).not.toThrow();
    }
  });
});

describe("A12: axes are hidden from assistive technology", () => {
  it("marks every axis group aria-hidden", () => {
    const fig = parse(barChart({ data: [{ k: "a" }], x: "k", alt: "a" }));
    const axes = [...fig.querySelectorAll('[data-enarratio-mark*="axis"]')];
    expect(axes.length).toBeGreaterThan(0);
    for (const g of axes) expect(g.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("A13: wide drawings scroll instead of shrinking their text", () => {
  it("wraps the SVG in a frame that keeps a minimum width for wide drawings only", () => {
    const wide = parse(barChart({ data: [{ k: "a" }], x: "k", alt: "a" }));
    expect(wide.querySelector(".enarratio-frame")?.getAttribute("class")).toContain(
      "enarratio-frame-wide",
    );
    const narrow = parse(barChart({ data: [{ k: "a" }], x: "k", width: 300, alt: "a" }));
    expect(narrow.querySelector(".enarratio-frame")?.getAttribute("class")).toBe("enarratio-frame");
    expect(stylesheet(defaultTheme)).toContain(".enarratio-frame-wide > svg { min-width: 30rem; }");
  });
});

describe("F2: a log axis refuses values it cannot show", () => {
  it.each([0, -5])("throws on %i", (bad) => {
    expect(() =>
      lineChart({
        data: [
          { t: 1, v: bad },
          { t: 2, v: 10 },
          { t: 3, v: 100 },
        ],
        x: "t",
        y: "v",
        yType: "log",
        alt: "a",
      }),
    ).toThrow(/which a log axis cannot show/);
  });
});

describe("F3: sub-daily time series", () => {
  it("draws six hourly points as six rows, labelled with the time", () => {
    const data = Array.from({ length: 6 }, (_, h) => ({
      t: new Date(Date.UTC(2026, 0, 1, h)),
      v: h,
    }));
    const fig = parse(lineChart({ data, x: "t", y: "v", alt: "a" }));
    expect(keyedMarks(fig)).toHaveLength(6);
    const rows = [...fig.querySelectorAll("tbody th")].map((th) => th.textContent);
    expect(rows[0]).toBe("2026-01-01 00:00 UTC");
    expect(new Set(rows).size).toBe(6);
  });

  it("keeps rows distinct under a coarse formatX", () => {
    const data = Array.from({ length: 3 }, (_, h) => ({
      t: new Date(Date.UTC(2026, 0, 1, h)),
      v: h,
    }));
    const fig = parse(lineChart({ data, x: "t", y: "v", formatX: () => "Thursday", alt: "a" }));
    expect(keyedMarks(fig)).toHaveLength(3);
  });
});

describe("F4: years print without a thousands separator", () => {
  it("labels the axis and table 2020, not 2,020", () => {
    const fig = parse(
      lineChart({
        data: [2020, 2021, 2022].map((year, i) => ({ year, v: i })),
        x: "year",
        y: "v",
        alt: "a",
      }),
    );
    expect(tickLabels(fig, "x")).toEqual(["2020", "2021", "2022"]);
    expect([...fig.querySelectorAll("tbody th")].map((th) => th.textContent)).toEqual([
      "2020",
      "2021",
      "2022",
    ]);
  });
});

describe("F5: area gaps are gaps", () => {
  it("gives a missing value no point and no hover text claiming zero", () => {
    const fig = parse(
      areaChart({
        data: [
          { d: 1, s: "a", v: 1 },
          { d: 2, s: "a", v: null },
          { d: 3, s: "a", v: 2 },
        ],
        x: "d",
        y: "v",
        series: "s",
        alt: "a",
      }),
    );
    const titles = keyedMarks(fig).map((m) => m.querySelector("title")?.textContent ?? "");
    expect(titles).toHaveLength(2);
    expect(titles.some((t) => t.includes("d 2"))).toBe(false);
    expect([...fig.querySelectorAll("tbody tr")][1]?.querySelector("td")?.textContent).toBe("");
  });
});

describe("F8: labels on marks reach 4.5:1", () => {
  it("chooses a label color with at least 4.5:1 on every fill in both the built-in and the example theme", () => {
    for (const theme of [defaultTheme, exampleTheme]) {
      for (const scheme of [theme.light, theme.dark]) {
        for (const fill of [...scheme.series, ...scheme.sequential]) {
          const label = labelColor(fill, scheme.text, scheme.background);
          expect(contrastRatio(label, fill)).toBeGreaterThanOrEqual(4.5);
        }
      }
      expect(checkTheme(theme).issues.filter((i) => i.check === "label-contrast")).toEqual([]);
    }
  });

  it("falls back to black or white for mid-tone fills", () => {
    for (let v = 0; v <= 255; v += 5) {
      const fill = `#${v.toString(16).padStart(2, "0").repeat(3)}`;
      expect(contrastRatio(labelColor(fill, "#777777", "#888888"), fill)).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });
});

describe("F9: marks carry their reading order from the data", () => {
  it("numbers grouped bars by category, then series", () => {
    const fig = parse(
      barChart({
        data: [
          { c: "A", s: "one", v: 1 },
          { c: "A", s: "two", v: 2 },
          { c: "B", s: "one", v: 3 },
          { c: "B", s: "two", v: 4 },
        ],
        x: "c",
        y: "v",
        series: "s",
        layout: "grouped",
        alt: "a",
      }),
    );
    expect(
      keyedMarks(fig).map((m) => [
        m.getAttribute("data-enarratio-col"),
        m.getAttribute("data-enarratio-row"),
      ]),
    ).toEqual([
      ["0", "0"],
      ["0", "1"],
      ["1", "0"],
      ["1", "1"],
    ]);
  });

  it("orders a heatmap by column and row", () => {
    const fig = parse(
      heatmap({
        data: [
          { x: "b", y: "q", v: 1 },
          { x: "a", y: "p", v: 2 },
        ],
        x: "x",
        y: "y",
        value: "v",
        xDomain: ["a", "b"],
        yDomain: ["p", "q"],
        alt: "a",
      }),
    );
    const places = keyedMarks(fig).map(
      (m) => `${m.getAttribute("data-enarratio-col")}${m.getAttribute("data-enarratio-row")}`,
    );
    expect(places.sort()).toEqual(["00", "11"]);
  });
});

describe("F13: labels may contain the warning glyph", () => {
  it("draws a category and a reference named with a warning sign", () => {
    expect(() => barChart({ data: [{ k: "⚠ Outage" }], x: "k", alt: "a" })).not.toThrow();
    expect(() =>
      lineChart({
        data: [
          { t: 1, v: 1 },
          { t: 2, v: 2 },
        ],
        x: "t",
        y: "v",
        references: [{ y: 1.5, label: "⚠ limit" }],
        alt: "a",
      }),
    ).not.toThrow();
  });

  it("still throws when Plot itself warns", () => {
    expect(() =>
      scatterPlot({ data: [{ a: "1" as unknown as number, b: 2 }], x: "a", y: "b", alt: "a" }),
    ).toThrow();
  });
});

describe("F18: one name for text alternatives", () => {
  it("accepts alt on every primitive, and label as the subject of a generated one", () => {
    expect(parse(progressRing({ value: 0.5, alt: "Half done" })).getAttribute("aria-label")).toBe(
      "Half done",
    );
    expect(parse(uptimeStrip({ slots: ["up"], alt: "All up" })).getAttribute("aria-label")).toBe(
      "All up",
    );
    expect(parse(sparkline({ values: [1, 2], alt: "Rising" })).getAttribute("aria-label")).toBe(
      "Rising",
    );
    expect(parse(progressRing({ value: 0.5, label: "Done" })).getAttribute("aria-label")).toBe(
      "Done: 50%",
    );
    expect(() => uptimeStrip({ slots: ["up"] })).toThrow(/label or alt is required/);
  });
});
