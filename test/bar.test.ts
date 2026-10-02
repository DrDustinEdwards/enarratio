import { describe, expect, it } from "vitest";
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

  it("names the SVG, not the figure, and keeps caption and table outside role=img", () => {
    const fig = parse(
      barChart({
        data: entries,
        x: "year",
        series: "type",
        alt: "Entries by year",
        caption: "Source: CV",
      }),
    );
    expect(fig.tagName.toLowerCase()).toBe("figure");
    expect(fig.hasAttribute("aria-label")).toBe(false);
    const svg = fig.querySelector("svg");
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.getAttribute("aria-label")).toBe("Entries by year");
    expect(svg?.querySelector("figcaption, table")).toBeNull();
    expect(fig.querySelector("figcaption")?.textContent).toBe("Source: CV");
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

  it("colors series by palette slot and lists them in a legend", () => {
    const fig = parse(barChart({ data: entries, x: "year", series: "type", alt: "a" }));
    const talks = keyedMarks(fig).find((m) => m.getAttribute("data-enarratio-series") === "Talks");
    expect(talks?.getAttribute("fill")).toBe("var(--enarratio-series-2)");
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

  it("applies color overrides to the figure's slot", () => {
    const fig = parse(
      barChart({
        data: entries,
        x: "year",
        series: "type",
        colors: { Talks: { light: "#112233", dark: "#aabbcc" } },
        alt: "a",
      }),
    );
    expect(fig.getAttribute("style")).toBe("--enarratio-series-2: light-dark(#112233, #aabbcc)");
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

  it("refuses a missing alt, bad values, unknown color keys and too many series", () => {
    expect(() => barChart({ data: entries, x: "year", alt: "  " })).toThrow(/alt is required/);
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

  it("makes each bar a link for readers without script", () => {
    const fig = parse(
      barChart({
        data: entries,
        x: "year",
        series: "type",
        href: (y) => `/cv?year=${y}`,
        alt: "a",
      }),
    );
    const marks = keyedMarks(fig);
    expect(marks[0]?.tagName.toLowerCase()).toBe("a");
    expect(marks[0]?.getAttribute("href")).toBe("/cv?year=2022");
    expect(marks[0]?.querySelector("rect title")?.textContent).toBe("year 2022, Publications: 1");
  });

  it("refuses links that are not relative or http(s)", () => {
    for (const bad of ["javascript:alert(1)", " java\tscript:x", "data:text/html,x"]) {
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
