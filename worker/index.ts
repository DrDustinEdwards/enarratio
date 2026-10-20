/**
 * The gallery's Worker: sends plain HTTP to HTTPS and the old hostname to the new one, receives
 * Content-Security-Policy violation reports, and serves everything else from the static assets. It
 * runs in front of the assets (`run_worker_first`) so it sees http: requests, which the assets
 * layer would otherwise answer directly (A14, F16). The assets carry the security headers from
 * `_headers`; the responses made here carry the same set, from scripts/security-headers.ts (record 0018).
 */

import { applyHeaderSet } from "@dustinedwards/site-runtime/headers";
import { HOST, REPORT_PATH, securityHeaders } from "../scripts/security-headers.ts";

export { HOST };

/** The assets binding wrangler provides as `env.ASSETS`. */
export interface Env {
  readonly ASSETS: { fetch(request: Request): Promise<Response> };
}

/** The gallery's address before the rename to Enarratio (design record 0010). */
export const OLD_HOST = "abscissa.dustinedwards.info";

/** A report body larger than this is refused unread: a real one is well under 2 kB. */
const MAX_REPORT_BYTES = 16_384;

/** At most this many reports are logged from one request. */
const MAX_REPORTS = 10;

/** A response made by the Worker, with the gallery's security headers. */
function respond(status: number, headers: Record<string, string> = {}): Response {
  const response = new Response(null, { status, headers });
  applyHeaderSet(response.headers, securityHeaders);
  return response;
}

/** A URL reduced to its origin and path, so no query string reaches the log. */
function trimUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value === "") return undefined;
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    // "inline", "eval", "data" and the like are keywords, not URLs.
    return value.slice(0, 64);
  }
}

const field = (body: Record<string, unknown>, ...names: string[]): unknown =>
  names.map((name) => body[name]).find((value) => value !== undefined);

/**
 * The violations in a report body, in either format browsers send: the Reporting API's array of
 * `{ type: "csp-violation", body }` (application/reports+json) or report-uri's
 * `{ "csp-report": {...} }` (application/csp-report).
 */
function violations(parsed: unknown): Record<string, unknown>[] {
  const isObject = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null;
  if (Array.isArray(parsed)) {
    return parsed
      .filter((r) => isObject(r) && r["type"] === "csp-violation" && isObject(r["body"]))
      .map((r) => (r as { body: Record<string, unknown> }).body);
  }
  if (isObject(parsed) && isObject(parsed["csp-report"])) return [parsed["csp-report"]];
  return [];
}

/** Logs each violation as one line (no address, no query string, no user agent) and answers 204. */
async function receiveReport(request: Request): Promise<Response> {
  if (request.method !== "POST") return respond(405, { Allow: "POST" });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_REPORT_BYTES) return respond(413);
  const text = await request.text();
  if (text.length > MAX_REPORT_BYTES) return respond(413);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return respond(400);
  }
  for (const body of violations(parsed).slice(0, MAX_REPORTS)) {
    console.log(
      JSON.stringify({
        event: "csp-violation",
        directive: field(body, "effectiveDirective", "effective-directive", "violated-directive"),
        blocked: trimUrl(field(body, "blockedURL", "blocked-uri")),
        page: trimUrl(field(body, "documentURL", "document-uri")),
        source: trimUrl(field(body, "sourceFile", "source-file")),
        line: field(body, "lineNumber", "line-number"),
        disposition: field(body, "disposition"),
      }),
    );
  }
  return respond(204);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.protocol === "http:" || url.hostname === OLD_HOST) {
      url.protocol = "https:";
      if (url.hostname === OLD_HOST) url.hostname = HOST;
      return respond(301, { Location: url.toString() });
    }
    if (url.pathname === REPORT_PATH) return receiveReport(request);
    return env.ASSETS.fetch(request);
  },
};
