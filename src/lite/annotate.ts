/**
 * What the light bar and line charts draw beside their marks, as the Plot charts do: annotations
 * laid out from the light scales, and error bars with their caps.
 */

import {
  ANNOTATION_GROUPS,
  type Annotation,
  type AnnotationScale,
  annotationShapes,
  type Shape,
} from "../render/annotation.js";
import type { Band, Continuous, Pair } from "./scale.js";
import { type Attrs, el, roundNumbers, text } from "./svg.js";

/** A light continuous scale as annotations read it. */
export function continuousScale(scale: Continuous): AnnotationScale {
  return {
    type: scale.type,
    range: scale.range,
    apply: (v) => scale(v instanceof Date ? v.getTime() : Number(v)),
  };
}

/** A light band scale over named categories as annotations read it. */
export function bandScale(band: Band, names: readonly string[], range: Pair): AnnotationScale {
  return {
    type: "band",
    range,
    bandwidth: band.bandwidth,
    apply: (v) => {
      const i = names.indexOf(String(v));
      return i < 0 ? Number.NaN : band.at(i);
    },
  };
}

const shape = (s: Shape): string =>
  el(
    s.tag,
    s.tag === "path" ? { ...s.attrs, d: roundNumbers(String(s.attrs["d"])) } : s.attrs,
    s.text === undefined ? "" : text(s.text),
  );

/** The annotations as markup: ranges to draw before the first mark, notes after the last. */
export function annotationMarkup(
  kind: string,
  annotations: readonly Annotation[] | undefined,
  scaleOf: (axis: "x" | "y") => AnnotationScale | undefined,
  swap = false,
): { readonly behind: string; readonly above: string } {
  if (!annotations || annotations.length === 0) return { behind: "", above: "" };
  const { behind, above } = annotationShapes(kind, annotations, scaleOf, swap);
  const group = (attrs: Attrs, list: readonly Shape[]): string =>
    list.length === 0 ? "" : el("g", attrs, list.map(shape).join(""));
  return {
    behind: group(ANNOTATION_GROUPS.behind, behind),
    above: group(ANNOTATION_GROUPS.above, above),
  };
}

/** The half-width of an error bar's cap, in pixels. */
const CAP = 4;

type Line = { readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number };

/**
 * The caps across both ends of an error bar's line, so it reads as one even where it crosses a
 * gridline, in drawing order after the line: the second end's first, as both renderers draw them.
 */
export function capsOf({ x1, y1, x2, y2 }: Line): [Line, Line] {
  const cap = (x: number, y: number): Line =>
    x1 === x2
      ? { x1: x - CAP, x2: x + CAP, y1: y, y2: y }
      : { x1: x, x2: x, y1: y - CAP, y2: y + CAP };
  return [cap(x2, y2), cap(x1, y1)];
}

/** One error bar as markup: its line, then its caps. */
export function errorBar(line: Line): string {
  return [line, ...capsOf(line)].map((l) => el("line", l)).join("");
}
