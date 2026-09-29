import type { Page } from "puppeteer";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Harness, startHarness } from "./harness.ts";

let harness: Harness;
let page: Page;

beforeAll(async () => {
  harness = await startHarness();
});

afterAll(async () => {
  // Undefined when the browser failed to launch: let that error, not this one, be reported.
  await harness?.close();
});

const STACKED = '[data-example="stacked-bar"]';

/** The focused mark's category and series. */
const focused = (p: Page): Promise<string> =>
  p.evaluate(() => {
    const el = document.activeElement;
    return `${el?.getAttribute("data-abscissa-x")}|${el?.getAttribute("data-abscissa-series")}`;
  });

const eventLog = (p: Page, example: string): Promise<string> =>
  p.$eval(`${example} .events`, (el) => el.textContent ?? "");

describe("enhance: stacked bar", () => {
  beforeAll(async () => {
    page = await harness.open("index.html", "light");
  });

  it("turns marks into named buttons with one tab stop", async () => {
    const marks = await page.$$eval(`${STACKED} [data-abscissa-key]`, (els) =>
      els.map((el) => [
        el.getAttribute("role"),
        el.getAttribute("tabindex"),
        el.getAttribute("aria-label"),
      ]),
    );
    expect(marks.every(([role]) => role === "button")).toBe(true);
    expect(marks.filter(([, tab]) => tab === "0")).toHaveLength(1);
    expect(marks[0]?.[2]).toBe("Year 2019, Publications: 3");
    expect(await page.$eval(`${STACKED} svg`, (svg) => svg.getAttribute("role"))).toBe("group");
    expect(await page.$(`${STACKED} [data-abscissa-key] title`)).toBeNull();
  });

  it("moves by column with left and right, and through a stack with up and down", async () => {
    // SVG elements take focus from script; Puppeteer's page.focus() accepts only HTML elements.
    await page.$eval(`${STACKED} [data-abscissa-key][tabindex="0"]`, (el) =>
      (el as SVGElement).focus(),
    );
    expect(await focused(page)).toBe("2019|Publications");
    await page.keyboard.press("ArrowUp");
    expect(await focused(page)).toBe("2019|Talks");
    await page.keyboard.press("ArrowUp");
    expect(await focused(page)).toBe("2019|Talks");
    await page.keyboard.press("ArrowRight");
    expect(await focused(page)).toBe("2020|Publications");
    await page.keyboard.press("ArrowLeft");
    expect(await focused(page)).toBe("2019|Publications");
    await page.keyboard.press("End");
    expect(await focused(page)).toBe("2024|Talks");
  });

  it("shows hover details for the focused mark", async () => {
    const tip = await page.$eval(".abscissa-tooltip:not([hidden])", (el) => el.textContent);
    expect(tip).toBe("Year 2024, Talks: 2");
  });

  it("filters with Enter, dims other series, and clears with Escape", async () => {
    await page.keyboard.press("Enter");
    expect(await eventLog(page, STACKED)).toBe(
      'abscissa:select {"chartId":"entries-by-year","field":"type","value":"Talks","x":"2024"}',
    );
    const dimmed = await page.$$eval(`${STACKED} [data-abscissa-dimmed]`, (els) =>
      els.map((el) => el.getAttribute("data-abscissa-series")),
    );
    expect(dimmed.length).toBeGreaterThan(0);
    expect(dimmed).not.toContain("Talks");
    expect(await page.$eval(`${STACKED} figure [aria-live]`, (el) => el.textContent)).toBe(
      "Filtered to Talks",
    );
    await page.keyboard.press("Escape");
    expect(await eventLog(page, STACKED)).toContain('"value":null');
    expect(await page.$(`${STACKED} [data-abscissa-dimmed]`)).toBeNull();
  });

  it("filters from the legend by pointer", async () => {
    await page.click(`${STACKED} .abscissa-legend li[data-abscissa-series="Grants"] button`);
    expect(await eventLog(page, STACKED)).toBe(
      'abscissa:select {"chartId":"entries-by-year","field":"type","value":"Grants"}',
    );
    const pressed = await page.$$eval(`${STACKED} .abscissa-legend button`, (els) =>
      els.map((el) => el.getAttribute("aria-pressed")),
    );
    expect(pressed).toEqual(["false", "true", "false"]);
  });

  it("filters by clicking a mark, and a second click clears it", async () => {
    const mark = `${STACKED} [data-abscissa-x="2021"][data-abscissa-series="Talks"]`;
    await page.click(mark);
    expect(await eventLog(page, STACKED)).toContain('"value":"Talks"');
    await page.click(mark);
    expect(await eventLog(page, STACKED)).toContain('"value":null');
  });

  it("does not animate under reduced motion", async () => {
    expect(await page.$("[data-abscissa-entering]")).toBeNull();
  });

  afterAll(async () => {
    await page.close();
  });
});

