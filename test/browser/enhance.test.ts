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
const POINTS = ".enarratio-points > *";

/** The focused point's label, without its place in the series. */
const focused = (p: Page): Promise<string> =>
  p.evaluate(
    () => document.activeElement?.getAttribute("aria-label")?.replace(/, \d+ of \d+$/, "") ?? "",
  );

const eventLog = (p: Page, example: string): Promise<string> =>
  p.$eval(`${example} .events`, (el) => el.textContent ?? "");

const liveText = (p: Page, example: string): Promise<string> =>
  p.$eval(`${example} figure [aria-live]`, (el) => el.textContent?.trim() ?? "");

describe("enhance: stacked bar", () => {
  beforeAll(async () => {
    page = await harness.open("index.html", "light");
  });

  it("lays a named native button over each mark, with one tab stop and the keys described", async () => {
    const points = await page.$$eval(`${STACKED} ${POINTS}`, (els) =>
      els.map((el) => [el.tagName, el.getAttribute("tabindex"), el.getAttribute("aria-label")]),
    );
    expect(points.every(([tag]) => tag === "BUTTON")).toBe(true);
    expect(points.filter(([, tab]) => tab === "0")).toHaveLength(1);
    expect(points[0]?.[2]).toBe("Year 2019, Publications: 3, 1 of 6");
    expect(await page.$eval(`${STACKED} svg`, (svg) => svg.getAttribute("role"))).toBe("img");
    expect(await page.$(`${STACKED} [data-enarratio-key] title`)).toBeNull();
    const hint = await page.$eval(`${STACKED} .enarratio-points`, (layer) => [
      layer.getAttribute("role"),
      document.getElementById(layer.getAttribute("aria-describedby") ?? "")?.textContent,
    ]);
    expect(hint[0]).toBe("application");
    expect(hint[1]).toMatch(/^Arrow keys move between points/);
    // The points scroll the frame into view, so the frame is no longer a tab stop of its own.
    expect(
      await page.$eval(`${STACKED} .enarratio-frame`, (el) => el.getAttribute("tabindex")),
    ).toBeNull();
  });

  it("walks along a series, between series, by tens, to the ends and back", async () => {
    await page.focus(`${STACKED} ${POINTS}[tabindex="0"]`);
    expect(await focused(page)).toBe("Year 2019, Publications: 3");
    // The hint shows while a point has focus.
    expect(await page.$eval(`${STACKED} .enarratio-hint`, (el) => el.clientWidth)).toBeGreaterThan(
      100,
    );
    const walk: [string, string][] = [
      ["ArrowUp", "Year 2019, Talks: 1"],
      ["ArrowUp", "Year 2019, Talks: 1"],
      // 2020 has no talks: along the series is the next year that has one.
      ["ArrowRight", "Year 2021, Talks: 2"],
      ["PageDown", "Year 2024, Talks: 2"],
      ["Home", "Year 2019, Talks: 1"],
      ["End", "Year 2024, Talks: 2"],
      ["Backspace", "Year 2019, Talks: 1"],
      ["ArrowDown", "Year 2019, Publications: 3"],
      ["ArrowLeft", "Year 2019, Publications: 3"],
    ];
    for (const [key, expected] of walk) {
      await page.keyboard.press(key as "ArrowUp");
      expect(await focused(page), key).toBe(expected);
    }
  });

  it("shows hover details for the focused mark and fades the other series", async () => {
    const tip = await page.$eval(".enarratio-tooltip:not([hidden])", (el) => el.textContent);
    expect(tip).toBe("Year 2019, Publications: 3");
    const faded = await page.$$eval(`${STACKED} [data-enarratio-faded]`, (els) => [
      ...new Set(els.map((el) => el.getAttribute("data-enarratio-series"))),
    ]);
    expect(faded.sort()).toEqual(["Grants", "Talks"]);
  });

  it("filters with Enter, dims other series, and clears with Escape", async () => {
    await page.keyboard.press("Enter");
    expect(await eventLog(page, STACKED)).toBe(
      'enarratio:select {"chartId":"entries-by-year","field":"type","value":"Publications","x":"2019"}',
    );
    const dimmed = await page.$$eval(`${STACKED} [data-enarratio-dimmed]`, (els) =>
      els.map((el) => el.getAttribute("data-enarratio-series")),
    );
    expect(dimmed.length).toBeGreaterThan(0);
    expect(dimmed).not.toContain("Publications");
    expect(await liveText(page, STACKED)).toBe("Filtered to Publications");
    await page.keyboard.press("Escape");
    expect(await eventLog(page, STACKED)).toContain('"value":null');
    expect(await page.$(`${STACKED} [data-enarratio-dimmed]`)).toBeNull();
  });

  it("filters from the legend by pointer, and clears it by keyboard", async () => {
    const grants = `${STACKED} .enarratio-legend li[data-enarratio-series="Grants"] button`;
    await page.click(grants);
    expect(await eventLog(page, STACKED)).toBe(
      'enarratio:select {"chartId":"entries-by-year","field":"type","value":"Grants"}',
    );
    const pressed = await page.$$eval(`${STACKED} .enarratio-legend button`, (els) =>
      els.map((el) => el.getAttribute("aria-pressed")),
    );
    expect(pressed).toEqual(["false", "true", "false"]);
    await page.focus(grants);
    await page.keyboard.press("Enter");
    expect(await eventLog(page, STACKED)).toContain('"value":null');
    expect(await liveText(page, STACKED)).toBe("Filter cleared");
  });

  it("filters by clicking a mark, and a second click clears it", async () => {
    const mark = `${STACKED} [data-enarratio-x="2021"][data-enarratio-series="Talks"]`;
    await page.click(mark);
    expect(await eventLog(page, STACKED)).toContain('"value":"Talks"');
    await page.click(mark);
    expect(await eventLog(page, STACKED)).toContain('"value":null');
  });

  it("does not animate under reduced motion", async () => {
    expect(await page.$("[data-enarratio-entering]")).toBeNull();
  });

  afterAll(async () => {
    await page.close();
  });
});

