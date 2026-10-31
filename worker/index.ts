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
 * package never imports this or site-runtime.
 */

import { TDM_RESERVATION_HEADERS } from "@drdustinedwards/site-helpers/robots";
import { preloads } from "@dustinedwards/site-runtime/preload";
import { enarratio } from "@dustinedwards/site-runtime/sites";
import { staticSite } from "@dustinedwards/site-runtime/static-site";

/**
 * What the home page blocks on or paints first, sent on every page as a preload `Link` header,
 * which Early Hints answers with a 103 (site-runtime `./preload`): Capsomer's stylesheet, the home
 * page's own, and the headings' and text's Schibsted Grotesk. The names are not hashed (record
 * 0008); `scripts/gallery.ts` refuses a build in which one is missing or the home page links a
 * stylesheet not listed here.
 */
export const PAGE_PRELOADS = preloads([
  { href: "/capsomer.css", as: "style" },
  { href: "/index.css", as: "style" },
  { href: "/fonts/schibsted-grotesk-latin-wght-normal.woff2", as: "font", type: "font/woff2" },
]);

export default staticSite({
  site: enarratio,
  headers: TDM_RESERVATION_HEADERS,
  preload: PAGE_PRELOADS.header,
});
