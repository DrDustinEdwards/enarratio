/** The pointer targets the layer draws under small marks. */

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