describe("enhance: table, view switch, expand and address", () => {
  it("sorts the table by a column, and switches between chart and table", async () => {
    const p = await harness.open("index.html", "light");
    const button = (text: string): Promise<void> =>
      p.$$eval(
        `${STACKED} .enarratio-controls button`,
        (els, t) => (els.find((el) => el.textContent === t) as HTMLElement).click(),
        text,
      );
    const years = (): Promise<(string | null)[]> =>
      p.$$eval(`${STACKED} .enarratio-data tbody th`, (els) => els.map((el) => el.textContent));
    expect(await years()).toEqual(["2019", "2020", "2021", "2022", "2023", "2024"]);
    await button("Show table");
    const shown = await p.$eval(`${STACKED} figure`, (f) => [
      getComputedStyle(f.querySelector(".enarratio-frame") as Element).display,
      (f.querySelector(".enarratio-data") as HTMLDetailsElement).open,
    ]);
    expect(shown).toEqual(["none", true]);
    const publications = `${STACKED} .enarratio-data thead th:nth-child(2)`;
    await p.click(`${publications} button`);
    expect(await p.$eval(publications, (th) => th.getAttribute("aria-sort"))).toBe("ascending");
    expect(await years()).toEqual(["2019", "2020", "2023", "2021", "2022", "2024"]);
    await p.click(`${publications} button`);
    expect(await years()).toEqual(["2024", "2022", "2021", "2020", "2023", "2019"]);
    expect(await liveText(p, STACKED)).toBe("Sorted by Publications, descending");
    await button("Show chart");
    expect(await p.$eval(`${STACKED} .enarratio-data`, (d) => (d as HTMLDetailsElement).open)).toBe(
      false,
    );
    // The gallery turns expand on: Escape closes it.
    await button("Expand");
    expect(await p.$eval(`${STACKED} figure`, (f) => getComputedStyle(f).position)).toBe("fixed");
    await p.keyboard.press("Escape");
    expect(await p.$(`${STACKED} [data-enarratio-expanded]`)).toBeNull();
    await p.close();
  });

  it("sorts a table chart's one table, with no chart and table switch", async () => {
    const p = await harness.open("index.html", "light");
    const TABLE = '[data-example="table-chart"]';
    const first = `${TABLE} .enarratio-data thead th:nth-child(2)`;
    expect(await p.$(`${TABLE} .enarratio-controls`)).toBeNull();
    await p.click(`${first} button`);
    expect(await p.$eval(first, (th) => th.getAttribute("aria-sort"))).toBe("ascending");
    expect(await liveText(p, TABLE)).toMatch(/^Sorted by /);
    await p.close();
  });

  it("keeps a filter in the address, and shows it again from a link", async () => {
    const p = await harness.open("index.html", "light");
    await p.click(`${STACKED} [data-enarratio-x="2021"][data-enarratio-series="Talks"]`);
    const search = await p.evaluate(() => location.search);
    expect(new URLSearchParams(search).get("entries-by-year")).toBe("type:Talks");
    await p.close();
    const shared = await harness.open(`index.html${search}`, "light");
    expect(await eventLog(shared, STACKED)).toBe(
      'enarratio:select {"chartId":"entries-by-year","field":"type","value":"Talks"}',
    );
    expect(
      await shared.$eval(
        `${STACKED} .enarratio-legend li[data-enarratio-series="Talks"] button`,
        (b) => b.getAttribute("aria-pressed"),
      ),
    ).toBe("true");
    await shared.close();
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
      const before = figure.querySelector('[data-enarratio-x="Contact"]')?.getAttribute("width");
      const template = document.createElement("template");
      template.innerHTML = server;
      template.content.querySelector('[data-enarratio-x="Contact"]')?.setAttribute("width", "100");
      const next = template.innerHTML;
      chart.update(next);
      const announced = figure.querySelector("[aria-live]")?.textContent;
      const during = figure.querySelector('[data-enarratio-x="Contact"]')?.getAttribute("width");
      await new Promise((r) => setTimeout(r, 700));
      const after = figure.querySelector('[data-enarratio-x="Contact"]')?.getAttribute("width");
      chart.destroy();
      return {
        before,
        announced,
        during,
        after,
        role: figure.querySelector("svg")?.getAttribute("role"),
        titles: figure.querySelectorAll("[data-enarratio-key] > title").length,
        frameTab: figure.querySelector(".enarratio-frame")?.getAttribute("tabindex"),
      };
    });
    expect(result.announced).toBe("Chart updated");
    expect(Number(result.during)).toBeLessThan(100);
    expect(result.after).toBe("100");
    expect(result.role).toBe("img");
    expect(result.titles).toBe(5);
    expect(result.frameTab).toBe("0");
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
    expect(log.startsWith('enarratio:brush {"chartId":"weekly-cases","range":[')).toBe(true);
    const detail = JSON.parse(log.slice("enarratio:brush ".length)) as {
      range: [number, number];
      time: boolean;
    };
    expect(detail.time).toBe(true);
    expect(detail.range[0]).toBeLessThan(detail.range[1]);
    expect(detail.range[0]).toBeGreaterThan(Date.UTC(2025, 9, 1));
    expect(detail.range[1]).toBeLessThan(Date.UTC(2026, 1, 1));
    expect(await p.$eval(`${LINE} .enarratio-brush`, (r) => (r as SVGElement).style.display)).toBe(
      "",
    );
    await p.close();
  });

  it("picks a range with Shift and the arrow keys, and clears it with Escape", async () => {
    const p = await harness.open("index.html", "light");
    await p.focus(`${LINE} ${POINTS}[tabindex="0"]`);
    await p.keyboard.down("Shift");
    await p.keyboard.press("ArrowRight");
    await p.keyboard.press("ArrowRight");
    await p.keyboard.up("Shift");
    const detail = JSON.parse((await eventLog(p, LINE)).slice("enarratio:brush ".length)) as {
      range: [number, number];
    };
    // Two steps of one week each, from the first week plotted.
    expect(Math.round((detail.range[1] - detail.range[0]) / 86_400_000)).toBe(14);
    await p.keyboard.press("Escape");
    expect(await eventLog(p, LINE)).toBe(
      'enarratio:brush {"chartId":"weekly-cases","range":null,"time":true}',
    );
    await p.close();
  });
});

