/**
 * The gallery's Worker: sends plain HTTP to HTTPS and the old hostname to the new one, and
 * serves everything else from the static assets. It runs in front of the assets
 * (`run_worker_first`) so it sees http: requests, which the assets layer would otherwise answer
 * directly (A14, F16). Nothing else lives here.
 */

/** The assets binding wrangler provides as `env.ASSETS`. */
export interface Env {
  readonly ASSETS: { fetch(request: Request): Promise<Response> };
}

/** The gallery's address. */
export const HOST = "enarratio.dustinedwards.info";

/** The gallery's address before the rename to Enarratio (design record 0010). */
export const OLD_HOST = "abscissa.dustinedwards.info";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.protocol === "http:" || url.hostname === OLD_HOST) {
      url.protocol = "https:";
      if (url.hostname === OLD_HOST) url.hostname = HOST;
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(request);
  },
};
