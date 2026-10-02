/**
 * Companion functions: every primitive offers its numbers as a table and a summary sentence,
 * computed from the same values as the drawing. Each test reads the drawing back and compares it
 * with the table, so the two cannot drift apart.
 */
import { describe, expect, it } from "vitest";
import {
  heatStrip,
  heatStripTable,
  progressRing,
  progressRingTable,
  sparkline,
  sparklineTable,
  timeline,
  timelineTable,
  uptimeStrip,
  uptimeStripTable,
} from "../src/index.js";
import { parse } from "./helpers.js";

const cells = (table: { rows: readonly (readonly string[])[] }, col: number): string[] =>
  table.rows.map((r) => r[col] ?? "");

describe("sparklineTable", () => {
  const options = { values: [3, 8, null, 5, 11], label: "Entries per year", height: 40 };
  const { summary, table, markup } = sparklineTable(options);

  it("states the values the sparkline's text alternative states", () => {
    expect(summary).toBe("Entries per year: 5 values, from 3 to 11; lowest 3, highest 11.");
    expect(parse(sparkline(options)).getAttribute("aria-label")).toBe(summary);
  });

  it("tabulates every position, with no data for a gap", () => {
    expect(table.columns).toEqual(["Position", "Entries per year"]);
    expect(table.rows).toEqual([
      ["1", "3"],
      ["2", "8"],
      ["3", "no data"],
      ["4", "5"],
      ["5", "11"],
    ]);
  });

  it("matches the drawn line: its heights read back as the tabulated values", () => {
    const d =
      parse(sparkline(options)).querySelector("path:not([fill-opacity])")?.getAttribute("d") ?? "";
    const ys = [...d.matchAll(/[ML]([\d.]+),([\d.]+)/g)].map((m) => Number(m[2]));
    // The drawing maps min..max onto height-2.5..2.5 (an inset of 2.5), so invert it.
    const read = ys.map((y) => 3 + ((40 - 2.5 - y) * (11 - 3)) / (40 - 5));
    const present = [3, 8, 5, 11];
    expect(read).toHaveLength(present.length);
    for (const [i, v] of read.entries()) expect(v).toBeCloseTo(present[i] as number, 1);
    expect(cells(table, 1).filter((c) => c !== "no data")).toEqual(present.map(String));
  });

  it("formats with formatValue and gives markup that follows the figure's convention", () => {
    const out = sparklineTable({ values: [1, 2], label: "x", formatValue: (n) => `${n}%` });
    expect(cells(out.table, 1)).toEqual(["1%", "2%"]);
    const root = parse(markup);
    expect(root.localName).toBe("details");
    expect(root.querySelector("caption")?.textContent).toBe("Data for: Entries per year");
    expect(root.querySelectorAll("tbody tr")).toHaveLength(5);
    const hidden = parse(sparklineTable(options, { dataTable: "visually-hidden" }).markup);
    expect(hidden.localName).toBe("div");
    expect(hidden.getAttribute("class")).toContain("enarratio-visually-hidden");
  });

  it("keeps the generated summary when alt is given, and validates like the sparkline", () => {
    expect(sparklineTable({ values: [1], alt: "Mine" }).summary).toBe(
      "1 values, from 1 to 1; lowest 1, highest 1.",
    );
    expect(() => sparklineTable({ values: [] })).toThrow(/at least one value/);
    expect(() => sparklineTable({ values: [1], width: -1 })).toThrow(/width/);
  });
});

describe("uptimeStripTable", () => {
  const slots = [
    "up",
    "up",
    { status: "degraded", label: "Mon 14:00, slow" },
    "down",
    "unknown",
  ] as const;
  const options = { slots, label: "API, last 5 hours" };
  const { summary, table } = uptimeStripTable(options);

  it("states the counts and availability the strip's text alternative states", () => {
    expect(summary).toBe(
      "API, last 5 hours: 5 periods, 2 up, 1 degraded, 1 down, 1 no data; 75% available.",
    );
    expect(parse(uptimeStrip(options)).getAttribute("aria-label")).toBe(summary);
  });

  it("tabulates each period with its status, named as in the hover details", () => {
    expect(table.rows).toEqual([
      ["Period 1", "up"],
      ["Period 2", "up"],
      ["Mon 14:00, slow", "degraded"],
      ["Period 4", "down"],
      ["Period 5", "no data"],
    ]);
    const titles = [...parse(uptimeStrip(options)).querySelectorAll("rect title")].map(
      (t) => t.textContent,
    );
    expect(titles).toEqual(table.rows.map((r) => `${r[0]}: ${r[1]}`));
  });

  it("uses the given alt as the summary when there is no label", () => {
    expect(uptimeStripTable({ slots: ["up"], alt: "Mine" }).summary).toBe("Mine");
    expect(() => uptimeStripTable({ slots: [] })).toThrow(/at least one slot/);
    expect(() => uptimeStripTable({ slots: ["constructor" as never], label: "x" })).toThrow(
      /unknown status/,
    );
  });
});

