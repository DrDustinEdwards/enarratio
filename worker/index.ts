/**
 * The gallery's Worker: site-runtime's `staticSite`, the one front door the family's static sites
 * share. One hop from http: to https: (308 for a method other than GET and HEAD, never cached);
 * Content-Security-Policy violation reports at /csp-report with site-runtime's shared receiver;
 * the prefetch rules at /speculation-rules.json; and every page with the Speculation-Rules,
 * Server-Timing and preload Link headers (Early Hints), charset=utf-8, and any header of the
 * security set from scripts/security-headers.ts (record 0018) its `_headers` rules left out. A path
 * with no file gets the 404 page, private and never stored, and so does a page asked for with a
 * cookie. wrangler.jsonc runs it first for every path but /fonts/*.
 */

import { staticSite } from "@dustinedwards/site-runtime/static-site";
import { PAGE_PRELOADS, REPORT_PATH, securityHeaders } from "../scripts/security-headers.ts";

export default staticSite({
  headers: securityHeaders,
  preload: PAGE_PRELOADS.header,
  reportPath: REPORT_PATH,
});
