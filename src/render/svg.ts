/**
 * The steps every server-drawn SVG goes through before it reaches the page, whichever library drew
 * it: coordinates rounded so output is stable across engines, and serialization with every
 * attribute and text node escaped.
 */

import { escapeHtml } from "../html.js";

const NUMBER = /-?\d+\.\d{3,}(?:e-?\d+)?/g;
const ROUNDED_ATTRIBUTES = new Set([
  "x",
  "y",
  "x1",
  "x2",
  "y1",
  "y2",
  "cx",
  "cy",
  "r",
  "width",
  "height",
  "d",
  "points",
  "transform",
  "viewBox",
]);

/**
 * Rounds long decimals in coordinate attributes to two places, so output is stable across engines.
 * `extra` names further attributes to round for drawings that carry them.
 */
export function roundCoordinates(root: Element, extra: readonly string[] = []): void {
  for (const el of [root, ...root.querySelectorAll("*")]) {
    for (const name of el.getAttributeNames()) {
      if (!ROUNDED_ATTRIBUTES.has(name) && !extra.includes(name)) continue;
      const value = el.getAttribute(name);
      if (value === null) continue;
      el.setAttribute(
        name,
        value.replace(NUMBER, (n) => String(Math.round(Number(n) * 100) / 100)),
      );
    }
  }
}

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

/**
 * Serializes an SVG tree with every attribute and text node escaped, so the markup is valid in
 * HTML and XML alike whatever the data contains. Childless elements self-close, as SVG allows.
 */
export function serialize(node: Node): string {
  if (node.nodeType === TEXT_NODE) return escapeHtml(node.textContent ?? "");
  if (node.nodeType !== ELEMENT_NODE) return "";
  const el = node as Element;
  const attrs = el
    .getAttributeNames()
    .map((name) => ` ${name}="${escapeHtml(el.getAttribute(name) ?? "")}"`)
    .join("");
  const children = [...el.childNodes].map(serialize).join("");
  return children === ""
    ? `<${el.localName}${attrs}/>`
    : `<${el.localName}${attrs}>${children}</${el.localName}>`;
}
