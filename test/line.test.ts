import { describe, expect, it } from "vitest";
import { areaChart, lineChart } from "../src/index.js";
import { keyedMarks, parse } from "./helpers.js";

const weekly = [
  { week: "2025-01-06", county: "Travis", cases: 10 },
  { week: "2025-01-13", county: "Travis", cases: null },
  { week: "2025-01-20", county: "Travis", cases: 14 },
  { week: "2025-01-06", county: "Hays", cases: 4 },
  { week: "2025-01-13", county: "Hays", cases: 6 },
  { week: "2025-01-20", county: "Hays", cases: 5 },
];

describe("lineChart", () => {
  it("keys one point per present value, and skips gaps", () => {
    const fig = parse(
      lineChart({ data: weekly, x: "week", y: "cases", series: "county", alt: "a" }),
    );
    const keys = keyedMarks(fig).map((m) => m.getAttribute("data-enarratio-key"));
    expect(keys).toHaveLength(5);
    expect(keys).not.toContain(JSON.stringify([Date.UTC(2025, 0, 13), "Travis"]));
    expect(keyedMarks(fig)[0]?.querySelector("title")?.textContent).toBe(
      "Travis, week 2025-01-06: 10",
    );
  });

  it("breaks the line at a gap instead of drawing zero", () => {
    const fig = parse(
      lineChart({
        data: weekly.filter((r) => r.county === "Travis"),
        x: "week",
        y: "cases",
        alt: "a",
      }),
    );
    const d = fig.querySelector('[data-enarratio-mark="line"] path')?.getAttribute("d") ?? "";
    expect(d.match(/M/g)?.length).toBe(2);
  });

  it("describes a time x scale for the brush", () => {
    const fig = parse(
      lineChart({ data: weekly, x: "week", y: "cases", series: "county", alt: "a" }),
    );
    const scale = JSON.parse(fig.getAttribute("data-enarratio-x-scale") ?? "{}");
    expect(scale.type).toBe("utc");
    expect(scale.domain).toEqual([Date.UTC(2025, 0, 6), Date.UTC(2025, 0, 20)]);
  });

  it("tabulates every x with a blank for a gap", () => {
    const fig = parse(
      lineChart({ data: weekly, x: "week", y: "cases", series: "county", alt: "a" }),
    );
    const rows = [...fig.querySelectorAll("tbody tr")].map((tr) =>
      [...tr.children].map((c) => c.textContent),
    );
    expect(rows).toEqual([
      ["2025-01-06", "10", "4"],
      ["2025-01-13", "", "6"],
      ["2025-01-20", "14", "5"],
    ]);
  });

  it("draws labelled reference lines and markers, and direct labels", () => {
    const markup = lineChart({
      data: weekly,
      x: "week",
      y: "cases",
      series: "county",
      references: [{ y: 12, label: "Threshold" }],
      markers: [{ x: "2025-01-13", label: "Holiday" }],
      directLabels: true,
      alt: "a",
    });
    expect(markup).toContain(">Threshold<");
    expect(markup).toContain(">Holiday<");
    expect(markup).toContain(">Hays<");
  });

  it("uses a linear x for numbers and supports a log y", () => {
    const fig = parse(
      lineChart({
        data: [
          { dose: 1, response: 10 },
          { dose: 2, response: 1000 },
        ],
        x: "dose",
        y: "response",
        yType: "log",
        alt: "a",
      }),
    );
    expect(JSON.parse(fig.getAttribute("data-enarratio-x-scale") ?? "{}").type).toBe("linear");
  });

  it("refuses duplicate points and bad dates", () => {
    expect(() =>
      lineChart({ data: [weekly[0], weekly[0]] as typeof weekly, x: "week", y: "cases", alt: "a" }),
    ).toThrow(/two rows for x 2025-01-06/);
    expect(() =>
      lineChart({ data: [{ t: "not a date", v: 1 }], x: "t", y: "v", alt: "a" }),
    ).toThrow(/not a date/);
    expect(() => lineChart({ data: [], x: "week", y: "cases", alt: "a" } as never)).toThrow(
      /empty/,
    );
  });
});

describe("areaChart", () => {
  it("stacks series and keys each present value; a gap has no point (F5)", () => {
    const fig = parse(
      areaChart({ data: weekly, x: "week", y: "cases", series: "county", alt: "a" }),
    );
    expect(keyedMarks(fig)).toHaveLength(5);
    expect(fig.querySelector('[data-enarratio-mark="area"]')?.children).toHaveLength(2);
  });

  it("refuses negative values, which cannot stack", () => {
    expect(() => areaChart({ data: [{ t: 1, v: -1 }], x: "t", y: "v", alt: "a" })).toThrow(
      /zero or more/,
    );
  });
});
