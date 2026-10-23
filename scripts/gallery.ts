/**
 * Builds the gallery: one page per theme showing every example in examples/, its source, and the
 * events the enhancement layer fires. Run after `npm run build`; the examples import "enarratio",
 * which resolves to this package's own dist. The page around the charts is Capsomer's (its fonts,
 * tokens, site header, page head, panels and disclosures); the charts are drawn in each page's own
 * Enarratio theme, on that theme's background. Gallery tooling only: the npm package never
 * imports Capsomer.
 *
 *   node scripts/gallery.ts [outDir]
 */

import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { checkTheme, stylesheet, type Theme } from "enarratio";
import { defaultTheme } from "enarratio/themes";
import { rolldown } from "rolldown";
import { exampleTheme } from "../examples/themes/example.ts";
import { writeHeadersFile } from "./security-headers.ts";

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
  "runs",
  "grouped-bar",
  "horizontal-bar",
  "line",
  "forecast",
  "area",
  "scatter",
  "heatmap",
  "network",
  "titer",
  "genome",
  "sparkline",
  "primitives",
  "heat-strip",
  "timeline",
  "primitive-tables",
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

const packageFile = createRequire(import.meta.url).resolve;
const capsomerDir = dirname(dirname(packageFile("capsomer/tokens.css")));

/** A stylesheet with its `@import`s written in place, each in the layer it names. */
function inlineCss(file: string): string {
  return readFileSync(file, "utf8").replace(
    /@import\s+"([^"]+)"(?:\s+layer\(([\w.-]+)\))?\s*;/g,
    (_, path: string, layer?: string) => {
      const inner = inlineCss(join(dirname(file), path));
      return layer ? `@layer ${layer} {\n${inner}\n}` : inner;
    },
  );
}

/** The faces Capsomer's tokens name, latin only: the gallery is in English. */
const FONTS = [
  [
    "Schibsted Grotesk",
    "400",
    "@fontsource/schibsted-grotesk/files/schibsted-grotesk-latin-400-normal.woff2",
  ],
  [
    "Schibsted Grotesk",
    "600",
    "@fontsource/schibsted-grotesk/files/schibsted-grotesk-latin-600-normal.woff2",
  ],
  ["Martian Mono", "400", "@fontsource/martian-mono/files/martian-mono-latin-400-normal.woff2"],
] as const;

/** The Capsomer components the page uses, in the order their CSS loads. */
const COMPONENTS = [
  "button",
  "popover",
  "dialog",
  "theme-switch",
  "site-header",
  "page-head",
  "panel",
  "disclosure",
];

/** The gallery's own layout, from Capsomer's tokens. */
const GALLERY_CSS = `
.gallery { max-width: 52rem; margin: 0 auto; padding: var(--space-6) var(--space-5) var(--space-9); }
.gallery .cap-page-head { margin-block-end: var(--space-5); }
.gallery-intro { max-width: var(--measure); margin: 0 0 var(--space-5); }
.gallery .cap-panel { margin-block-start: var(--space-6); }
.gallery .cap-panel-head h2 { text-wrap: balance; }
.example-chart { grid-template-columns: minmax(0, 1fr); gap: var(--space-3); background: var(--enarratio-background); color: var(--enarratio-text); }
.example-source { border-block-start: 1px solid var(--line); padding: var(--space-2) calc(var(--pad-card) - var(--pad-x)); }
.example-source pre { overflow-x: auto; margin: 0; padding: var(--space-4); border-radius: var(--radius-m); background: var(--sunken); font: 400 var(--fs-detail) / 1.6 var(--mono); }
.events { min-height: 1.5em; margin: 0; font: 400 var(--fs-detail) / var(--leading) var(--mono); overflow-wrap: anywhere; }
.primitives { display: flex; flex-wrap: wrap; gap: var(--space-6); align-items: center; }
.primitive-tables p { margin: var(--space-3) 0; }
.gallery-logo { display: inline-flex; align-items: center; gap: var(--space-3); font-weight: 600; }
.gallery-logo img { display: block; inline-size: 24px; block-size: 24px; }
`;

/** Capsomer for the whole gallery: the faces, the tokens and base, then each component's CSS. */
function capsomerCss(fontDir: string): string {
  const faces = FONTS.map(([family, weight, file]) => {
    const name = basename(file);
    copyFileSync(packageFile(file), join(fontDir, name));
    return `@font-face { font-family: "${family}"; font-style: normal; font-weight: ${weight}; font-display: swap; src: url("fonts/${name}") format("woff2"); }`;
  });
  return [
    "/* Built by scripts/gallery.ts from Capsomer: its faces, tokens, base and the components the gallery uses. */",
    ...faces,
    inlineCss(join(capsomerDir, "css", "tokens.css")),
    inlineCss(join(capsomerDir, "css", "base.css")),
    ...COMPONENTS.map((name) => inlineCss(join(capsomerDir, "components", name, `${name}.css`))),
    GALLERY_CSS,
  ].join("\n\n");
}

