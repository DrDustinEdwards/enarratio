/**
 * `enarratio/redraw` in a real browser: a line chart drawn on the server 640 wide, in a 320 px
 * column, is drawn again at the column's width and enhanced, and drawn again when the column
 * widens.
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Page } from "puppeteer";
import { rolldown } from "rolldown";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Harness, startHarness } from "./harness.ts";

const root = resolve(import.meta.dirname, "..", "..");
const options = {
  data: [2019, 2020, 2021, 2022].flatMap((year, i) => [
    { year, site: "A", n: 10 + i },
    { year, site: "B", n: 8 + i * 2 },
  ]),
  x: "year",
  y: "n",
  series: "site",
  alt: "Both grew.",
  title: "Samples",
};

let harness: Harness;
let page: Page;

beforeAll(async () => {
  const lite = await import(pathToFileURL(resolve(root, "dist", "lite", "index.js")).href);
  const redraw = await import(pathToFileURL(resolve(root, "dist", "redraw", "index.js")).href);
  const bundle = await rolldown({
    input: resolve(root, "dist", "redraw", "index.js"),
    platform: "browser",
    logLevel: "silent",
  });
  const { output } = await bundle.generate({ format: "iife", name: "EnarratioRedraw" });
  await bundle.close();
  harness = await startHarness();
  page = await harness.open("index.html", "light", { scripts: false });
  const chart = lite.lineChart(options);
  const attribute = redraw.redrawAttribute({ chart: "line", options });
  await page.evaluate((html) => {
    (document.querySelector("main") as HTMLElement).innerHTML = html;
  }, `<div id="column" style="width:320px"><div id="host" ${attribute}>${chart}</div></div>`);
  await page.addScriptTag({
    content: output.map((chunk) => ("code" in chunk ? chunk.code : "")).join("\n"),
  });
});

afterAll(async () => {
  await page?.close();
  await harness?.close();
});

describe("enarratio/redraw", () => {
  it("draws a server chart again at its column's width, enhanced, and follows the column", async () => {
    const width = (): Promise<string | null> =>
      page.$eval("#host svg", (svg) => svg.getAttribute("width"));
    expect(await width()).toBe("640");
    await page.evaluate(() =>
      (
        window as unknown as { EnarratioRedraw: { redrawCharts(): unknown[] } }
      ).EnarratioRedraw.redrawCharts(),
    );
    expect(Number(await width())).toBeLessThanOrEqual(320);
    expect(await page.$("#host [role='application']")).not.toBeNull();
    await page.evaluate(() => {
      (document.querySelector("#column") as HTMLElement).style.width = "460px";
    });
    await page.waitForFunction(() => {
      const w = Number(document.querySelector("#host svg")?.getAttribute("width"));
      return w > 320;
    });
  });
});
