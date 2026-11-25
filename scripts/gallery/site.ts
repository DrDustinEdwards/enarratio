import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ACCESSIBILITY_PATH } from "@drdustinedwards/site-helpers/accessibility";
import { defineHead, headHtml } from "@drdustinedwards/site-helpers/head";
import { iconLinks } from "@drdustinedwards/site-helpers/icons";
import { graph, thing, website } from "@drdustinedwards/site-helpers/schema";
import { integrityHash } from "@dustinedwards/site-runtime/csp";
import { enarratio } from "@dustinedwards/site-runtime/sites";
import { familyFooterHtml } from "capsomer/behavior/family-footer";
import { letterheadHtml } from "capsomer/behavior/site-header";
import { capsomerMoreTheme, capsomerTheme } from "capsomer/enarratio-theme";
import type { Theme } from "enarratio";
import { defaultTheme, highContrastTheme } from "enarratio/themes";
import { rolldown } from "rolldown";
import { exampleTheme } from "../../examples/themes/example.ts";

export const root = resolve(import.meta.dirname, "..", "..");

export const escapeText = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

/** One of the package's adapters, as its gallery page shows it. */
export interface Adapter {
  /** The design system's name. */
  readonly name: string;
  /** Its file in enarratio/adapters and in examples/adapters. */
  readonly file: string;
  /** What the design system calls the default values the page draws on. */
  readonly values: string;
}

export type View = { readonly theme: Theme } | { readonly adapter: Adapter };

export interface Link {
  readonly label: string;
  readonly href: string;
  readonly current: boolean;
}

export function siteHeader(links: readonly Link[]): string {
  const current = links.find((l) => l.current)?.label;
  return letterheadHtml({
    name: "Enarratio",
    home: "./",
    mark: '<img src="/icon.svg" alt="" width="32" height="32">',
    links: links.map((l) => [l.href, l.label] as [string, string]),
    ...(current ? { current } : {}),
  });
}

/** The site's address, for canonical links, the sitemap and llms.txt. */
export const SITE = enarratio.origin;

/** The share card every page sends (site/og-card.png): the line example beside the name. */
const CARD = {
  url: "/og-card.png",
  width: 1200,
  height: 630,
  alt: "Enarratio: accessible charts, drawn on the server into the HTML.",
};

/** The author, as the structured data names him. */
export const AUTHOR = {
  "@type": "Person",
  name: "Dustin Edwards",
  url: "https://dustinedwards.info",
};

/** Prelum's head for an indexed page: the tags, the title and description cut to what a result shows, and the page's WebPage in JSON-LD. */
const pageHead = defineHead({
  origin: SITE,
  siteName: "Enarratio",
  image: CARD,
  suffix: ": Enarratio",
});

/**
 * The head every page shares: Prelum's tags, Capsomer, the page's own chart theme, then the
 * remembered theme before first paint. `address` is the page's clean path; the 404 page has none,
 * so it gets no canonical and noindex.
 */
export function head(
  title: string,
  description: string,
  themeCss?: string,
  address?: string,
  data: readonly Record<string, unknown>[] = [],
): string {
  const tags = address
    ? pageHead({ path: address, title, fullTitle: true, description })
    : [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "noindex" },
      ];
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="text-scale" content="scale">
${headHtml([...tags, ...data.map((node) => ({ "script:ld+json": node }))])}
${ICON_TAGS}
<link rel="stylesheet" href="/capsomer.css">
${themeCss ? `<link rel="stylesheet" href="${themeCss}">\n` : ""}<script src="/theme.js" integrity="${scripts["theme.js"]}" crossorigin="anonymous"></script>`;
}

/** The family icon set's links, on every page; the files are in site/icons. */
const ICON_TAGS = iconLinks()
  .map(
    (link) =>
      `<link ${Object.entries(link)
        .map(([name, value]) => `${name}="${value}"`)
        .join(" ")}>`,
  )
  .join("\n");

/** The library itself, on every gallery page: what it is, where its code is, who wrote it. */
export const libraryData = graph([
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
export const VERSION = (
  JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version: string }
).version;

export function siteFooter(): string {
  const center = `<div class="cap-family-footer-center">
