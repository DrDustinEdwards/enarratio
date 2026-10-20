# 0018. The gallery's security headers come from site-runtime

Status: accepted, 2026-10-20. Replaces point 3 of [0008](0008-gallery-hosting.md) (the
hand-written `site/_headers`); its reasons for allowing style attributes and Cloudflare Web
Analytics still hold.

## Decision

**Author's decision (Dustin Edwards).** Every portfolio site takes its security headers from the
shared package `@dustinedwards/site-runtime` (capsid/decisions.md, "shared functions across the
sites", point 5), and for the gallery: "fix all the gaps". The hand-written `site/_headers` sent
a Content-Security-Policy, HSTS, Referrer-Policy, Permissions-Policy and nosniff, and lacked the
rest of the shared set: framing refused, the cross-origin opener and resource policies,
`object-src 'none'`, a report sink, a two-year HSTS and the full Permissions-Policy.

## Implementation choices

1. **One file.** `scripts/security-headers.ts` holds the gallery's own list (what it loads
   beyond itself) and calls site-runtime's `buildSecurityHeaders` and
   `buildContentSecurityPolicy`. It exports `securityHeaders` and `writeHeadersFile`, which
   `npm run gallery` calls to write `site/dist/_headers`. No other file sets up a header.
2. **The standard set, no overrides.** OWASP's defaults as site-runtime carries them. Two
   changes from 0008 follow: `Referrer-Policy: no-referrer` (the gallery needs no referrer
   anywhere), and HSTS for two years with `includeSubDomains`. 0008 left `includeSubDomains`
   out for fear of other dustinedwards.info subdomains, but on this host it covers only
   subdomains of enarratio.dustinedwards.info, of which there are none.
3. **The policy.** Built from: `data:` images, style attributes (0008), the Cloudflare beacon
   (site-runtime's `CLOUDFLARE_WEB_ANALYTICS`, a path prefix rather than the whole host), and
   connections to cloudflareinsights.com, which 0008 measured the beacon reporting to. The fixed
   parts (`default-src 'self'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'self'`,
   `frame-ancestors 'none'`) are site-runtime's.
4. **A report sink on a static site.** The gallery already has a Worker in front of its assets
   (0009), so it receives reports at `/csp-report`: `report-uri /csp-report`, and `report-to`
   with a `Reporting-Endpoints` group at the same address. The Worker logs one line per
   violation (directive, blocked address, page and source file, each without its query string;
   no IP address or user agent) and answers 204. Workers Logs keep those lines; invocation logs
   stay off, so nothing else about a reader is recorded.
5. **Every response.** The Worker's own responses (its redirects and the report endpoint) carry
   `securityHeaders` too, as site-runtime asks ("redirects included").
6. **Proved in CI.** `test/security-headers.test.ts` runs site-runtime's `checkSecurityHeaders`
   on the generated `_headers`, on a redirect and on the report endpoint's answer.
7. **The package is untouched.** site-runtime is a devDependency used only by the gallery
   tooling and the Worker; nothing under `src/` imports it, and the package still has no
   dependencies.
