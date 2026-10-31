/**
 * The light charts in a real browser: `enarratio/lite`, bundled for the browser and minified as
 * an app would ship it, draws in Chrome the same markup it draws on the server, and that markup
 * looks the same, pixel for pixel, as the Plot chart drawn on the server from the same options.
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import type { Page } from "puppeteer";
import { rolldown } from "rolldown";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Harness, startHarness } from "./harness.ts";

const root = resolve(import.meta.dirname, "..", "..");

const entries = [2019, 2020, 2021, 2022].flatMap((year, i) =>
  ["Publications", "Talks", "Grants"].flatMap((type, t) =>
    Array.from({ length: ((i + 2) * (t + 1)) % 5 }, () => ({ year, type })),
  ),
);
const weekly = ["Travis", "Hays"].flatMap((county, k) =>
  Array.from({ length: 12 }, (_, week) => ({
    week: new Date(Date.UTC(2025, 9, 6 + week * 7)).toISOString(),
    county,
    cases:
      county === "Hays" && week === 5 ? null : 20 + k * 15 + Math.round(30 * Math.sin(week / 2)),
  })),
);
const days = Array.from({ length: 20 }, (_, i) => ({
  day: new Date(Date.UTC(2026, 1, 3 + i)).toISOString().slice(0, 10),
  visits: 120 + i * 3,
  lower: i > 14 ? 120 + i * 3 - (i - 14) * 4 : null,
  upper: i > 14 ? 120 + i * 3 + (i - 14) * 4 : null,
}));

/** Each case: the chart, and options that survive the trip into the page as JSON. */
const cases = [
  [
    "stacked bars with direct labels",
    "barChart",
    { data: entries, x: "year", series: "type", directLabels: true, alt: "Entries per year" },
  ],
  [
    "grouped horizontal bars",
    "barChart",
    {
      data: entries,
      x: "type",
      series: "year",
      layout: "grouped",
      orientation: "horizontal",
      alt: "Entries by type",
    },
  ],
  [
    "lines with a gap, a reference and a marker",
    "lineChart",
    {
      data: weekly,
      x: "week",
      y: "cases",
      series: "county",
      references: [{ y: 60, label: "Alert threshold" }],
      markers: [{ x: "2025-11-24", label: "Holiday" }],
      directLabels: true,
      alt: "Weekly cases",
    },
  ],
  [
    "a forecast with its band",
    "lineChart",
    {
      data: days,
      x: "day",
      y: "visits",
      band: { lower: "lower", upper: "upper", label: "95% interval" },
      forecastFrom: "2026-02-17",
      alt: "Daily visits",
    },
  ],
  [
    "stacked areas",
    "areaChart",
    {
      data: weekly.map((w) => ({ ...w, cases: Math.abs(w.cases ?? 0) })),
      x: "week",
      y: "cases",
      series: "county",
      alt: "Cases",
    },
  ],
] as const;

type Kind = (typeof cases)[number][1];
type Charts = Record<Kind, (options: unknown) => string>;

/** A built entry, loaded at run time: the browser suite runs after `npm run build`. */
const built = async (path: string): Promise<Charts> =>
  (await import(pathToFileURL(resolve(root, "dist", path)).href)) as Charts;

let harness: Harness;
let page: Page;
let liteServer: Charts;
let plot: Charts;

beforeAll(async () => {
  liteServer = await built("lite/index.js");
  plot = await built("plot/index.js");
  const bundle = await rolldown({
    input: resolve(root, "dist", "lite", "index.js"),
    platform: "browser",
    logLevel: "silent",
  });
  const { output } = await bundle.generate({ format: "iife", name: "EnarratioLite", minify: true });
  await bundle.close();
  harness = await startHarness();
  page = await harness.open("index.html", "light", { scripts: false });
  // Tall enough that both figures, with their text, fit without scrolling under the pinned header.
  await page.setViewport({ width: 800, height: 3000, deviceScaleFactor: 1 });
  await page.addScriptTag({
    content: output.map((chunk) => ("code" in chunk ? chunk.code : "")).join("\n"),
  });
});

afterAll(async () => {
  await page?.close();
  await harness?.close();
});

describe("enarratio/lite in the browser", () => {
  it.each(cases)("draws %s as on the server, and as Plot draws it", async (_, kind, options) => {
    const inBrowser = await page.evaluate(
      (k, o) =>
        (
          window as unknown as { EnarratioLite: Record<string, (o: unknown) => string> }
        ).EnarratioLite[k]?.(o) ?? "",
      kind,
      options as unknown as Record<string, unknown>,
    );
    expect(inBrowser).toBe(liteServer[kind](options));

    const drawnByPlot = plot[kind](options);
    await page.evaluate(
      (a, b) => {
        const main = document.querySelector("main") as HTMLElement;
        main.innerHTML = `<div id="light">${a}</div><div id="plot">${b}</div>`;
      },
      inBrowser,
      drawnByPlot,
    );
    const shot = async (id: string): Promise<PNG> => {
      const svg = await page.$(`#${id} svg`);
      if (!svg) throw new Error(`no chart drawn in #${id}`);
      return PNG.sync.read(Buffer.from(await svg.screenshot({ type: "png" })));
    };
    const light = await shot("light");
    const drawn = await shot("plot");
    expect([light.width, light.height]).toEqual([drawn.width, drawn.height]);
    const changed = pixelmatch(light.data, drawn.data, undefined, light.width, light.height, {
      threshold: 0.1,
    });
    expect(changed).toBe(0);
  });
});