<div><p class="cap-family-footer-center-name">Enarratio</p><p class="cap-family-footer-about">Accessible charts and scientific figures, drawn on the server into the HTML. Open source, MIT licensed.</p></div>
<div class="cap-family-footer-columns">
<ul class="cap-family-footer-links"><li><a href="/">Default theme</a></li><li><a href="/example">Example theme</a></li><li><a href="/capsomer">Capsomer theme</a></li>${adapters.map((a) => `<li><a href="${galleryPath(adapterPage(a))}">${escapeText(a.name)} adapter</a></li>`).join("")}<li><a href="/astro">Astro and EmDash</a></li></ul>
<ul class="cap-family-footer-links"><li><a href="https://github.com/DrDustinEdwards/enarratio" rel="external">Source</a></li><li><a href="https://www.npmjs.com/package/enarratio" rel="external">npm</a></li><li><a href="https://github.com/DrDustinEdwards/enarratio/blob/main/CHANGELOG.md" rel="external">Changes</a></li></ul>
</div>
<p class="cap-family-footer-stamp"><span>Release ${escapeText(VERSION)}</span></p>
</div>`;
  return `<footer class="cap-page">${familyFooterHtml({ site: "enarratio", center, statement: ACCESSIBILITY_PATH })}</footer>`;
}

/**
 * Bundles a script of site/ for the browser. Capsomer's lazy parts are inlined with
 * `codeSplitting: false`, so each page script stays one file with one integrity hash: an import()
 * carries none, and Integrity-Policy would refuse it.
 */
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
  const { output } = await built.generate({ format, minify: true, codeSplitting: false });
  await built.close();
  const [chunk] = output;
  if (output.length !== 1 || chunk?.type !== "chunk")
    throw new Error(`${file}: expected one chunk`);
  return chunk.code;
}

/** The page for Enarratio in Astro and EmDash sites, served at /astro. */
export const ASTRO_PAGE = "astro.html";

/**
 * The scripts, bundled before any page is written so each tag carries its sha384 and crossorigin,
 * which Integrity-Policy needs of every script. gallery.js imports enhance.js, preloaded with its
 * own integrity; sound.js and image.js load by import(), which carries none, so they are
 * preloaded the same way and not run until needed.
 */
export const scriptFiles = {
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

export function galleryScript(src: string): string {
  const at = (file: string): string => new URL(file, new URL(src, `${SITE}/`)).pathname;
  return `<link rel="modulepreload" href="${at("enhance.js")}" integrity="${scripts["enhance.js"]}" crossorigin="anonymous">
<link rel="modulepreload" href="${at("sound.js")}" integrity="${scripts["sound.js"]}" crossorigin="anonymous">
<link rel="modulepreload" href="${at("image.js")}" integrity="${scripts["image.js"]}" crossorigin="anonymous">
<script type="module" src="${src}" integrity="${scripts["gallery.js"]}" crossorigin="anonymous"></script>`;
}

/** Each page's theme, file and stylesheet, and the theme readers who ask for more contrast get. */
export const pages: [Theme, string, string, Theme][] = [
  [defaultTheme, "index.html", "index.css", highContrastTheme],
  [exampleTheme, "example.html", "example.css", highContrastTheme],
  [capsomerTheme, "capsomer.html", "capsomer-theme.css", capsomerMoreTheme],
];
/** The adapter pages: each draws every example through one adapter, on that design system's own default values. */
export const adapters: Adapter[] = [
  {
    name: "shadcn/ui",
    file: "shadcn.css",
    values: "theme, its chart colors adjusted for contrast",
  },
  { name: "Radix Colors", file: "radix.css", values: "scales" },
  { name: "Material Design 3", file: "material.css", values: "baseline scheme" },
];
export const adapterPage = (a: Adapter): string => a.file.replace(/\.css$/, ".html");
/** The address a page is linked at: the host serves index.html at the directory and other pages without their extension. */
export const cleanAddress = (file: string): string =>
  file === "index.html" ? "./" : file.replace(/\.html$/, "");
/** The same address from the site's root, for canonical links and the sitemap. */
export const galleryPath = (file: string): string =>
  file === "index.html" ? "/" : `/${file.replace(/\.html$/, "")}`;
export const links = (current: string): Link[] => [
  ...pages.map(([t, f]) => ({
    label: f === pages[0]?.[1] ? "Home" : `${t.name[0]?.toUpperCase()}${t.name.slice(1)} theme`,
    href: cleanAddress(f),
    current: f === current,
  })),
  {
    label: "Adapters",
    href: cleanAddress(adapterPage(adapters[0] as Adapter)),
    current: adapters.some((a) => adapterPage(a) === current),
  },
  { label: "Astro and EmDash", href: "astro", current: current === ASTRO_PAGE },
  { label: "Code", href: "https://github.com/DrDustinEdwards/enarratio", current: false },
];
