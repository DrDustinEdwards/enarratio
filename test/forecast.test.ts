/**
 * lineChart's forecast options: `band` (lower and upper fields drawn as a shaded area) and
 * `forecastFrom` (the line dashed after an x). The caller computes the forecast; these tests
 * check that what is drawn, what is hovered and what the data table says are the same numbers.
 */
import { describe, expect, it } from "vitest";
import { lineChart } from "../src/plot/index.js";
import { keyedMarks, parse } from "./helpers.js";

const days = [
  { day: "2026-03-01", cases: 10, lo: null, hi: null },
  { day: "2026-03-02", cases: 14, lo: null, hi: null },
  { day: "2026-03-03", cases: 18, lo: null, hi: null },
  { day: "2026-03-04", cases: 22, lo: 17, hi: 27 },
  { day: "2026-03-05", cases: 26, lo: 19, hi: 34 },
  { day: "2026-03-06", cases: 30, lo: 20, hi: 42 },
];

const base = {
  data: days,
  x: "day",
  y: "cases",
  alt: "Cases per day, forecast from 3 March",
} as const;
const band = { lower: "lo", upper: "hi", label: "95% interval" } as const;

const tableRows = (fig: Element): string[][] =>
  [...fig.querySelectorAll("tbody tr")].map((tr) =>
    [...tr.children].map((c) => c.textContent ?? ""),
  );

