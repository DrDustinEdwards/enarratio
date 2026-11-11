/**
 * Accessibility: axe-core over every gallery page, in both themes and both color schemes, with
 * and without the enhancement layer. Any violation fails, including color contrast, which axe
 * measures on the rendered page.
 */
import { createRequire } from "node:module";
import type { Page } from "puppeteer";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Harness, startHarness } from "./harness.ts";

const axeSource = createRequire(import.meta.url).resolve("axe-core/axe.min.js");

let harness: Harness;

beforeAll(async () => {
  harness = await startHarness();
});

afterAll(async () => {
  // Undefined when the browser failed to launch: let that error, not this one, be reported.
  await harness?.close();
});

interface Violation {
  id: string;
  help: string;
  nodes: { target: string[] }[];
}

/** Axe over the page, or over only the elements `include` selects. */
async function audit(page: Page, include?: string): Promise<Violation[]> {
  await page.addScriptTag({ path: axeSource });
  return page.evaluate(async (include) => {
    const axe = (
      window as unknown as {
        axe: {
          run: (
            context: Document | object,
            options: object,
          ) => Promise<{ violations: Violation[] }>;
        };
      }
    ).axe;
    const result = await axe.run(include ? { include: [[include]] } : document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"],
      },
      // axe ships target-size (WCAG 2.2 SC 2.5.8) disabled; tags alone do not turn it on (A6).
      rules: { "target-size": { enabled: true } },
    });
    return result.violations.map((v) => ({
      id: v.id,
      help: v.help,
      nodes: v.nodes.slice(0, 5).map((n) => ({ target: n.target })),
    }));
  }, include);
}

/** Opens every disclosure but the toolbar's panels, which open over the chart one at a time. */
const openDisclosures = (page: Page): Promise<void> =>
  page.$$eval("details:not(.enarratio-controls > details)", (all) => {
    for (const d of all) d.open = true;
  });

/** Opens every toolbar panel, each over its own chart. */
const openPanels = (page: Page): Promise<void> =>
  page.$$eval(".enarratio-controls > details", (all) => {
    for (const d of all) d.open = true;
  });

describe("narrow screens", () => {
  // WCAG 1.4.10: at 320 CSS pixels the toolbar stays on one row and its open panels stay inside
  // the page, so nothing scrolls sideways.
  it.each(schemes)(
    "has no axe violations at 320 pixels with every panel open, %s",
    async (scheme) => {
      const page = await harness.open("example.html", scheme);
      await page.setViewport({ width: 320, height: 256 });
      await openDisclosures(page);
      expect(await audit(page)).toEqual([]);
      // The Range and Download panels, open together; each covers its own chart while open.
      await openPanels(page);
      expect(await audit(page, ".enarratio-panel")).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= 320)).toBe(true);
      await page.close();
    },
  );
});

const pages = ["index.html", "example.html", "astro.html"];
const schemes = ["light", "dark"] as const;

describe.each(pages)("%s", (file) => {
  it.each(schemes)("has no axe violations when enhanced, %s", async (scheme) => {
    const page = await harness.open(file, scheme);
    // Open every source block, so its contents are audited too, then every toolbar panel.
    await openDisclosures(page);
    expect(await audit(page)).toEqual([]);
    await openPanels(page);
    expect(await audit(page, ".enarratio-panel")).toEqual([]);
    await page.close();
  });

  it.each(schemes)("has no axe violations without scripts, %s", async (scheme) => {
    const page = await harness.open(file, scheme, { scripts: false });
    expect(await page.$("[data-enarratio-enhanced]")).toBeNull();
    expect(await audit(page)).toEqual([]);
    await page.close();
  });
});
