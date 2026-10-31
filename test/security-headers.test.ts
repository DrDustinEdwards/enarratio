/**
 * The gallery's security headers (record 0018): the generated `_headers` passes site-runtime's
 * check against the shared standard set. The Worker is site-runtime's staticSite, tested there.
 */
import { checkSecurityHeaders, failures } from "@dustinedwards/site-runtime/check";
import { describe, expect, it } from "vitest";
import {
  galleryHeadersFile,
  REPORT_PATH,
  securityHeaders,
  standardHeaders,
} from "../scripts/security-headers.ts";

/** The headers `_headers` sets on every path: its `/*` rules, which Cloudflare joins. */
function parseHeadersFile(text: string): Headers {
  const headers = new Headers();
  for (const block of text.trimEnd().split("\n\n")) {
    const [rule, ...lines] = block.split("\n");
    if (rule !== "/*") continue;
    for (const line of lines) {
      const match = /^ {2}([A-Za-z-]+): (.+)$/.exec(line);
      if (!match?.[1] || !match[2]) throw new Error(`not a header line: ${JSON.stringify(line)}`);
      headers.append(match[1], match[2]);
    }
  }
  return headers;
}

const check = (headers: Headers) =>
  failures(
    checkSecurityHeaders(headers, { standard: standardHeaders, cloudflareWebAnalytics: true }),
  );

describe("gallery security headers", () => {
  it("the generated _headers passes checkSecurityHeaders", () => {
    const headers = parseHeadersFile(galleryHeadersFile());
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
});
