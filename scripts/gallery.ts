/**
 * Builds the gallery: one page per theme showing every example in examples/, its source, and the
 * events the enhancement layer fires. Run after `npm run build`; the examples import "enarratio",
 * which resolves to this package's own dist.
 *
 *   node scripts/gallery.ts [outDir]
 */

import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { checkTheme, defaultTheme, dustinedwardsTheme, stylesheet, type Theme } from "enarratio";

const root = resolve(import.meta.dirname, "..");
const outDir = resolve(process.argv[2] ?? join(root, "site", "dist"));
const examplesDir = join(root, "examples");

interface Example {
  readonly id: string;
  readonly title: string;
  readonly source: string;
  readonly markup: string;
}

const escapeText = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

/** Gallery order. Every example must be listed, so a new one cannot be left out by accident. */
const ORDER = [
  "stacked-bar",
  "years",
  "grouped-bar",
  "horizontal-bar",
  "line",
  "area",
  "scatter",
  "heatmap",
  "network",
  "titer",
  "genome",
  "sparkline",
  "primitives",
];

async function loadExamples(): Promise<Example[]> {
  const found = readdirSync(examplesDir)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => basename(f, ".ts"));
  const unlisted = found.filter((id) => !ORDER.includes(id));
  const missing = ORDER.filter((id) => !found.includes(id));
  if (unlisted.length > 0 || missing.length > 0) {
    throw new Error(
      `gallery ORDER is out of date: unlisted ${unlisted.join(", ")}; missing ${missing.join(", ")}`,
    );
  }
  const files = ORDER.map((id) => `${id}.ts`);
  const examples: Example[] = [];
  for (const file of files) {
    const path = join(examplesDir, file);
    const module = (await import(pathToFileURL(path).href)) as { default: unknown };
    if (typeof module.default !== "string") throw new Error(`${file} must export a string`);
    const source = readFileSync(path, "utf8");
    const heading = /^\/\/ (.+)$/m.exec(source)?.[1] ?? file;
    examples.push({ id: basename(file, ".ts"), title: heading, source, markup: module.default });
  }
  return examples;
}

const PAGE_CSS = `
:root { color-scheme: light dark; }
:root[data-scheme="light"] { color-scheme: light; }
:root[data-scheme="dark"] { color-scheme: dark; }
body {
  margin: 0;
  background: var(--page-bg);
  color: var(--page-text);
  font-family: var(--enarratio-font, system-ui, sans-serif);
  line-height: 1.5;
}
main { max-width: 760px; margin: 0 auto; padding: 24px 16px 64px; }
header { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: baseline; justify-content: space-between; }
h1 { margin: 0; font-size: 1.75rem; }
nav a, button.scheme { color: inherit; font: inherit; }
button.scheme { padding: 4px 10px; border: 1px solid currentColor; border-radius: 4px; background: none; cursor: pointer; }
section.example { margin: 40px 0; padding-top: 24px; border-top: 1px solid var(--page-rule); }
section.example h2 { margin: 0 0 16px; font-size: 1.125rem; }
.source { margin-top: 12px; font-size: 0.875rem; }
.source pre { overflow-x: auto; padding: 12px; border-radius: 6px; background: var(--page-code); }
.events { min-height: 1.5em; margin: 8px 0 0; font-family: ui-monospace, monospace; font-size: 0.8125rem; }
.report { font-size: 0.875rem; }
.primitives { display: flex; flex-wrap: wrap; gap: 24px; align-items: center; }
.report li { margin: 2px 0; }
`;

/** A page's stylesheet: the theme, the page's colors from the theme, and the page layout. */
function pageCss(theme: Theme): string {
  return `${stylesheet(theme)}
:root {
  --page-bg: light-dark(${theme.light.background}, ${theme.dark.background});
  --page-text: light-dark(${theme.light.text}, ${theme.dark.text});
  --page-rule: light-dark(${theme.light.grid}, ${theme.dark.grid});
  --page-code: light-dark(${theme.light.grid}55, ${theme.dark.grid}55);
}
${PAGE_CSS}`;
}

