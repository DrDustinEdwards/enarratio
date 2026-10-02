/**
 * Documentation stays complete: every public export has a section in docs/api.md, and every
 * chart in the gallery is named in the README.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (path: string): string => readFileSync(resolve(root, path), "utf8");

function exportedNames(source: string): string[] {
  const names = new Set<string>();
  for (const block of source.matchAll(/export (?:type )?\{([^}]*)\}/g)) {
    for (const part of (block[1] ?? "").split(",")) {
      const name = part.replace(/\btype\b/, "").trim();
      if (name) names.add(name);
    }
  }
  for (const match of source.matchAll(/^export (?:function|interface|type|const|class) (\w+)/gm)) {
    if (match[1]) names.add(match[1]);
  }
  return [...names];
}

const ENTRIES = [
  "src/index.ts",
  "src/plot/index.ts",
  "src/science/index.ts",
  "src/themes/index.ts",
  "src/enhance/index.ts",
];

describe("documentation", () => {
  const api = read("docs/api.md");
  const publicNames = [...ENTRIES.flatMap((entry) => exportedNames(read(entry)))];

  it("finds the public API", () => {
    expect(publicNames).toContain("barChart");
    expect(publicNames).toContain("enhance");
    expect(publicNames.length).toBeGreaterThan(50);
  });

  it.each(publicNames)("documents %s in docs/api.md", (name) => {
    expect(api).toContain(`### \`${name}\``);
  });

  it("names every chart function in the README", () => {
    const readme = read("README.md");
    for (const name of publicNames.filter(
      (n) =>
        /^[a-z]/.test(n) &&
        /Chart$|Plot$|^heatmap$|Track$|^sparkline$|^progressRing$|^uptimeStrip$/.test(n),
    )) {
      expect(readme).toContain(`\`${name}\``);
    }
  });
});
