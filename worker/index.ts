/**
 * The gallery's Worker: site-runtime's `staticSite`, the one front door the family's static sites
 * share, with the gallery's headers from its registry entry (`@dustinedwards/site-runtime/sites`)
 * and Prelum's TDMRep header on top: one hop from http: to https:, Content-Security-Policy,
 * Integrity-Policy and COEP reports at /csp-report, the prefetch rules, and every page with the
 * Speculation-Rules, Server-Timing and preload Link headers (Early Hints). `npm run gallery` writes
 * `_headers` from the same entry. A path with no file gets the 404 page, private and never stored,
 * and so does a page asked for with a cookie. Gallery tooling only: the npm package never imports
 * this or site-runtime.
 */

import { serveMarkdownCopies } from "@drdustinedwards/site-helpers/llms";
import { TDM_RESERVATION_HEADERS } from "@drdustinedwards/site-helpers/robots";
import { preloads, withPreloadHeader } from "@dustinedwards/site-runtime/preload";
import { enarratio } from "@dustinedwards/site-runtime/sites";
import { withSiteSentry } from "@dustinedwards/site-runtime/sentry";
import { staticSite } from "@dustinedwards/site-runtime/static-site";

/** Capsomer's stylesheet and the headings' and text's Inter: every page paints with them. */
const SHARED = [
  { href: "/capsomer.css", as: "style" },
  { href: "/fonts/inter-latin-wght-normal.woff2", as: "font", type: "font/woff2" },
] as const;

/**
 * What each page blocks on or paints first, sent as a preload `Link` header (answered early with a
 * 103): Capsomer's stylesheet, the page's own (each theme page links its own, so preloading
 * another's would fetch a file it never uses), and Inter. `scripts/gallery.ts` refuses a build in
 * which a listed file is missing or a page links a stylesheet its entry leaves out.
 */
const own = (href: string) => preloads([SHARED[0], { href, as: "style" }, SHARED[1]]);
export const PAGE_PRELOADS: Readonly<Record<string, ReturnType<typeof preloads>>> = {
  "/": own("/index.css"),
  "/example": own("/example.css"),
  "/capsomer": own("/capsomer-theme.css"),
  "/shadcn": own("/shadcn-adapter.css"),
  "/radix": own("/radix-adapter.css"),
  "/material": own("/material-adapter.css"),
  "/astro": own("/index.css"),
  "/accessibility": own("/index.css"),
};

const site = staticSite({
  site: enarratio,
  siteName: "Enarratio",
  headers: TDM_RESERVATION_HEADERS,
});

const pages = async (
  request: Request,
  env: Parameters<typeof site.fetch>[1],
): Promise<Response> => {
  const response = await site.fetch(request, env);
  const preload = PAGE_PRELOADS[new URL(request.url).pathname];
  return response.status === 200 && preload
    ? withPreloadHeader(response, preload.header)
    : response;
};

// Each page's Markdown copy (/astro.md, or Accept: text/markdown) and llms-full.txt are files `npm run gallery` writes with
// prelum-markdown; serveMarkdownCopies answers them.
// Errors go to the Sentry project when the SENTRY_DSN secret is set (site-runtime ./sentry).
export default withSiteSentry({ fetch: serveMarkdownCopies(pages, { origin: enarratio.origin }) });
