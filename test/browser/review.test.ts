/**
 * Browser regression tests for review findings (Fable 5.1: A*, Claude Opus 5.5: F*). Each test
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

/** Clicks the centre of an element with the real mouse, as a reader would. */
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
    expect(await p.$eval(selector, (el) => el.getAttribute("aria-pressed"))).toBe("true");
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
    await p.$eval(mark, (el) => (el as SVGElement).focus());
    expect(await p.$(tip)).not.toBeNull();
    await p.keyboard.press("Escape");
    expect(await p.$(tip)).toBeNull();
    await p.close();
  });
});

describe("F7: the focus ring has two tones", () => {
  it("draws a background ring inside a focus ring around the focused mark", async () => {
    const p = await harness.open("index.html", "light");
    await p.$eval('[data-example="stacked-bar"] [data-enarratio-key]', (el) =>
      (el as SVGElement).focus(),
    );
    const strokes = await p.$$eval(
      '[data-example="stacked-bar"] .enarratio-focus-ring rect',
      (rects) => rects.map((r) => getComputedStyle(r).stroke),
    );
    const colors = await p.evaluate(() => {
      const figure = document.querySelector('[data-example="stacked-bar"] figure') as Element;
      const css = getComputedStyle(figure);
      return [
        css.getPropertyValue("--enarratio-background"),
        css.getPropertyValue("--enarratio-focus"),
      ];
    });
    expect(strokes).toHaveLength(2);
    expect(strokes[0]).not.toBe(strokes[1]);
    expect(colors.every((c) => c.trim() !== "")).toBe(true);
    await p.$eval("button.scheme", (el) => (el as HTMLElement).focus());
    expect(await p.$('[data-example="stacked-bar"] .enarratio-focus-ring')).toBeNull();
    await p.close();
  });
});

describe("F9: keyboard order follows the data, in facets and when enhanced while hidden", () => {
  const focusedPlace = (p: Page): Promise<string> =>
    p.evaluate(
      () =>
        `${document.activeElement?.getAttribute("data-enarratio-x")}|${document.activeElement?.getAttribute("data-enarratio-series")}`,
    );

  it("steps through every category of a grouped chart and up within a group", async () => {
    const p = await harness.open("index.html", "light");
    await p.$eval('[data-example="grouped-bar"] [data-enarratio-key][tabindex="0"]', (el) =>
      (el as SVGElement).focus(),
    );
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
    await p.$eval('[data-example="stacked-bar"] [data-enarratio-key][tabindex="0"]', (el) =>
      (el as SVGElement).focus(),
    );
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
          '<script>window.pwned=3</script><svg role="img" aria-label="x"><a href="javascript:alert(1)"><rect data-enarratio-key="k" onclick="window.pwned=4" width="10" height="10"></rect></a></svg></figure>',
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
        img: chart.figure.querySelectorAll("img, script").length,
        href: chart.figure.querySelector("a")?.getAttribute("href") ?? null,
      };
    });
    expect(result).toEqual({ pwned: null, handlers: [], img: 0, href: null });
    await p.close();
  });
});

describe("F17: the scheme button reports the scheme shown", () => {
  it("starts pressed when the system is dark, and one click shows light", async () => {
    const p = await harness.open("index.html", "dark");
    // The harness pins data-scheme; clear it so the page follows the system, as it does for readers.
    await p.evaluate(() => {
      delete document.documentElement.dataset["scheme"];
    });
    // The page loaded before the harness set a scheme, so the button shows the system's.
    const load = await p.$eval("button.scheme", (b) => b.getAttribute("aria-pressed"));
    expect(load).toBe("true");
    await p.click("button.scheme");
    expect(await p.evaluate(() => document.documentElement.dataset["scheme"])).toBe("light");
    expect(await p.$eval("button.scheme", (b) => b.getAttribute("aria-pressed"))).toBe("false");
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
        mark: section.querySelector("[data-enarratio-key]")?.getAttribute("role"),
        filter: again?.options.filter,
      };
    });
    expect(roles).toEqual({ mark: "img", filter: false });
    await p.close();
  });
});

describe("A13: text stays readable on a narrow screen", () => {
  it("keeps tick labels at least 9 pixels tall at 320 CSS pixels wide, scrolling the chart instead", async () => {
    const p = await harness.open("index.html", "light");
    await p.setViewport({ width: 320, height: 800, deviceScaleFactor: 1 });
    const measures = await p.evaluate(() => {
      const text = document.querySelector(
        '[data-example="stacked-bar"] [data-enarratio-mark="x-axis tick label"] text',
      );
      const frame = document.querySelector(
        '[data-example="stacked-bar"] .enarratio-frame',
      ) as HTMLElement;
      return {
        textHeight: text?.getBoundingClientRect().height ?? 0,
        frameScrolls: frame.scrollWidth > frame.clientWidth,
        pageScrolls: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });
    expect(measures.textHeight).toBeGreaterThanOrEqual(9);
    expect(measures.frameScrolls).toBe(true);
    expect(measures.pageScrolls).toBe(false);
    await p.close();
  });
});
