/**
 * The event timeline and the heat strip: the two primitives added in 0.2. Each is checked
 * against the numbers it was given: what is drawn, hovered and listed is the same data.
 */
import { describe, expect, it } from "vitest";
import { heatStrip, type TimelineOptions, timeline } from "../src/index.js";
import { parse } from "./helpers.js";

const events: TimelineOptions["events"] = [
  {
    lane: "Agent A",
    label: "Nightly run",
    status: "ok",
    from: "2026-06-09T01:00:00Z",
    to: "2026-06-09T05:00:00Z",
  },
  {
    lane: "Agent A",
    label: "Retry",
    status: "warning",
    from: "2026-06-09T04:00:00Z",
    to: "2026-06-09T06:00:00Z",
  },
  { lane: "Agent B", label: "Timeout", status: "error", at: "2026-06-09T03:00:00Z" },
  { lane: "Agent B", label: "Heartbeat lost", status: "unknown", at: "2026-06-09T07:00:00Z" },
  { lane: "Agent C", label: "Deploy", status: "ok", at: "2026-06-09T00:00:00Z" },
];
const options = {
  events,
  label: "Agent runs",
  start: "2026-06-09T00:00:00Z",
  end: "2026-06-09T08:00:00Z",
} as const;

describe("timeline", () => {
  const root = parse(timeline(options));
  const svg = root.querySelector("svg");
  const marks = [...root.querySelectorAll('[data-enarratio-mark="event"]')];

  it("is a container holding a named drawing and a plain list", () => {
    expect(root.tagName.toLowerCase()).toBe("div");
    expect(root.getAttribute("data-enarratio")).toBe("timeline");
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.getAttribute("aria-label")).toBe(
      "Agent runs: 5 events in 3 lanes, 2026-06-09 00:00 UTC to 2026-06-09 08:00 UTC; 2 ok, 1 warning, 1 error, 1 unknown.",
    );
    expect(root.querySelectorAll("ol.enarratio-timeline-list li")).toHaveLength(5);
  });

  it("lists every event in time order with its lane, status and time", () => {
    const items = [...root.querySelectorAll("ol li")].map((li) => li.textContent);
    expect(items).toEqual([
      "Agent C: Deploy, ok, 2026-06-09 00:00 UTC",
      "Agent A: Nightly run, ok, from 2026-06-09 01:00 UTC to 2026-06-09 05:00 UTC",
      "Agent B: Timeout, error, 2026-06-09 03:00 UTC",
      "Agent A: Retry, warning, from 2026-06-09 04:00 UTC to 2026-06-09 06:00 UTC",
      "Agent B: Heartbeat lost, unknown, 2026-06-09 07:00 UTC",
    ]);
  });

  it("puts each event at its time on one linear scale", () => {
    // Point events: x is the marker's centre; hour h should sit h/8 of the way along the plot.
    const centre = (mark: Element): number => {
      const shape = mark.querySelector("circle, polygon, rect:last-child");
      if (shape?.localName === "circle") return Number(shape.getAttribute("cx"));
      if (shape?.localName === "rect") return Number(shape.getAttribute("x")) + 4.5;
      const xs = (shape?.getAttribute("points") ?? "")
        .split(" ")
        .map((p) => Number(p.split(",")[0]));
      return xs[0] as number;
    };
    const byLabel = (label: string): Element =>
      marks.find((m) => m.querySelector("title")?.textContent?.includes(label)) as Element;
    const x0 = centre(byLabel("Deploy")); // hour 0
    const x3 = centre(byLabel("Timeout")); // hour 3
    const x7 = centre(byLabel("Heartbeat lost")); // hour 7
    expect((x7 - x0) / 7).toBeCloseTo((x3 - x0) / 3, 1);
  });

  it("draws spans as bars from start to end", () => {
    const run = marks.find((m) => m.querySelector("title")?.textContent?.includes("Nightly run"));
    const bar = run?.querySelector("rect");
    const retry = marks.find((m) => m.querySelector("title")?.textContent?.includes("Retry"));
    const retryBar = retry?.querySelector("rect");
    // 4 hours and 2 hours: widths are in that ratio.
    expect(
      Number(bar?.getAttribute("width")) / Number(retryBar?.getAttribute("width")),
    ).toBeCloseTo(2, 1);
  });

  it("says status by shape as well as color", () => {
    const shape = (label: string): string => {
      const mark = marks.find((m) => m.querySelector("title")?.textContent?.includes(label));
      return [...(mark?.children ?? [])].map((c) => c.localName).at(-1) ?? "";
    };
    expect(shape("Deploy")).toBe("circle");
    expect(shape("Retry")).toBe("polygon");
    expect(shape("Timeout")).toBe("rect");
    const unknown = marks.find((m) => m.querySelector("title")?.textContent?.includes("Heartbeat"));
    expect(unknown?.querySelector("circle")?.getAttribute("stroke-dasharray")).toBeTruthy();
    // And in the theme's status colors.
    expect(marks.find((m) => m.getAttribute("data-status") === "error")?.innerHTML).toContain(
      "--enarratio-status-bad",
    );
  });

  it("stacks overlapping events in a lane instead of drawing them over each other", () => {
    const y = (label: string): number =>
      Number(
        marks
          .find((m) => m.querySelector("title")?.textContent?.includes(label))
          ?.querySelector("rect")
          ?.getAttribute("y"),
      );
    expect(y("Retry")).toBeGreaterThan(y("Nightly run"));
    // Agent B's events do not overlap: one row, so the drawing is shorter than with stacking.
    const flat = parse(
      timeline({ ...options, events: events.filter((e) => e.lane !== "Agent A") }),
    );
    expect(Number(flat.querySelector("svg")?.getAttribute("height"))).toBeLessThan(
      Number(svg?.getAttribute("height")),
    );
  });

  it("draws lanes in the order given, empty ones too", () => {
    const out = parse(
      timeline({ ...options, lanes: ["Agent C", "Agent B", "Agent A", "Agent D"] }),
    );
    const labels = [...out.querySelectorAll("svg > text[text-anchor='end']")].map(
      (t) => t.textContent,
    );
    expect(labels).toEqual(["Agent C", "Agent B", "Agent A", "Agent D"]);
  });

  it("labels the axis with ticks inside the window", () => {
    const labels = [...root.querySelectorAll("svg > text.enarratio-numeric")].map(
      (t) => t.textContent,
    );
    expect(labels.length).toBeGreaterThanOrEqual(3);
    expect(labels.length).toBeLessThanOrEqual(8);
    expect(labels[0]).toMatch(/^\d\d-\d\d$|^\d\d:\d\d$/);
  });

  it("uses calendar ticks for a long window", () => {
    const out = parse(
      timeline({
        label: "Years",
        events: [{ lane: "L", label: "x", status: "ok", at: "2020-03-01" }],
        start: "2020-01-01",
        end: "2026-01-01",
      }),
    );
    const labels = [...out.querySelectorAll("svg > text.enarratio-numeric")].map(
      (t) => t.textContent,
    );
    expect(labels).toContain("2021");
    expect(labels.length).toBeLessThanOrEqual(7);
  });

  it("defaults the window to the events, takes Dates and epoch milliseconds, and formats times", () => {
    const out = parse(
      timeline({
        label: "T",
        events: [
          { lane: "L", label: "a", status: "ok", at: new Date(Date.UTC(2026, 0, 1)) },
          { lane: "L", label: "b", status: "ok", at: Date.UTC(2026, 0, 2) },
        ],
        formatTime: (d) => d.toISOString().slice(0, 10),
      }),
    );
    expect(out.querySelector("svg")?.getAttribute("aria-label")).toBe(
      "T: 2 events in 1 lane, 2026-01-01 to 2026-01-02; 2 ok.",
    );
  });

  it("takes its own text alternative", () => {
    const out = parse(timeline({ ...options, label: undefined as never, alt: "Mine" }));
    expect(out.querySelector("svg")?.getAttribute("aria-label")).toBe("Mine");
  });

  it("clips a span that runs past the window, and keeps its real times in the list", () => {
    const out = parse(
      timeline({
        label: "T",
        start: "2026-06-09T00:00:00Z",
        end: "2026-06-09T08:00:00Z",
        events: [
          {
            lane: "L",
            label: "long",
            status: "ok",
            from: "2026-06-08T20:00:00Z",
            to: "2026-06-10T00:00:00Z",
          },
        ],
      }),
    );
    const bar = out.querySelector('[data-enarratio-mark="event"] rect');
    const width = Number(out.querySelector("svg")?.getAttribute("width"));
    expect(Number(bar?.getAttribute("x")) + Number(bar?.getAttribute("width"))).toBeLessThanOrEqual(
      width,
    );
    expect(out.querySelector("li")?.textContent).toContain("2026-06-08 20:00 UTC");
  });

  it("shortens a long lane name and keeps the whole name as hover text", () => {
    const name = "A very long agent name that cannot fit";
    const out = parse(
      timeline({
        label: "T",
        events: [
          { lane: name, label: "x", status: "ok", at: 1000 },
          { lane: "B", label: "y", status: "ok", at: 5000 },
        ],
      }),
    );
    const text = out.querySelector("svg > text[text-anchor='end']");
    expect(text?.textContent).toContain("…");
    expect(text?.querySelector("title")?.textContent).toBe(name);
  });

  it("refuses what would draw wrongly", () => {
    const bad = (e: unknown, extra: Partial<TimelineOptions> = {}) =>
      timeline({ ...options, events: [e as never], ...extra });
    expect(() => timeline({ ...options, events: [] })).toThrow(/at least one event/);
    expect(() => timeline({ events })).toThrow(/label or alt/);
    expect(() => timeline({ events, label: " " })).toThrow(/label or alt/);
    expect(() => bad({ lane: "A", label: "x", status: "ok" })).toThrow(/needs a time/);
    expect(() => bad({ lane: "A", label: "x", status: "great", at: 1 })).toThrow(/unknown status/);
    expect(() => bad({ lane: "A", label: "x", status: "constructor", at: 1 })).toThrow(
      /unknown status/,
    );
    expect(() => bad({ lane: "A", label: "", status: "ok", at: 1 })).toThrow(/needs a label/);
    expect(() => bad({ lane: "", label: "x", status: "ok", at: 1 })).toThrow(/needs a lane/);
    expect(() => bad({ lane: "A", label: "x", status: "ok", at: "tomorrow" })).toThrow(
      /not a time/,
    );
    expect(() =>
      bad({ lane: "A", label: "x", status: "ok", from: 1, to: 0 }, { start: 0, end: 5 }),
    ).toThrow(/ends before/);
    expect(() =>
      bad({ lane: "A", label: "x", status: "ok", from: 1 }, { start: 0, end: 5 }),
    ).toThrow(/both from and to/);
    expect(() =>
      bad({ lane: "A", label: "x", status: "ok", at: 1, from: 1, to: 2 }, { start: 0, end: 5 }),
    ).toThrow(/both a time/);
    expect(() =>
      bad(
        { lane: "Z", label: "x", status: "ok", at: Date.parse("2026-06-09T01:00Z") },
        { lanes: ["Agent A"] },
      ),
    ).toThrow(/lane "Z"/);
    expect(() =>
      bad({ lane: "Agent A", label: "x", status: "ok", at: Date.parse("2027-01-01") }),
    ).toThrow(/outside the time window/);
    expect(() =>
      timeline({ label: "T", events: [{ lane: "A", label: "x", status: "ok", at: 5 }] }),
    ).toThrow(/no length/);
    expect(() => timeline({ ...options, lanes: ["Agent A", "Agent A"] })).toThrow(/repeated/);
    expect(() => timeline({ ...options, width: 0 })).toThrow(/width/);
  });
});

