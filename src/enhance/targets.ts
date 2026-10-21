/** The shapes the layer draws over marks: pointer targets and the focus ring. */

import { SVG_NS, shape } from "./marks.js";

/** The smallest pointer target, in CSS pixels (WCAG 2.2 SC 2.5.8). */
const TARGET = 24;

/**
 * An invisible target around a mark smaller than 24 CSS pixels, so it is large enough to point
 * at (WCAG 2.2 SC 2.5.8, A5). Drawn beneath the marks, so a mark still wins where targets
 * overlap in dense charts. Null when the mark is big enough already.
 */
export function hitArea(mark: SVGGraphicsElement): SVGRectElement | null {
  const scale = mark.getScreenCTM()?.a ?? 0;
  const parent = mark.parentElement;
  if (!(scale > 0) || !parent) return null;
  const box = (shape(mark) as SVGGraphicsElement).getBBox();
  const side = TARGET / scale;
  if (box.width >= side && box.height >= side) return null;
  const width = Math.max(box.width, side);
  const height = Math.max(box.height, side);
  const hit = document.createElementNS(SVG_NS, "rect");
  hit.setAttribute("class", "enarratio-hit");
  hit.setAttribute("aria-hidden", "true");
  hit.setAttribute("x", String(box.x + box.width / 2 - width / 2));
  hit.setAttribute("y", String(box.y + box.height / 2 - height / 2));
  hit.setAttribute("width", String(width));
  hit.setAttribute("height", String(height));
  parent.insertBefore(hit, parent.firstChild);
  return hit;
}

/**
 * The focus ring around a mark: a background-colored ring inside a focus-colored one, so the ring
 * shows against any series color beside it, not only against the background (F7).
 */
export function focusRing(mark: SVGGraphicsElement): SVGGElement | null {
  const parent = mark.parentElement;
  if (!parent) return null;
  const box = (shape(mark) as SVGGraphicsElement).getBBox();
  const scale = mark.getScreenCTM()?.a || 1;
  const pad = 2 / scale;
  const ring = document.createElementNS(SVG_NS, "g");
  ring.setAttribute("class", "enarratio-focus-ring");
  ring.setAttribute("aria-hidden", "true");
  for (const [cls, extra] of [
    ["enarratio-focus-ring-inner", pad],
    ["enarratio-focus-ring-outer", pad + 3.5 / scale],
  ] as const) {
    const rect = document.createElementNS(SVG_NS, "rect");
    rect.setAttribute("class", cls);
    rect.setAttribute("x", String(box.x - extra));
    rect.setAttribute("y", String(box.y - extra));
    rect.setAttribute("width", String(box.width + 2 * extra));
    rect.setAttribute("height", String(box.height + 2 * extra));
    rect.setAttribute("rx", String(2 / scale));
    ring.append(rect);
  }
  parent.append(ring);
  return ring;
}
