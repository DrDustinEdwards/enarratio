import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize, resolve } from "node:path";
import puppeteer, { type Browser, type Page } from "puppeteer";

const SITE = resolve(import.meta.dirname, "..", "..", "site", "dist");
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

/** A static server for the built gallery and one headless browser. */
export interface Harness {
  readonly browser: Browser;
  readonly origin: string;
  /**
   * Opens a gallery page in a color scheme. Reduced motion is on unless turned off, so screenshots
   * never catch an animation; `scripts: false` blocks the enhancement layer, as a reader without
   * JavaScript would see the page. The gallery enhances a chart as it nears the viewport, so the
   * page is scrolled to its end and back, as a reader would, until every chart is enhanced;
   * `lazy: true` leaves it as loaded.
   */
  open(
    path: string,
    scheme: "light" | "dark",
    options?: { reducedMotion?: boolean; scripts?: boolean; lazy?: boolean },
  ): Promise<Page>;
  close(): Promise<void>;
}

/** Scrolls a page down and back up so that every chart comes near the viewport and is enhanced. */
async function enhanceAll(page: Page): Promise<void> {
  const unenhanced = "figure.enarratio:not([data-enarratio-static]):not([data-enarratio-enhanced])";
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight) {
      window.scrollTo(0, y);
      await new Promise((done) => setTimeout(done, 20));
    }
  });
  await page.waitForFunction(
    (selector) => document.querySelector(selector) === null,
    {},
    unenhanced,
  );
  await page.evaluate(() => window.scrollTo(0, 0));
}

export async function startHarness(): Promise<Harness> {
  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    // Serve pages at clean addresses, as the host does: / is index.html, /page is page.html.
    const requested = url.pathname === "/" ? "index.html" : url.pathname;
    const path = normalize(join(SITE, extname(requested) === "" ? `${requested}.html` : requested));
    if (!path.startsWith(SITE)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const body = readFileSync(path);
      res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const browser = await puppeteer.launch({ headless: true, args: ["--font-render-hinting=none"] });
  return {
    browser,
    origin,
    async open(path, scheme, options = {}) {
      const page = await browser.newPage();
      await page.setViewport({ width: 800, height: 900, deviceScaleFactor: 1 });
      await page.emulateMediaFeatures([
        { name: "prefers-color-scheme", value: scheme },
        {
          name: "prefers-reduced-motion",
          value: options.reducedMotion === false ? "no-preference" : "reduce",
        },
      ]);
      if (options.scripts === false) {
        await page.setRequestInterception(true);
        page.on("request", (request) => {
          if (request.url().endsWith(".js")) void request.abort();
          else void request.continue();
        });
      }
      await page.goto(`${origin}/${path}`, { waitUntil: "load" });
      await page.evaluate((s) => {
        document.documentElement.dataset["theme"] = s;
      }, scheme);
      if (options.scripts !== false && options.lazy !== true) await enhanceAll(page);
      return page;
    },
    async close() {
      await browser.close();
      await new Promise<void>((done) => server.close(() => done()));
    },
  };
}
