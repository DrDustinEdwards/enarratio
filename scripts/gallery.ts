/**
 * Builds the gallery: one page per theme showing every example in examples/, its source, and the
 * events the enhancement layer fires. Run after `npm run build`; the examples import "enarratio",
 * which resolves to this package's own dist. The page around the charts is Capsomer's (its fonts,
 * tokens, site header, page head, panels and disclosures), and each chart sits in Capsomer's chart
 * frame, as on the family's sites; the charts are drawn in each page's own Enarratio theme, on that
 * theme's background, and one page is Capsomer's own theme. Gallery tooling only: the npm package
 * never imports Capsomer.
 *
 *   node scripts/gallery.ts [outDir]
 */

import { copyFileSync, cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire, registerHooks } from "node:module";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  ACCESSIBILITY_PATH,
  accessibilityStatement,
} from "@drdustinedwards/site-helpers/accessibility";
import { headHtml, headTags } from "@drdustinedwards/site-helpers/head";
import { llmsDocument } from "@drdustinedwards/site-helpers/llms";
import { aiTxt, robotsDocument } from "@drdustinedwards/site-helpers/robots";
import { graph, thing, website } from "@drdustinedwards/site-helpers/schema";
import { sitemapDocument } from "@drdustinedwards/site-helpers/sitemap";
import { integrityHash } from "@dustinedwards/site-runtime/csp";
import { securityTxt } from "@dustinedwards/site-runtime/security-txt";
import { enarratio } from "@dustinedwards/site-runtime/sites";
import { familyFooterHtml } from "capsomer/behavior/family-footer";
import { letterheadHtml } from "capsomer/behavior/site-header";
import { capsomerMoreTheme, capsomerTheme } from "capsomer/enarratio-theme";
import { checkTheme, stylesheet, type Theme } from "enarratio";
import { barChart } from "enarratio/lite";
import { defaultTheme, highContrastTheme } from "enarratio/themes";
import { rolldown } from "rolldown";
import { exampleTheme } from "../examples/themes/example.ts";
import { PAGE_PRELOADS } from "../worker/index.ts";

// Capsomer's chart frame imports "enarratio" and "enarratio/redraw", its peer; here that is this
// package itself.
const selfExports = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    exports: Record<string, string | { default: string }>;
  }
).exports;
const self = (specifier: string): string => {
  if (specifier !== "enarratio" && !specifier.startsWith("enarratio/")) return specifier;
  const entry = selfExports[`.${specifier.slice("enarratio".length)}`];
  const file = typeof entry === "string" ? entry : entry?.default;
  return file ? new URL(`../${file}`, import.meta.url).href : specifier;
};
/**
 * The width each example is drawn at again for a phone: the frame's on a 320 px screen (the page's
 * gutter, the panel's padding and a scrollbar leave 231). Under 30rem the gallery swaps it in
 * (enarratio/redraw's narrow spec), so the drawing fits its frame with 12 px text instead of
 * scrolling (C12).
 */
