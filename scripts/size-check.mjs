/**
 * Per-entry size check, run after `npm run build`. For every entry in package.json's `exports`
 * it follows the compiled file's imports and reports the gzipped size of everything the entry
 * brings with it from this package (compiled, not minified: a bundler's output is smaller), and
 * the outside packages it imports.
 *
 * It fails when core gains a runtime dependency: if package.json lists any `dependencies`, or if
 * the core entry imports anything outside this package.
 *
 *   node scripts/size-check.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { gzipSync } from "node:zlib";

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
  }
}

const width = Math.max(...rows.map((r) => r[0].length));
console.log(`${"entry".padEnd(width)}  gzipped  imports from outside`);
for (const [label, bytes, outside] of rows) {
  console.log(
    `${label.padEnd(width)}  ${`${(bytes / 1024).toFixed(1)} kB`.padStart(7)}  ${outside}`,
  );
}
if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}
console.log("ok: core has no runtime dependency");
