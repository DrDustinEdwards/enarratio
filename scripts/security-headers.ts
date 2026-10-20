/**
 * The gallery's security headers: its own list of what it loads, and site-runtime's builders
 * (`@dustinedwards/site-runtime`, design record 0018). This is the only place they are set up.
 * `scripts/gallery.ts` calls `writeHeadersFile` to put them in `site/dist/_headers` for every
 * static file, and the Worker (`worker/index.ts`) sends `securityHeaders` on the responses it makes
 * itself (its redirects and the report endpoint). Gallery tooling only: the npm package never
 * imports this or site-runtime.
 */

import { buildContentSecurityPolicy } from "@dustinedwards/site-runtime/csp";
import { buildSecurityHeaders } from "@dustinedwards/site-runtime/headers";

/** The gallery's address. */
export const HOST = "enarratio.dustinedwards.info";

/** Where browsers send Content-Security-Policy violation reports; the Worker logs them. */
export const REPORT_PATH = "/csp-report";

/** The Reporting API group the policy's `report-to` names. */
const REPORT_GROUP = "csp-endpoint";

/**
 * The policy, from what the gallery loads beyond its own origin: `data:` images (charts may embed
 * them), style attributes (record 0008: chart color overrides and Observable Plot write them), the
 * Cloudflare Web Analytics beacon the zone injects, and the beacon's reports to
 * cloudflareinsights.com, which record 0008 measured alongside the zone's own /cdn-cgi/rum.
 */
const csp = buildContentSecurityPolicy({
  sources: { img: ["data:"], connect: ["https://cloudflareinsights.com"] },
  styleAttributesInline: true,
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
  // The Reporting API needs an absolute address for the group `report-to` names; `report-uri`
  // covers browsers without it.
  "Reporting-Endpoints": `${REPORT_GROUP}="https://${HOST}${REPORT_PATH}"`,
});

/**
 * Five minutes: file names are not hashed, so a longer cache would serve stale pages and scripts
 * after a deploy (record 0008).
 */
const CACHE_CONTROL = "public, max-age=300, must-revalidate";

/** The `_headers` file for the static assets: the security set and the cache rule, on every path. */
export function headersFile(): string {
  const lines = Object.entries({ ...securityHeaders, "Cache-Control": CACHE_CONTROL }).map(
    ([name, value]) => `  ${name}: ${value}`,
  );
  return `/*\n${lines.join("\n")}\n`;
}

/**
 * Writes `_headers` into the built gallery. node:fs is fetched when called rather than imported,
 * because the Worker imports this module and the Workers runtime here has no node:fs.
 */
export function writeHeadersFile(outDir: string): void {
  const { writeFileSync } = process.getBuiltinModule("node:fs");
  writeFileSync(`${outDir}/_headers`, headersFile());
}