describe("enhance: update and destroy", () => {
  it("animates marks to new data under the same keys, and restores server markup on destroy", async () => {
    const p = await harness.open("index.html", "light", { reducedMotion: false });
    const result = await p.evaluate(async () => {
      // Built with Function so the test runner does not rewrite the page's own import().
      const load = new Function("url", "return import(url)") as (url: string) => Promise<unknown>;
      const { enhance } = (await load(
        "./enhance.js",
      )) as typeof import("../../src/enhance/index.ts");
      const section = document.querySelector('[data-example="horizontal-bar"]');
      if (!section) throw new Error("no example");
      // Page load already enhanced it: take the server markup back, then enhance afresh.
      enhance(section)[0]?.destroy();
      const figure = section.querySelector("figure");
      if (!figure) throw new Error("no figure");
      const server = figure.outerHTML;
      const [chart] = enhance(section);
      if (!chart) throw new Error("no chart");
      const before = figure.querySelector('[data-abscissa-x="Contact"]')?.getAttribute("width");
      const template = document.createElement("template");
      template.innerHTML = server;
      template.content.querySelector('[data-abscissa-x="Contact"]')?.setAttribute("width", "100");
      const next = template.innerHTML;
      chart.update(next);
      const during = figure.querySelector('[data-abscissa-x="Contact"]')?.getAttribute("width");
      await new Promise((r) => setTimeout(r, 700));
      const after = figure.querySelector('[data-abscissa-x="Contact"]')?.getAttribute("width");
      chart.destroy();
      return {
        before,
        during,
        after,
        role: figure.querySelector("svg")?.getAttribute("role"),
        titles: figure.querySelectorAll("[data-abscissa-key] > title").length,
      };
    });
    expect(Number(result.during)).toBeLessThan(100);
    expect(result.after).toBe("100");
    expect(result.role).toBe("img");
    expect(result.titles).toBe(5);
    expect(result.before).not.toBe("100");
    await p.close();
  });
});

describe("enhance: brush on a time axis", () => {
  const LINE = '[data-example="line"]';

  it("picks a range by dragging and reports it in data units", async () => {
    const p = await harness.open("index.html", "light");
    const box = await p.$eval(`${LINE} svg`, (svg) => {
      svg.scrollIntoView({ block: "center" });
      const r = svg.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
    await p.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2);
    await p.mouse.down();
    await p.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2, { steps: 5 });
    await p.mouse.up();
    const log = await eventLog(p, LINE);
    expect(log.startsWith('abscissa:brush {"chartId":"weekly-cases","range":[')).toBe(true);
    const detail = JSON.parse(log.slice("abscissa:brush ".length)) as {
      range: [number, number];
      time: boolean;
    };
    expect(detail.time).toBe(true);
    expect(detail.range[0]).toBeLessThan(detail.range[1]);
    expect(detail.range[0]).toBeGreaterThan(Date.UTC(2025, 9, 1));
    expect(detail.range[1]).toBeLessThan(Date.UTC(2026, 1, 1));
    expect(await p.$eval(`${LINE} .abscissa-brush`, (r) => (r as SVGElement).style.display)).toBe(
      "",
    );
    await p.close();
  });

  it("picks a range with Shift and the arrow keys, and clears it with Escape", async () => {
    const p = await harness.open("index.html", "light");
    await p.$eval(`${LINE} [data-abscissa-key][tabindex="0"]`, (el) => (el as SVGElement).focus());
    await p.keyboard.down("Shift");
    await p.keyboard.press("ArrowRight");
    await p.keyboard.press("ArrowRight");
    await p.keyboard.up("Shift");
    const detail = JSON.parse((await eventLog(p, LINE)).slice("abscissa:brush ".length)) as {
      range: [number, number];
    };
    // Two steps of one week each, from the first week plotted.
    expect(Math.round((detail.range[1] - detail.range[0]) / 86_400_000)).toBe(14);
    await p.keyboard.press("Escape");
    expect(await eventLog(p, LINE)).toBe(
      'abscissa:brush {"chartId":"weekly-cases","range":null,"time":true}',
    );
    await p.close();
  });
});