const NARROW_WIDTH = 228;
registerHooks({
  resolve: (specifier, context, next) => next(self(specifier), context),
  // An example imported with ?narrow draws its chart at NARROW_WIDTH: the options it passes, with
  // the width set. Its source, as the gallery shows it, is unchanged.
  load: (url, context, next) => {
    const loaded = next(url, context);
    if (!url.endsWith("?narrow")) return loaded;
    const source = String(loaded.source).replace(
      /export default (\w+)\(/,
      `export default ((draw) => (options) => draw({ ...options, width: ${NARROW_WIDTH} }))($1)(`,
    );
    return { ...loaded, source };
  },
});
const { frameHtml } = await import("capsomer/behavior/chart-frame");

const root = resolve(import.meta.dirname, "..");
const outDir = resolve(process.argv[2] ?? join(root, "site", "dist"));
const examplesDir = join(root, "examples");

interface Example {
  readonly id: string;
  readonly name: string;
  /** The module it imports: enarratio, enarratio/plot, enarratio/science or enarratio/map. */
  readonly module: string;
  readonly title: string;
  readonly source: string;
  readonly markup: string;
  /** The chart's drawing at NARROW_WIDTH (its `.enarratio-frame`), when the example is wider. */
  readonly narrow?: string | undefined;
}

const escapeText = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

/**
 * Gallery order, with each example's short name for its number and the contents. Every example
 * must be listed, so a new one cannot be left out by accident.
 */
const NAMES: Record<string, string> = {
  "stacked-bar": "Stacked bars",
  years: "Bars by year",
  runs: "Runs per day",
  "grouped-bar": "Grouped bars",
  "horizontal-bar": "Horizontal bars",
  "diverging-bar": "Diverging bars",
  "error-bars": "Error bars",
  waterfall: "Waterfall",
  line: "Line",
  forecast: "Forecast",
  annotations: "Annotations",
  area: "Stacked areas",
  "percent-area": "100% stacked areas",
  "small-multiples": "Small multiples",
  "small-multiples-bar": "Small multiples, bars",
  scatter: "Scatter",
  bubble: "Bubbles",
  histogram: "Histogram",
  density: "Density",
  box: "Box plot",
  beeswarm: "Beeswarm",
  dot: "Dot plot",
  range: "Range plot",
  dumbbell: "Dumbbell",
  slope: "Slope chart",
  donut: "Donut",
  heatmap: "Heatmap",
  "table-chart": "Table with graphics",
  network: "Network",
  titer: "Titers",
  genome: "Genome map",
  "dose-response": "Dose-response",
  survival: "Survival",
  forest: "Forest plot",
  tree: "Phylogenetic tree",
  "dot-map": "Dot map",
  choropleth: "Choropleth map",
  sparkline: "Sparklines",
  primitives: "Rings and uptime",
  "heat-strip": "Heat strip",
  timeline: "Timeline",
  "primitive-tables": "Primitives as tables",
};
const ORDER = Object.keys(NAMES);

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
    const id = basename(file, ".ts");
    const from = /from "(enarratio[^"]*)"/.exec(source)?.[1] ?? "enarratio";
    const drawnWidth = Number(/<svg[^>]* width="(\d+(?:\.\d+)?)"/.exec(module.default)?.[1] ?? 0);
    const narrow =
      /export default \w+\(/.test(source) && drawnWidth > NARROW_WIDTH
        ? frameOf(
            ((await import(`${pathToFileURL(path).href}?narrow`)) as { default: string }).default,
          )
        : undefined;
    examples.push({
      id,
      name: NAMES[id] ?? id,
      module: from,
      title: heading,
      source,
      markup: module.default,
      narrow,
    });
  }
  return examples;
}

