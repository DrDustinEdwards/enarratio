/**
 * barChart on a time axis (`xType: "time"`): one bar slot for every interval from the first row
 * to the last, labelled for the caller, so a run per day needs no pre-formatted labels.
 */
import { describe, expect, it } from "vitest";
import { barChart } from "../src/plot/index.js";
import { keyedMarks, parse } from "./helpers.js";

const runs = [
  { at: "2026-01-05T08:00:00Z", site: "A", ok: 1 },
  { at: "2026-01-05T17:30:00Z", site: "A", ok: 1 },
  { at: "2026-01-05T09:00:00Z", site: "B", ok: 1 },
  { at: "2026-01-08T10:00:00Z", site: "A", ok: 1 },
];
const base = { data: runs, x: "at", xType: "time", alt: "Runs per day" } as const;

const rows = (fig: Element): string[][] =>
  [...fig.querySelectorAll("tbody tr")].map((tr) =>
    [...tr.children].map((c) => c.textContent ?? ""),
  );

describe("barChart time axis", () => {
  it("gives every day from the first to the last a slot, empty ones too", () => {
    const fig = parse(barChart(base));
    expect(rows(fig)).toEqual([
      ["2026-01-05", "3"],
      ["2026-01-06", "0"],
      ["2026-01-07", "0"],
      ["2026-01-08", "1"],
    ]);
  });

  it("counts rows as bars: the drawn values are the tabulated ones", () => {
    const fig = parse(barChart(base));
    const drawn = keyedMarks(fig).map((m) => m.querySelector("title")?.textContent);
    expect(drawn).toEqual(["at 2026-01-05: 3", "at 2026-01-08: 1"]);
  });

  it("stacks series, summing a value field", () => {
    const fig = parse(barChart({ ...base, series: "site", y: "ok" }));
    expect(rows(fig)).toEqual([
      ["2026-01-05", "2", "1"],
      ["2026-01-06", "", ""],
      ["2026-01-07", "", ""],
      ["2026-01-08", "1", ""],
    ]);
    expect(keyedMarks(fig)).toHaveLength(3);
  });

  it("groups series on a time axis", () => {
    const fig = parse(barChart({ ...base, series: "site", layout: "grouped" }));
    expect(rows(fig)).toHaveLength(4);
    expect(keyedMarks(fig)).toHaveLength(3);
  });

  it("draws horizontal bars on a time axis", () => {
    const fig = parse(barChart({ ...base, orientation: "horizontal" }));
    expect(fig.getAttribute("data-enarratio-orientation")).toBe("horizontal");
    expect(rows(fig)).toHaveLength(4);
  });

  it("takes Dates, epoch milliseconds and calendar dates", () => {
    const asDates = barChart({ ...base, data: runs.map((r) => ({ ...r, at: new Date(r.at) })) });
    const asNumbers = barChart({
      ...base,
      data: runs.map((r) => ({ ...r, at: Date.parse(r.at) })),
    });
    expect(asDates).toBe(barChart(base));
    expect(asNumbers).toBe(barChart(base));
    const local = barChart({
      ...base,
      data: [new Date(2026, 0, 5), new Date(2026, 0, 6)].map((at) => ({ at })),
    });
    expect([...parse(local).querySelectorAll("tbody th")].map((t) => t.textContent)).toEqual([
      "2026-01-05",
      "2026-01-06",
    ]);
  });

  it("buckets by hour, week, month and year", () => {
    const labels = (interval: "hour" | "week" | "month" | "year", data: { at: string }[]) =>
      [...parse(barChart({ ...base, interval, data })).querySelectorAll("tbody th")].map(
        (t) => t.textContent,
      );
    expect(
      labels("hour", [{ at: "2026-01-05T08:10:00Z" }, { at: "2026-01-05T10:59:00Z" }]),
    ).toEqual(["2026-01-05 08:00 UTC", "2026-01-05 09:00 UTC", "2026-01-05 10:00 UTC"]);
    // 2026-01-05 is a Monday; a Sunday belongs to the week before.
    expect(
      labels("week", [{ at: "2026-01-04T12:00:00Z" }, { at: "2026-01-13T00:00:00Z" }]),
    ).toEqual(["2025-12-29", "2026-01-05", "2026-01-12"]);
    expect(
      labels("month", [{ at: "2025-11-30T23:59:59Z" }, { at: "2026-02-01T00:00:00Z" }]),
    ).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(
      labels("year", [{ at: "2024-06-01T00:00:00Z" }, { at: "2026-01-01T00:00:00Z" }]),
    ).toEqual(["2024", "2025", "2026"]);
  });

  it("sums rows that share an interval", () => {
    const fig = parse(
      barChart({
        data: [
          { at: "2026-01-05", n: 2 },
          { at: "2026-01-20", n: 3 },
        ],
        x: "at",
        y: "n",
        xType: "time",
        interval: "month",
        alt: "a",
      }),
    );
    expect(rows(fig)).toEqual([["2026-01", "5"]]);
  });

  it("formats labels with formatX, and refuses labels that collide", () => {
    const fig = parse(
      barChart({
        ...base,
        formatX: (d) =>
          d.toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short" }),
      }),
    );
    expect(rows(fig)[0]?.[0]).toBe("5 Jan");
    expect(() => barChart({ ...base, formatX: () => "same" })).toThrow(/same label/);
  });

  it("thins the printed labels to fit, and keeps every bar", () => {
    const long = Array.from({ length: 60 }, (_, i) => ({ at: Date.UTC(2026, 0, 1 + i) }));
    const fig = parse(barChart({ ...base, data: long }));
    const ticks = fig.querySelectorAll('[data-enarratio-mark="x-axis tick label"] text');
    expect(ticks.length).toBeGreaterThan(1);
    expect(ticks.length).toBeLessThan(15);
    expect(rows(fig)).toHaveLength(60);
    const all = parse(barChart({ ...base, data: long, maxXTicks: 60 }));
    expect(all.querySelectorAll('[data-enarratio-mark="x-axis tick label"] text')).toHaveLength(60);
  });

  it("filters by the interval's label once enhanced", () => {
    const mark = keyedMarks(parse(barChart(base)))[0];
    expect(mark?.getAttribute("data-enarratio-field")).toBe("at");
    expect(mark?.getAttribute("data-enarratio-value")).toBe("2026-01-05");
  });

  it("refuses what would draw wrongly", () => {
    expect(() => barChart({ ...base, data: [{ at: "later" }] })).toThrow(/not a date/);
    expect(() => barChart({ ...base, xDomain: ["2026-01-05"] })).toThrow(/xDomain/);
    expect(() =>
      barChart({ ...base, data: [{ at: 0 }, { at: Date.UTC(2026, 0, 1) }], interval: "hour" }),
    ).toThrow(/more than 2000 bars/);
    expect(() => barChart({ data: runs, x: "at", interval: "day", alt: "a" })).toThrow(
      /belong to xType "time"/,
    );
  });

  it("leaves category charts exactly as they were", () => {
    const a = barChart({ data: [{ k: "a" }, { k: "b" }], x: "k", alt: "a" });
    const b = barChart({ data: [{ k: "a" }, { k: "b" }], x: "k", xType: "category", alt: "a" });
    expect(b).toBe(a);
  });
});
