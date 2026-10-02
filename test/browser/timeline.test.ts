/**
 * The timeline's narrow-screen fallback: with room it is a drawing, and its plain list is read
 * only by screen readers; under 30rem of room the list replaces the drawing. Needs a real layout
 * engine, so it lives with the browser tests.
 */
import type { Page } from "puppeteer";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Harness, startHarness } from "./harness.ts";

let harness: Harness;

beforeAll(async () => {
  harness = await startHarness();
});

afterAll(async () => {
  await harness?.close();
});

/** Whether the drawing and the list take up space, and the list's size. */
async function visible(
  page: Page,
): Promise<{ drawing: boolean; list: boolean; listHeight: number }> {
  return page.evaluate(() => {
    const root = document.querySelector("#timeline .enarratio-timeline");
    const svg = root?.querySelector("svg");
    const list = root?.querySelector("ol");
    const box = (el: Element | null | undefined): DOMRect | undefined =>
      el?.getBoundingClientRect();
    return {
      drawing: (box(svg)?.width ?? 0) > 2 && getComputedStyle(svg as Element).display !== "none",
      list: (box(list)?.width ?? 0) > 2,
      listHeight: box(list)?.height ?? 0,
    };
  });
}

describe("timeline fallback", () => {
  it("shows the drawing, and hides the list from sight, when there is room", async () => {
    const page = await harness.open("index.html", "light", { scripts: false });
    await page.setViewport({ width: 900, height: 900 });
    expect(await visible(page)).toMatchObject({ drawing: true, list: false });
    await page.close();
  });

  it("shows the list in place of the drawing on a narrow screen", async () => {
    const page = await harness.open("index.html", "light", { scripts: false });
    await page.setViewport({ width: 360, height: 800 });
    const state = await visible(page);
    expect(state).toMatchObject({ drawing: false, list: true });
    expect(state.listHeight).toBeGreaterThan(100);
    const items = await page.$$eval("#timeline .enarratio-timeline li", (els) =>
      els.map((el) => el.textContent ?? ""),
    );
    expect(items).toHaveLength(8);
    expect(items[0]).toContain("Ingest agent");
    await page.close();
  });

  it("keeps the list in the accessibility tree beside the drawing", async () => {
    const page = await harness.open("index.html", "light", { scripts: false });
    const hidden = await page.$eval("#timeline .enarratio-timeline-list", (el) => {
      const style = getComputedStyle(el);
      return style.display === "none" || style.visibility === "hidden";
    });
    expect(hidden).toBe(false);
    await page.close();
  });
});
