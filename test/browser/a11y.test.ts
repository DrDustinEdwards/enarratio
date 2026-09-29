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

async function audit(page: Page): Promise<Violation[]> {
  await page.addScriptTag({ path: axeSource });
  return page.evaluate(async () => {
    const axe = (
      window as unknown as {
        axe: { run: (context: Document, options: object) => Promise<{ violations: Violation[] }> };
      }
    ).axe;
    const result = await axe.run(document, {
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
  });
}

const pages = ["index.html", "dustinedwards.html"];
const schemes = ["light", "dark"] as const;

describe.each(pages)("%s", (file) => {
  it.each(schemes)("has no axe violations when enhanced, %s", async (scheme) => {
    const page = await harness.open(file, scheme);
    // Open every data table and source block, so their contents are audited too.
    await page.$$eval("details", (all) => {
      for (const d of all) d.open = true;
    });
    expect(await audit(page)).toEqual([]);
    await page.close();
  });

  it.each(schemes)("has no axe violations without scripts, %s", async (scheme) => {
    const page = await harness.open(file, scheme, { scripts: false });
    expect(await page.$("[data-enarratio-enhanced]")).toBeNull();
    expect(await audit(page)).toEqual([]);
    await page.close();
  });
});
