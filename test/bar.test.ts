import { describe, expect, it } from "vitest";
import { colorStyles } from "../src/index.js";
import { barChart } from "../src/plot/index.js";
import { keyedMarks, parse } from "./helpers.js";

const entries = [
  { year: 2022, type: "Publications" },
  { year: 2022, type: "Talks" },
  { year: 2023, type: "Publications" },
  { year: 2024, type: "Grants" },
  { year: 2024, type: "Publications" },
  { year: 2024, type: "Publications" },
];

describe("barChart", () => {
  it("counts rows per category and series when y is omitted", () => {
    const fig = parse(
      barChart({ data: entries, x: "year", series: "type", alt: "Entries by year" }),
    );
    const marks = keyedMarks(fig);
    expect(marks.map((m) => JSON.parse(m.getAttribute("data-enarratio-key") ?? ""))).toEqual([
      ["2022", "Publications"],
      ["2022", "Talks"],
      ["2023", "Publications"],
      ["2024", "Publications"],
      ["2024", "Grants"],
    ]);
    expect(marks[3]?.querySelector("title")?.textContent).toBe("year 2024, Publications: 2");
  });

  it("adds a unit to an axis title only when the title does not already name it", () => {
    const title = (yLabel: string, yUnit: string): string | null | undefined =>
      parse(barChart({ data: entries, x: "year", yLabel, yUnit, alt: "a" })).querySelector(
        '[data-enarratio-mark="y-axis label"] text',
      )?.textContent;
    expect(title("reads", "reads")).toBe("reads");
    expect(title("Reads per sample", "reads")).toBe("Reads per sample");
    expect(title("Spreads", "reads")).toBe("Spreads (reads)");
    expect(title("Dose", "mg/L")).toBe("Dose (mg/L)");
  });

  it("names the SVG, not the figure, and puts every text part in the HTML outside role=img", () => {
    const fig = parse(
      barChart({
        data: entries,
        x: "year",
        series: "type",
        yLabel: "Entries",
        yUnit: "count",
        title: "Entries",
        subtitle: "Each bar is one year.",
        alt: "Entries by year",
        caption: "Illustrative data.",
        notes: ["A grant counts once."],
        source: { name: "CV", href: "https://example.com/cv" },
        byline: "Sample Lab",
      }),
    );
    expect(fig.tagName.toLowerCase()).toBe("figure");
    expect(fig.hasAttribute("aria-label")).toBe(false);
    const svg = fig.querySelector("svg");
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.getAttribute("aria-label")).toBe("Entries by year");
    expect(svg?.querySelector("figcaption, table, p")).toBeNull();
    // The head names the figure; the finding is visible and read once, on the SVG.
    expect(fig.firstElementChild?.tagName.toLowerCase()).toBe("figcaption");
    expect(fig.querySelector("figcaption")?.textContent).toBe(
      "EntriesEach bar is one year.Entries by year",
    );
    expect(fig.querySelector(".enarratio-finding")?.getAttribute("aria-hidden")).toBe("true");
    const text = (cls: string) => fig.querySelector(`.${cls}`)?.textContent;
    expect(text("enarratio-overview")).toBe(
      "Bar chart with 3 series and 9 points. X axis, year: 2022 to 2024. Y axis, Entries (count): 0 to 3.",
    );
    expect(text("enarratio-summary")).toBe(
      "Publications rose from 1 (2022) to 2 (2024). Talks fell from 1 (2022) to 0 (2024). Grants rose from 0 (2022) to 1 (2024). The highest value is 2 (Publications, 2024). The lowest is 0 (Talks, 2023).",
    );
    expect(text("enarratio-note")).toBe("Notes: A grant counts once.");
    expect(text("enarratio-source")).toBe("Source: CV · By Sample Lab · Download CSV");
    expect(fig.querySelector(".enarratio-source a")?.getAttribute("href")).toBe(
      "https://example.com/cv",
    );
    expect(fig.querySelector("th")?.textContent).toBe("year");
    expect(fig.querySelector(".enarratio-csv")?.getAttribute("download")).toBe("entries.csv");
  });

  it("moves hover titles to a data attribute with hoverTitles: false, linked bars too", () => {
    const fig = parse(
      barChart({
        data: entries,
        x: "year",
        series: "type",
        href: (year) => `?year=${year}`,
        hoverTitles: false,
        alt: "a",
      }),
    );
    expect(fig.querySelector("title")).toBeNull();
    const shapes = [...fig.querySelectorAll('[data-enarratio-mark="bar"] [data-enarratio-href]')];
    expect(shapes.length).toBeGreaterThan(0);
    for (const shape of shapes) expect(shape.getAttribute("data-enarratio-label")).toMatch(/: /);
  });

  it("emits an equivalent data table, zero-filling counts", () => {
    const fig = parse(barChart({ data: entries, x: "year", series: "type", alt: "a" }));
    const rows = [...fig.querySelectorAll("tbody tr")].map((tr) =>
      [...tr.children].map((c) => c.textContent),
    );
    expect(rows).toEqual([
      ["2022", "1", "1", "0"],
      ["2023", "1", "0", "0"],
      ["2024", "2", "0", "1"],
    ]);
    expect([...fig.querySelectorAll("thead th")].map((th) => th.textContent)).toEqual([
      "year",
      "Publications",
      "Talks",
      "Grants",
    ]);
  });

  it("fills series by palette slot, textured after the first, and lists them in a legend", () => {
    const fig = parse(barChart({ data: entries, x: "year", series: "type", alt: "a" }));
    const talks = keyedMarks(fig).find((m) => m.getAttribute("data-enarratio-series") === "Talks");
    const id = /^url\(#(.+)\)$/.exec(talks?.getAttribute("fill") ?? "")?.[1];
    const pattern = fig.querySelector(`pattern[id="${id}"]`);
    expect(pattern?.querySelector("rect")?.getAttribute("fill")).toBe("var(--enarratio-series-2)");
    expect(pattern?.querySelector(".enarratio-texture")).not.toBeNull();
    const legend = [...fig.querySelectorAll(".enarratio-legend li")];
    expect(legend.map((li) => [li.textContent, li.getAttribute("data-slot")])).toEqual([
      ["Publications", "1"],
      ["Talks", "2"],
      ["Grants", "3"],
    ]);
  });

  it("carries filter attributes for the enhancement layer", () => {
    const fig = parse(barChart({ data: entries, x: "year", series: "type", alt: "a" }));
    const mark = keyedMarks(fig)[0];
    expect(mark?.getAttribute("data-enarratio-field")).toBe("type");
    expect(mark?.getAttribute("data-enarratio-value")).toBe("Publications");
    expect(mark?.getAttribute("data-enarratio-x")).toBe("2022");
  });

  it("shows empty categories and a fixed series order when given", () => {
    const fig = parse(
      barChart({
        data: entries,
        x: "year",
        series: "type",
        xDomain: [2021, 2022, 2023, 2024],
        seriesDomain: ["Grants", "Publications", "Talks"],
        alt: "a",
      }),
    );
    expect([...fig.querySelectorAll("tbody th")].map((th) => th.textContent)).toEqual([
      "2021",
      "2022",
      "2023",
      "2024",
    ]);
    expect(fig.querySelector(".enarratio-legend li")?.textContent).toBe("Grants");
  });

  it("uses whole-number ticks for counts", () => {
    const fig = parse(barChart({ data: entries, x: "year", series: "type", alt: "a" }));
    const ticks = [...fig.querySelectorAll('[data-enarratio-mark="y-axis tick label"] text')].map(
      (t) => t.textContent,
    );
    expect(ticks).toEqual(["0", "1", "2", "3"]);
  });

  it("draws one series with given values, horizontal, and filters by category", () => {
    const fig = parse(
      barChart({
        data: [
          { lab: "A", n: 3 },
          { lab: "B", n: 5 },
        ],
        x: "lab",
        y: "n",
        orientation: "horizontal",
        alt: "a",
      }),
    );
    expect(fig.getAttribute("data-enarratio-orientation")).toBe("horizontal");
    expect(fig.querySelector(".enarratio-legend")).toBeNull();
    expect(keyedMarks(fig).map((m) => m.getAttribute("data-enarratio-field"))).toEqual([
      "lab",
      "lab",
    ]);
  });

  it("groups series side by side", () => {
    const fig = parse(
      barChart({ data: entries, x: "year", series: "type", layout: "grouped", alt: "a" }),
    );
    expect(keyedMarks(fig)).toHaveLength(5);
  });

  it("applies color overrides to the figure's slot through a rule, not a style attribute (D4)", () => {
    const html = barChart({
      data: entries,
      x: "year",
      series: "type",
      colors: { Talks: { light: "#112233", dark: "#aabbcc" } },
      alt: "a",
    });
    expect(html).not.toContain("style=");
    const value = "--enarratio-series-2: light-dark(#112233, #aabbcc)";
    const label =
      "--enarratio-series-label-2: color-mix(in srgb, light-dark(#112233, #aabbcc) 55%, var(--enarratio-text))";
    expect(colorStyles(html)).toBe(
      `.enarratio[data-enarratio-colors="${value}"] { ${value}; ${label}; }`,
    );
  });

  it("escapes caller text", () => {
    const markup = barChart({
      data: [{ k: "<b>", v: 1 }],
      x: "k",
      y: "v",
      title: 'A "quoted" <title>',
      alt: "a & b",
    });
    expect(markup).not.toContain("<b>");
    expect(markup).toContain("A &quot;quoted&quot; &lt;title&gt;");
  });

  it("is deterministic", () => {
    const options = { data: entries, x: "year", series: "type", alt: "a" } as const;
    expect(barChart(options)).toBe(barChart(options));
  });

  it("names a chart without alt from its data, reports it, and throws when strict (B52)", () => {
    const issues: string[] = [];
    const fig = parse(
      barChart({ data: entries, x: "year", alt: "  ", onIssue: (i) => issues.push(i.code) }),
    );
    expect(issues).toEqual(["title-missing", "alt-missing"]);
    expect(fig.querySelector("svg")?.getAttribute("aria-label")).toBe(
      "Bar chart with 3 points. X axis, year: 2022 to 2024. Y axis, Count: 0 to 3. Count rose from 2 (2022) to 3 (2024). The highest value is 3 (2024). The lowest is 1 (2023).",
    );
    expect(fig.querySelector(".enarratio-finding")).toBeNull();
    expect(() => barChart({ data: entries, x: "year", title: "Entries", strict: true })).toThrow(
      /bar: alt is missing/,
    );
    expect(() =>
      barChart({ data: entries, x: "year", yLabel: null, alt: "a", strict: true }),
    ).toThrow(/bar: no title/);
    expect(() =>
      barChart({
        data: entries,
        x: "year",
        yLabel: null,
        alt: "a",
        title: "Entries",
        strict: true,
      }),
    ).not.toThrow();
  });

  it("refuses bad values, unknown color keys and too many series", () => {
    expect(() => barChart({ data: [{ k: "a", v: Number.NaN }], x: "k", y: "v", alt: "a" })).toThrow(
      /row 1 field "v" is NaN/,
    );
    expect(() =>
      barChart({ data: entries, x: "year", series: "type", colors: { Books: "#000" }, alt: "a" }),
    ).toThrow(/"Books", which is not a series/);
    const many = Array.from({ length: 9 }, (_, i) => ({ x: "a", s: `s${i}` }));
    expect(() => barChart({ data: many, x: "x", series: "s", alt: "a" })).toThrow(/9 series/);
    expect(() => barChart({ data: entries, x: "year", xDomain: [2022], alt: "a" })).toThrow(
      /2023" is missing from the year domain/,
    );
    expect(() =>
      barChart({
        data: entries,
        x: "year",
        series: "type",
        colors: { Talks: "url(#x)" },
        alt: "a",
      }),
    ).toThrow(/not an allowed color/);
  });

  it("filters by category when asked, even with series", () => {
    const fig = parse(
      barChart({ data: entries, x: "year", series: "type", filterBy: "x", alt: "a" }),
    );
    const mark = keyedMarks(fig)[0];
    expect(mark?.getAttribute("data-enarratio-field")).toBe("year");
    expect(mark?.getAttribute("data-enarratio-value")).toBe("2022");
  });

  it("puts each bar's link in the table and on the bar, with no link inside the image", () => {
    const fig = parse(
      barChart({
        data: entries,
        x: "year",
        series: "type",
        href: (y) => `/cv?year=${y}`,
        alt: "a",
      }),
    );
    expect(fig.querySelector("svg a, svg [tabindex]")).toBeNull();
    const marks = keyedMarks(fig);
    expect(marks[0]?.tagName.toLowerCase()).toBe("rect");
    expect(marks[0]?.getAttribute("data-enarratio-href")).toBe("/cv?year=2022");
    expect(marks[0]?.querySelector("title")?.textContent).toBe("year 2022, Publications: 1");
    expect(fig.querySelector("tbody th a")?.getAttribute("href")).toBe("/cv?year=2022");
  });

  it("refuses links that are not relative or http(s)", () => {
    for (const bad of [
      "javascript:alert(1)",
      " java\tscript:x",
      "data:text/html,x",
      "https://dustinedwards.info@evil.example/login",
    ]) {
      expect(() => barChart({ data: entries, x: "year", href: () => bad, alt: "a" })).toThrow(
        /not a relative or http\(s\) link/,
      );
    }
    expect(() =>
      barChart({ data: entries, x: "year", href: (y) => `https://example.org/${y}`, alt: "a" }),
    ).not.toThrow();
  });

  it("thins category labels to at most maxXTicks, keeping the first", () => {
    const years = Array.from({ length: 20 }, (_, i) => ({ year: 2000 + i }));
    const fig = parse(barChart({ data: years, x: "year", maxXTicks: 5, alt: "a" }));
    const labels = [...fig.querySelectorAll('[data-enarratio-mark="x-axis tick label"] text')].map(
      (t) => t.textContent,
    );
    expect(labels).toEqual(["2000", "2004", "2008", "2012", "2016"]);
    expect(() => barChart({ data: years, x: "year", maxXTicks: 0, alt: "a" })).toThrow(/maxXTicks/);
  });
});
