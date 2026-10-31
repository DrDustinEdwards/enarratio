/** Keeps only what Enarratio's server emits in markup handed to update() (F11). */

/** The elements Enarratio's server markup is made of; update() keeps only these (F11). */
const ALLOWED_ELEMENTS = new Set([
  "figure",
  "p",
  "ul",
  "li",
  "span",
  "div",
  "figcaption",
  "details",
  "summary",
  "table",
  "caption",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "svg",
  "g",
  "rect",
  "circle",
  "ellipse",
  "path",
  "line",
  "polyline",
  "polygon",
  "text",
  "tspan",
  "title",
  "a",
  "defs",
  "clippath",
  "pattern",
]);
const LINK_ATTRIBUTES = new Set(["href", "xlink:href", "data-enarratio-href"]);

/** Relative and http(s) links only, with no user or password before the host, as the server allows (A11). */
function safeLink(value: string): boolean {
  const compact = [...value].filter((ch) => ch.charCodeAt(0) > 0x20).join("");
  if (/^[/\\][/\\]/.test(compact)) return false;
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(compact)?.[1]?.toLowerCase();
  if (scheme === undefined) return true;
  if (scheme !== "http" && scheme !== "https") return false;
  try {
    const url = new URL(compact);
    return url.username === "" && url.password === "";
  } catch {
    return false;
  }
}

/** Removes everything the server never emits: other elements, handlers, link pings, form attributes, unsafe links and styles. */
export function sanitize(root: Element): void {
  for (const el of [root, ...root.querySelectorAll("*")]) {
    if (!ALLOWED_ELEMENTS.has(el.localName.toLowerCase())) {
      el.remove();
      continue;
    }
    for (const name of el.getAttributeNames()) {
      const value = el.getAttribute(name) ?? "";
      const lower = name.toLowerCase();
      if (
        lower.startsWith("on") ||
        (LINK_ATTRIBUTES.has(lower) && !safeLink(value)) ||
        lower === "style" ||
        lower === "srcdoc" ||
        lower === "ping" ||
        lower.startsWith("form")
      ) {
        el.removeAttribute(name);
      }
    }
  }
}
