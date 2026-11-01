/**
 * The gallery's Worker: site-runtime's `staticSite`, the one front door the family's static sites
 * share, with the gallery's headers from its registry entry (`@dustinedwards/site-runtime/sites`,
 * enarratio; record 0018) and Prelum's TDMRep header on top. One hop from http: to https: (308
 * for a method other than GET and HEAD, never cached); Content-Security-Policy, Integrity-Policy
 * and COEP reports at /csp-report with site-runtime's shared receiver; the prefetch rules at
 * /speculation-rules.json; and every page with the Speculation-Rules, Server-Timing and preload
 * Link headers (Early Hints), charset=utf-8, and any header of the set its `_headers` rules left
 * out. `npm run gallery` writes `_headers` from the same entry (site-runtime-headers). A path with
 * no file gets the 404 page, private and never stored, and so does a page asked for with a
 * cookie. wrangler.jsonc runs it first for every path but /fonts/*. Gallery tooling only: the npm
 * package never imports this or site-runtime. Prelum's serveMarkdownCopies wraps it: each page's
 * Markdown copy.
 */

import { serveMarkdownCopies } from "@drdustinedwards/site-helpers/llms";
import { TDM_RESERVATION_HEADERS } from "@drdustinedwards/site-helpers/robots";
import { preloads, withPreloadHeader } from "@dustinedwards/site-runtime/preload";
import { enarratio } from "@dustinedwards/site-runtime/sites";
import { staticSite } from "@dustinedwards/site-runtime/static-site";

/** Capsomer's stylesheet and the headings' and text's Schibsted Grotesk: every page paints with them. */
const SHARED = [
  { href: "/capsomer.css", as: "style" },
  { href: "/fonts/schibsted-grotesk-latin-wght-normal.woff2", as: "font", type: "font/woff2" },
] as const;

/**
 * What each page blocks on or paints first, sent as a preload `Link` header, which Early Hints
 * answers with a 103 (site-runtime `./preload`): Capsomer's stylesheet, the page's own (each
 * theme page links its own, so a page that preloaded another's would fetch a file it never uses
 * and discover its own only after the HTML), and Schibsted Grotesk. The names are not hashed
 * (record 0008); `scripts/gallery.ts` refuses a build in which a listed file is missing or a page
 * links a stylesheet its entry leaves out.
 */
const own = (href: string) => preloads([SHARED[0], { href, as: "style" }, SHARED[1]]);
export const PAGE_PRELOADS: Readonly<Record<string, ReturnType<typeof preloads>>> = {
  "/": own("/index.css"),
  "/example": own("/example.css"),
  "/capsomer": own("/capsomer-theme.css"),
  "/astro": own("/index.css"),
};

const site = staticSite({ site: enarratio, headers: TDM_RESERVATION_HEADERS });

async function gallery(request: Request, env: Parameters<typeof site.fetch>[1]): Promise<Response> {
  const response = await site.fetch(request, env);
  const preload = PAGE_PRELOADS[new URL(request.url).pathname];
  return response.status === 200 && preload
    ? withPreloadHeader(response, preload.header)
    : response;
}

/** Every page's Markdown copy (/example.md, or Accept: text/markdown), which `npm run gallery` writes with prelum-markdown. */
export default { fetch: serveMarkdownCopies(gallery, { origin: enarratio.origin }) };
