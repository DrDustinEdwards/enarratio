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
  "button",
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
]);
const LINK_ATTRIBUTES = new Set(["href", "xlink:href"]);
const SAFE_STYLE = /^(\s*--enarratio-[a-z0-9-]+\s*:\s*[^;{}<>]*;?)*\s*$/i;

/** Relative and http(s) links only, as the server allows (A11). */
function safeLink(value: string): boolean {
  const compact = [...value].filter((ch) => ch.charCodeAt(0) > 0x20).join("");
  if (/^[/\\][/\\]/.test(compact)) return false;
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(compact)?.[1]?.toLowerCase();
  return scheme === undefined || scheme === "http" || scheme === "https";
}

/** Removes everything the server never emits: other elements, handlers, unsafe links and styles. */
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
        (lower === "style" && !SAFE_STYLE.test(value)) ||
        lower === "srcdoc" ||
        lower === "formaction"
      ) {
        el.removeAttribute(name);
      }
    }
  }
}
