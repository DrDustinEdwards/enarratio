/** Reading marks and scales from Enarratio's server markup: labels, geometry and reading order. */

export interface XScale {
  readonly type: string;
  readonly domain: readonly (number | string)[];
  readonly range: readonly number[];
}

export const MARK = "[data-enarratio-key]";
export const SVG_NS = "http://www.w3.org/2000/svg";

export function label(mark: Element): string {
  return mark.getAttribute("aria-label") ?? mark.querySelector("title")?.textContent ?? "";
}

/** The element holding a mark's geometry: the mark, or the shape inside a linked mark. */
export function shape(mark: Element): Element {
  return mark.hasAttribute("x") || mark.hasAttribute("cx") || !mark.firstElementChild
    ? mark
    : mark.firstElementChild;
}

export function center(mark: SVGGraphicsElement): { x: number; y: number } {
  const box = mark.getBBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * A mark's place in reading order: the column (category) and row (position within it) the server
 * wrote from the data. Geometry is the fallback for markup without them, measured on screen so
 * facets compare correctly (F9).
 */
export function place(mark: Element): { column: number; row: number } {
  const column = mark.getAttribute("data-enarratio-col");
  const row = mark.getAttribute("data-enarratio-row");
  if (column !== null && row !== null) return { column: Number(column), row: Number(row) };
  const box = mark.getBoundingClientRect();
  return {
    column: Math.round(box.left + box.width / 2),
    row: -Math.round(box.top + box.height / 2),
  };
}

/** Marks in reading order: columns in order, and within a column bottom to top. */
export function readingOrder(marks: SVGGraphicsElement[]): SVGGraphicsElement[] {
  const places = new Map(marks.map((m) => [m, place(m)]));
  const at = (m: SVGGraphicsElement): { column: number; row: number } =>
    places.get(m) ?? { column: 0, row: 0 };
  return [...marks].sort((a, b) => at(a).column - at(b).column || at(a).row - at(b).row);
}

export function parseScale(figure: HTMLElement): XScale | null {
  const raw = figure.getAttribute("data-enarratio-x-scale");
  if (!raw) return null;
  const scale = JSON.parse(raw) as XScale;
  return ["linear", "utc", "time", "log", "sqrt", "pow"].includes(scale.type) ? scale : null;
}

/** Inverts a continuous scale for a position in SVG user units. */
export function invert(scale: XScale, px: number): number {
  const [d0, d1] = scale.domain as [number, number];
  const [r0, r1] = scale.range as [number, number];
  const t = Math.min(1, Math.max(0, (px - r0) / (r1 - r0)));
  if (scale.type === "log") return Math.exp(Math.log(d0) + t * (Math.log(d1) - Math.log(d0)));
  return d0 + t * (d1 - d0);
}

/** A position in SVG user units for a value on a continuous scale: the inverse of {@link invert}. */
export function project(scale: XScale, value: number): number {
  const [d0, d1] = scale.domain as [number, number];
  const [r0, r1] = scale.range as [number, number];
  const t =
    scale.type === "log"
      ? (Math.log(value) - Math.log(d0)) / (Math.log(d1) - Math.log(d0))
      : (value - d0) / (d1 - d0);
  return r0 + Math.min(1, Math.max(0, t)) * (r1 - r0);
}

export function svgPoint(
  svg: SVGSVGElement,
  event: { clientX: number; clientY: number },
): DOMPoint {
  const matrix = svg.getScreenCTM();
  const point = new DOMPoint(event.clientX, event.clientY);
  return matrix ? point.matrixTransform(matrix.inverse()) : point;
}
