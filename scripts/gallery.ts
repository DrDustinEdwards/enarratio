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
import { headHtml, headTags } from "@drdustinedwards/site-helpers/head";
import { llmsDocument } from "@drdustinedwards/site-helpers/llms";
import { aiTxt, robotsDocument } from "@drdustinedwards/site-helpers/robots";
import { graph, thing, website } from "@drdustinedwards/site-helpers/schema";
import { sitemapDocument } from "@drdustinedwards/site-helpers/sitemap";
import { securityTxt } from "@dustinedwards/site-runtime/security-txt";
import { checkTheme, stylesheet, type Theme } from "enarratio";
import { barChart } from "enarratio/lite";
import { defaultTheme } from "enarratio/themes";
import { rolldown } from "rolldown";
import { exampleTheme } from "../examples/themes/example.ts";
import { HOST, writeHeadersFile } from "./security-headers.ts";

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
.guide h2 { margin: var(--space-7) 0 var(--space-3); }
.guide p, .guide ul { max-width: var(--measure); }
.guide pre { overflow-x: auto; margin: var(--space-3) 0; padding: var(--space-4); border-radius: var(--radius-m); background: var(--sunken); font: 400 var(--fs-detail) / 1.6 var(--mono); }
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

/** The site's address, for canonical links, the sitemap and llms.txt. */
const SITE = `https://${HOST}`;

/** The IndexNow key, served as /<key>.txt; .github/workflows/gallery.yml reads it here to ping IndexNow. Public by design. */
const INDEXNOW_KEY = "af8c0a9cc5d66f499272f9cd7b95b024";

/** When security.txt lapses (RFC 9116 asks for under a year); renew it before then. */
const SECURITY_TXT_EXPIRES = "2027-10-25T00:00:00Z";

/** The share card every page sends (site/og-card.png): the line example beside the name. */
const CARD = {
  url: "/og-card.png",
  width: 1200,
  height: 630,
  alt: "Enarratio: accessible charts, drawn on the server into the HTML.",
};

/** The author, as the structured data names him. */
const AUTHOR = { "@type": "Person", name: "Dustin Edwards", url: "https://dustinedwards.info" };

/**
 * The head every page shares: Prelum's tags (title, description, canonical, Open Graph and Twitter
 * with the card, and any JSON-LD), Capsomer, then the page's own chart theme, then the remembered
 * theme before first paint. `address` is the page's clean path ("/", "/astro"); the 404 page has
 * none, so it gets a title, a description and noindex, never a canonical.
 */
function head(
  title: string,
  description: string,
  themeCss?: string,
  address?: string,
  data: readonly Record<string, unknown>[] = [],
): string {
  const tags = address
    ? headTags({
        origin: SITE,
        path: address,
        title,
        description,
        image: CARD,
        siteName: "Enarratio",
      })
    : [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "noindex" },
      ];
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${headHtml([...tags, ...data.map((node) => ({ "script:ld+json": node }))])}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/capsomer.css">
${themeCss ? `<link rel="stylesheet" href="${themeCss}">\n` : ""}<script src="/theme.js"></script>`;
}

/** The library itself, on every gallery page: what it is, where its code is, who wrote it. */
const libraryData = graph([
  website({
    origin: SITE,
    name: "Enarratio",
    description: "The Enarratio gallery: every chart, server-rendered, with its source.",
  }),
  thing("SoftwareSourceCode", {
    name: "Enarratio",
    description: "Accessible, server-rendered charts and scientific figures for the web.",
    codeRepository: "https://github.com/DrDustinEdwards/enarratio",
    url: `${SITE}/`,
    programmingLanguage: "TypeScript",
    runtimePlatform: ["Node.js", "Cloudflare Workers"],
    license: "https://opensource.org/licenses/MIT",
    author: AUTHOR,
  }),
]);

/**
 * One gallery page. It links its stylesheets and scripts as files, never inline, so the site's
 * Content-Security-Policy can allow scripts and style sheets from its own origin only.
 */
function page(
  theme: Theme,
  file: string,
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
${head(`Enarratio gallery: ${theme.name} theme`, `Every Enarratio chart, server-rendered, in the ${theme.name} theme.`, css, pathOf(file), [libraryData])}
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

/** The page for Enarratio in Astro and EmDash sites, served at /astro. */
const ASTRO_PAGE = "astro.html";
const ASTRO_TITLE = "Accessible charts for Astro and EmDash";
const ASTRO_DESCRIPTION =
  "Accessible bar, line, area, scatter and heatmap charts drawn on the server for Astro pages, Markdown and the EmDash editor.";
const ASTRO_REPO = "https://github.com/DrDustinEdwards/astro";

/** A code sample, escaped. */
const code = (source: string): string =>
  `<pre tabindex="0"><code>${escapeText(source)}</code></pre>`;

const MARKDOWN_SAMPLE = `\`\`\`chart
type: bar
x: team
y: tickets
series: status
layout: grouped
title: Tickets by team
alt: Support has the most open tickets; Platform has closed the most.
---
team,status,tickets
Support,Open,14
Support,Closed,22
Platform,Open,5
Platform,Closed,31
Web,Open,8
Web,Closed,17
\`\`\``;

