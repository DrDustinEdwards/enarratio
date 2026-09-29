# 0008. Hosting the gallery, and its Content-Security-Policy

Status: accepted, 2026-09-28. Amended by [0009](0009-review-fixes.md) after the two reviews,
and by [0010](0010-rename-to-enarratio.md) for the new name and address.

## Decision

**Author's decision.** The documentation and gallery live at
enarratio.dustinedwards.info, hosted on Cloudflare, where the dustinedwards.info
zone already is.

**Implementation choices.**

1. **An assets Worker.** (Since 0009, a few lines of Worker code in
   `worker/index.ts` run first, only to redirect `http:` to `https:`.) `wrangler.jsonc` names a Worker,
   `enarratio-gallery` (named `abscissa-gallery` until 0010), that serves `site/dist` (built by `npm run gallery`) on
   the custom domain, with no `workers.dev` address and no
   preview URLs. A missing path gets `404.html`. The file carries no account
   id, because the repository is public; wrangler takes it from the login or
   from `CLOUDFLARE_ACCOUNT_ID`. Pages are served at clean addresses (`/` and
   `/dustinedwards`), Cloudflare's default HTML handling, which redirects the
   `.html` form there; the gallery links the clean addresses so no link costs
   a redirect. (Turning the handling off serves `.html` directly but leaves `/`
   without a page.)
2. **No inline script or style blocks.** Each page links its stylesheet
   (`index.css`, `dustinedwards.css`: the theme's stylesheet, the page's
   colors and layout) and one script, `gallery.js`, which imports
   `enhance.js`. This lets the policy below allow scripts from the site's own
   origin only.
3. **The headers** (`site/_headers`, copied into `site/dist`):

   | Header | Value | Why |
   |---|---|---|
   | Content-Security-Policy | `default-src 'none'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self'; style-src-elem 'self'; style-src-attr 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://cloudflareinsights.com; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'` | Nothing loads unless listed; scripts only from the site itself and Cloudflare Web Analytics; style sheets only from the site, inline styles only as attributes. |
   | X-Content-Type-Options | `nosniff` | Files are only what their type says. |
   | Referrer-Policy | `strict-origin-when-cross-origin` | Other sites see only the origin. |
   | Cache-Control | `public, max-age=300, must-revalidate` | Five minutes: file names are not hashed, so a longer cache would serve stale pages and scripts after a deploy. |
   | Strict-Transport-Security | `max-age=31536000` | Browsers use HTTPS for a year after a visit. No `includeSubDomains`: not every dustinedwards.info subdomain is known to be HTTPS-only. |
   | Permissions-Policy | `accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()` | Device features the gallery never uses are off. |

   **Why `style-src-attr` allows `'unsafe-inline'`.** A chart given color
   overrides (`colors`, or `color` on a primitive) sets its palette slots in a
   `style` attribute on the figure or SVG, and Observable Plot writes `style`
   attributes when a chart passes it style options. A policy without
   `'unsafe-inline'` blocks every `style` attribute, which would silently drop
   those colors. The current gallery examples happen to use none, but the
   policy is written for the charts the package can produce.

   **Why Cloudflare Web Analytics is allowed.** The dustinedwards.info zone
   has Web Analytics with automatic injection on, so Cloudflare adds its
   beacon script to every page it serves. The first deploy, with scripts
   limited to `'self'`, blocked it: an error in every visitor's console and
   no analytics for the gallery. The policy therefore allows exactly the
   beacon's script origin and the addresses it reports to (the zone's own
   `/cdn-cgi/rum`, hence `connect-src 'self'`, and cloudflareinsights.com). The author chose to
   keep analytics on the gallery (2026-09-28), so both allowances stay; excluding
   this hostname in the zone's Web Analytics settings would let them be removed. Inline styles cannot run
   code, and scripts stay limited to `'self'`, so the risk this admits is
   small. Sites embedding Enarratio charts need the same allowance for styles.
4. **Deploys.** `npm run deploy:gallery` builds the package and the gallery
   and runs a pinned wrangler (`npx --yes wrangler@4.143.0 deploy`, not a
   dependency). The "Deploy gallery" workflow runs it on pushes to `main`
   when the repository has `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
   secrets, and otherwise posts a notice and stops.
