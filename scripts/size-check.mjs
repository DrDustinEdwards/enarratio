/**
 * Per-entry size check, run after `npm run build`. For every entry in package.json's `exports`
 * it follows the compiled file's imports and reports the gzipped size of everything the entry
 * brings with it from this package (compiled, not minified: a bundler's output is smaller), and
 * the outside packages it imports.
 *
 * The light chart entries (`enarratio/lite` and its subpaths) are also measured the way a browser
 * app ships them: bundled for the browser with everything they import, minified, then gzipped.
 * Each must stay under LITE_LIMIT and import nothing outside this package. The enhancement layer
 * (`enarratio/enhance`) is measured the same way and must stay under ENHANCE_LIMIT.
 *
 * It fails when core gains a runtime dependency: if package.json lists any `dependencies`, or if
 * the core entry imports anything outside this package.
 *
 *   node scripts/size-check.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { rolldown } from "rolldown";

/** The most a light chart entry may weigh, bundled, minified and gzipped (40 kB). */
const LITE_LIMIT = 40_000;
/** The most the enhancement layer may weigh, bundled, minified and gzipped (D6). */
const ENHANCE_LIMIT = 9_000;

const root = resolve(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const IMPORT =
  /(?:^|\n)\s*(?:import|export)\s[^"';]*?from\s*["']([^"']+)["']|(?:^|\n)\s*import\s*["']([^"']+)["']/g;

/** `condition` picks the `#document` variant, so the browser build can be measured without linkedom. */
function closure(entryFile, condition) {
  const files = new Set();
  const outside = new Set();
  const visit = (file) => {
    if (files.has(file)) return;
    files.add(file);
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(IMPORT)) {
      const spec = match[1] ?? match[2];
      if (spec === undefined) continue;
      if (spec.startsWith(".")) visit(resolve(dirname(file), spec));
      else if (spec === "#document") visit(resolve(root, pkg.imports["#document"][condition]));
      else
        outside.add(
          spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0],
        );
    }
  };
  visit(entryFile);
  return { files, outside };
}

const gzipped = (files) =>
  gzipSync(Buffer.concat([...files].map((f) => readFileSync(f))), { level: 9 }).length;

const failures = [];
if (Object.keys(pkg.dependencies ?? {}).length > 0) {
  failures.push(
    `package.json has runtime dependencies: ${Object.keys(pkg.dependencies).join(", ")}`,
  );
}

const rows = [];
for (const [name, target] of Object.entries(pkg.exports)) {
  const file = typeof target === "string" ? target : target.default;
  if (!file.endsWith(".js") && !file.endsWith(".css")) continue;
  const path = resolve(root, file);
  if (file.endsWith(".css")) {
    rows.push([name, gzipped(new Set([path])), "-"]);
    continue;
  }
  const variants = name === "./plot" || name === "./science" ? ["default", "browser"] : ["default"];
  for (const condition of variants) {
    const { files, outside } = closure(path, condition);
    const label = condition === "browser" ? `${name} (browser build)` : name;
    rows.push([label, gzipped(files), [...outside].sort().join(", ") || "-"]);
    if (name === "." && outside.size > 0) {
      failures.push(`core ("enarratio") imports outside its own files: ${[...outside].join(", ")}`);
    }
    if (name.startsWith("./lite") && outside.size > 0) {
      failures.push(`${name} imports outside its own files: ${[...outside].join(", ")}`);
    }
  }
}

/**
 * An entry bundled for the browser with all it imports, minified, then gzipped: the bytes a page
 * loads at once (the entry chunk) and the bytes it loads only on demand (dynamic imports).
 */
async function bundledParts(path) {
  const bundle = await rolldown({ input: path, platform: "browser", logLevel: "silent" });
  const { output } = await bundle.generate({ format: "esm", minify: true });
  await bundle.close();
  const gz = (chunks) => gzipSync(chunks.map((c) => c.code ?? "").join(""), { level: 9 }).length;
  const chunks = output.filter((c) => c.type === "chunk");
  const entry = chunks.filter((c) => c.isEntry);
  const lazy = chunks.filter((c) => !c.isEntry);
  return { entry: gz(entry), lazy: lazy.length > 0 ? gz(lazy) : 0 };
}
const bundled = async (path) => {
  const { entry, lazy } = await bundledParts(path);
  return entry + lazy;
};

const lite = [];
for (const [name, target] of Object.entries(pkg.exports)) {
  if (!name.startsWith("./lite")) continue;
  const bytes = await bundled(resolve(root, target.default));
  lite.push([name, bytes]);
  if (bytes > LITE_LIMIT) {
    failures.push(
      `${name} is ${bytes} bytes bundled, minified and gzipped; the limit is ${LITE_LIMIT}`,
    );
  }
}

// The budget is what a page loads at once; the export code (C3) loads on the reader's click.
const { entry: enhanceBytes, lazy: enhanceLazy } = await bundledParts(
  resolve(root, pkg.exports["./enhance"].default),
);
if (enhanceBytes > ENHANCE_LIMIT) {
  failures.push(
    `./enhance is ${enhanceBytes} bytes bundled, minified and gzipped; the limit is ${ENHANCE_LIMIT}`,
  );
}

const width = Math.max(...rows.map((r) => r[0].length));
console.log(`${"entry".padEnd(width)}  gzipped  imports from outside`);
for (const [label, bytes, outside] of rows) {
  console.log(
    `${label.padEnd(width)}  ${`${(bytes / 1024).toFixed(1)} kB`.padStart(7)}  ${outside}`,
  );
}
console.log(
  `\nlight charts, bundled for the browser, minified, gzipped (limit ${LITE_LIMIT / 1000} kB):`,
);
for (const [label, bytes] of lite) {
  console.log(`${label.padEnd(width)}  ${`${(bytes / 1000).toFixed(1)} kB`.padStart(7)}`);
}
console.log(
  `\nenhancement layer, the same way (limit ${ENHANCE_LIMIT / 1000} kB on first load):\n${"./enhance".padEnd(width)}  ${`${(enhanceBytes / 1000).toFixed(1)} kB`.padStart(7)}  (+${(enhanceLazy / 1000).toFixed(1)} kB loaded on demand)`,
);
if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}
console.log(
  "ok: core has no runtime dependency; every light chart and the enhancement layer are within their limits",
);
