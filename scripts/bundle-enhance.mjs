/**
 * Bundles dist/enhance/index.js into one file with no static imports, so a page without a bundler
 * can serve it as a single script (README, "Without a bundler"), the sound module (B54) into
 * sound.js beside it, which index.js imports only when a reader presses Play, and the image files
 * (C3, B55) into image.js, imported on the first download. The source is split
 * into modules; the published files are not. Runs in `npm run build`, after tsc.
 */
import { readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { rolldown } from "rolldown";

const dir = resolve(import.meta.dirname, "..", "dist", "enhance");
const bundle = await rolldown({ input: join(dir, "index.js") });
const { output } = await bundle.generate({ format: "esm", chunkFileNames: "[name].js" });
await bundle.close();
const names = output.map((chunk) => chunk.fileName).sort();
if (names.join() !== "image.js,index.js,sound.js" || output.some((c) => c.type !== "chunk")) {
  throw new Error(`enhance: expected image.js, index.js and sound.js, got ${names.join(", ")}`);
}
// The modules they were built from are inlined now; their declarations stay for the types.
for (const file of readdirSync(dir)) if (file.endsWith(".js")) rmSync(join(dir, file));
for (const chunk of output) writeFileSync(join(dir, chunk.fileName), chunk.code);