describe("enhance: selecting a year, page-set filters and links", () => {
  const YEARS = '[data-example="years"]';

  it("selects the bar's year, and fires nothing for filters the page sets itself", async () => {
    const p = await harness.open("index.html", "light");
    await p.$eval(`${YEARS} svg`, (svg) => svg.scrollIntoView({ block: "center" }));
    await p.click(`${YEARS} [data-abscissa-x="2012"][data-abscissa-series="Grants"]`);
    expect(await eventLog(p, YEARS)).toBe(
      'abscissa:select {"chartId":"entries-by-year-select","field":"year","value":"2012","x":"2012"}',
    );
    const dimmedYears = await p.$$eval(`${YEARS} [data-abscissa-dimmed]`, (els) => [
      ...new Set(els.map((el) => el.getAttribute("data-abscissa-x"))),
    ]);
    expect(dimmedYears).not.toContain("2012");

    const result = await p.evaluate(async () => {
      const load = new Function("url", "return import(url)") as (url: string) => Promise<unknown>;
      const { enhance } = (await load(
        "./enhance.js",
      )) as typeof import("../../src/enhance/index.ts");
      const section = document.querySelector('[data-example="years"]');
      if (!section) throw new Error("no example");
      // Take the server markup back, as a page re-rendering on the server would send it.
      enhance(section)[0]?.destroy();
      const server = section.querySelector("figure")?.outerHTML ?? "";
      const [chart] = enhance(section);
      if (!chart) throw new Error("no chart");
      let events = 0;
      chart.figure.addEventListener("abscissa:select", () => {
        events += 1;
      });
      chart.setFilter({ field: "year", value: "2020" });
      const pressed = chart.figure
        .querySelector('[aria-pressed="true"]')
        ?.getAttribute("data-abscissa-x");
      chart.update(server);
      const stillPressed = chart.figure
        .querySelector('[aria-pressed="true"]')
        ?.getAttribute("data-abscissa-x");
      chart.clear();
      const afterClear = chart.figure.querySelectorAll("[data-abscissa-dimmed]").length;
      return { events, pressed, stillPressed, afterClear };
    });
    expect(result).toEqual({ events: 0, pressed: "2020", stillPressed: "2020", afterClear: 0 });
    await p.close();
  });

  it("keeps bars as links without script, and turns them into filter buttons with it", async () => {
    const off = await harness.open("index.html", "light", { scripts: false });
    expect(
      await off.$eval(`${YEARS} [data-abscissa-x="2012"][data-abscissa-series="Grants"]`, (a) => [
        a.tagName,
        a.getAttribute("href"),
      ]),
    ).toEqual(["a", "?year=2012"]);
    await off.close();
    const on = await harness.open("index.html", "light");
    expect(
      await on.$eval(`${YEARS} [data-abscissa-x="2012"][data-abscissa-series="Grants"]`, (a) => [
        a.getAttribute("href"),
        a.getAttribute("data-abscissa-href"),
        a.getAttribute("role"),
      ]),
    ).toEqual([null, "?year=2012", "button"]);
    await on.close();
  });
});

