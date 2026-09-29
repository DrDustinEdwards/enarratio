import { describe, expect, it } from "vitest";
import { sparkline } from "../src/index.js";
import { parse } from "./helpers.js";

describe("sparkline", () => {
  it("describes the data when no alt is given", () => {
    const svg = parse(sparkline({ values: [2, 5, 3, 8], label: "Entries per year" }));
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-label")).toBe(
      "Entries per year: 4 values, from 2 to 8; lowest 2, highest 8.",
    );
  });

  it("prefers a given alt", () => {
    const svg = parse(sparkline({ values: [1, 2], alt: "Rising" }));
    expect(svg.getAttribute("aria-label")).toBe("Rising");
  });

  it("breaks the line at nulls instead of drawing zero", () => {
    const svg = parse(sparkline({ values: [1, 2, null, 3, 4], endDot: false }));
    const d = svg.querySelector('path[fill="none"]')?.getAttribute("d") ?? "";
    expect(d.match(/M/g)).toHaveLength(2);
    expect(svg.querySelector("circle")).toBeNull();
  });

  it("draws a flat line mid-height for constant data and a dot at the end", () => {
    const svg = parse(sparkline({ values: [4, 4, 4], height: 20 }));
    expect(svg.querySelector("circle")?.getAttribute("cy")).toBe("10");
  });

  it("shades the area when asked and applies a color override", () => {
    const svg = parse(sparkline({ values: [1, 3], area: true, color: "#123456" }));
    expect(svg.querySelectorAll("path")).toHaveLength(2);
    expect(svg.getAttribute("style")).toBe("--enarratio-series-1: #123456");
  });

  it("refuses empty or non-finite data", () => {
    expect(() => sparkline({ values: [] })).toThrow(/at least one value/);
    expect(() => sparkline({ values: [null] })).toThrow(/at least one value/);
    expect(() => sparkline({ values: [1, Number.POSITIVE_INFINITY] })).toThrow(/value 2/);
  });
});
