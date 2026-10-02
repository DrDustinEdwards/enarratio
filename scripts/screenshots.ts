/**
 * Saves full-page screenshots of the built gallery, every theme in light and dark, for review.
 *
 *   node scripts/screenshots.ts <outDir>
 */

import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { startHarness } from "../test/browser/harness.ts";

const outDir = process.argv[2];
if (!outDir) throw new Error("usage: node scripts/screenshots.ts <outDir>");
mkdirSync(resolve(outDir), { recursive: true });

const harness = await startHarness();
try {
  for (const file of ["index.html", "example.html"]) {
    for (const scheme of ["light", "dark"] as const) {
      const page = await harness.open(file, scheme);
      const name = `gallery-${file.replace(".html", "")}-${scheme}.png`;
      await page.screenshot({
        path: join(resolve(outDir), name) as `${string}.png`,
        fullPage: true,
      });
      await page.close();
      console.log(name);
    }
  }
} finally {
  await harness.close();
}