describe("enhance: series filters on a year chart, and focus across update()", () => {
  const YEARS = '[data-example="years"]';

  /** Loads the enhancement module in the page and returns a fresh chart for the years example. */
  const PREPARE = `
    const load = new Function("url", "return import(url)");
    const { enhance } = await load("./enhance.js");
    const section = document.querySelector('[data-example="years"]');
    enhance(section)[0].destroy();
    window.__server = section.querySelector("figure").outerHTML;
    window.__chart = enhance(section)[0];
    window.__events = [];
    window.__chart.figure.addEventListener("abscissa:select", (e) => window.__events.push(e.detail));
  `;

  const prepare = async (p: Page): Promise<void> => {
    await p.evaluate(`(async () => { ${PREPARE} })()`);
  };

  it("shows a series filter from setFilter without dimming by year", async () => {
    const p = await harness.open("index.html", "light");
    await prepare(p);
    const result = (await p.evaluate(`(() => {
      window.__chart.setFilter({ field: "type", value: "Grants" });
      const marks = [...window.__chart.figure.querySelectorAll("[data-abscissa-key]")];
      return {
        dimmedSeries: [...new Set(marks.filter((m) => m.hasAttribute("data-abscissa-dimmed")).map((m) => m.getAttribute("data-abscissa-series")))].sort(),
        litSeries: [...new Set(marks.filter((m) => !m.hasAttribute("data-abscissa-dimmed")).map((m) => m.getAttribute("data-abscissa-series")))],
        legend: [...window.__chart.figure.querySelectorAll(".abscissa-legend button")].map((b) => b.getAttribute("aria-pressed")),
        events: window.__events.length,
      };
    })()`)) as { dimmedSeries: string[]; litSeries: string[]; legend: string[]; events: number };
    expect(result).toEqual({
      dimmedSeries: ["Publications", "Talks"],
      litSeries: ["Grants"],
      legend: ["false", "true", "false"],
      events: 0,
    });
    // A year filter still works on the same chart.
    const yearDimmed = (await p.evaluate(`(() => {
      window.__chart.setFilter({ field: "year", value: "2012" });
      return [...window.__chart.figure.querySelectorAll("[data-abscissa-key]:not([data-abscissa-dimmed])")].map((m) => m.getAttribute("data-abscissa-x"));
    })()`)) as string[];
    expect(new Set(yearDimmed)).toEqual(new Set(["2012"]));
    await p.close();
  });

  it("keeps keyboard focus and the tab stop on the same mark through update(), so Escape still works", async () => {
    const p = await harness.open("index.html", "light");
    await prepare(p);
    await p.$eval(`${YEARS} [data-abscissa-x="2012"][data-abscissa-series="Grants"]`, (el) =>
      (el as SVGElement).focus(),
    );
    await p.keyboard.press("Enter");
    await p.evaluate(`window.__chart.update(window.__server)`);
    const after = (await p.evaluate(`(() => {
      const figure = window.__chart.figure;
      return {
        focused: document.activeElement?.getAttribute("data-abscissa-key") ?? null,
        stops: [...figure.querySelectorAll('[data-abscissa-key][tabindex="0"]')].map((m) => m.getAttribute("data-abscissa-key")),
      };
    })()`)) as { focused: string | null; stops: string[] };
    const key = JSON.stringify(["2012", "Grants"]);
    expect(after).toEqual({ focused: key, stops: [key] });
    await p.keyboard.press("Escape");
    const last = (await p.evaluate("window.__events.at(-1)")) as { value: string | null };
    expect(last.value).toBeNull();
    await p.close();
  });

  it("moves focus to the same year when the focused mark is gone after update()", async () => {
    const p = await harness.open("index.html", "light");
    await prepare(p);
    await p.$eval(`${YEARS} [data-abscissa-x="2012"][data-abscissa-series="Grants"]`, (el) =>
      (el as SVGElement).focus(),
    );
    const focused = await p.evaluate(`(() => {
      const template = document.createElement("template");
      template.innerHTML = window.__server;
      const gone = template.content.querySelector('[data-abscissa-x="2012"][data-abscissa-series="Grants"]');
      if (!gone) throw new Error("mark not found");
      gone.remove();
      const next = template.innerHTML;
      window.__chart.update(next);
      const el = document.activeElement;
      return [el?.getAttribute("data-abscissa-x"), el?.getAttribute("tabindex")];
    })()`);
    expect(focused).toEqual(["2012", "0"]);
    await p.close();
  });
});
