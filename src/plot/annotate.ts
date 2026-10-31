/**
 * Annotations on the Plot charts: the shapes `render/annotation.ts` lays out from Plot's own
 * scales, drawn after layout as elements, ranges behind the marks and notes above them.
 */

import type * as Plot from "@observablehq/plot";
import {
  ANNOTATION_GROUPS,
  type Annotation,
  type AnnotationScale,
  annotationShapes,
  type Shape,
} from "../render/annotation.js";
import { svgElement } from "./marks.js";

export {
  type Annotated,
  type Annotation,
  type AnnotationValue,
  withNotes,
} from "../render/annotation.js";

/**
 * An `after` step that draws the annotations from the chart's scales. `swap` is for horizontal
 * bars, whose x field runs down the y axis.
 */
export function drawAnnotations(
  kind: string,
  annotations: readonly Annotation[] | undefined,
  swap = false,
): ((svg: SVGSVGElement) => void) | undefined {
  if (!annotations || annotations.length === 0) return undefined;
  return (svg) => {
    const plot = svg as unknown as Plot.Plot;
    const shapes = annotationShapes(
      kind,
      annotations,
      (axis) => plot.scale(axis) as unknown as AnnotationScale | undefined,
      swap,
    );
    const doc = svg.ownerDocument;
    const group = (attrs: Readonly<Record<string, string>>, list: readonly Shape[]) => {
      const g = svgElement(doc, "g", attrs);
      for (const shape of list) {
        const el = svgElement(doc, shape.tag, shape.attrs);
        if (shape.text !== undefined) el.textContent = shape.text;
        g.append(el);
      }
      return g;
    };
    const firstMark = [...svg.children].find((el) => {
      const name = el.getAttribute("data-enarratio-mark") ?? "";
      return el.localName === "g" && !/axis|grid/.test(name);
    });
    if (shapes.behind.length > 0) {
      svg.insertBefore(group(ANNOTATION_GROUPS.behind, shapes.behind), firstMark ?? null);
    }
    if (shapes.above.length > 0) svg.append(group(ANNOTATION_GROUPS.above, shapes.above));
  };
}
