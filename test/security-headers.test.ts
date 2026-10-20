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
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-/);
    expect(policy).toContain(`report-uri ${REPORT_PATH}`);
  });

  it("the Worker's redirects carry the set and pass the check", async () => {
    const response = await worker.fetch(new Request("http://enarratio.dustinedwards.info/"), {
      ASSETS: assets,
    });
    expect(response.status).toBe(301);
    expect(check(response.headers)).toEqual([]);
  });

  it("the report endpoint logs each violation without query strings and answers 204", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const body = JSON.stringify([
      {
        type: "csp-violation",
        body: {
          documentURL: "https://enarratio.dustinedwards.info/example?q=private",
          blockedURL: "https://evil.example.com/x.js?token=1",
          effectiveDirective: "script-src-elem",
          disposition: "enforce",
        },
      },
    ]);
    const response = await worker.fetch(
      new Request(`https://enarratio.dustinedwards.info${REPORT_PATH}`, {
        method: "POST",
        headers: { "content-type": "application/reports+json" },
        body,
      }),
      { ASSETS: assets },
    );
    expect(response.status).toBe(204);
    expect(check(response.headers)).toEqual([]);
    expect(log).toHaveBeenCalledTimes(1);
    const line = JSON.parse(String(log.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(line).toMatchObject({
      event: "csp-violation",
      directive: "script-src-elem",
      blocked: "https://evil.example.com/x.js",
      page: "https://enarratio.dustinedwards.info/example",
    });
  });

  it("the report endpoint accepts the report-uri format and refuses other methods and bad bodies", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const post = (body: string) =>
      worker.fetch(
        new Request(`https://enarratio.dustinedwards.info${REPORT_PATH}`, { method: "POST", body }),
        { ASSETS: assets },
      );
    const legacy = JSON.stringify({ "csp-report": { "violated-directive": "img-src" } });
    expect((await post(legacy)).status).toBe(204);
    expect((await post("not json")).status).toBe(400);
    expect((await post("x".repeat(20_000))).status).toBe(413);
    const get = await worker.fetch(
      new Request(`https://enarratio.dustinedwards.info${REPORT_PATH}`),
      { ASSETS: assets },
    );
    expect(get.status).toBe(405);
  });
});