/** A chart's drawing, the `.enarratio-frame` that enarratio/redraw swaps. */
function frameOf(markup: string): string | undefined {
  const start = markup.indexOf('<div class="enarratio-frame');
  const end = markup.indexOf("</svg></div>", start);
  return start === -1 || end === -1 ? undefined : markup.slice(start, end + "</svg></div>".length);
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

/**
 * The Capsomer components the page uses, in the order their CSS loads: then the NASA manual theme
 * the family's public sites share, and the family footer.
 */
const COMPONENTS = [
  "link",
  "button",
  "popover",
  "dialog",
  "theme-switch",
  "site-header",
  "page-head",
  "panel",
  "disclosure",
  "chart-frame",
  "manual",
  "family-footer",
];

/** The gallery's color family: every page's root is `data-family="rose"`. */
const FAMILY = "rose";

/**
 * The gallery's own layout, from Capsomer's tokens, in the NASA manual theme: a sign for the running
 * head, the facts in form boxes, the charts as numbered parts in ruled boxes and the contents as a
 * leader index above them. The page is Capsomer's family column (.cap-page), so the letterhead, the
 * charts and the footer line up on every site. The charts' column stays 52rem, so each chart is
 * drawn at the width its stored images were taken at.
 */
const GALLERY_CSS = `
.gallery { padding-block-start: var(--space-6); }
.gallery-head h1 { margin: 0 0 var(--space-3); font-size: clamp(2rem, 1.5rem + 2vw, 3rem); line-height: 1.05; letter-spacing: -0.02em; text-wrap: balance; }
.gallery-head .cap-form-boxes { margin-block: var(--space-5) 0; }
.gallery-intro { max-width: var(--measure); margin: 0 0 var(--space-4); color: var(--muted); }
.gallery-body { display: grid; gap: var(--space-7); margin-block-start: var(--space-7); }
.gallery-main { min-width: 0; max-width: 52rem; }
@media (min-width: 64rem) { .gallery-contents .cap-leader-index { columns: 2; column-gap: var(--space-8); } .gallery-contents li { break-inside: avoid; } }
.gallery-contents h2 { margin: 0 0 var(--space-3); font: 600 0.75rem / 1.5 var(--mono); letter-spacing: 0.08em; text-transform: uppercase; }
.gallery .report { border-radius: 0; border-color: var(--text); }
.gallery .cap-panel { margin-block-start: var(--space-6); border-color: var(--text); border-radius: 0; box-shadow: none; }
.gallery .cap-panel-head { display: grid; gap: var(--space-1); background: transparent; border-block-end: 1px solid var(--line); }
.gallery .cap-panel-head h2 { margin: 0; font-size: 1.25rem; text-wrap: balance; }
.gallery .cap-panel-head h2 .cap-part-no { margin-inline-end: var(--space-3); font-weight: 400; color: var(--muted); font-variant-numeric: tabular-nums; }
/* A whole-pixel line (13px at 1.5 is 19.5px), so each chart starts on the pixel grid its stored image was taken on. */
.gallery .cap-panel-head p { margin: 0; color: var(--muted); font-size: var(--fs-detail); line-height: 20px; }
.example-chart { grid-template-columns: minmax(0, 1fr); gap: var(--space-3); background: var(--enarratio-background); color: var(--enarratio-text); }
.example-source { border-block-start: 1px solid var(--line); padding: var(--space-2) calc(var(--pad-card) - var(--pad-x)); }
.example-source pre { overflow-x: auto; margin: 0; padding: var(--space-4); border-radius: var(--radius-m); background: var(--sunken); font: 400 var(--fs-detail) / 1.6 var(--mono); }
.events { min-height: 1.5em; margin: 0; font: 400 var(--fs-detail) / var(--leading) var(--mono); overflow-wrap: anywhere; }
.primitives { display: flex; flex-wrap: wrap; gap: var(--space-6); align-items: center; }
.primitive-tables p { margin: var(--space-3) 0; }
.primitive-tables figure { margin: 0 0 var(--space-6); }
.primitive-tables figure:last-child { margin-bottom: 0; }
.primitive-tables .enarratio-head p { margin: 0; }
.guide > :not(.gallery-head) { max-width: 52rem; }
.guide h2 { margin: var(--space-7) 0 var(--space-3); }
.guide p, .guide ul { max-width: var(--measure); }
.guide pre { overflow-x: auto; margin: var(--space-3) 0; padding: var(--space-4); border-radius: var(--radius-m); background: var(--sunken); font: 400 var(--fs-detail) / 1.6 var(--mono); }
`;

/**
 * Capsomer for the whole gallery: the family's faces (capsomer/fonts.css, with its fonts/ copied
 * beside the stylesheet), the tokens and base, then each component's CSS.
 */
function capsomerCss(fontDir: string): string {
  cpSync(join(capsomerDir, "fonts"), fontDir, { recursive: true });
  return [
    "/* Built by scripts/gallery.ts from Capsomer: its faces, tokens, base and the components the gallery uses. */",
    inlineCss(join(capsomerDir, "css", "fonts.css")).replaceAll("../fonts/", "fonts/"),
    inlineCss(join(capsomerDir, "css", "tokens.css")),
    inlineCss(packageFile("capsomer/base.css")),
    `@layer cap.tokens {\n${inlineCss(join(capsomerDir, "tokens", `family-${FAMILY}.css`))}\n}`,
    ...COMPONENTS.map((name) => inlineCss(join(capsomerDir, "components", name, `${name}.css`))),
    GALLERY_CSS,
  ].join("\n\n");
}

/** A link in the header: the theme pages, then the code. */
interface Link {
  readonly label: string;
  readonly href: string;
  readonly current: boolean;
}

/** The family letterhead (capsomer/site-header), wired by gallery.js. */
function siteHeader(links: readonly Link[]): string {
  const current = links.find((l) => l.current)?.label;
  return letterheadHtml({
    name: "Enarratio",
    home: "./",
    mark: '<img src="/favicon.svg" alt="" width="32" height="32">',
    links: links.map((l) => [l.href, l.label] as [string, string]),
    ...(current ? { current } : {}),
  });
}

/** The site's address, for canonical links, the sitemap and llms.txt. */
const SITE = enarratio.origin;

/** The IndexNow key, served as /<key>.txt; .github/workflows/ci.yml's indexnow job reads it here to ping IndexNow. Public by design. */
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
${themeCss ? `<link rel="stylesheet" href="${themeCss}">\n` : ""}<script src="/theme.js" integrity="${scripts["theme.js"]}" crossorigin="anonymous"></script>`;
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

/** The library's version, shown on every page. */
const VERSION = (
  JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version: string }
).version;

/** The family footer every dustinedwards.info site ends with, Enarratio's own part first. */
function siteFooter(): string {
  const center = `<div class="cap-family-footer-center">
<div><p class="cap-family-footer-center-name">Enarratio</p><p class="cap-family-footer-about">Accessible charts and scientific figures, drawn on the server into the HTML. Open source, MIT licensed.</p></div>
<div class="cap-family-footer-columns">
<ul class="cap-family-footer-links"><li><a href="/">Default theme</a></li><li><a href="/example">Example theme</a></li><li><a href="/capsomer">Capsomer theme</a></li><li><a href="/astro">Astro and EmDash</a></li></ul>
<ul class="cap-family-footer-links"><li><a href="https://github.com/DrDustinEdwards/enarratio" rel="external">Source</a></li><li><a href="https://www.npmjs.com/package/enarratio" rel="external">npm</a></li><li><a href="https://github.com/DrDustinEdwards/enarratio/blob/main/CHANGELOG.md" rel="external">Changes</a></li></ul>
</div>
<p class="cap-family-footer-stamp"><span>Release ${escapeText(VERSION)}</span></p>
</div>`;
  return `<footer class="cap-page">${familyFooterHtml({ site: "enarratio", center, statement: ACCESSIBILITY_PATH })}</footer>`;
}

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
  const index = examples
    .map(
      (e, i) =>
        `<li><a class="cap-leader-index-link" href="#${e.id}"><span class="cap-leader-index-no">${i + 1}</span><span class="cap-leader-index-name">${escapeText(e.name)}</span><span class="cap-leader-index-dots" aria-hidden="true"></span><span class="cap-leader-index-fact">${e.module}</span></a></li>`,
    )
    .join("\n");
  return `<!doctype html>
<html lang="en" data-family="${FAMILY}">
<head>
${head(`Enarratio gallery: ${theme.name} theme`, `Every Enarratio chart in the ${theme.name} theme, drawn on the server and readable without scripts, each with its source.`, css, pathOf(file), [libraryData])}
</head>
<body>
${siteHeader(links)}
<main class="cap-page gallery" id="main" tabindex="-1">
<header class="gallery-head">
<h1>Enarratio gallery</h1>
<p class="gallery-intro">Every Enarratio chart in the ${escapeText(theme.name)} theme. Each was drawn on the server and reads without scripts; the enhancement layer adds hover details, keyboard navigation, filters and brushing.</p>
<dl class="cap-form-boxes" data-variant="readings">
<div class="cap-form-boxes-box"><dt>Release</dt><dd>${escapeText(VERSION)}</dd></div>
<div class="cap-form-boxes-box"><dt>Charts</dt><dd>${examples.length}</dd></div>
<div class="cap-form-boxes-box"><dt>Theme check</dt><dd>${report.ok ? "Passes" : "Fails"}</dd></div>
<div class="cap-form-boxes-box"><dt>License</dt><dd>MIT</dd></div>
</dl>
</header>
<div class="gallery-body">
<nav class="gallery-contents" aria-labelledby="contents-name">
<h2 id="contents-name">Charts</h2>
<ol class="cap-leader-index">
${index}
</ol>
</nav>
<div class="gallery-main">
<details class="cap-disclosure report"><summary>Theme check: ${report.ok ? "passes" : "fails"} with ${report.issues.length} finding${report.issues.length === 1 ? "" : "s"}</summary><div class="cap-disclosure-body">${findings}</div></details>
${examples
  .map(
    (
      e,
      i,
    ) => `<section class="cap-panel example" id="${e.id}" data-example="${e.id}" aria-labelledby="${e.id}-title">
<header class="cap-panel-head"><h2 id="${e.id}-title"><span class="cap-part-no">${i + 1}</span>${escapeText(e.name)}</h2><p>${escapeText(e.title)}</p></header>
<div class="cap-panel-body example-chart">
${frameHtml(e.markup, e.narrow ? { redraw: { narrow: e.narrow } } : {})}
<p class="events" aria-live="polite"></p>
</div>
<details class="cap-disclosure example-source" data-variant="accordion"><summary>Source: examples/${e.id}.ts</summary><div class="cap-disclosure-body"><pre tabindex="0"><code>${escapeText(e.source)}</code></pre></div></details>
</section>`,
  )
  .join("\n")}
</div>
</div>
</main>
${siteFooter()}
${galleryScript("gallery.js")}
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
    // enarratio/redraw imports the enhancement layer, which the page loads as enhance.js.
    plugins: [
      {
        name: "enhance-as-file",
        resolveId: (id: string) =>
          /(?:^|\/)enhance\/index\.js$/.test(id) ? { id: "./enhance.js", external: true } : null,
      },
    ],
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

/**
 * The accessibility statement (devkit-a11y S6): Prelum's, with this site's facts and the open finding of devkit-a11y's
 * run of 2026-11-01.
 */
const STATEMENT = accessibilityStatement({
  siteName: "The Enarratio gallery",
  contact: {
    href: "https://dustinedwards.info/contact",
    label: "the contact page on dustinedwards.info",
  },
  date: "2026-11-01",
  capsomer: true,
  links: "marked",
  limitations: [
    "At 320 pixels wide, the page for an address that does not exist scrolls sideways a little, because its introduction is wider than the screen.",
  ],
});
const STATEMENT_PAGE = "accessibility.html";

function statementPage(): string {
  return `<!doctype html>
<html lang="en" data-family="${FAMILY}">
<head>
${head(`${STATEMENT.title}: Enarratio`, STATEMENT.description, "index.css", ACCESSIBILITY_PATH)}
</head>
<body>
${siteHeader(links(STATEMENT_PAGE))}
<main class="cap-page gallery guide" id="main" tabindex="-1">
<header class="gallery-head">
<h1>${STATEMENT.title}</h1>
</header>
${STATEMENT.html}
</main>
${siteFooter()}
${galleryScript("gallery.js")}
</body>
</html>
`;
}

function astroPage(): string {
  return `<!doctype html>
<html lang="en" data-family="${FAMILY}">
<head>
${head(`${ASTRO_TITLE}: Enarratio`, ASTRO_DESCRIPTION, "index.css", pathOf(ASTRO_PAGE), [astroData])}
</head>
<body>
${siteHeader(links(ASTRO_PAGE))}
<main class="cap-page gallery guide" id="main" tabindex="-1">
<header class="gallery-head">
<h1>${ASTRO_TITLE}</h1>
<p class="gallery-intro">Enarratio's charts in Astro pages, in Markdown, and as a block in the EmDash editor.</p>
</header>
<p>Two packages bring Enarratio to <a href="https://astro.build" rel="external">Astro</a> sites and to <a href="https://github.com/emdash-cms/emdash" rel="external">EmDash</a>, the CMS built on Astro. A chart arrives in the page as HTML and SVG, drawn on the server: complete before any script runs, with a written description and a data table for screen readers, numbers that search engines and language models can read, and light and dark themes. It draws bar, line, stacked area, scatter (with an optional regression line) and heatmap charts, and can add hover details, keyboard navigation and filtering where a page asks for them.</p>
<ul>
<li><a href="https://www.npmjs.com/package/enarratio-astro" rel="external">enarratio-astro</a>: a <code>&lt;Chart&gt;</code> component and <code>chart</code> blocks in Markdown, for Astro 6 or later.</li>
<li><a href="https://www.npmjs.com/package/enarratio-emdash" rel="external">enarratio-emdash</a>: a Chart block for EmDash 1.0 or later. An editor types <code>/chart</code>, pastes data from a spreadsheet, and describes what the chart shows.</li>
</ul>
<p>Both are MIT licensed. The code is at <a href="${ASTRO_REPO}" rel="external">github.com/DrDustinEdwards/astro</a>.</p>

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
${frameHtml(sampleChart)}
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
${siteFooter()}
${galleryScript("gallery.js")}
</body>
</html>
`;
}

/**
 * The scripts, bundled before any page is written so each tag carries its file's sha384
 * (site-runtime integrityHash) and crossorigin, which Integrity-Policy needs of every script, a
 * classic one included. gallery.js imports enhance.js, which a modulepreload with its own
 * integrity fetches, so the import finds it already checked. enhance.js imports sound.js when a
 * reader presses Play, and image.js on the first download; an import() carries no integrity, so
 * both (under 2 kB each) are preloaded the same way, fetched but not run until then.
 */
const scriptFiles = {
  "gallery.js": await bundle("gallery.js", "esm"),
  "theme.js": await bundle("theme.js", "iife"),
  "enhance.js": readFileSync(join(root, "dist", "enhance", "index.js"), "utf8"),
  "sound.js": readFileSync(join(root, "dist", "enhance", "sound.js"), "utf8"),
  "image.js": readFileSync(join(root, "dist", "enhance", "image.js"), "utf8"),
};
const scripts = Object.fromEntries(
  await Promise.all(
    Object.entries(scriptFiles).map(async ([name, code]) => [name, await integrityHash(code)]),
  ),
) as Record<keyof typeof scriptFiles, string>;

/** The enhancement layer's preload and gallery.js, at `src` (relative on the gallery pages). */
function galleryScript(src: string): string {
  const at = (file: string): string => new URL(file, new URL(src, `${SITE}/`)).pathname;
  return `<link rel="modulepreload" href="${at("enhance.js")}" integrity="${scripts["enhance.js"]}" crossorigin="anonymous">
<link rel="modulepreload" href="${at("sound.js")}" integrity="${scripts["sound.js"]}" crossorigin="anonymous">
<link rel="modulepreload" href="${at("image.js")}" integrity="${scripts["image.js"]}" crossorigin="anonymous">
<script type="module" src="${src}" integrity="${scripts["gallery.js"]}" crossorigin="anonymous"></script>`;
}

const examples = await loadExamples();
writeFileSync(join(outDir, "capsomer.css"), capsomerCss(join(outDir, "fonts")));
/**
 * Each page's theme, file and stylesheet, and the theme readers who ask for more contrast get.
 * Capsomer's is the one the family's sites draw with (capsomer/enarratio-theme).
 */
const pages: [Theme, string, string, Theme][] = [
  [defaultTheme, "index.html", "index.css", highContrastTheme],
  [exampleTheme, "example.html", "example.css", highContrastTheme],
  [capsomerTheme, "capsomer.html", "capsomer-theme.css", capsomerMoreTheme],
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
    label: f === pages[0]?.[1] ? "Home" : `${t.name[0]?.toUpperCase()}${t.name.slice(1)} theme`,
    href: cleanAddress(f),
    current: f === current,
  })),
  { label: "Astro and EmDash", href: "astro", current: current === ASTRO_PAGE },
  { label: "Code", href: "https://github.com/DrDustinEdwards/enarratio", current: false },
];
for (const [theme, file, css, highContrast] of pages) {
  writeFileSync(join(outDir, css), stylesheet(theme, { highContrast }));
  writeFileSync(join(outDir, file), page(theme, file, css, examples, links(file)));
}
writeFileSync(join(outDir, ASTRO_PAGE), astroPage());
writeFileSync(join(outDir, STATEMENT_PAGE), statementPage());
const addresses = [
  ...pages.map(([, file]) => pathOf(file)),
  pathOf(ASTRO_PAGE),
  pathOf(STATEMENT_PAGE),
];
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
        "- Install: `npm install enarratio`. Code and documentation: https://github.com/DrDustinEdwards/enarratio",
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
            title: "Gallery, Capsomer theme",
            url: `${SITE}/capsomer`,
            description: "the same charts in Capsomer's theme, as the family's sites draw them",
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
<html lang="en" data-family="${FAMILY}">
<head>
${head("Not found: Enarratio gallery", "There is no page at this address.")}
</head>
<body>
${siteHeader(links(""))}
<main class="cap-page gallery" id="main" tabindex="-1">
<header class="gallery-head"><h1>Not found</h1>
<p class="gallery-intro">There is no page at this address. The gallery is at <a href="/">enarratio.dustinedwards.info</a>, and the code at <a href="https://github.com/DrDustinEdwards/enarratio" rel="external">github.com/DrDustinEdwards/enarratio</a>.</p></header>
</main>
${siteFooter()}
${galleryScript("/gallery.js")}
</body>
</html>
`,
);
// Served as files beside the pages: the gallery's scripts (Capsomer's behavior bundled in) and the
// icon. The security and caching headers are site-runtime-headers', from the gallery's registry
// entry (record 0018), which `npm run gallery` writes into _headers after this.
for (const [name, code] of Object.entries(scriptFiles)) writeFileSync(join(outDir, name), code);
copyFileSync(join(root, "site", "favicon.svg"), join(outDir, "favicon.svg"));
copyFileSync(join(root, "site", "og-card.png"), join(outDir, "og-card.png"));
// Each page's preload header names files that exist and every stylesheet the page links, and
// every page has one.
const fileOf = (path: string): string => (path === "/" ? "index.html" : `${path.slice(1)}.html`);
for (const address of addresses) {
  if (!PAGE_PRELOADS[address])
    throw new Error(`gallery: PAGE_PRELOADS has no entry for ${address}`);
}
for (const [address, { links: preloadLinks }] of Object.entries(PAGE_PRELOADS)) {
  const preloaded = preloadLinks.map((link) => link.href);
  for (const href of preloaded) readFileSync(join(outDir, href));
  const styles = [
    ...readFileSync(join(outDir, fileOf(address)), "utf8").matchAll(
      /<link rel="stylesheet" href="([^"]+)"/g,
    ),
  ].map((m) => new URL(m[1] ?? "", `${SITE}/`).pathname);
  const unlisted = styles.filter((href) => !preloaded.includes(href));
  if (unlisted.length)
    throw new Error(`gallery: PAGE_PRELOADS for ${address} leaves out ${unlisted.join(", ")}`);
}
console.log(
  `gallery: ${examples.length} examples, ${pages.length} themes, the Astro page -> ${outDir}`,
);
