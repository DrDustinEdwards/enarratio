/**
 * Visual regression: every gallery example, in each theme and color scheme, compared pixel by
 * pixel with a stored image. Images are stored per platform, because fonts render differently;
 * CI runs on Linux and its images are the ones committed.
 *
 * To create or accept images: UPDATE_SNAPSHOTS=1 npm run test:browser, then review the new PNGs.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Harness, startHarness } from "./harness.ts";

const here = import.meta.dirname;
const snapshots = resolve(here, "__snapshots__", process.platform);
const output = resolve(here, "__output__");
const update = process.env["UPDATE_SNAPSHOTS"] === "1";
/**
 * Images are stored for CI's platform (Linux). On a platform with none stored, the comparison is
 * skipped rather than failing every example, unless UPDATE_SNAPSHOTS asks to create them (F20).
 */
const hasImages = existsSync(snapshots) && readdirSync(snapshots).some((f) => f.endsWith(".png"));

/** Pixels that may differ before a comparison fails: anti-aliasing noise, not a changed chart. */
const TOLERATED_PIXELS = 30;

let harness: Harness;

beforeAll(async () => {
  harness = await startHarness();
  mkdirSync(snapshots, { recursive: true });
});

afterAll(async () => {
  // Undefined when the browser failed to launch: let that error, not this one, be reported.
  await harness?.close();
});

/**
 * Compares one image with its stored copy and returns what is wrong, or null. With none stored it
 * writes one; with a difference it writes the new image and a diff to __output__. Either way the
 * run goes on, so one run records every missing or changed image, not just the first.
 */
function compare(name: string, actual: Uint8Array): string | null {
  const stored = join(snapshots, `${name}.png`);
  if (update || !existsSync(stored)) {
    writeFileSync(stored, actual);
    return update ? null : `${name}: no stored image; wrote one, review and commit it`;
  }
  const expected = PNG.sync.read(readFileSync(stored));
  const received = PNG.sync.read(Buffer.from(actual));
  if (expected.width !== received.width || expected.height !== received.height) {
    mkdirSync(output, { recursive: true });
    writeFileSync(join(output, `${name}.actual.png`), actual);
    return `${name}: size changed from ${expected.width}x${expected.height} to ${received.width}x${received.height}`;
  }
  const diff = new PNG({ width: expected.width, height: expected.height });
  const changed = pixelmatch(
    expected.data,
    received.data,
    diff.data,
    expected.width,
    expected.height,
    {
      threshold: 0.1,
    },
  );
  if (changed > TOLERATED_PIXELS) {
    mkdirSync(output, { recursive: true });
    writeFileSync(join(output, `${name}.actual.png`), actual);
    writeFileSync(join(output, `${name}.diff.png`), PNG.sync.write(diff));
    return `${name}: ${changed} pixels differ`;
  }
  return null;
}

const pages = [
  ["default", "index.html"],
  ["dustinedwards", "dustinedwards.html"],
] as const;
const schemes = ["light", "dark"] as const;

describe.skipIf(!hasImages && !update).each(pages)("%s theme", (theme, file) => {
  it.each(schemes)("matches the stored images, %s", async (scheme) => {
    const page = await harness.open(file, scheme, { scripts: false });
    const sections = await page.$$("section.example");
    expect(sections.length).toBeGreaterThan(0);
    const problems: string[] = [];
    for (const section of sections) {
      const id = await section.evaluate((el) => el.getAttribute("data-example") ?? "");
      const target = (await section.$("figure, .primitives, svg")) ?? section;
      const shot = await target.screenshot({ type: "png" });
      const name = `${theme}-${scheme}-${id}`;
      const problem = compare(name, shot);
      if (problem) problems.push(problem);
    }
    await page.close();
    expect(problems).toEqual([]);
  });
});
