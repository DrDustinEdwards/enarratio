/** Small pieces the Plot charts share: named mark groups, error bar caps and helpers for SVG. */

import type * as Plot from "@observablehq/plot";
import { capsOf } from "../lite/annotate.js";

export const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * A render transform that names a mark's group, so CSS, tests and later steps can find it as
 * `data-enarratio-mark="<name>"` (Plot names every rule "rule", every dot "dot"). `also` can
 * chain another render transform, such as {@link keyed}.
 */
export function named(name: string, also?: Plot.RenderFunction): Plot.RenderFunction {
  return (index, scales, values, dimensions, context, next) => {
    if (!next) throw new Error("named() must be used as a render transform");
    const group = also
      ? also(index, scales, values, dimensions, context, next)
      : next(index, scales, values, dimensions, context);
    group?.setAttribute("aria-label", name);
    return group;
  };
}

/** Creates an SVG element with attributes. */
export function svgElement(
  document: Document,
  tag: string,
  attrs: Readonly<Record<string, string | number>>,
): SVGElement {
  const el = document.createElementNS(SVG_NS, tag) as SVGElement;
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, String(value));
  return el;
}

/**
 * Puts a short cap across both ends of every line in the marks named "error bar", so an error
 * bar reads as one even where it crosses a gridline. Runs after Plot lays the chart out.
 */
export function capErrorBars(svg: SVGSVGElement): void {
  for (const group of svg.querySelectorAll('[data-enarratio-mark="error bar"]')) {
    for (const line of [...group.querySelectorAll("line")]) {
      const [x1, y1, x2, y2] = ["x1", "y1", "x2", "y2"].map((a) =>
        Number(line.getAttribute(a) ?? 0),
      ) as [number, number, number, number];
      line.after(
        ...capsOf({ x1, y1, x2, y2 }).map((cap) => svgElement(svg.ownerDocument, "line", cap)),
      );
    }
  }
}

/** Runs several `after` steps in order. */
export function steps(
  ...all: readonly (((svg: SVGSVGElement) => void) | undefined)[]
): ((svg: SVGSVGElement) => void) | undefined {
  const present = all.filter((f): f is (svg: SVGSVGElement) => void => f !== undefined);
  if (present.length === 0) return undefined;
  return (svg) => {
    for (const f of present) f(svg);
  };
}

/** Line dashes by series, solid first, so lines differ by more than color. */
const DASHES = ["6,3", "2,3", "8,3,2,3", "12,4", "4,2,4,6", "1,2", "10,2,2,2"];

/** The dash option for the kth series' line: none for the first. */
export function dashFor(k: number): { strokeDasharray?: string } {
  const dash = k > 0 ? DASHES[(k - 1) % DASHES.length] : undefined;
  return dash ? { strokeDasharray: dash } : {};
}
