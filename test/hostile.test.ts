/**
 * F12: hostile data through every public function that returns markup. Each payload goes into
 * every caller-supplied string (data values, labels, titles, captions, alt, ids, formatter
 * output), the result is parsed as HTML through a DOM, and the parse must contain no element or
 * attribute the caller's text could have created.
 */
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import {
  escapeHtml,
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
import { areaChart, barChart, heatmap, lineChart, scatterPlot } from "../src/plot/index.js";
import { genomeTrack, networkChart, titerPlot } from "../src/science/index.js";

const PAYLOADS = [
  "<script>window.pwned=1</script>",
  '"><img src=x onerror="window.pwned=1">',
  "'><svg onload='window.pwned=1'>",
  "</svg></figure><script>window.pwned=1</script>",
  "&lt;b&gt; & \" '",
];

/** Elements Enarratio itself emits; anything else in the parse came from the payload. */
const EMITTED = new Set([
  "div",
  "figure",
  "p",
  "ul",
  "ol",
  "strong",
  "li",
  "span",
  "figcaption",
  "details",
  "summary",
  "table",
  "caption",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "svg",
  "g",
  "rect",
  "circle",
  "path",
  "line",
  "text",
  "title",
  "polygon",
  "a",
  "tspan",
]);

function assertInert(markup: string, payload: string): void {
  const { document } = parseHTML(`<!doctype html><html><body>${markup}</body></html>`);
  for (const el of document.body.querySelectorAll("*")) {
    expect(EMITTED.has(el.localName.toLowerCase()), `unexpected <${el.localName}>`).toBe(true);
    for (const name of el.getAttributeNames()) {
      expect(name.toLowerCase().startsWith("on"), `handler attribute ${name}`).toBe(false);
    }
  }
  // The text survives as text: escaping must not lose or alter it.
  expect(document.body.textContent).toContain(payload);
}

type Render = (p: string) => string;

const RENDERERS: Record<string, Render> = {
  barChart: (p) =>
    barChart({
      data: [
        { x: p, s: p, v: 1 },
        { x: "b", s: "t", v: 2 },
      ],
      x: "x",
      y: "v",
      series: "s",
      title: p,
      caption: p,
      alt: p,
      id: p,
      xLabel: p,
      yLabel: p,
      formatValue: (n) => `${p}${n}`,
      href: () => "/safe",
      directLabels: true,
    }),
  lineChart: (p) =>
    lineChart({
      data: [
        { t: 1, s: p, v: 1 },
        { t: 2, s: p, v: 2 },
      ],
      x: "t",
      y: "v",
      series: "s",
      references: [{ y: 1.5, label: p }],
      markers: [{ x: 1.5, label: p }],
      directLabels: true,
      title: p,
      caption: p,
      alt: p,
      formatX: (v) => `${p}${String(v)}`,
    }),
  "lineChart forecast": (p) =>
    lineChart({
      data: [
        { t: 1, s: p, v: 1, lo: 0.5, hi: 1.5 },
        { t: 2, s: p, v: 2, lo: 1, hi: 3 },
        { t: 3, s: p, v: 3, lo: 2, hi: 4 },
      ],
      x: "t",
      y: "v",
      series: "s",
      band: { lower: "lo", upper: "hi", label: p },
      forecastFrom: 1,
      forecastLabel: p,
      title: p,
      alt: p,
    }),
  "barChart time axis": (p) =>
    barChart({
      data: [
        { t: "2026-01-01", s: p },
        { t: "2026-01-03", s: p },
      ],
      x: "t",
      xType: "time",
      series: "s",
      formatX: (d) => `${p}${d.toISOString().slice(0, 10)}`,
      xLabel: p,
      title: p,
      alt: p,
    }),
  timeline: (p) =>
    timeline({
      label: p,
      lanes: [p, "b"],
      formatTime: (d) => `${p}${d.getUTCHours()}`,
      events: [
        { lane: p, label: p, status: "ok", at: 1000 },
        { lane: "b", label: p, status: "error", from: 500, to: 3000 },
      ],
    }),
  heatStrip: (p) =>
    heatStrip({
      values: [1, 2, null],
      label: p,
      cellLabels: [p, p, p],
      formatValue: (n) => `${p}${n}`,
    }),
  "companion tables": (p) =>
    [
      sparklineTable({ values: [1, 2], label: p, formatValue: (n) => `${p}${n}` }),
      uptimeStripTable({ slots: [{ status: "up", label: p }], label: p }),
      progressRingTable({ value: 1, label: p }),
      heatStripTable({ values: [1, null], label: p, cellLabels: [p, p] }),
      timelineTable({
        label: p,
        events: [{ lane: p, label: p, status: "ok", from: 0, to: 5 }],
        formatTime: () => p,
      }),
    ]
      .map((c) => `${c.markup}<p>${escapeHtml(c.summary)}</p>`)
      .join(""),
  areaChart: (p) =>
    areaChart({
      data: [
        { t: 1, s: p, v: 1 },
        { t: 2, s: p, v: 2 },
      ],
      x: "t",
      y: "v",
      series: "s",
      title: p,
      alt: p,
    }),
  scatterPlot: (p) =>
    scatterPlot({
      data: [
        { a: 1, b: 2, n: p, s: p },
        { a: 2, b: 3, n: "q", s: "r" },
      ],
      x: "a",
      y: "b",
      label: "n",
      series: "s",
      alt: p,
      title: p,
    }),
  heatmap: (p) =>
    heatmap({
      data: [
        { x: p, y: p, v: 1 },
        { x: "b", y: "c", v: 2 },
      ],
      x: "x",
      y: "y",
      value: "v",
      valueLabel: p,
      alt: p,
      caption: p,
    }),
  networkChart: (p) =>
    networkChart({
      nodes: [
        { id: p, label: p, group: p },
        { id: "b", group: "g" },
      ],
      links: [{ source: p, target: "b" }],
      alt: p,
      title: p,
    }),
  titerPlot: (p) =>
    titerPlot({
      data: [
        { g: p, t: 40 },
        { g: "b", t: 80 },
      ],
      group: "g",
      titer: "t",
      groupLabel: p,
      titerLabel: p,
      alt: p,
    }),
  genomeTrack: (p) =>
    genomeTrack({
      length: 1000,
      features: [{ name: p, start: 1, end: 900, strand: 1, type: p, track: p }],
      alt: p,
      title: p,
    }),
  sparkline: (p) => sparkline({ values: [1, 2, 3], label: p }),
  progressRing: (p) => progressRing({ value: 0.5, label: p }),
  uptimeStrip: (p) => uptimeStrip({ slots: [{ status: "up", label: p }], label: p }),
};

describe("F12: hostile data cannot create markup", () => {
  for (const [name, render] of Object.entries(RENDERERS)) {
    it.each(PAYLOADS)(`${name} keeps %s as text`, (payload) => {
      assertInert(render(payload), payload);
    });
  }
});
