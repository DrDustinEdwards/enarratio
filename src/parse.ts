/**
 * Parses a string of chart markup into an inert document, the one place Enarratio's scripts hand a string to `DOMParser`.
 *
 * A page that enforces Trusted Types (`require-trusted-types-for 'script'`) refuses `DOMParser.parseFromString` given a plain
 * string, and Chrome logs the call as a CSP issue even when the policy only reports. The string here is a chart the
 * server drew with every value escaped, or markup the caller passed to `update()`, which is sanitized before it joins the page;
 * the parse itself builds a document in which nothing loads or runs. So the string goes through one policy named `enarratio`
 * (the page's own policy is used if its `trusted-types` list omits the name, and plain strings if the browser has none).
 */

type Policy = { createHTML(html: string): unknown };
type Factory = { createPolicy(name: string, rules: { createHTML(html: string): string }): Policy };

// The enhancement layer is one bundled file and `enarratio/redraw/narrow` another, so each holds its own copy of this module; a
// policy name can be created once per page, so the policy is kept on the global object where both find it.
const KEY = Symbol.for("enarratio.trusted-types-policy");

function getPolicy(): Policy | null {
  const holder = globalThis as unknown as { [KEY]?: Policy | null; trustedTypes?: Factory };
  if (holder[KEY] !== undefined) return holder[KEY] ?? null;
  try {
    holder[KEY] =
      holder.trustedTypes?.createPolicy("enarratio", { createHTML: (html) => html }) ?? null;
  } catch {
    holder[KEY] = null;
  }
  return holder[KEY] ?? null;
}

/** `markup` parsed as an HTML document, without running or loading anything in it. */
export function parseMarkup(markup: string): Document {
  const html = (getPolicy()?.createHTML(markup) ?? markup) as string;
  return new DOMParser().parseFromString(html, "text/html");
}
