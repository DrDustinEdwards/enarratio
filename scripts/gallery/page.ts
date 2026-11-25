import {
  ACCESSIBILITY_PATH,
  accessibilityStatement,
} from "@drdustinedwards/site-helpers/accessibility";
import { graph, thing } from "@drdustinedwards/site-helpers/schema";
import { checkTheme } from "enarratio";
import { barChart } from "enarratio/lite";
import {
  type Example,
  NARROW_WIDTH,
  frameHtml,
  frameOf,
  galleryShownHeight,
  withExpand,
} from "./examples.ts";
import { FAMILY } from "./css.ts";
import {
  ASTRO_PAGE,
  AUTHOR,
  type Link,
  VERSION,
  type View,
  adapterPage,
  adapters,
  cleanAddress,
  escapeText,
  galleryScript,
  head,
  libraryData,
  links,
  galleryPath,
  siteFooter,
  siteHeader,
} from "./site.ts";

/** One gallery page. Scripts and stylesheets are linked as files, never inline, so the CSP can allow its own origin only. */
export function page(
  view: View,
  file: string,
  css: string,
  examples: readonly Example[],
  links: readonly Link[],
): string {
  const report = "theme" in view ? checkTheme(view.theme) : undefined;
  const findings = !report
    ? ""
    : report.issues.length === 0
      ? "<p>No findings.</p>"
      : `<ul>${report.issues.map((i) => `<li>${escapeText(i.severity)}: ${escapeText(i.message)}</li>`).join("")}</ul>`;
  const name =
    "theme" in view ? `the ${view.theme.name} theme` : `the ${view.adapter.name} adapter`;
  const intro =
    "theme" in view
      ? ""
      : `<code>enarratio/adapters/${view.adapter.file}</code> on ${escapeText(view.adapter.name)}'s default ${escapeText(view.adapter.values)}. The adapter maps names, not measured colors: a site using it checks its own contrast (<a href="https://github.com/DrDustinEdwards/enarratio/blob/main/docs/adapters.md" rel="external">adapters guide</a>). The other adapters: ${adapters
          .filter((a) => a !== view.adapter)
          .map((a) => `<a href="${cleanAddress(adapterPage(a))}">${escapeText(a.name)}</a>`)
          .join(", ")}.`;
  const index = examples
    .map(
      (e, i) =>
        `<li><a class="cap-leader-index-link" href="#${e.id}"><span class="cap-leader-index-no">${i + 1}</span><span class="cap-leader-index-name">${escapeText(e.name)}</span><span class="cap-leader-index-dots" aria-hidden="true"></span><span class="cap-leader-index-fact">${e.module}</span></a></li>`,
    )
    .join("\n");
  return `<!doctype html>
<html lang="en" data-family="${FAMILY}">
<head>
${head(`Enarratio gallery: ${"theme" in view ? `${view.theme.name} theme` : `${view.adapter.name} adapter`}`, `Every Enarratio chart in ${name}, drawn on the server and readable without scripts, each with its source.`, css, galleryPath(file), [libraryData])}
</head>
<body>
${siteHeader(links)}
<main class="cap-page gallery" id="main" tabindex="-1">
<header class="gallery-head">
<h1>Enarratio gallery</h1>
${intro && `<p class="gallery-intro">${intro}</p>`}
<dl class="cap-form-boxes" data-variant="readings">
<div class="cap-form-boxes-box"><dt>Release</dt><dd>${escapeText(VERSION)}</dd></div>
<div class="cap-form-boxes-box"><dt>Charts</dt><dd>${examples.length}</dd></div>
${"theme" in view ? `<div class="cap-form-boxes-box"><dt>Theme check</dt><dd>${report?.ok ? "Passes" : "Fails"}</dd></div>` : `<div class="cap-form-boxes-box"><dt>Adapter</dt><dd>${escapeText(view.adapter.name)}</dd></div>`}
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
${report ? `<details class="cap-disclosure report"><summary>Theme check: ${report.ok ? "passes" : "fails"} with ${report.issues.length} finding${report.issues.length === 1 ? "" : "s"}</summary><div class="cap-disclosure-body">${findings}</div></details>` : ""}
${examples
  .map(
    (
      e,
      i,
    ) => `<section class="cap-panel example" id="${e.id}" data-example="${e.id}" aria-labelledby="${e.id}-title">
<header class="cap-panel-head"><h2 id="${e.id}-title"><span class="cap-part-no">${i + 1}</span>${escapeText(e.name)}</h2></header>
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
source: Illustrative data made up for this gallery
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
const drawSample = (size: { width?: number; height?: number } = {}): string =>
  barChart({
    ...size,
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
    source: "Illustrative data made up for this gallery",
  });
const sampleChart = withExpand(drawSample());
/** Its drawing for a phone, swapped in under 30rem as the gallery's examples are. */
const sampleShown = galleryShownHeight(sampleChart);
const sampleNarrow = frameOf(
  drawSample({
    width: NARROW_WIDTH,
    ...(sampleShown === undefined ? {} : { height: sampleShown }),
  }),
);

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

/** The accessibility statement: Prelum's, with this site's facts. */
const STATEMENT = accessibilityStatement({
  siteName: "The Enarratio gallery",
  contact: {
    href: "https://dustinedwards.info/contact",
    label: "the contact page on dustinedwards.info",
  },
  date: "2026-11-01",
  capsomer: true,
  links: "marked",
});
export const STATEMENT_PAGE = "accessibility.html";

export function statementPage(): string {
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

export function astroPage(): string {
  return `<!doctype html>
<html lang="en" data-family="${FAMILY}">
<head>
${head(`${ASTRO_TITLE}: Enarratio`, ASTRO_DESCRIPTION, "index.css", galleryPath(ASTRO_PAGE), [astroData])}
</head>
<body>
${siteHeader(links(ASTRO_PAGE))}
<main class="cap-page gallery guide" id="main" tabindex="-1">
<header class="gallery-head">
<h1>${ASTRO_TITLE}</h1>
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
${frameHtml(sampleChart, sampleNarrow ? { redraw: { narrow: sampleNarrow } } : {})}
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