describe("progressRingTable", () => {
  const options = { value: 7, max: 12, label: "Chapters drafted" };
  const { summary, table } = progressRingTable(options);

  it("states the value, total and percentage the ring's text alternative states", () => {
    expect(summary).toBe("Chapters drafted: 7 of 12 (58%)");
    expect(parse(progressRing(options)).getAttribute("aria-label")).toBe(summary);
  });

  it("tabulates the numbers the ring draws", () => {
    expect(table.columns).toEqual(["Measure", "Value", "Total", "Percent"]);
    expect(table.rows).toEqual([["Chapters drafted", "7", "12", "58%"]]);
    const root = parse(progressRing({ ...options, size: 100, thickness: 10 }));
    const arc = root.querySelectorAll("circle")[1]?.getAttribute("stroke-dasharray") ?? "";
    const [filled, whole] = arc.split(" ").map(Number) as [number, number];
    expect(Math.round((filled / whole) * 100)).toBe(58);
    expect(root.querySelector("text")?.textContent).toBe(table.rows[0]?.[3]);
  });

  it("says when the value passes the total, and handles a ring named only by alt", () => {
    expect(progressRingTable({ value: 1.2, label: "Tests" }).summary).toBe(
      "Tests: 120%, more than the total",
    );
    expect(progressRingTable({ value: 1, alt: "Mine" }).summary).toBe("Mine");
    expect(() => progressRingTable({ value: -1, label: "x" })).toThrow(/zero or more/);
  });
});

describe("heatStripTable", () => {
  const options = {
    values: [3, 5, null, 9, 14],
    label: "Requests per hour",
    cellLabels: ["a", "b", "c", "d", "e"],
  };
  const { summary, table } = heatStripTable(options);

  it("states what the strip's text alternative states", () => {
    expect(summary).toBe(
      "Requests per hour: 5 cells, from 3 to 14; lowest 3, highest 14; 1 with no data.",
    );
    expect(parse(heatStrip(options)).getAttribute("aria-label")).toBe(summary);
  });

  it("tabulates each cell's value and ramp step, as drawn", () => {
    expect(table.columns).toEqual(["Cell", "Value", "Ramp step"]);
    expect(table.rows).toEqual([
      ["a", "3", "1"],
      ["b", "5", "1"],
      ["c", "no data", ""],
      ["d", "9", "3"],
      ["e", "14", "5"],
    ]);
    const drawn = [...parse(heatStrip(options)).querySelectorAll("rect")];
    drawn.forEach((cell, i) => {
      const step = table.rows[i]?.[2];
      expect(cell.getAttribute("fill")).toBe(step ? `var(--enarratio-sequential-${step})` : "none");
      expect(cell.querySelector("title")?.textContent).toBe(
        `${table.rows[i]?.[0]}: ${table.rows[i]?.[1]}`,
      );
    });
  });
});

describe("timelineTable", () => {
  const options = {
    label: "Agent runs",
    start: "2026-06-09T00:00:00Z",
    end: "2026-06-09T08:00:00Z",
    events: [
      { lane: "B", label: "Timeout", status: "error", at: "2026-06-09T03:00:00Z" },
      {
        lane: "A",
        label: "Run",
        status: "ok",
        from: "2026-06-09T01:00:00Z",
        to: "2026-06-09T02:00:00Z",
      },
    ],
  } as const;
  const { summary, table } = timelineTable(options);

  it("states what the timeline's text alternative states", () => {
    expect(summary).toBe(
      "Agent runs: 2 events in 2 lanes, 2026-06-09 00:00 UTC to 2026-06-09 08:00 UTC; 1 ok, 1 error.",
    );
    expect(parse(timeline(options)).querySelector("svg")?.getAttribute("aria-label")).toBe(summary);
  });

  it("tabulates every event in time order, the end blank for a point", () => {
    expect(table.columns).toEqual(["Event", "Lane", "Status", "Start", "End"]);
    expect(table.rows).toEqual([
      ["Run", "A", "ok", "2026-06-09 01:00 UTC", "2026-06-09 02:00 UTC"],
      ["Timeout", "B", "error", "2026-06-09 03:00 UTC", ""],
    ]);
  });

  it("agrees with the drawing's plain list and hover text", () => {
    const root = parse(timeline(options));
    const list = [...root.querySelectorAll("li")].map((li) => li.textContent);
    expect(list).toHaveLength(table.rows.length);
    table.rows.forEach((row, i) => {
      expect(list[i]).toContain(row[0]);
      expect(list[i]).toContain(row[1]);
      expect(list[i]).toContain(row[2]);
      expect(list[i]).toContain(row[3]);
    });
    const titles = [...root.querySelectorAll('[data-enarratio-mark="event"] title')].map(
      (t) => t.textContent,
    );
    expect(titles.sort()).toEqual(
      table.rows
        .map((r) => `${r[1]}: ${r[0]}, ${r[2]}, ${r[4] ? `from ${r[3]} to ${r[4]}` : r[3]}`)
        .sort(),
    );
  });

  it("validates like the timeline", () => {
    expect(() => timelineTable({ ...options, events: [] })).toThrow(/at least one event/);
    expect(() => timelineTable({ events: options.events })).toThrow(/label or alt/);
  });
});
