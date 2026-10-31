/** The pointer targets the layer draws under small marks. */

import { SVG_NS, shape } from "./marks.js";

/** The smallest pointer target, in CSS pixels (WCAG 2.2 SC 2.5.8). */
const TARGET = 24;

/** A mark's box and the side its target needs, or null when the mark is big enough already. */
export type HitSize = { box: DOMRect; side: number } | null;

/**
 * Measures the marks for {@link drawHits}. Reads layout only, so charts measure together before
 * any of them inserts a target (batch.ts).
 */
export function measureHits(marks: readonly SVGGraphicsElement[]): HitSize[] {
  return marks.map((mark) => {
    const scale = mark.getScreenCTM()?.a ?? 0;
    if (!(scale > 0) || !mark.parentElement) return null;
    const box = (shape(mark) as SVGGraphicsElement).getBBox();
    const side = TARGET / scale;
    return box.width >= side && box.height >= side ? null : { box, side };
  });
}

/**
 * An invisible target around each mark smaller than 24 CSS pixels, so it is large enough to point
 * at (WCAG 2.2 SC 2.5.8, A5). Drawn beneath the marks, so a mark still wins where targets
 * overlap in dense charts. Null for a mark big enough already. `sizes` is what
 * {@link measureHits} read before anything was inserted: an insert invalidates layout, so
 * measuring between inserts laid the whole page out once per mark.
 */
export function drawHits(
  marks: readonly SVGGraphicsElement[],
  sizes: readonly HitSize[],
): (SVGRectElement | null)[] {
  return marks.map((mark, i) => {
    const size = sizes[i];
    const parent = mark.parentElement;
    if (!size || !parent) return null;
    const { box, side } = size;
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
  });
}
