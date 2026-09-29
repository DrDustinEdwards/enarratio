/** The gallery Worker (A14, F16): http: is redirected to https:, everything else is served. */
import { describe, expect, it } from "vitest";
import worker from "../worker/index.ts";

const assets = {
  requests: [] as string[],
  async fetch(request: Request): Promise<Response> {
    this.requests.push(request.url);
    return new Response("asset", { status: 200 });
  },
};

describe("gallery worker", () => {
  it("redirects http to https permanently, keeping the path and query (A14, F16)", async () => {
    const response = await worker.fetch(
      new Request("http://abscissa.dustinedwards.info/dustinedwards?x=1"),
      { ASSETS: assets },
    );
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(
      "https://abscissa.dustinedwards.info/dustinedwards?x=1",
    );
    expect(assets.requests).toEqual([]);
  });

  it("serves https requests from the assets", async () => {
    const response = await worker.fetch(new Request("https://abscissa.dustinedwards.info/"), {
      ASSETS: assets,
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("asset");
    expect(assets.requests).toEqual(["https://abscissa.dustinedwards.info/"]);
  });
});
