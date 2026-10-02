import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  baseStylesheet,
  checkTheme,
  colorDifference,
  contrastRatio,
  defaultTheme,
  defineTheme,
  dustinedwardsTheme,
  simulateColorVision,
  stylesheet,
  type Theme,
} from "../src/index.js";
import { deltaE2000 } from "../src/theme/color.js";

describe("contrastRatio", () => {
  it("is 21 for black on white and 1 for a color on itself", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777", "#777777")).toBe(1);
  });

  it("matches a published WCAG value", () => {
    // #767676 on white is the classic lightest gray to pass 4.5:1.
    expect(contrastRatio("#767676", "#fff")).toBeCloseTo(4.54, 2);
  });

  it("rejects colors it cannot measure", () => {
    expect(() => contrastRatio("red", "#fff")).toThrow(/not a hex color/);
  });
});

describe("deltaE2000", () => {
  // Test pairs 1, 7, 17 and 25 of Sharma, Wu and Dalal (2005), Color Res. Appl. 30(1), Table 1.
  it.each([
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 0, 0], [50, -1, 2], 2.3669],
    [[50, 2.5, 0], [73, 25, -18], 27.1492],
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
  ] as const)("matches the published difference for %j and %j", (a, b, expected) => {
    expect(deltaE2000(a, b)).toBeCloseTo(expected, 3);
    expect(deltaE2000(b, a)).toBeCloseTo(expected, 3);
  });
});

describe("color vision simulation", () => {
  it("leaves grays unchanged", () => {
    const [r, g, b] = simulateColorVision("#808080", "deuteranopia");
    expect(r).toBeCloseTo(g, 2);
    expect(g).toBeCloseTo(b, 2);
  });

  it("collapses red and green under deuteranopia but not typical vision", () => {
    const typical = colorDifference("#d62728", "#2ca02c");
    const deutan = colorDifference("#d62728", "#2ca02c", "deuteranopia");
    expect(typical).toBeGreaterThan(40);
    expect(deutan).toBeLessThan(typical / 2);
  });

  it("measures zero difference between identical colors", () => {
    expect(colorDifference("#123456", "#123456", "tritanopia")).toBe(0);
  });
});

describe("checkTheme", () => {
  it("passes both built-in themes with no errors", () => {
    expect(checkTheme(defaultTheme).ok).toBe(true);
    expect(checkTheme(dustinedwardsTheme).ok).toBe(true);
  });

  it("reports low text contrast as an error, per scheme", () => {
    const pale: Theme = { ...defaultTheme, light: { ...defaultTheme.light, mutedText: "#bbbbbb" } };
    const report = checkTheme(pale);
    expect(report.ok).toBe(false);
    const issue = report.issues.find((i) => i.check === "text-contrast");
    expect(issue).toMatchObject({
      severity: "error",
      scheme: "light",
      colors: ["#bbbbbb", "#ffffff"],
    });
  });

  it("warns once per pair of series colors that could be confused", () => {
    const [first, , ...rest] = defaultTheme.light.series;
    const confusable: Theme = {
      ...defaultTheme,
      light: { ...defaultTheme.light, series: [first, first, ...rest] },
    };
    const warnings = checkTheme(confusable).issues.filter(
      (i) =>
        i.check === "series-difference" &&
        i.message.includes("series 1 ") &&
        i.message.includes(" 2 "),
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.measured).toBe(0);
  });

  it("errors when the sequential ramp does not grow away from the background", () => {
    const [a, b, c, d, e] = defaultTheme.light.sequential;
    const reversed: Theme = {
      ...defaultTheme,
      light: { ...defaultTheme.light, sequential: [e, d, c, b, a] },
    };
    expect(checkTheme(reversed).issues.some((i) => i.check === "sequential-order")).toBe(true);
  });
});

describe("defineTheme", () => {
  it("returns a valid theme unchanged", () => {
    expect(defineTheme(defaultTheme)).toBe(defaultTheme);
  });

  it("rejects a non-hex color with its path", () => {
    const bad = {
      ...defaultTheme,
      dark: { ...defaultTheme.dark, grid: "gray" },
    } as unknown as Theme;
    expect(() => defineTheme(bad)).toThrow(/dark\.grid: "gray" is not a hex color/);
  });

  it("rejects a palette of the wrong length", () => {
    const short = {
      ...defaultTheme,
      light: { ...defaultTheme.light, series: defaultTheme.light.series.slice(0, 6) },
    } as unknown as Theme;
    expect(() => defineTheme(short)).toThrow(/exactly 8 colors/);
  });
});

describe("stylesheet", () => {
  const css = stylesheet(defaultTheme);

  it("defines every palette slot with a light fallback and a light-dark() pair", () => {
    for (let i = 1; i <= 8; i += 1) {
      expect(css).toContain(`--enarratio-series-${i}: ${defaultTheme.light.series[i - 1]};`);
      expect(css).toContain(
        `--enarratio-series-${i}: light-dark(${defaultTheme.light.series[i - 1]}, ${defaultTheme.dark.series[i - 1]});`,
      );
    }
  });

  it("hides the gridlines the theme does not show", () => {
    expect(css).toContain('[data-enarratio-mark="x-grid"] { display: none; }');
    expect(css).not.toContain('[data-enarratio-mark="y-grid"] { display: none; }');
  });

  it("switches scheme under caller selectors", () => {
    const attr = stylesheet(defaultTheme, { colorScheme: { dark: '[data-theme="dark"]' } });
    expect(attr).toContain(':where([data-theme="dark"]) .enarratio { color-scheme: dark; }');
  });

  it("turns animation off under reduced motion", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[^}]*animation: none/);
  });
});

describe("the CSS custom property contract", () => {
  const base = baseStylesheet();
  const api = readFileSync(resolve(import.meta.dirname, "..", "docs", "api.md"), "utf8");
  // Every `var(--enarratio-name, fallback)` the base rules use for a size, weight, radius or timing.
  const tunable = new Map<string, string>();
  for (const m of base.matchAll(/var\((--enarratio-[a-z-]+),\s*((?:[^()]|\([^()]*\))+)\)/g)) {
    tunable.set(m[1] as string, (m[2] as string).replace(/\s+/g, " ").trim());
  }

  it("finds the tunable properties", () => {
    expect(tunable.size).toBeGreaterThan(30);
    expect(tunable.get("--enarratio-font-size-mark")).toBe("12px");
    expect(tunable.get("--enarratio-duration-grow")).toBe("600ms");
  });

  it.each([...tunable])("documents %s with its fallback %s", (name, fallback) => {
    const row = api.split("\n").find((line) => line.startsWith(`| \`${name}\``));
    expect(row, `${name} is missing from the property table in docs/api.md`).toBeDefined();
    expect(row).toContain(`\`${fallback}\``);
  });

  it("is included, unchanged, in every stylesheet", () => {
    expect(stylesheet(defaultTheme)).toContain(base);
  });

  it("defines no theme value itself", () => {
    expect(base).not.toMatch(/--enarratio-(?:series|sequential|status)-\d*[a-z-]*:/);
    expect(base).not.toMatch(/#[0-9a-f]{3,6}\b/i);
  });

  it("ships as dist/base.css when built", () => {
    const built = resolve(import.meta.dirname, "..", "dist", "base.css");
    if (existsSync(built)) expect(readFileSync(built, "utf8").trim()).toBe(base.trim());
  });
});
