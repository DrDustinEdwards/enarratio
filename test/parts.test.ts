import { describe, expect, it } from "vitest";
import { readLinks, sankeyLayout } from "../src/render/flow.js";
import { checkBands, shade } from "../src/plot/gauge.js";
import { niceCeil } from "../src/plot/radar.js";
import { buildHierarchy, hierarchyTable, squarify } from "../src/render/hierarchy.js";

describe("squarify", () => {
  // The worked example of Bruls, Huizing and van Wijk (2000): seven values in a 6 by 4 rectangle.
  const values = [6, 6, 4, 3, 2, 2, 1];
  const rects = squarify(values, { x: 0, y: 0, width: 6, height: 4 });

  it("gives each value its share of the area, inside the rectangle, with no overlap", () => {
    rects.forEach((r, i) => {
      expect(r.width * r.height).toBeCloseTo(values[i] as number, 6);
      expect(r.x).toBeGreaterThanOrEqual(-1e-9);
      expect(r.y).toBeGreaterThanOrEqual(-1e-9);
      expect(r.x + r.width).toBeLessThanOrEqual(6 + 1e-9);
      expect(r.y + r.height).toBeLessThanOrEqual(4 + 1e-9);
    });
    for (const [i, a] of rects.entries()) {
      for (const b of rects.slice(i + 1)) {
        const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        expect(w > 1e-9 && h > 1e-9).toBe(false);
      }
    }
  });

  it("matches the paper's layout: the two 6s side by side in a column, then 4 and 3", () => {
    expect(rects[0]).toMatchObject({ x: 0, y: 0, width: 3, height: 2 });
    expect(rects[1]).toMatchObject({ x: 0, y: 2, width: 3, height: 2 });
    const worst = Math.max(...rects.map((r) => Math.max(r.width / r.height, r.height / r.width)));
    expect(worst).toBeLessThan(3);
  });
});

describe("hierarchyTable", () => {
  it("lists each leaf, then its group's subtotal, then the whole", () => {
    const tops = buildHierarchy(
      "test",
      [
        { g: "A", item: "a1", v: 3 },
        { g: "A", item: "a2", v: 1 },
        { g: "B", item: "b1", v: 4 },
      ],
      ["g", "item"],
      "v",
    );
    const table = hierarchyTable(tops, ["g", "item", "v", "Share"], String, String, "Total");
    expect(table.rows).toEqual([
      ["A", "a1", "3", "0.375"],
      ["A", "a2", "1", "0.125"],
      ["A", "Total", "4", "0.5"],
      ["B", "b1", "4", "0.5"],
      ["B", "Total", "4", "0.5"],
      ["Total", "", "8", "1"],
    ]);
  });
});

describe("sankeyLayout", () => {
  const rows = [
    { s: "a", t: "b", v: 6 },
    { s: "a", t: "c", v: 4 },
    { s: "b", t: "d", v: 6 },
    { s: "c", t: "d", v: 2 },
  ];

  it("puts nodes in columns by longest path and keeps bands within their nodes", () => {
    const { links, names } = readLinks("test", rows, "s", "t", "v");
    const { nodes, columns } = sankeyLayout("test", names, links, 100, 10);
    expect(columns).toBe(3);
    const byName = Object.fromEntries(nodes.map((n) => [n.name, n]));
    expect(byName["d"]?.column).toBe(2);
    // c sends 2 of the 4 it receives: its height is the larger, 4.
    expect(byName["c"]?.value).toBe(4);
    for (const n of nodes) {
      expect(n.y0).toBeGreaterThanOrEqual(-1e-9);
      expect(n.y1).toBeLessThanOrEqual(100 + 1e-9);
    }
  });

  it("refuses a cycle", () => {
    const { links, names } = readLinks("test", [...rows, { s: "d", t: "a", v: 1 }], "s", "t", "v");
    expect(() => sankeyLayout("test", names, links, 100, 10)).toThrow(/cycle/);
  });
});

describe("niceCeil and qualitative bands", () => {
  it("rounds a scale's end up to 1, 2, 2.5 or 5 times a power of ten", () => {
    expect([0.7, 3, 22, 99, 100, 101, 240].map(niceCeil)).toEqual([1, 5, 25, 100, 100, 200, 250]);
  });

  it("shades the worst band darkest, either way round", () => {
    expect([0, 1, 2].map((i) => shade(i, 3))).toEqual([3, 2, 1]);
    expect([0, 1, 2].map((i) => shade(i, 3, true))).toEqual([1, 2, 3]);
  });

  it("refuses bands that do not ascend to the scale's end", () => {
    const bands = [
      { to: 50, label: "low" },
      { to: 40, label: "high" },
    ];
    expect(() => checkBands("test", bands, 0, 100)).toThrow(/ascend/);
    expect(() =>
      checkBands(
        "test",
        [
          { to: 50, label: "a" },
          { to: 90, label: "b" },
        ],
        0,
        100,
      ),
    ).toThrow(/scale's end/);
  });
});