describe("lineChart band", () => {
  const fig = parse(lineChart({ ...base, band, forecastFrom: "2026-03-03" }));

  it("draws one shaded area behind the line", () => {
    const area = fig.querySelector('[data-enarratio-mark="area"]');
    expect(area).not.toBeNull();
    expect(area?.querySelectorAll("path")).toHaveLength(1);
    const marks = [...fig.querySelectorAll("svg > g")].map((g) =>
      g.getAttribute("data-enarratio-mark"),
    );
    expect(marks.indexOf("area")).toBeLessThan(marks.indexOf("line"));
  });

  it("draws the band at the lower and upper values, on the same scale as the points", () => {
    // y pixels are linear in value; read the mapping off two points, then check the band's edges.
    const dots = keyedMarks(fig).map((m) => ({
      value: Number(/: (\d+)/.exec(m.querySelector("title")?.textContent ?? "")?.[1]),
      cy: Number(m.getAttribute("cy")),
    }));
    const [a, b] = [dots[0], dots[5]] as [(typeof dots)[number], (typeof dots)[number]];
    const slope = (b.cy - a.cy) / (b.value - a.value);
    const yOf = (v: number): number => a.cy + (v - a.value) * slope;
    const d = fig.querySelector('[data-enarratio-mark="area"] path')?.getAttribute("d") ?? "";
    const ys = [...d.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map((m) => Number(m[2]));
    for (const row of days.filter((r) => r.lo !== null && r.hi !== null)) {
      for (const v of [row.lo as number, row.hi as number]) {
        expect(
          ys.some((y) => Math.abs(y - yOf(v)) < 0.05),
          `${row.day} ${v}`,
        ).toBe(true);
      }
    }
    // No area where the rows have no band: 3 rows, 2 edges each.
    expect(ys).toHaveLength(6);
  });

  it("carries the bounds in the data table, as columns, with forecast rows marked", () => {
    const head = [...fig.querySelectorAll("thead th")].map((th) => th.textContent);
    expect(head).toEqual([
      "day",
      "cases",
      "95% interval, lower",
      "95% interval, upper",
      "Forecast",
    ]);
    expect(tableRows(fig)).toEqual(
      days.map((r, i) => [
        r.day,
        String(r.cases),
        r.lo === null ? "" : String(r.lo),
        r.hi === null ? "" : String(r.hi),
        i > 2 ? "Yes" : "",
      ]),
    );
  });

  it("says the same in the hover details as in the table", () => {
    const titles = keyedMarks(fig).map((m) => m.querySelector("title")?.textContent);
    expect(titles[3]).toBe("day 2026-03-04: 22 (forecast; 95% interval 17 to 27)");
    expect(titles[2]).toBe("day 2026-03-03: 18");
  });

  it("names bound columns per series", () => {
    const multi = days.flatMap((r) => [
      { ...r, county: "A" },
      { ...r, county: "B", cases: r.cases + 1, lo: r.lo === null ? null : r.lo + 1, hi: r.hi },
    ]);
    const out = parse(
      lineChart({ ...base, data: multi, series: "county", band: { lower: "lo", upper: "hi" } }),
    );
    expect([...out.querySelectorAll("thead th")].map((th) => th.textContent)).toEqual([
      "day",
      "A",
      "B",
      "A lower bound",
      "A upper bound",
      "B lower bound",
      "B upper bound",
    ]);
    expect(out.querySelectorAll('[data-enarratio-mark="area"] path')).toHaveLength(2);
  });

  it("names bound columns without a label", () => {
    const out = parse(lineChart({ ...base, band: { lower: "lo", upper: "hi" } }));
    expect([...out.querySelectorAll("thead th")].map((th) => th.textContent)).toEqual([
      "day",
      "cases",
      "Lower bound",
      "Upper bound",
    ]);
  });

  it("refuses a band that would draw wrongly", () => {
    const oneSided = days.map((r, i) => (i === 4 ? { ...r, hi: null } : r));
    expect(() => lineChart({ ...base, data: oneSided, band })).toThrow(/only one of the band's/);
    const flipped = days.map((r, i) => (i === 4 ? { ...r, lo: 40 } : r));
    expect(() => lineChart({ ...base, data: flipped, band })).toThrow(/lower bound 40 is above/);
    const bad = days.map((r, i) => (i === 4 ? { ...r, lo: Number.NaN } : r));
    expect(() => lineChart({ ...base, data: bad, band })).toThrow(/finite number/);
    const zero = days.map((r, i) => (i === 3 ? { ...r, lo: 0 } : r));
    expect(() => lineChart({ ...base, data: zero, band, yType: "log" })).toThrow(
      /log axis cannot show/,
    );
  });

  it("leaves a chart without options exactly as it was", () => {
    const plain = lineChart({ ...base });
    expect(plain).not.toContain('stroke-dasharray="6,4"');
    expect(plain).not.toContain('data-enarratio-mark="area"');
  });
});

describe("lineChart forecastFrom", () => {
  const fig = parse(lineChart({ ...base, forecastFrom: "2026-03-03" }));
  // Plot puts the dash pattern on the mark's group, with one path per series inside it.
  const lines = [...fig.querySelectorAll('[data-enarratio-mark="line"]')];

  it("draws a solid line up to the boundary and a dashed one from it, joined", () => {
    expect(lines).toHaveLength(2);
    const [solid, dashed] = lines as [Element, Element];
    expect(solid.getAttribute("stroke-dasharray")).toBeNull();
    expect(dashed.getAttribute("stroke-dasharray")).toBe("6,4");
    const points = (el: Element): string[] =>
      (el.querySelector("path")?.getAttribute("d") ?? "").match(
        /-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/g,
      ) ?? [];
    expect(points(solid)).toHaveLength(3);
    // The dashed stretch starts at the solid line's last point.
    expect(points(dashed)).toHaveLength(4);
    expect(points(dashed)[0]).toBe(points(solid)[2]);
  });

  it("draws forecast points hollow and observed ones filled", () => {
    const dots = keyedMarks(fig);
    expect(dots[0]?.getAttribute("fill-opacity")).toBe("1");
    expect(dots[3]?.getAttribute("fill-opacity")).toBe("0");
    expect(dots[3]?.getAttribute("stroke")).toMatch(/--enarratio-series-1/);
  });

  it("labels the boundary and marks forecast rows in the table", () => {
    expect(fig.textContent).toContain("Forecast");
    expect(tableRows(fig).map((r) => r[2])).toEqual(["", "", "", "Yes", "Yes", "Yes"]);
    expect(keyedMarks(fig)[4]?.querySelector("title")?.textContent).toBe(
      "day 2026-03-05: 26 (forecast)",
    );
  });

  it("takes a custom label, and a Date or number for the boundary", () => {
    const labelled = lineChart({ ...base, forecastFrom: "2026-03-03", forecastLabel: "Projected" });
    expect(labelled).toContain("Projected");
    const asDate = lineChart({ ...base, forecastFrom: new Date(Date.UTC(2026, 2, 3)) });
    expect(asDate).toBe(lineChart({ ...base, forecastFrom: "2026-03-03" }));
    const linear = parse(
      lineChart({
        data: [1, 2, 3, 4].map((t) => ({ t, v: t * 2 })),
        x: "t",
        y: "v",
        forecastFrom: 2,
        alt: "a",
      }),
    );
    expect(tableRows(linear).map((r) => r.at(-1))).toEqual(["", "", "Yes", "Yes"]);
  });

  it("keeps each series joined when a series has no point at the boundary", () => {
    const rows = [
      { t: 1, s: "A", v: 1 },
      { t: 2, s: "A", v: 2 },
      { t: 4, s: "A", v: 4 },
      { t: 1, s: "B", v: 3 },
      { t: 3, s: "B", v: 3 },
      { t: 4, s: "B", v: 5 },
    ];
    const out = parse(
      lineChart({ data: rows, x: "t", y: "v", series: "s", forecastFrom: 3, alt: "a" }),
    );
    const dashed = [
      ...(out
        .querySelector('[data-enarratio-mark="line"][stroke-dasharray]')
        ?.querySelectorAll("path") ?? []),
    ];
    // Series A has no point at 3, so its dashes start from its point at 2.
    const counts = dashed.map((p) => (p.getAttribute("d") ?? "").match(/,/g)?.length);
    expect(counts.sort()).toEqual([2, 2]);
  });

  it("refuses a boundary with nothing on one side", () => {
    expect(() => lineChart({ ...base, forecastFrom: "2026-03-06" })).toThrow(/forecastFrom/);
    expect(() => lineChart({ ...base, forecastFrom: "2026-02-01" })).toThrow(/forecastFrom/);
    expect(() => lineChart({ ...base, forecastFrom: "soon" })).toThrow(/not a date/);
  });

  it("works with a band and a log axis", () => {
    const fig2 = parse(
      lineChart({ ...base, band, forecastFrom: "2026-03-03", yType: "log", zero: false }),
    );
    expect(fig2.querySelectorAll('[data-enarratio-mark="area"] path')).toHaveLength(1);
  });
});
