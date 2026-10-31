/**
 * Browser regression tests for review findings (A* and F*, from the two reviews of PR #1). Each test
 * names the finding it guards.
 */
import type { Page } from "puppeteer";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Harness, startHarness } from "./harness.ts";

let harness: Harness;

beforeAll(async () => {
  harness = await startHarness();
});

afterAll(async () => {
  // Undefined when the browser failed to launch: let that error, not this one, be reported.
  await harness?.close();
});

const eventLog = (p: Page, example: string): Promise<string> =>
  p.$eval(`[data-example="${example}"] .events`, (el) => el.textContent ?? "");

/** Clicks the center of an element with the real mouse, as a reader would. */
async function mouseClick(p: Page, selector: string): Promise<void> {
  await p.$eval(selector, (el) => el.scrollIntoView({ block: "center" }));
  const box = await p.$eval(selector, (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await p.mouse.click(box.x, box.y);
}

describe("F1: marks on continuous charts can be clicked with a real pointer", () => {
  it.each([
    ["line", '[data-example="line"] [data-enarratio-series="Travis"][data-enarratio-col="5"]'],
    ["scatter", '[data-example="scatter"] [data-enarratio-key]'],
  ])("filters the %s chart from a mouse click on a mark", async (example, selector) => {
    const p = await harness.open("index.html", "light");
    await mouseClick(p, selector);
    expect(await eventLog(p, example)).toMatch(/^enarratio:select .*"value":"[^"]+"/);
    expect(
      await p.$(`[data-example="${example}"] .enarratio-points [aria-pressed="true"]`),
    ).not.toBeNull();
    await p.close();
  });
});

describe("A4: a range can be picked without dragging", () => {
  it("sets a range from two clicks on the plot", async () => {
    const p = await harness.open("index.html", "light");
    const svg = '[data-example="line"] svg';
    await p.$eval(svg, (el) => el.scrollIntoView({ block: "center" }));
    const box = await p.$eval(svg, (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
    // Near the top of the plot, before the peak, clear of the points.
    await p.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.12);
    expect(
      await p.$eval('[data-example="line"] figure [aria-live]', (el) => el.textContent),
    ).toMatch(/Range start set/);
    await p.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.12);
    const log = await eventLog(p, "line");
    expect(log.startsWith('enarratio:brush {"chartId":"weekly-cases","range":[')).toBe(true);
    const { range } = JSON.parse(log.slice("enarratio:brush ".length)) as {
      range: [number, number];
    };
    expect(range[0]).toBeLessThan(range[1]);
    await p.close();
  });
});

describe("A5: small marks get 24 pixel targets", () => {
  it("gives every point on the line chart a pointer target at least 24 by 24 CSS pixels", async () => {
    const p = await harness.open("index.html", "light");
    const sizes = await p.$$eval('[data-example="line"] .enarratio-hit', (hits) =>
      hits.map((h) => {
        const r = h.getBoundingClientRect();
        return [r.width, r.height];
      }),
    );
    expect(sizes.length).toBeGreaterThan(40);
    for (const [w, h] of sizes) {
      expect(w).toBeGreaterThanOrEqual(23.9);
      expect(h).toBeGreaterThanOrEqual(23.9);
    }
    // A click on the target, off the point itself, still filters.
    const target = await p.$eval('[data-example="line"] .enarratio-hit', (h) => {
      h.scrollIntoView({ block: "center" });
      const r = h.getBoundingClientRect();
      return { x: r.x + 2, y: r.y + 2 };
    });
    await p.mouse.click(target.x, target.y);
    expect(await eventLog(p, "line")).toMatch(/^enarratio:select/);
    await p.close();
  });
});

describe("F6: the tooltip can be dismissed and hovered", () => {
  it("hides on Escape and stays while the pointer is over it", async () => {
    const p = await harness.open("index.html", "light");
    const mark = '[data-example="stacked-bar"] [data-enarratio-key]';
    await p.$eval(mark, (el) => el.scrollIntoView({ block: "center" }));
    const box = await p.$eval(mark, (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await p.mouse.move(box.x, box.y);
    const tip = ".enarratio-tooltip:not([hidden])";
    expect(await p.$(tip)).not.toBeNull();
    const tipBox = await p.$eval(tip, (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await p.mouse.move(tipBox.x, tipBox.y, { steps: 4 });
    await new Promise((r) => setTimeout(r, 500));
    expect(await p.$(tip)).not.toBeNull();
    await p.mouse.move(box.x, box.y);
    await p.focus('[data-example="stacked-bar"] .enarratio-points > [tabindex="0"]');
    expect(await p.$(tip)).not.toBeNull();
    await p.keyboard.press("Escape");
    expect(await p.$(tip)).toBeNull();
    await p.close();
  });
});

describe("F7: the focus ring has two tones", () => {
  it("draws a background ring inside a focus ring around the focused point, above the marks", async () => {
    const p = await harness.open("index.html", "light");
    const point = '[data-example="stacked-bar"] .enarratio-points > [tabindex="0"]';
    await p.focus(point);
    const ring = await p.$eval(point, (el) => {
      const css = getComputedStyle(el);
      return [css.outlineStyle, css.outlineColor, css.boxShadow];
    });
    expect(ring[0]).toBe("solid");
    expect(ring[2]).toMatch(/^rgb/);
    expect(ring[2]?.startsWith(ring[1] ?? "")).toBe(false);
    // The points come after the drawing, so the ring is painted over every mark (B13).
    expect(
      await p.$eval(point, (el) => el.parentElement?.previousElementSibling?.matches("svg")),
    ).toBe(true);
    await p.$eval(".cap-theme-button", (el) => (el as HTMLElement).focus());
    expect(await p.$eval(point, (el) => getComputedStyle(el).outlineStyle)).toBe("none");
    await p.close();
  });
});

describe("F9: keyboard order follows the data, in facets and when enhanced while hidden", () => {
  /** The focused point's category and series, from its label ("Assay qPCR, Manual: 64, …"). */
  const focusedPlace = (p: Page): Promise<string> =>
    p.evaluate(() => {
      const [x, series] = (document.activeElement?.getAttribute("aria-label") ?? "").split(/, |: /);
      return `${x?.split(" ").at(-1)}|${series}`;
    });

  it("steps through every category of a grouped chart and up within a group", async () => {
    const p = await harness.open("index.html", "light");
    await p.focus('[data-example="grouped-bar"] .enarratio-points > [tabindex="0"]');
    expect(await focusedPlace(p)).toBe("Plaque|Manual");
    await p.keyboard.press("ArrowRight");
    expect(await focusedPlace(p)).toBe("TCID50|Manual");
    await p.keyboard.press("ArrowRight");
    expect(await focusedPlace(p)).toBe("qPCR|Manual");
    await p.keyboard.press("ArrowUp");
    expect(await focusedPlace(p)).toBe("qPCR|Automated");
    await p.keyboard.press("ArrowUp");
    expect(await focusedPlace(p)).toBe("qPCR|Automated");
    await p.close();
  });

  it("orders a chart enhanced while display:none", async () => {
    const p = await harness.open("index.html", "light");
    await p.evaluate(async () => {
      const load = new Function("url", "return import(url)") as (url: string) => Promise<unknown>;
      const { enhance } = (await load(
        "./enhance.js",
      )) as typeof import("../../src/enhance/index.ts");
      const section = document.querySelector('[data-example="stacked-bar"]') as HTMLElement;
      enhance(section)[0]?.destroy();
      section.style.display = "none";
      enhance(section);
      section.style.display = "";
    });
    await p.focus('[data-example="stacked-bar"] .enarratio-points > [tabindex="0"]');
    expect(await focusedPlace(p)).toBe("2019|Publications");
    await p.keyboard.press("ArrowRight");
    expect(await focusedPlace(p)).toBe("2020|Publications");
    await p.keyboard.press("ArrowUp");
    expect(await focusedPlace(p)).toBe("2020|Grants");
    await p.close();
  });
});

describe("F11: update() keeps only what Enarratio emits", () => {
  it("drops handlers, scripts and foreign elements from the markup it is given", async () => {
    const p = await harness.open("index.html", "light");
    const result = await p.evaluate(async () => {
      const load = new Function("url", "return import(url)") as (url: string) => Promise<unknown>;
      const { enhance } = (await load(
        "./enhance.js",
      )) as typeof import("../../src/enhance/index.ts");
      const section = document.querySelector('[data-example="horizontal-bar"]') as HTMLElement;
      const [chart] = enhance(section);
      if (!chart) throw new Error("no chart");
      const win = window as unknown as { pwned?: number };
      chart.update(
        '<figure class="enarratio" onmouseover="window.pwned=2"><img src="data:," onerror="window.pwned=1">' +
          '<script>window.pwned=3</script><button type="submit" form="publish">x</button>' +
          '<svg role="img" aria-label="x"><a href="https://a.example/" ping="https://evil.example/p"></a>' +
          '<a href="https://trusted.example@evil.example/"></a><a href="javascript:alert(1)"><rect data-enarratio-key="k" onclick="window.pwned=4" width="10" height="10"></rect></a></svg></figure>',
      );
      await new Promise((r) => setTimeout(r, 300));
      chart.figure.dispatchEvent(new MouseEvent("mouseover"));
      chart.figure.querySelector("rect")?.dispatchEvent(new MouseEvent("click"));
      const handlers = [chart.figure, ...chart.figure.querySelectorAll("*")].flatMap((el) =>
        el.getAttributeNames().filter((n) => n.startsWith("on")),
      );
      return {
        pwned: win.pwned ?? null,
        handlers,
        img: chart.figure.querySelectorAll("img, script, button").length,
        ping: chart.figure.querySelectorAll("[ping]").length,
        hrefs: [...chart.figure.querySelectorAll("a")].map((a) => a.getAttribute("href")),
      };
    });
    expect(result).toEqual({
      pwned: null,
      handlers: [],
      img: 0,
      ping: 0,
      hrefs: ["https://a.example/", null, null],
    });
    await p.close();
  });
});

describe("F18: enhancing again with other options re-applies them", () => {
  it("turns filtering off when asked a second time", async () => {
    const p = await harness.open("index.html", "light");
    const roles = await p.evaluate(async () => {
      const load = new Function("url", "return import(url)") as (url: string) => Promise<unknown>;
      const { enhance } = (await load(
        "./enhance.js",
      )) as typeof import("../../src/enhance/index.ts");
      const section = document.querySelector('[data-example="stacked-bar"]') as HTMLElement;
      const [again] = enhance(section, { filter: false });
      return {
        mark: section.querySelector(".enarratio-points > *")?.getAttribute("role"),
        filter: again?.options.filter,
      };
    });
    expect(roles).toEqual({ mark: "img", filter: false });
    await p.close();
  });
});

describe("A13, B3: text stays readable on a narrow screen", () => {
  it("keeps tick labels at least 12 pixels at 320 CSS pixels wide, scrolling the chart instead", async () => {
    const p = await harness.open("index.html", "light");
    await p.setViewport({ width: 320, height: 800, deviceScaleFactor: 1 });
    const measures = await p.evaluate(() => {
      const text = document.querySelector(
        '[data-example="stacked-bar"] [data-enarratio-mark="x-axis tick label"] text',
      ) as SVGTextElement;
      const svg = text.ownerSVGElement as SVGSVGElement;
      const frame = document.querySelector(
        '[data-example="stacked-bar"] .enarratio-frame',
      ) as HTMLElement;
      // The font size in the drawing's units, times the drawing's scale on screen.
      const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
      return {
        fontSize: Number.parseFloat(getComputedStyle(text).fontSize) * scale,
        frameScrolls: frame.scrollWidth > frame.clientWidth,
        pageScrolls: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });
    expect(measures.fontSize).toBeGreaterThanOrEqual(12);
    expect(measures.frameScrolls).toBe(true);
    expect(measures.pageScrolls).toBe(false);
    await p.close();
  });
});
