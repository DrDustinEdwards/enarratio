/**
 * Rendering tests: the server output of every gallery example, compared with a stored copy, so any
 * change to the markup a site receives is seen in review. Update with `npx vitest run -u` and read
 * the diff before committing it.
 */
import { readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "./helpers.js";

const examplesDir = resolve(import.meta.dirname, "..", "examples");
const examples = readdirSync(examplesDir).filter((f) => f.endsWith(".ts"));

describe("server rendering", () => {
  it.each(examples)("%s renders the stored markup", async (file) => {
    const module = (await import(pathToFileURL(join(examplesDir, file)).href)) as {
      default: string;
    };
    await expect(module.default).toMatchFileSnapshot(
      join("__snapshots__", "render", `${basename(file, ".ts")}.html`),
    );
  });

  it.each(examples)("%s is well-formed and every svg is named", async (file) => {
    const module = (await import(pathToFileURL(join(examplesDir, file)).href)) as {
      default: string;
    };
    const root = parse(`<div>${module.default}</div>`);
    const svgs = [...root.querySelectorAll("svg")];
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      // One image, or a named group when its marks are links.
      expect(["img", "group"]).toContain(svg.getAttribute("role"));
      expect((svg.getAttribute("aria-label") ?? "").length).toBeGreaterThan(0);
    }
    for (const fig of root.querySelectorAll("figure")) {
      expect(fig.hasAttribute("aria-label")).toBe(false);
      expect(fig.querySelector("table")).not.toBeNull();
    }
    // No inline event handlers or scripts can reach the markup.
    expect(module.default).not.toMatch(/<script|\son[a-z]+=/i);
  });
});