/** The chart MARKDOWN_SAMPLE draws: the same options, drawn here by Enarratio itself. */
const sampleChart = barChart({
  id: "tickets-by-team",
  data: [
    { team: "Support", status: "Open", tickets: 14 },
    { team: "Support", status: "Closed", tickets: 22 },
    { team: "Platform", status: "Open", tickets: 5 },
    { team: "Platform", status: "Closed", tickets: 31 },
    { team: "Web", status: "Open", tickets: 8 },
    { team: "Web", status: "Closed", tickets: 17 },
  ],
  x: "team",
  y: "tickets",
  series: "status",
  layout: "grouped",
  title: "Tickets by team",
  alt: "Support has the most open tickets; Platform has closed the most.",
});

/** Structured data naming the two packages, so search engines can describe them. */
const astroData = graph(
  [
    [
      "enarratio-astro",
      "Accessible charts for Astro: a Chart component and charts in Markdown, drawn on the server by Enarratio.",
    ],
    [
      "enarratio-emdash",
      "An EmDash plugin that adds a Chart block to the editor, drawn on the server by Enarratio.",
    ],
  ].map(([name, description]) =>
    thing("SoftwareSourceCode", {
      name,
      description,
      codeRepository: `${ASTRO_REPO}/tree/main/packages/${name}`,
      url: `https://www.npmjs.com/package/${name}`,
      programmingLanguage: "TypeScript",
      runtimePlatform: "Astro",
      license: "https://opensource.org/licenses/MIT",
      author: AUTHOR,
    }),
  ),
);

function astroPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
${head(`${ASTRO_TITLE}: Enarratio`, ASTRO_DESCRIPTION, "index.css", pathOf(ASTRO_PAGE), [astroData])}
</head>
<body>
${siteHeader(links(ASTRO_PAGE))}
<main class="gallery guide" id="main" tabindex="-1">
<header class="cap-page-head">
<div class="cap-page-head-text">
<h1 class="cap-page-head-title">${ASTRO_TITLE}</h1>
<p class="cap-page-head-lead">Enarratio's charts in Astro pages, in Markdown, and as a block in the EmDash editor.</p>
</div>
</header>
<p>Two packages bring Enarratio to <a href="https://astro.build">Astro</a> sites and to <a href="https://github.com/emdash-cms/emdash">EmDash</a>, the CMS built on Astro. A chart arrives in the page as HTML and SVG, drawn on the server: complete before any script runs, with a written description and a data table for screen readers, numbers that search engines and language models can read, and light and dark themes. It draws bar, line, stacked area, scatter (with an optional regression line) and heatmap charts, and can add hover details, keyboard navigation and filtering where a page asks for them.</p>
<ul>
<li><a href="https://www.npmjs.com/package/enarratio-astro">enarratio-astro</a>: a <code>&lt;Chart&gt;</code> component and <code>chart</code> blocks in Markdown, for Astro 6 or later.</li>
<li><a href="https://www.npmjs.com/package/enarratio-emdash">enarratio-emdash</a>: a Chart block for EmDash 1.0 or later. An editor types <code>/chart</code>, pastes data from a spreadsheet, and describes what the chart shows.</li>
</ul>
<p>Both are MIT licensed. The code is at <a href="${ASTRO_REPO}">github.com/DrDustinEdwards/astro</a>.</p>