describe("enhance: the range form", () => {
  it("picks a range from typed dates, and clears it", async () => {
    const p = await harness.open("index.html", "light");
    const LINE = '[data-example="line"]';
    await p.$eval(`${LINE} .enarratio-range`, (d) => {
      (d as HTMLDetailsElement).open = true;
    });
    await p.$$eval(`${LINE} .enarratio-range input`, (inputs) => {
      (inputs[0] as HTMLInputElement).value = "2025-11-03";
      (inputs[1] as HTMLInputElement).value = "2025-12-01";
    });
    await p.focus(`${LINE} .enarratio-range input`);
    await p.keyboard.press("Enter");
    expect(await eventLog(p, LINE)).toBe(
      `enarratio:brush {"chartId":"weekly-cases","range":[${Date.UTC(2025, 10, 3)},${Date.UTC(2025, 11, 1)}],"time":true}`,
    );
    expect(await liveText(p, LINE)).toBe("Range selected: 2025-11-03 to 2025-12-01");
    await p.$$eval(`${LINE} .enarratio-range button`, (els) => (els[1] as HTMLElement).click());
    expect(await eventLog(p, LINE)).toContain('"range":null');
    expect(
      await p.$eval(`${LINE} .enarratio-range input`, (i) => (i as HTMLInputElement).value),
    ).toBe("");
    await p.close();
  });
});

