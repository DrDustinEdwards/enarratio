/**
 * The gallery's Worker: sends plain HTTP to HTTPS and the old hostname to the new one, receives
 * Content-Security-Policy violation reports with site-runtime's shared receiver, and serves
 * everything else from the static assets. It runs in front of the assets (`run_worker_first`) so
 * it sees http: requests, which the assets layer would otherwise answer directly. The assets carry
 * the security headers from `_headers`; the responses made here carry the same set, from
 * scripts/security-headers.ts (record 0018).
 */

import { receiveCspReport } from "@dustinedwards/site-runtime/csp-report";
import { applyHeaderSet } from "@dustinedwards/site-runtime/headers";
import { HOST, REPORT_PATH, securityHeaders } from "../scripts/security-headers.ts";

export { HOST };

/** The assets binding wrangler provides as `env.ASSETS`. */
export interface Env {
  readonly ASSETS: { fetch(request: Request): Promise<Response> };
}

/** The gallery's address before the rename to Enarratio (design record 0010). */
export const OLD_HOST = "abscissa.dustinedwards.info";

/** A response made by the Worker, with the gallery's security headers. */
function respond(status: number, headers: Record<string, string> = {}): Response {
  const response = new Response(null, { status, headers });
  applyHeaderSet(response.headers, securityHeaders);
  return response;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.protocol === "http:" || url.hostname === OLD_HOST) {
      url.protocol = "https:";
      if (url.hostname === OLD_HOST) url.hostname = HOST;
      // 308 for anything but GET and HEAD, so a POST stays a POST (a 301 lets the browser turn it into a GET and drop
      // the body), and never cached, as on dustinedwards.info (app/lib/https-redirect.mjs).
      const read = request.method === "GET" || request.method === "HEAD";
      return respond(read ? 301 : 308, { Location: url.toString(), "Cache-Control": "no-store" });
    }
    if (url.pathname === REPORT_PATH)
      return receiveCspReport(request, { headers: securityHeaders });
    return env.ASSETS.fetch(request);
  },
};
