/**
 * The gallery's security headers (record 0018): the generated `_headers` passes site-runtime's
 * check against the shared standard set, and the Worker's own responses carry the same set.
 */
import { checkSecurityHeaders, failures } from "@dustinedwards/site-runtime/check";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  headersFile,
  REPORT_PATH,
  securityHeaders,
  standardHeaders,
} from "../scripts/security-headers.ts";
import worker from "../worker/index.ts";

/** The headers `_headers` sets on a path matched by its single `/*` rule. */
function parseHeadersFile(text: string): Headers {
  const [rule, ...lines] = text.trimEnd().split("\n");
  expect(rule).toBe("/*");
  const headers = new Headers();
  for (const line of lines) {
    const match = /^ {2}([A-Za-z-]+): (.+)$/.exec(line);
    if (!match?.[1] || !match[2]) throw new Error(`not a header line: ${JSON.stringify(line)}`);
    headers.append(match[1], match[2]);
  }
  return headers;
}

const check = (headers: Headers) =>
  failures(
    checkSecurityHeaders(headers, { standard: standardHeaders, cloudflareWebAnalytics: true }),
  );

const assets = {
  async fetch(): Promise<Response> {
    return new Response("asset", { status: 200 });
  },
};

describe("gallery security headers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("the generated _headers passes checkSecurityHeaders", () => {
    const headers = parseHeadersFile(headersFile());
    expect(check(headers)).toEqual([]);
    expect(headers.get("Cache-Control")).toBe("public, max-age=300, must-revalidate");
  });

  it("the policy allows only what the gallery loads", () => {
    const policy = securityHeaders["Content-Security-Policy"];
    expect(policy).toContain(
      "script-src 'self' https://static.cloudflareinsights.com/beacon.min.js https://static.cloudflareinsights.com/beacon.min.js/;",
    );
    expect(policy).toContain("connect-src 'self' https://cloudflareinsights.com;");
    // No inline script or style anywhere, style attributes included (D4).
    expect(policy).not.toContain("'unsafe-");
    expect(policy).toContain(`report-uri ${REPORT_PATH}`);
  });

  it("the Worker's redirects carry the set and pass the check", async () => {
    const response = await worker.fetch(new Request("http://enarratio.dustinedwards.info/"), {
      ASSETS: assets,
    });
    expect(response.status).toBe(301);
    expect(check(response.headers)).toEqual([]);
  });

  it("routes reports to the shared receiver, whose answers carry the set", async () => {
    // The receiver itself is tested in site-runtime; this checks the Worker sends reports to it.
    vi.spyOn(console, "log").mockImplementation(() => {});
    const response = await worker.fetch(
      new Request(`https://enarratio.dustinedwards.info${REPORT_PATH}`, {
        method: "POST",
        body: JSON.stringify({ "csp-report": { "violated-directive": "img-src" } }),
      }),
      { ASSETS: assets },
    );
    expect(response.status).toBe(204);
    expect(check(response.headers)).toEqual([]);
  });
});