/**
 * One gallery page. It links its stylesheet and script as files, never inline, so the site's
 * Content-Security-Policy can allow scripts and style sheets from its own origin only.
 */
function page(theme: Theme, css: string, examples: readonly Example[], nav: string): string {
  const report = checkTheme(theme);
  const findings =
    report.issues.length === 0
      ? "<p>No findings.</p>"
      : `<ul>${report.issues.map((i) => `<li>${escapeText(i.severity)}: ${escapeText(i.message)}</li>`).join("")}</ul>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Enarratio gallery: ${escapeText(theme.name)} theme</title>
<meta name="description" content="Every Enarratio chart, server-rendered, in the ${escapeText(theme.name)} theme.">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${css}">
</head>
<body>
<main>
<header>
<h1>Enarratio gallery</h1>
<nav aria-label="Themes">${nav}</nav>
<button type="button" class="scheme" aria-pressed="false">Dark</button>
</header>
<p>Theme <strong>${escapeText(theme.name)}</strong>. Every chart below was drawn on the server and reads without scripts; the enhancement layer adds hover details, keyboard navigation, filters and brushing.</p>
<details class="report"><summary>Theme check: ${report.ok ? "passes" : "fails"} with ${report.issues.length} finding${report.issues.length === 1 ? "" : "s"}</summary>${findings}</details>
${examples
  .map(
    (e) => `<section class="example" id="${e.id}" data-example="${e.id}">
<h2>${escapeText(e.title)}</h2>
${e.markup}
<p class="events" aria-live="polite"></p>
<details class="source"><summary>Source: examples/${e.id}.ts</summary><pre tabindex="0"><code>${escapeText(e.source)}</code></pre></details>
</section>`,
  )
  .join("\n")}
</main>
<script type="module" src="gallery.js"></script>
</body>
</html>
`;
}

const examples = await loadExamples();
mkdirSync(outDir, { recursive: true });
/** Each page's theme, file and stylesheet. */
const pages: [Theme, string, string][] = [
  [defaultTheme, "index.html", "index.css"],
  [dustinedwardsTheme, "dustinedwards.html", "dustinedwards.css"],
];
/**
 * The address a page is linked at: the host (Cloudflare static assets) serves index.html at the
 * directory and other pages without their extension, and redirects the .html form there.
 */
const cleanAddress = (file: string): string =>
  file === "index.html" ? "./" : file.replace(/\.html$/, "");
const nav = (current: string): string =>
  pages
    .map(([t, f]) =>
      f === current
        ? `<strong>${escapeText(t.name)}</strong>`
        : `<a href="${cleanAddress(f)}">${escapeText(t.name)}</a>`,
    )
    .join(" | ");
for (const [theme, file, css] of pages) {
  writeFileSync(join(outDir, css), pageCss(theme));
  writeFileSync(join(outDir, file), page(theme, css, examples, nav(file)));
}
writeFileSync(
  join(outDir, "404.html"),
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Not found: Enarratio gallery</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/index.css">
</head>
<body>
<main>
<h1>Not found</h1>
<p>There is no page at this address. The gallery is at <a href="/">enarratio.dustinedwards.info</a>, and the code at <a href="https://github.com/DrDustinEdwards/enarratio">github.com/DrDustinEdwards/enarratio</a>.</p>
</main>
</body>
</html>
`,
);
copyFileSync(join(root, "dist", "enhance", "index.js"), join(outDir, "enhance.js"));
// Served as files beside the pages: the gallery script, the security and caching headers, and
// the icon.
copyFileSync(join(root, "site", "gallery.js"), join(outDir, "gallery.js"));
copyFileSync(join(root, "site", "_headers"), join(outDir, "_headers"));
copyFileSync(join(root, "site", "favicon.svg"), join(outDir, "favicon.svg"));
console.log(`gallery: ${examples.length} examples, ${pages.length} themes -> ${outDir}`);