const THEME_ICONS = `<svg class="cap-theme-icon" data-show="light" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>
<svg class="cap-theme-icon" data-show="dark" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>`;

/** A link in the header and in the phone sheet: the theme pages, then the code. */
interface Link {
  readonly label: string;
  readonly href: string;
  readonly current: boolean;
}

/** Capsomer's site header, written by hand (site-header.md, "Markup"), wired by gallery.js. */
function siteHeader(links: readonly Link[]): string {
  const current = (l: Link): string => (l.current ? ' aria-current="page"' : "");
  return `<header class="cap-site-header" data-cap="site-header" data-links="left">
<a class="cap-site-header-skip" href="#main">Skip to the charts</a>
<a class="cap-site-header-logo gallery-logo" href="./"><img src="/favicon.svg" alt="" width="24" height="24"><span>Enarratio</span></a>
<nav class="cap-site-header-sections" aria-label="Site"><ul>
${links.map((l) => `<li><a class="cap-site-header-link" href="${l.href}"${current(l)}>${escapeText(l.label)}</a></li>`).join("\n")}
</ul></nav>
<div class="cap-site-header-tools">
<button type="button" class="cap-theme-button cap-site-header-icon cap-site-header-theme" data-cap="theme-switch" data-variant="button" aria-label="Switch to dark theme">
${THEME_ICONS}
<span class="cap-theme-tip cap-popover" data-variant="tooltip" data-side="bottom" data-offset="6" popover="manual" role="tooltip" aria-hidden="true"><span class="cap-theme-tip-text">Switch to dark theme</span></span>
</button>
<button type="button" class="cap-site-header-icon cap-site-header-menu" aria-label="Menu" aria-haspopup="dialog" aria-expanded="false" aria-controls="sheet"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg></button>
</div>
<dialog class="cap-dialog cap-site-header-sheet" data-cap="dialog" data-placement="bottom" data-size="md" id="sheet" aria-labelledby="sheet-title">
<div class="cap-dialog-header"><h2 id="sheet-title" class="cap-dialog-title cap-site-header-sheet-title" tabindex="-1">Enarratio menu</h2></div>
<div class="cap-dialog-body"><nav aria-labelledby="sheet-title"><ul class="cap-site-header-sheet-list">
${links.map((l) => `<li><a href="${l.href}"${current(l)}><span class="cap-site-header-sheet-icon" aria-hidden="true"></span><span class="cap-site-header-sheet-name">${escapeText(l.label)}</span></a></li>`).join("\n")}
</ul></nav></div>
<button type="button" class="cap-btn cap-dialog-close" data-variant="quiet" data-icon-only="" data-cap-part="close" aria-label="Close"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg></button>
</dialog>
</header>`;
}

/** The head every page shares: Capsomer, then the page's own chart theme, then the remembered theme before first paint. */
function head(title: string, description: string, themeCss?: string): string {
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeText(title)}</title>
<meta name="description" content="${escapeText(description)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/capsomer.css">
${themeCss ? `<link rel="stylesheet" href="${themeCss}">\n` : ""}<script src="/theme.js"></script>`;
}

/**
 * One gallery page. It links its stylesheets and scripts as files, never inline, so the site's
 * Content-Security-Policy can allow scripts and style sheets from its own origin only.
 */
function page(
  theme: Theme,
  css: string,
  examples: readonly Example[],
  links: readonly Link[],
): string {
  const report = checkTheme(theme);
  const findings =
    report.issues.length === 0
      ? "<p>No findings.</p>"
      : `<ul>${report.issues.map((i) => `<li>${escapeText(i.severity)}: ${escapeText(i.message)}</li>`).join("")}</ul>`;
  return `<!doctype html>
