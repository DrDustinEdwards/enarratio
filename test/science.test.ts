import { describe, expect, it } from "vitest";
import { genomeTrack, geometricSummary, titerPlot } from "../src/index.js";
import { tCritical95 } from "../src/science/stats.js";
import { keyedMarks, parse } from "./helpers.js";

describe("geometricSummary", () => {
  it("computes a geometric mean and a t-based 95% interval on the log scale", () => {
    const s = geometricSummary([10, 40, 160]);
    expect(s.mean).toBeCloseTo(40, 10);
    // log values ln10, ln40, ln160: sd = ln4, half-width = 4.303 * ln4 / sqrt(3).
    const half = (4.303 * Math.log(4)) / Math.sqrt(3);
    expect(s.lower).toBeCloseTo(40 / Math.exp(half), 6);
    expect(s.upper).toBeCloseTo(40 * Math.exp(half), 6);
  });

  it("gives no interval for one value and refuses non-positive values", () => {
    const one = geometricSummary([80]);
    expect(one.n).toBe(1);
    expect(one.mean).toBeCloseTo(80, 10);
    expect(one.lower).toBeUndefined();
    expect(() => geometricSummary([0, 1])).toThrow(/positive/);
    expect(() => geometricSummary([])).toThrow(/no values/);
  });

  it("uses published t critical values", () => {
    expect(tCritical95(1)).toBe(12.706);
    expect(tCritical95(10)).toBe(2.228);
    expect(tCritical95(30)).toBe(2.042);
    expect(tCritical95(120)).toBeCloseTo(1.98, 2);
  });
});

describe("titerPlot", () => {
  const sera = [
    { day: "D0", titer: 5 },
    { day: "D0", titer: 10 },
    { day: "D0", titer: 10 },
    { day: "D28", titer: 160 },
    { day: "D28", titer: 320 },
  ];

  it("draws below-limit samples hollow at half the limit", () => {
    const fig = parse(titerPlot({ data: sera, group: "day", titer: "titer", alt: "a" }));
    const marks = keyedMarks(fig);
    expect(marks).toHaveLength(5);
    expect(marks[0]?.getAttribute("fill")).toBe("var(--abscissa-background)");
    expect(marks[1]?.getAttribute("fill")).toBe("var(--abscissa-series-1)");
    expect(marks[0]?.querySelector("title")?.textContent).toBe(
      "day D0: below the limit of detection (<1:10)",
    );
  });

  it("spreads identical titers side by side", () => {
    const fig = parse(titerPlot({ data: sera, group: "day", titer: "titer", alt: "a" }));
    const [, b, c] = keyedMarks(fig);
    expect(b?.getAttribute("cy")).toBe(c?.getAttribute("cy"));
    expect(b?.getAttribute("cx")).not.toBe(c?.getAttribute("cx"));
  });

  it("labels the axis in dilution steps", () => {
    const fig = parse(titerPlot({ data: sera, group: "day", titer: "titer", alt: "a" }));
    const ticks = [...fig.querySelectorAll('[data-abscissa-mark="y-axis tick label"] text')].map(
      (t) => t.textContent,
    );
    expect(ticks).toEqual(["1:5", "1:10", "1:20", "1:40", "1:80", "1:160", "1:320", "1:640"]);
  });

  it("summarizes each group in the table", () => {
    const fig = parse(titerPlot({ data: sera, group: "day", titer: "titer", alt: "a" }));
    const rows = [...fig.querySelectorAll("tbody tr")].map((tr) =>
      [...tr.children].map((c) => c.textContent),
    );
    expect(rows[0]).toEqual(["D0", "3", "7.9", "2.9 to 21.5", "1", "<10, 10, 10"]);
    expect(rows[1]?.[2]).toBe("226");
  });

  it("refuses non-positive titers and a bad dilution series", () => {
    expect(() => titerPlot({ data: [{ g: "a", t: 0 }], group: "g", titer: "t", alt: "a" })).toThrow(
      /positive/,
    );
    expect(() =>
      titerPlot({
        data: sera,
        group: "day",
        titer: "titer",
        dilution: { start: 10, factor: 1 },
        alt: "a",
      }),
    ).toThrow(/factor above 1/);
  });
});

describe("genomeTrack", () => {
  const features = [
    { name: "A", start: 1, end: 400, strand: 1 as const, type: "Gene" },
    { name: "B", start: 300, end: 700, strand: -1 as const, type: "Gene" },
    { name: "C", start: 800, end: 1000, type: "Repeat" },
  ];

  it("draws features as polygons pointing along their strand", () => {
    const fig = parse(genomeTrack({ length: 1000, features, alt: "a" }));
    const marks = keyedMarks(fig);
    expect(marks.map((m) => m.tagName.toLowerCase())).toEqual(["polygon", "polygon", "polygon"]);
    const points = (m: Element | undefined): number =>
      (m?.getAttribute("points") ?? "").split(" ").length;
    expect(points(marks[0])).toBe(5);
    expect(points(marks[1])).toBe(5);
    expect(points(marks[2])).toBe(4);
    expect(marks[0]?.querySelector("title")?.textContent).toBe(
      "A (Gene): 1 to 400, 400 nt, forward strand",
    );
  });

  it("stacks overlapping features into lanes", () => {
    const fig = parse(genomeTrack({ length: 1000, features, alt: "a" }));
    const [a, b, c] = keyedMarks(fig);
    const top = (m: Element | undefined): string =>
      (m?.getAttribute("points") ?? "").split(" ")[0]?.split(",")[1] ?? "";
    expect(top(a)).not.toBe(top(b));
    expect(top(a)).toBe(top(c));
  });

  it("colors and legends by type, and tabulates coordinates", () => {
    const fig = parse(genomeTrack({ length: 1000, features, alt: "a" }));
    expect([...fig.querySelectorAll(".abscissa-legend li")].map((li) => li.textContent)).toEqual([
      "Gene",
      "Repeat",
    ]);
    const rows = [...fig.querySelectorAll("tbody tr")].map((tr) =>
      [...tr.children].map((c) => c.textContent),
    );
    expect(rows[1]).toEqual(["B", "Gene", "300", "700", "401", "-"]);
  });

  it("refuses features outside the sequence", () => {
    expect(() =>
      genomeTrack({ length: 100, features: [{ name: "X", start: 50, end: 150 }], alt: "a" }),
    ).toThrow(/from 1 to 100/);
    expect(() =>
      genomeTrack({ length: 100, features: [{ name: "X", start: 60, end: 50 }], alt: "a" }),
    ).toThrow(/start before end/);
  });
});
