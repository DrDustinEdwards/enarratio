/**
 * The package's shape: which entry holds what, that core stays free of dependencies, and that the
 * built package works through its own export map, the way a reader's install would.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
  exports: Record<string, string | { types: string; default: string }>;
  imports: Record<string, Record<string, string>>;
  dependencies?: Record<string, string>;
  peerDependencies: Record<string, string>;
  peerDependenciesMeta: Record<string, { optional: boolean }>;
};

const IMPORTS_LINKEDOM = /(?:from|import)\s*\(?\s*["']linkedom/;
const BARE = /(?:from|import)\s*["']([^."'#][^"']*)["']/g;

/** Every file a source entry reaches through relative imports. */
function reach(entry: string, seen = new Set<string>()): Set<string> {
  if (seen.has(entry)) return seen;
  seen.add(entry);
  for (const m of readFileSync(entry, "utf8").matchAll(/from\s*["'](\.[^"']+)["']/g)) {
    reach(resolve(dirname(entry), (m[1] as string).replace(/\.js$/, ".ts")), seen);
  }
  return seen;
}

describe("package entries", () => {
  it("has the six subpaths and no others", () => {
    expect(Object.keys(pkg.exports).sort()).toEqual(
      [".", "./base.css", "./enhance", "./package.json", "./plot", "./science", "./themes"].sort(),
    );
  });

  it("gives core no runtime dependency", () => {
    expect(pkg.dependencies ?? {}).toEqual({});
    for (const file of reach(resolve(root, "src", "index.ts"))) {
      const bare = [...readFileSync(file, "utf8").matchAll(BARE)].map((m) => m[1]);
      expect(bare, file).toEqual([]);
    }
  });

  it("makes Plot, d3-force and linkedom optional peers", () => {
    expect(Object.keys(pkg.peerDependencies).sort()).toEqual([
      "@observablehq/plot",
      "d3-force",
      "linkedom",
    ]);
    for (const name of Object.keys(pkg.peerDependencies)) {
      expect(pkg.peerDependenciesMeta[name]?.optional).toBe(true);
    }
  });

  it("keeps Plot, linkedom and d3-force out of core, themes and enhance", () => {
    for (const entry of ["src/index.ts", "src/themes/index.ts", "src/enhance/index.ts"]) {
      for (const file of reach(resolve(root, entry))) {
        expect(readFileSync(file, "utf8"), file).not.toMatch(
          /@observablehq\/plot|linkedom|d3-force|#document/,
        );
      }
    }
  });

  it("drops linkedom under the browser condition, and keeps it where a Worker bundler sets that condition too", () => {
    const document = pkg.imports["#document"] as Record<string, string>;
    const order = Object.keys(document);
    expect(document["browser"]).toBe("./dist/render/document.browser.js");
    // Conditions match in order, so server runtimes that also set "browser" must come first.
    for (const server of ["node", "workerd", "worker", "edge-light", "deno"]) {
      expect(order.indexOf(server)).toBeLessThan(order.indexOf("browser"));
      expect(document[server]).toBe("./dist/render/document.js");
    }
    expect(readFileSync(resolve(root, "src/render/document.browser.ts"), "utf8")).not.toMatch(
      IMPORTS_LINKEDOM,
    );
  });
});

const built = existsSync(resolve(root, "dist", "index.js"));

describe.skipIf(!built)("the built package", () => {
  it("points every export at a file that exists", () => {
    for (const target of Object.values(pkg.exports)) {
      const files = typeof target === "string" ? [target] : [target.types, target.default];
      for (const file of files) expect(existsSync(resolve(root, file)), file).toBe(true);
    }
    for (const file of Object.values(pkg.imports["#document"] as Record<string, string>)) {
      expect(existsSync(resolve(root, file)), file).toBe(true);
    }
  });

  it("splits the charts from core", async () => {
    const load = async (path: string): Promise<Record<string, unknown>> =>
      (await import(pathToFileURL(resolve(root, "dist", path)).href)) as Record<string, unknown>;
    const core = await load("index.js");
    expect(core["sparkline"]).toBeTypeOf("function");
    expect(core).not.toHaveProperty("barChart");
    expect(Object.keys(await load("plot/index.js")).sort()).toEqual(
      ["areaChart", "barChart", "heatmap", "lineChart", "scatterPlot"].sort(),
    );
    expect(Object.keys(await load("science/index.js")).sort()).toEqual(
      ["genomeTrack", "geometricSummary", "networkChart", "titerPlot"].sort(),
    );
  });

  it("writes base.css identical to baseStylesheet()", async () => {
    const { baseStylesheet } = await import("../src/index.js");
    expect(readFileSync(resolve(root, "dist", "base.css"), "utf8").trim()).toBe(
      baseStylesheet().trim(),
    );
  });

  it("builds the browser variant without linkedom", () => {
    const file = resolve(root, "dist", "render", "document.browser.js");
    expect(readFileSync(file, "utf8")).not.toMatch(IMPORTS_LINKEDOM);
  });
});