<html lang="en">
<head>
${head(`Enarratio gallery: ${theme.name} theme`, `Every Enarratio chart, server-rendered, in the ${theme.name} theme.`, css)}
</head>
<body>
${siteHeader(links)}
<main class="gallery" id="main" tabindex="-1">
<header class="cap-page-head">
<div class="cap-page-head-text">
<h1 class="cap-page-head-title">Enarratio gallery</h1>
<p class="cap-page-head-lead">Every Enarratio chart in the ${escapeText(theme.name)} theme.</p>
</div>
</header>
<p class="gallery-intro">Every chart below was drawn on the server and reads without scripts; the enhancement layer adds hover details, keyboard navigation, filters and brushing.</p>
<details class="cap-disclosure report"><summary>Theme check: ${report.ok ? "passes" : "fails"} with ${report.issues.length} finding${report.issues.length === 1 ? "" : "s"}</summary><div class="cap-disclosure-body">${findings}</div></details>
${examples
  .map(
    (
      e,
    ) => `<section class="cap-panel example" id="${e.id}" data-example="${e.id}" aria-labelledby="${e.id}-title">
<header class="cap-panel-head"><h2 id="${e.id}-title">${escapeText(e.title)}</h2></header>
<div class="cap-panel-body example-chart">
${e.markup}
<p class="events" aria-live="polite"></p>
</div>
<details class="cap-disclosure example-source" data-variant="accordion"><summary>Source: examples/${e.id}.ts</summary><div class="cap-disclosure-body"><pre tabindex="0"><code>${escapeText(e.source)}</code></pre></div></details>
</section>`,
  )
  .join("\n")}
</main>
<script type="module" src="gallery.js"></script>
</body>
</html>
`;
}

/** Bundles a script of site/ for the browser, leaving the enhancement layer as the file it is. */
async function bundle(file: string, format: "esm" | "iife"): Promise<string> {
  const built = await rolldown({
    input: join(root, "site", file),
    platform: "browser",
    external: ["./enhance.js"],
    logLevel: "silent",
  });
  const { output } = await built.generate({ format, minify: true });
  await built.close();
  const [chunk] = output;
  if (output.length !== 1 || chunk?.type !== "chunk")
    throw new Error(`${file}: expected one chunk`);
  return chunk.code;
}

const examples = await loadExamples();
mkdirSync(join(outDir, "fonts"), { recursive: true });
writeFileSync(join(outDir, "capsomer.css"), capsomerCss(join(outDir, "fonts")));
/** Each page's theme, file and stylesheet. */
const pages: [Theme, string, string][] = [
  [defaultTheme, "index.html", "index.css"],
  [exampleTheme, "example.html", "example.css"],
];
/**
 * The address a page is linked at: the host (Cloudflare static assets) serves index.html at the
 * directory and other pages without their extension, and redirects the .html form there.
 */
const cleanAddress = (file: string): string =>
  file === "index.html" ? "./" : file.replace(/\.html$/, "");
const links = (current: string): Link[] => [
  ...pages.map(([t, f]) => ({
    label: `${t.name[0]?.toUpperCase()}${t.name.slice(1)} theme`,
    href: cleanAddress(f),
    current: f === current,
  })),
  { label: "Code", href: "https://github.com/DrDustinEdwards/enarratio", current: false },
];
for (const [theme, file, css] of pages) {
  writeFileSync(join(outDir, css), stylesheet(theme));
  writeFileSync(join(outDir, file), page(theme, css, examples, links(file)));
}
writeFileSync(
  join(outDir, "404.html"),
  `<!doctype html>
<html lang="en">
<head>
${head("Not found: Enarratio gallery", "There is no page at this address.")}
</head>
<body>
${siteHeader(links(""))}
<main class="gallery" id="main" tabindex="-1">
<header class="cap-page-head"><div class="cap-page-head-text"><h1 class="cap-page-head-title">Not found</h1></div></header>
<p class="gallery-intro">There is no page at this address. The gallery is at <a href="/">enarratio.dustinedwards.info</a>, and the code at <a href="https://github.com/DrDustinEdwards/enarratio">github.com/DrDustinEdwards/enarratio</a>.</p>
</main>
<script type="module" src="/gallery.js"></script>
</body>
</html>
`,
);
copyFileSync(join(root, "dist", "enhance", "index.js"), join(outDir, "enhance.js"));
// Served as files beside the pages: the gallery's scripts (Capsomer's behaviour bundled in) and the
// icon. The security and caching headers are written by scripts/security-headers.ts from the
// shared set (record 0018).
writeFileSync(join(outDir, "gallery.js"), await bundle("gallery.js", "esm"));
writeFileSync(join(outDir, "theme.js"), await bundle("theme.js", "iife"));
writeHeadersFile(outDir);
copyFileSync(join(root, "site", "favicon.svg"), join(outDir, "favicon.svg"));
console.log(`gallery: ${examples.length} examples, ${pages.length} themes -> ${outDir}`);