<h2>In an Astro page</h2>
${code("npm install enarratio-astro")}
${code(`---
import Chart from "enarratio-astro/Chart.astro";
import downloads from "../data/downloads.json";
---
<Chart
  type="line"
  data={downloads}
  x="year"
  y="downloads"
  series="package"
  alt="Downloads per year, 2024 to 2026: both packages grow every year."
  interactive
/>`)}
<p>The data can be rows (from code, JSON or a content collection) or CSV text. The chart's CSS is written once per page.</p>

<h2>In Markdown</h2>
<p>A code block whose language is <code>chart</code> becomes a chart: options, a line of three dashes, then the data. This block:</p>
${code(MARKDOWN_SAMPLE)}
<p>draws this chart:</p>
<section class="cap-panel example" id="tickets" aria-labelledby="tickets-title">
<header class="cap-panel-head"><h3 id="tickets-title">The chart the block draws</h3></header>
<div class="cap-panel-body example-chart">
${sampleChart}
</div>
</section>
<p>Register the plugin with Astro's Markdown processor, Sätteri (Astro 7) or remark (Astro 6):</p>
${code(`// astro.config.mjs
import { satteri } from "@astrojs/markdown-satteri";
import { satteriCharts } from "enarratio-astro/markdown";

export default defineConfig({
  markdown: { processor: satteri({ mdastPlugins: [satteriCharts()] }) },
});`)}

<h2>In EmDash</h2>
${code("npm install enarratio-emdash")}
${code(`// astro.config.mjs
import emdash from "emdash/astro";
import { enarratioPlugin } from "enarratio-emdash";

export default defineConfig({
  integrations: [emdash({ plugins: [enarratioPlugin()] })],
});`)}
<p>The editor gains a Chart block. It is a native EmDash plugin, installed from npm: EmDash's plugin registry holds only sandboxed plugins, which cannot draw on public pages. The plugin declares no capabilities, makes no network requests and stores nothing.</p>

