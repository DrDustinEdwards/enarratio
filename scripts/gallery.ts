/**
 * Builds the gallery: one page per theme showing every example in examples/, its source and the
 * events the enhancement layer fires. Run after `npm run build`; the examples import "enarratio",
 * which resolves to this package's own dist. The page around the charts is Capsomer's, and one page
 * is Capsomer's own theme. Gallery tooling only: the npm package never imports Capsomer.
 *
 *   node scripts/gallery.ts [outDir]
 */

import { copyFileSync, cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { webManifest } from "@drdustinedwards/site-helpers/icons";
import { llmsDocument } from "@drdustinedwards/site-helpers/llms";
import { aiTxt, robotsDocument } from "@drdustinedwards/site-helpers/robots";
import { sitemapDocument } from "@drdustinedwards/site-helpers/sitemap";
import { securityTxt } from "@dustinedwards/site-runtime/security-txt";
import { inlineCss } from "capsomer/build";
import { capsomerTheme } from "capsomer/enarratio-theme";
import { stylesheet } from "enarratio";
import { PAGE_PRELOADS } from "../worker/index.ts";
import { examplesDir, loadExamples } from "./gallery/examples.ts";
import { FAMILY, capsomerCss, packageFile } from "./gallery/css.ts";
import {
  ASTRO_PAGE,
  SITE,
  adapterPage,
  adapters,
  galleryScript,
  head,
  links,
  pages,
  pathOf,
  root,
  scriptFiles,
  siteFooter,
  siteHeader,
} from "./gallery/site.ts";
import { STATEMENT_PAGE, astroPage, page, statementPage } from "./gallery/page.ts";

/** The IndexNow key, served as /<key>.txt; .github/workflows/ci.yml's indexnow job reads it here to ping IndexNow. Public by design. */
const INDEXNOW_KEY = "af8c0a9cc5d66f499272f9cd7b95b024";

/** When security.txt lapses (RFC 9116 asks for under a year); renew it before then. */
const SECURITY_TXT_EXPIRES = "2027-10-25T00:00:00Z";

/** When the pages last changed, for the sitemap's lastmod: the latest release in CHANGELOG.md. */
const RELEASED = /^## \[[\d.]+\] - (\d{4}-\d{2}-\d{2})/m.exec(
  readFileSync(join(root, "CHANGELOG.md"), "utf8"),
)?.[1];

const outDir = resolve(process.argv[2] ?? join(root, "site", "dist"));

const examples = await loadExamples();
writeFileSync(join(outDir, "capsomer.css"), capsomerCss(join(outDir, "fonts"), examples));
for (const [theme, file, css, highContrast] of pages) {
  // The Capsomer page loads capsomer/enarratio.css, so it shows charts as they appear on the family's sites; the other pages show Enarratio's own themes.
  const themeCss =
    theme === capsomerTheme
      ? inlineCss(packageFile("capsomer/enarratio.css"))
      : stylesheet(theme, { highContrast });
  writeFileSync(join(outDir, css), themeCss);
  writeFileSync(join(outDir, file), page({ theme }, file, css, examples, links(file)));
}
for (const adapter of adapters) {
  const file = adapterPage(adapter);
  const css = `${adapter.file.replace(/\.css$/, "")}-adapter.css`;
  writeFileSync(
    join(outDir, css),
    [
      inlineCss(join(examplesDir, "adapters", adapter.file)),
      readFileSync(join(root, "dist", "base.css"), "utf8"),
      inlineCss(join(root, "dist", "adapters", adapter.file)),
      // A chart sits on its design system's own background, which its default colors are chosen against.
      ":where(.enarratio) { background: var(--enarratio-background); }",
    ].join("\n"),
  );
  writeFileSync(join(outDir, file), page({ adapter }, file, css, examples, links(file)));
}
writeFileSync(join(outDir, ASTRO_PAGE), astroPage());
writeFileSync(join(outDir, STATEMENT_PAGE), statementPage());
const addresses = [
  ...pages.map(([, file]) => pathOf(file)),
  ...adapters.map((a) => pathOf(adapterPage(a))),
  pathOf(ASTRO_PAGE),
  pathOf(STATEMENT_PAGE),
];
// For search engines and language models, from Prelum: sitemap, robots.txt, ai.txt (citation welcome, training reserved), llms.txt, security.txt and the IndexNow key file.
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
  sitemapDocument(addresses.map((a) => ({ loc: `${SITE}${a}`, lastmod: RELEASED ?? null }))),
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
          ...adapters.map((a) => ({
            title: `Gallery, ${a.name} adapter`,
            url: `${SITE}${pathOf(adapterPage(a))}`,
            description: `the same charts through enarratio/adapters/${a.file}, on ${a.name}'s default ${a.values}`,
          })),
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
// Served as files beside the pages: the gallery's scripts and the icon. Headers come from site-runtime-headers' registry entry, written into _headers by `npm run gallery`.
for (const [name, code] of Object.entries(scriptFiles)) writeFileSync(join(outDir, name), code);
// The family icon set (prelum-icons from the mark, in site/icons) at the root, where iconLinks() and the manifest point.
cpSync(join(root, "site", "icons"), outDir, { recursive: true });
writeFileSync(
  join(outDir, "site.webmanifest"),
  JSON.stringify(
    webManifest({
      name: "Enarratio",
      themeColor: "#0f6cbd",
      backgroundColor: "#0f6cbd",
      lang: "en",
    }),
  ),
);
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
  `gallery: ${examples.length} examples, ${pages.length} themes, ${adapters.length} adapters, the Astro page -> ${outDir}`,
);
