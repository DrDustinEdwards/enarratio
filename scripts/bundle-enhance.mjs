/**
 * Bundles dist/enhance/index.js into one file with no imports, so a page without a bundler can
 * serve it as a single script (README, "Without a bundler"). The source is split into modules;
 * the published file is not. Runs in `npm run build`, after tsc.
 */
import { readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { rolldown } from "rolldown";

const dir = resolve(import.meta.dirname, "..", "dist", "enhance");
const bundle = await rolldown({ input: join(dir, "index.js") });
const { output } = await bundle.generate({ format: "esm" });
await bundle.close();
const [chunk] = output;
if (output.length !== 1 || chunk?.type !== "chunk") throw new Error("enhance: expected one chunk");
// The modules it was built from are inlined now; their declarations stay for the types.
for (const file of readdirSync(dir)) if (file.endsWith(".js")) rmSync(join(dir, file));
writeFileSync(join(dir, "index.js"), chunk.code);