describe("enhance: selecting a year, page-set filters and links", () => {
  const YEARS = '[data-example="years"]';

  it("selects the bar's year, and fires nothing for filters the page sets itself", async () => {
    const p = await harness.open("index.html", "light");
    await p.$eval(`${YEARS} svg`, (svg) => svg.scrollIntoView({ block: "center" }));
    await p.click(`${YEARS} [data-enarratio-x="2012"][data-enarratio-series="Grants"]`);
    expect(await eventLog(p, YEARS)).toBe(
      'enarratio:select {"chartId":"entries-by-year-select","field":"year","value":"2012","x":"2012"}',
    );
    const dimmedYears = await p.$$eval(`${YEARS} [data-enarratio-dimmed]`, (els) => [
      ...new Set(els.map((el) => el.getAttribute("data-enarratio-x"))),
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
      chart.figure.addEventListener("enarratio:select", () => {
        events += 1;
      });
      chart.setFilter({ field: "year", value: "2020" });
      const year = (): string | undefined =>
        chart.figure
          .querySelector('.enarratio-points [aria-pressed="true"]')
          ?.getAttribute("aria-label")
          ?.split(",")[0];
      const pressed = year();
      chart.update(server);
      const stillPressed = year();
      chart.clear();
      const afterClear = chart.figure.querySelectorAll("[data-enarratio-dimmed]").length;
      return { events, pressed, stillPressed, afterClear };
    });
    expect(result).toEqual({
      events: 0,
      pressed: "Year 2020",
      stillPressed: "Year 2020",
      afterClear: 0,
    });
    await p.close();
  });

  it("links bars from the table without script, and filters or follows the link with it", async () => {
    const BAR = `${YEARS} [data-enarratio-x="2012"][data-enarratio-series="Grants"]`;
    const off = await harness.open("index.html", "light", { scripts: false });
    expect(await off.$(`${YEARS} svg a`)).toBeNull();
    expect(await off.$eval(BAR, (bar) => bar.getAttribute("data-enarratio-href"))).toBe(
      "?year=2012",
    );
    expect(await off.$(`${YEARS} tbody th a[href="?year=2012"]`)).not.toBeNull();
    await off.close();
    const on = await harness.open("index.html", "light");
    expect(await on.$(`${YEARS} button[aria-label^="Year 2012, Grants:"]`)).not.toBeNull();
    // Without filtering, a bar's point is its link, and a click on the bar follows it.
    await on.evaluate(async () => {
      const load = new Function("url", "return import(url)") as (url: string) => Promise<unknown>;
      const { enhance } = (await load(
        "./enhance.js",
      )) as typeof import("../../src/enhance/index.ts");
      const section = document.querySelector('[data-example="years"]');
      if (!section) throw new Error("no example");
      enhance(section)[0]?.destroy();
      enhance(section, { filter: false });
    });
    expect(
      await on.$eval(`${YEARS} .enarratio-points a[aria-label^="Year 2012, Grants:"]`, (a) =>
        a.getAttribute("href"),
      ),
    ).toBe("?year=2012");
    await on.$eval(BAR, (svg) => svg.scrollIntoView({ block: "center" }));
    await Promise.all([on.waitForNavigation(), on.click(BAR)]);
    expect(new URL(on.url()).search).toBe("?year=2012");
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
    window.__chart.figure.addEventListener("enarratio:select", (e) => window.__events.push(e.detail));
  `;

  const prepare = async (p: Page): Promise<void> => {
    await p.evaluate(`(async () => { ${PREPARE} })()`);
  };

  it("shows a series filter from setFilter without dimming by year", async () => {
    const p = await harness.open("index.html", "light");
    await prepare(p);
    const result = (await p.evaluate(`(() => {
      window.__chart.setFilter({ field: "type", value: "Grants" });
      const marks = [...window.__chart.figure.querySelectorAll("[data-enarratio-key]")];
      return {
        dimmedSeries: [...new Set(marks.filter((m) => m.hasAttribute("data-enarratio-dimmed")).map((m) => m.getAttribute("data-enarratio-series")))].sort(),
        litSeries: [...new Set(marks.filter((m) => !m.hasAttribute("data-enarratio-dimmed")).map((m) => m.getAttribute("data-enarratio-series")))],
        legend: [...window.__chart.figure.querySelectorAll(".enarratio-legend button")].map((b) => b.getAttribute("aria-pressed")),
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
      return [...window.__chart.figure.querySelectorAll("[data-enarratio-key]:not([data-enarratio-dimmed])")].map((m) => m.getAttribute("data-enarratio-x"));
    })()`)) as string[];
    expect(new Set(yearDimmed)).toEqual(new Set(["2012"]));
    await p.close();
  });

  it("keeps keyboard focus and the tab stop on the same mark through update(), so Escape still works", async () => {
    const p = await harness.open("index.html", "light");
    await prepare(p);
    await p.focus(`${YEARS} button[aria-label^="Year 2012, Grants:"]`);
    await p.keyboard.press("Enter");
    await p.evaluate(`window.__chart.update(window.__server)`);
    const after = (await p.evaluate(`(() => {
      const figure = window.__chart.figure;
      return {
        focused: document.activeElement?.getAttribute("aria-label") ?? null,
        stops: [...figure.querySelectorAll('.enarratio-points [tabindex="0"]')].map((m) => m.getAttribute("aria-label")),
      };
    })()`)) as { focused: string | null; stops: string[] };
    expect(after.focused).toMatch(/^Year 2012, Grants:/);
    expect(after.stops).toEqual([after.focused]);
    await p.keyboard.press("Escape");
    const last = (await p.evaluate("window.__events.at(-1)")) as { value: string | null };
    expect(last.value).toBeNull();
    await p.close();
  });

  it("moves focus to the same year when the focused mark is gone after update()", async () => {
    const p = await harness.open("index.html", "light");
    await prepare(p);
    await p.focus(`${YEARS} button[aria-label^="Year 2012, Grants:"]`);
    const focused = await p.evaluate(`(() => {
      const template = document.createElement("template");
      template.innerHTML = window.__server;
      const gone = template.content.querySelector('[data-enarratio-x="2012"][data-enarratio-series="Grants"]');
      if (!gone) throw new Error("mark not found");
      gone.remove();
      const next = template.innerHTML;
      window.__chart.update(next);
      const el = document.activeElement;
      return [el?.getAttribute("aria-label")?.split(",")[0], el?.getAttribute("tabindex")];
    })()`);
    expect(focused).toEqual(["Year 2012", "0"]);
    await p.close();
  });
});

describe("gallery: a chart is enhanced as it nears the viewport", () => {
  const CHART = "figure.enarratio:not([data-enarratio-static])";

  it("leaves a far chart as the server drew it until it is scrolled near, and enhances at once the chart a #hash names", async () => {
    const p = await harness.open("index.html", "light", { lazy: true });
    // The last chart of the page, which is far below the first screen.
    const id = await p.evaluate(
      (selector) => [...document.querySelectorAll(selector)].at(-1)?.closest("section")?.id ?? "",
      CHART,
    );
    const last = `#${id} ${CHART}`;
    expect(await p.$eval(last, (el) => el.hasAttribute("data-enarratio-enhanced"))).toBe(false);
    await p.$eval(last, (el) => el.scrollIntoView());
    await p.waitForSelector(`${last}[data-enarratio-enhanced]`);
    await p.close();

    const linked = await harness.open(`index.html#${id}`, "light", { lazy: true });
    await linked.waitForSelector(`${last}[data-enarratio-enhanced]`);
    await linked.close();
  });
});
