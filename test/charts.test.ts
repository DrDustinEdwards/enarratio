import { describe, expect, it } from "vitest";
import { heatmap, networkChart, scatterPlot } from "../src/index.js";
import { keyedMarks, parse } from "./helpers.js";

describe("scatterPlot", () => {
  const points = [
    { id: "a", g: "one", x: 1, y: 10 },
    { id: "b", g: "one", x: 2, y: 100 },
    { id: "c", g: "two", x: 3, y: 1000 },
  ];

  it("keys every point, names it, and gives series distinct symbols", () => {
    const fig = parse(
      scatterPlot({ data: points, x: "x", y: "y", series: "g", label: "id", alt: "a" }),
    );
    const marks = keyedMarks(fig);
    expect(marks).toHaveLength(3);
    expect(marks[0]?.querySelector("title")?.textContent).toBe("a: one, x 1, y 10");
    const shapes = new Set(marks.map((m) => m.getAttribute("d") ?? m.tagName));
    expect(shapes.size).toBeGreaterThan(1);
  });

  it("does not offer a filter when there are no series", () => {
    const fig = parse(scatterPlot({ data: points, x: "x", y: "y", alt: "a" }));
    expect(keyedMarks(fig).some((m) => m.hasAttribute("data-enarratio-field"))).toBe(false);
  });

  it("draws a regression band and refuses non-positive values on a log axis", () => {
    const markup = scatterPlot({ data: points, x: "x", y: "y", regression: true, alt: "a" });
    expect(markup).toContain('data-enarratio-mark="linear-regression"');
    expect(() =>
      scatterPlot({ data: [{ x: 0, y: 1 }], x: "x", y: "y", xType: "log", alt: "a" }),
    ).toThrow(/log axis/);
  });
});

describe("heatmap", () => {
  const cells = [
    { r: "A", c: "1", v: 0 },
    { r: "A", c: "2", v: 50 },
    { r: "B", c: "1", v: 100 },
    { r: "B", c: "2", v: null },
  ];

  it("fills cells from the sequential ramp by threshold, and outlines empty cells", () => {
    const fig = parse(heatmap({ data: cells, x: "c", y: "r", value: "v", alt: "a" }));
    const fills = keyedMarks(fig).map((m) => [
      m.getAttribute("data-enarratio-key"),
      m.getAttribute("fill"),
    ]);
    expect(fills).toEqual([
      ['["1","A"]', "var(--enarratio-sequential-1)"],
      ['["2","A"]', "var(--enarratio-sequential-3)"],
      ['["1","B"]', "var(--enarratio-sequential-5)"],
    ]);
    const empty = fig.querySelector('g[stroke="var(--enarratio-status-unknown)"] rect');
    expect(empty?.querySelector("title")?.textContent).toBe("r B, c 2: no data");
    expect(empty?.parentElement?.getAttribute("stroke-dasharray")).toBe("3,2");
  });

  it("prints values in text colors chosen for their step", () => {
    const fig = parse(heatmap({ data: cells, x: "c", y: "r", value: "v", alt: "a" }));
    const text = [...fig.querySelectorAll('[data-enarratio-mark="text"] text')].map((t) =>
      t.getAttribute("fill"),
    );
    expect(text).toEqual([
      "var(--enarratio-sequential-text-1)",
      "var(--enarratio-sequential-text-3)",
      "var(--enarratio-sequential-text-5)",
    ]);
  });

  it("labels the ramp legend with its bins", () => {
    const fig = parse(
      heatmap({ data: cells, x: "c", y: "r", value: "v", thresholds: [10, 20, 30, 40], alt: "a" }),
    );
    expect([...fig.querySelectorAll(".enarratio-ramp li")].map((li) => li.textContent)).toEqual([
      "below 10",
      "10 to 20",
      "20 to 30",
      "30 to 40",
      "40 or more",
    ]);
  });

  it("refuses thresholds out of order and duplicate cells", () => {
    expect(() =>
      heatmap({ data: cells, x: "c", y: "r", value: "v", thresholds: [1, 3, 2, 4], alt: "a" }),
    ).toThrow(/ascend/);
    expect(() =>
      heatmap({ data: [cells[0], cells[0]] as typeof cells, x: "c", y: "r", value: "v", alt: "a" }),
    ).toThrow(/two rows for cell/);
  });
});

describe("networkChart", () => {
  const nodes = [
    { id: "a", group: "x" },
    { id: "b", group: "x" },
    { id: "c", group: "y", label: "Node C" },
  ];
  const links = [
    { source: "a", target: "b" },
    { source: "b", target: "c" },
  ];

  it("lays out deterministically", () => {
    expect(networkChart({ nodes, links, alt: "a" })).toBe(networkChart({ nodes, links, alt: "a" }));
  });

  it("keys nodes, filters by group, and tabulates connections", () => {
    const fig = parse(networkChart({ nodes, links, alt: "a" }));
    const marks = keyedMarks(fig);
    expect(marks.map((m) => m.getAttribute("data-enarratio-key"))).toEqual(["a", "b", "c"]);
    expect(marks[2]?.getAttribute("data-enarratio-value")).toBe("y");
    expect(marks[1]?.querySelector("title")?.textContent).toBe("b (x): 2 connections");
    const rows = [...fig.querySelectorAll("tbody tr")].map((tr) =>
      [...tr.children].map((c) => c.textContent),
    );
    expect(rows).toContainEqual(["Node C", "y", "b"]);
  });

  it("refuses duplicate ids and links to missing nodes", () => {
    expect(() =>
      networkChart({ nodes: [nodes[0], nodes[0]] as typeof nodes, links: [], alt: "a" }),
    ).toThrow(/two nodes have id "a"/);
    expect(() => networkChart({ nodes, links: [{ source: "a", target: "z" }], alt: "a" })).toThrow(
      /"z", which is not a node/,
    );
  });
});
