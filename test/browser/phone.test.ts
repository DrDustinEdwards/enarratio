/**
 * Record 0041 for the six newest charts: each is drawn on a 360 px phone, in both color schemes,
 * with every piece of text inside its drawing, readable, and clear of the other text. Needs a
 * real layout engine, so it lives with the browser tests.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Harness, startHarness } from "./harness.ts";

const CHARTS = ["gantt", "candlestick", "calendar", "streamgraph", "violin", "ridgeline"] as const;

let harness: Harness;

beforeAll(async () => {
  harness = await startHarness();
});

afterAll(async () => {
  await harness?.close();
});

describe.each(["light", "dark"] as const)("phone drawings, %s", (scheme) => {
  it.each(CHARTS)("%s fits 360 px", async (id) => {
    const page = await harness.open("example.html", scheme, { lazy: true });
    await page.setViewport({ width: 360, height: 800, deviceScaleFactor: 1 });
    await page.$eval(`#${id}`, (el) => el.scrollIntoView());
    await new Promise((done) => setTimeout(done, 300));
    const found = await page.$eval(`[data-example="${id}"]`, (section) => {
      const problems: string[] = [];
      const svgs = [...section.querySelectorAll<SVGSVGElement>(".enarratio-frame svg")].filter(
        (svg) => svg.getBoundingClientRect().width > 2,
      );
      if (svgs.length !== 1) problems.push(`${svgs.length} drawings show, not 1`);
      const svg = svgs[0];
      if (svg) {
        const box = svg.getBoundingClientRect();
        const view = svg.viewBox.baseVal;
        const scale = box.width / view.width;
        if (document.documentElement.scrollWidth > 360) problems.push("the page scrolls sideways");
        if (box.right > 360.5 || box.left < -0.5) problems.push("the drawing leaves the screen");
        const texts = [...svg.querySelectorAll<SVGTextElement>("text")].filter(
          (t) => (t.textContent ?? "").trim() !== "" && t.getBoundingClientRect().width > 0,
        );
        if (texts.length < 3) problems.push(`only ${texts.length} texts drawn`);
        if (view.width > 300) problems.push(`the wide drawing shows (${view.width} units)`);
        const rects = texts.map((t) => t.getBoundingClientRect());
        texts.forEach((t, i) => {
          const r = rects[i] as DOMRect;
          const label = (t.textContent ?? "").trim().slice(0, 24);
          const size = Number.parseFloat(getComputedStyle(t).fontSize) * scale;
          if (size < 11.95) problems.push(`"${label}" draws at ${size.toFixed(1)} px`);
          if (r.left < box.left - 0.5 || r.right > box.right + 0.5)
            problems.push(`"${label}" runs past the drawing's sides`);
          if (r.top < box.top - 0.5 || r.bottom > box.bottom + 0.5)
            problems.push(`"${label}" runs past the drawing's top or bottom`);
          for (let j = i + 1; j < texts.length; j++) {
            const o = rects[j] as DOMRect;
            const across = Math.min(r.right, o.right) - Math.max(r.left, o.left);
            const down = Math.min(r.bottom, o.bottom) - Math.max(r.top, o.top);
            // Boxes touch by a pixel or two where lines meet; a real overlap is more.
            if (across > 2 && down > 3)
              problems.push(
                `"${label}" overlaps "${(texts[j]?.textContent ?? "").trim().slice(0, 24)}"`,
              );
          }
        });
      }
      return problems;
    });
    await page.close();
    expect(found).toEqual([]);
  });
});