<h2>Styles</h2>
<p>Charts use Enarratio's default theme, in light and dark, unless a site picks <code>styles: "base"</code> (layout only, colors from the site's own design tokens) or <code>"none"</code>. The <a href="./">gallery</a> shows every chart Enarratio draws.</p>
</main>
<script type="module" src="gallery.js"></script>
</body>
</html>
`;
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
/** The same address from the site's root, for canonical links and the sitemap. */
const pathOf = (file: string): string =>
  file === "index.html" ? "/" : `/${file.replace(/\.html$/, "")}`;
const links = (current: string): Link[] => [
  ...pages.map(([t, f]) => ({
    label: `${t.name[0]?.toUpperCase()}${t.name.slice(1)} theme`,
    href: cleanAddress(f),
    current: f === current,
  })),
  { label: "Astro and EmDash", href: "astro", current: current === ASTRO_PAGE },
  { label: "Code", href: "https://github.com/DrDustinEdwards/enarratio", current: false },
];
for (const [theme, file, css] of pages) {
  writeFileSync(join(outDir, css), stylesheet(theme));
  writeFileSync(join(outDir, file), page(theme, file, css, examples, links(file)));
}
writeFileSync(join(outDir, ASTRO_PAGE), astroPage());
const addresses = [...pages.map(([, file]) => pathOf(file)), pathOf(ASTRO_PAGE)];
// For search engines and language models, from Prelum: the sitemap, robots.txt (the family bot
// policy; Cloudflare puts its own lines first), ai.txt (citation welcome, training reserved, as the
// tdm-reservation header in _headers says) and llms.txt (https://llmstxt.org), a short guide; then
// security.txt (site-runtime) and the IndexNow key file.
mkdirSync(join(outDir, ".well-known"), { recursive: true });
writeFileSync(
  join(outDir, ".well-known", "security.txt"),
  securityTxt({
    origin: SITE,
    contact: "security@dustinedwards.info",
    expires: SECURITY_TXT_EXPIRES,
  }),
);
writeFileSync(join(outDir, `${INDEXNOW_KEY}.txt`), INDEXNOW_KEY);
writeFileSync(
  join(outDir, "sitemap.xml"),
  sitemapDocument(addresses.map((a) => ({ loc: `${SITE}${a}` }))),
);
writeFileSync(
  join(outDir, "robots.txt"),
  robotsDocument({
    origin: SITE,
    notes: [`AI usage policy: ${SITE}/ai.txt`, `LLM guide: ${SITE}/llms.txt`],
  }),
);
writeFileSync(
  join(outDir, "ai.txt"),
  aiTxt({ origin: SITE, name: "Enarratio", contact: "contact@dustinedwards.info" }),
);
writeFileSync(
  join(outDir, "llms.txt"),
  llmsDocument({
    title: "Enarratio",
    summary:
      "Accessible, server-rendered charts and scientific figures for the web. An open-source (MIT) JavaScript library by Dustin Edwards: charts are drawn on the server into the HTML as SVG, with a written description and a data table, and work without JavaScript.",
    intro: [
      [
        "- Install: `npm install enarratio@next`. Code and documentation: https://github.com/DrDustinEdwards/enarratio",
        "- Charts: bar, line, area, scatter, heatmap, network, titer plots, genome tracks, sparklines, progress rings, uptime and heat strips, timelines.",
        "- Runs on Node.js and Cloudflare Workers; `enarratio/lite` draws bar, line and area charts in the browser with no dependencies.",
      ].join("\n"),
    ],
    sections: [
      {
        heading: "Pages",
        links: [
          {
            title: "Gallery",
            url: `${SITE}/`,
            description: "every Enarratio chart in the default theme, with its source",
          },
          {
            title: "Gallery, example theme",
            url: `${SITE}/example`,
            description: "the same charts in a custom theme",
          },
          {
            title: "Charts for Astro and EmDash",
            url: `${SITE}/astro`,
            description:
              "enarratio-astro (a Chart component and charts in Markdown for Astro) and enarratio-emdash (a Chart block for the EmDash CMS)",
          },
        ],
      },
      {
        heading: "Packages",
        links: [
          {
            title: "enarratio",
            url: "https://www.npmjs.com/package/enarratio",
            description: "the library",
          },
          {
            title: "enarratio-astro",
            url: "https://www.npmjs.com/package/enarratio-astro",
            description: "charts in Astro pages and Markdown",
          },
          {
            title: "enarratio-emdash",
            url: "https://www.npmjs.com/package/enarratio-emdash",
            description: "the EmDash Chart block",
          },
        ],
      },
    ],
  }),
);
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
// Served as files beside the pages: the gallery's scripts (Capsomer's behavior bundled in) and the
// icon. The security and caching headers are written by scripts/security-headers.ts from the
// shared set (record 0018).
writeFileSync(join(outDir, "gallery.js"), await bundle("gallery.js", "esm"));
writeFileSync(join(outDir, "theme.js"), await bundle("theme.js", "iife"));
writeHeadersFile(outDir);
copyFileSync(join(root, "site", "favicon.svg"), join(outDir, "favicon.svg"));
copyFileSync(join(root, "site", "og-card.png"), join(outDir, "og-card.png"));
console.log(
  `gallery: ${examples.length} examples, ${pages.length} themes, the Astro page -> ${outDir}`,
);