describe("heatStrip", () => {
  const values = [3, 5, null, 9, 14, 8, 2];
  const root = parse(heatStrip({ values, label: "Requests per hour" }));
  const cells = [...root.querySelectorAll("rect")];

  it("is an svg named by a sentence made from the values", () => {
    expect(root.localName).toBe("svg");
    expect(root.getAttribute("class")).toContain("enarratio-heat-strip");
    expect(root.getAttribute("role")).toBe("img");
    expect(root.getAttribute("aria-label")).toBe(
      "Requests per hour: 7 cells, from 3 to 2; lowest 2, highest 14; 1 with no data.",
    );
  });

  it("colors each cell on the sequential ramp by its value, lowest to highest", () => {
    const fills = cells.map((c) => c.getAttribute("fill"));
    // 2..14 in five equal steps of 2.4: 3 -> 1, 5 -> 2, 9 -> 3, 14 -> 5, 8 -> 3, 2 -> 1.
    expect(fills).toEqual([
      "var(--enarratio-sequential-1)",
      "var(--enarratio-sequential-2)",
      "none",
      "var(--enarratio-sequential-3)",
      "var(--enarratio-sequential-5)",
      "var(--enarratio-sequential-3)",
      "var(--enarratio-sequential-1)",
    ]);
  });

  it("draws a missing value as a dashed outline", () => {
    expect(cells[2]?.getAttribute("stroke-dasharray")).toBe("2,2");
    expect(cells[2]?.querySelector("title")?.textContent).toBe("Cell 3: no data");
  });

  it("puts the value in each cell's hover details", () => {
    expect(cells.map((c) => c.querySelector("title")?.textContent)).toEqual([
      "Cell 1: 3",
      "Cell 2: 5",
      "Cell 3: no data",
      "Cell 4: 9",
      "Cell 5: 14",
      "Cell 6: 8",
      "Cell 7: 2",
    ]);
  });

  it("fills the width with equal cells and has no axis", () => {
    const widths = new Set(cells.map((c) => c.getAttribute("width")));
    expect(widths.size).toBeLessThanOrEqual(2);
    expect(root.querySelector("text, line")).toBeNull();
  });

  it("takes a fixed range, thresholds, cell labels and a formatter", () => {
    const out = parse(
      heatStrip({
        values: [1, 50],
        alt: "Mine",
        min: 0,
        max: 100,
        thresholds: [10, 20, 30, 40],
        cellLabels: ["Mon", "Tue"],
        formatValue: (n) => `${n}%`,
      }),
    );
    expect(out.getAttribute("aria-label")).toBe("Mine");
    expect([...out.querySelectorAll("rect")].map((c) => c.getAttribute("fill"))).toEqual([
      "var(--enarratio-sequential-1)",
      "var(--enarratio-sequential-5)",
    ]);
    expect(out.querySelector("title")?.textContent).toBe("Mon: 1%");
  });

  it("refuses what would draw wrongly", () => {
    const base = { values: [1, 2], label: "x" };
    expect(() => heatStrip({ ...base, values: [] })).toThrow(/at least one value/);
    expect(() => heatStrip({ ...base, values: [null, null] })).toThrow(/every value is empty/);
    expect(() => heatStrip({ ...base, values: [1, Number.NaN] })).toThrow(/not a finite number/);
    expect(() => heatStrip({ values: [1] })).toThrow(/label or alt/);
    expect(() => heatStrip({ ...base, width: -1 })).toThrow(/width/);
    expect(() => heatStrip({ ...base, min: 5, max: 1 })).toThrow(/above max/);
    expect(() => heatStrip({ ...base, thresholds: [1, 1, 2, 3] })).toThrow(/ascend/);
    expect(() => heatStrip({ ...base, cellLabels: ["a"] })).toThrow(/one each/);
  });

  it("copes with flat data", () => {
    const out = parse(heatStrip({ values: [4, 4, 4], label: "Flat" }));
    expect([...out.querySelectorAll("rect")].map((c) => c.getAttribute("fill"))).toEqual(
      Array(3).fill("var(--enarratio-sequential-1)"),
    );
  });
});
