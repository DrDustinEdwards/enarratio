/**
 * The gallery's security headers: its own list of what it loads, and site-runtime's builders
 * (`@dustinedwards/site-runtime`, design record 0018). This is the only place they are set up.
 * `scripts/gallery.ts` writes `galleryHeadersFile` to `site/dist/_headers` for every static file,
 * and the Worker (`worker/index.ts`) sends `securityHeaders` on the responses it makes
 * itself (its redirects and the report endpoint). Gallery tooling only: the npm package never
 * imports this or site-runtime.
 */

import { TDM_RESERVATION_HEADERS } from "@drdustinedwards/site-helpers/robots";
import { buildContentSecurityPolicy, reportingEndpoints } from "@dustinedwards/site-runtime/csp";
import { buildSecurityHeaders, headersFile } from "@dustinedwards/site-runtime/headers";

/** The gallery's address. */
export const HOST = "enarratio.dustinedwards.info";

/** Where browsers send Content-Security-Policy violation reports; the Worker logs them. */
export const REPORT_PATH = "/csp-report";

/** The Reporting API group the policy's `report-to` names. */
const REPORT_GROUP = "csp-endpoint";

/**
 * The policy, from what the gallery loads beyond its own origin: `data:` images (charts may embed
 * them), the Cloudflare Web Analytics beacon the zone injects, and the beacon's reports to
 * cloudflareinsights.com, which record 0008 measured alongside the zone's own /cdn-cgi/rum. Style
 * attributes are no longer allowed: charts write none (record 0022).
 */
const csp = buildContentSecurityPolicy({
  sources: { img: ["data:"], connect: ["https://cloudflareinsights.com"] },
  cloudflareWebAnalytics: true,
  reportUri: REPORT_PATH,
  reportTo: REPORT_GROUP,
});

/** The shared standard set (OWASP's defaults, no overrides), which the check grades against. */
export const standardHeaders = buildSecurityHeaders();

/** Every security header the gallery sends, in the order `_headers` lists them. */
export const securityHeaders: Readonly<Record<string, string>> = Object.freeze({
  ...standardHeaders,
  [csp.name]: csp.value,
  // The group `report-to` names; `report-uri` covers browsers without the Reporting API.
  "Reporting-Endpoints": reportingEndpoints(REPORT_GROUP, new URL(REPORT_PATH, `https://${HOST}`)),
  // Prelum's TDMRep header: training rights reserved, as /ai.txt says.
  ...TDM_RESERVATION_HEADERS,
});

/**
 * Five minutes: file names are not hashed, so a longer cache would serve stale pages and scripts
 * after a deploy (record 0008).
 */
const CACHE_CONTROL = "public, max-age=300, must-revalidate";

/**
 * The `_headers` file for the static assets, from site-runtime's `headersFile`: the set and the
 * cache rule on every path, and charset=utf-8 on the HTML, XML, SVG and text files, which the asset
 * server sends without one. The writer leaves the policy out of `/*`, since a page's policy can
 * carry a nonce; the gallery's has none, so it goes back on `/*` as a second rule, which Cloudflare
 * joins with the first. `scripts/gallery.ts` writes it into the build.
 */
export function galleryHeadersFile(): string {
  return headersFile(
    { ...securityHeaders, "Cache-Control": CACHE_CONTROL },
    { charset: true, paths: { "/*": { [csp.name]: csp.value } } },
  );
}
