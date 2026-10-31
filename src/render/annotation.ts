/**
 * Annotations, for both renderers: text notes, with an arrow when the note is set off from its
 * point, and highlighted ranges along either axis. They are laid out here from the chart's own
 * scales, after layout, so a note lands where the data it names is drawn; the Plot charts turn
 * the shapes into elements and the light charts into markup, so both draw the same SVG. The
 * notes are also added to the chart's text alternative: the drawing is one image to a screen
 * reader.
 */

import type { FigureOptions } from "./figure.js";
import { dateFormat, numberFormat, stringsFor } from "./text.js";

/** A position on an axis: a number, a date (Date or ISO 8601 string) or a category. */
export type AnnotationValue = number | string | Date;

/** A text note at a point, or a highlighted range along one axis. */
export type Annotation =
  | {
      readonly type: "note";
      /** The point the note is about, on the chart's x and y fields. */
      readonly x: AnnotationValue;
      readonly y: AnnotationValue;
      readonly text: string;
      /**
       * Where the text sits, in pixels from the point. With an offset, an arrow runs from the
       * text to the point.
       */
      readonly dx?: number;
      readonly dy?: number;
    }
  | {
      readonly type: "range";
      /** The chart's x or y field. On a bar chart, x is the category axis whichever way bars run. */
      readonly axis: "x" | "y";
      readonly from: AnnotationValue;
      readonly to: AnnotationValue;
      readonly label?: string;
    };

/** The option charts that take annotations add. */
export interface Annotated {
  /** Notes and highlighted ranges drawn on the chart, and listed in its text alternative. */
  readonly annotations?: readonly Annotation[];
}

/**
 * The options with their notes added to `alt`, so a reader who cannot see the chart gets what
 * the annotations say, with numbers and dates written for the chart's locale. Unchanged when
 * there are none.
 */
export function withNotes<O extends FigureOptions & Annotated>(options: O): O {
  const notes = options.annotations ?? [];
  if (notes.length === 0) return options;
  const locale = options.locale ? { locale: options.locale } : {};
  const number = numberFormat(locale);
  const date = dateFormat(locale);
  const strings = stringsFor(options.strings);
  const text = (v: AnnotationValue): string =>
    v instanceof Date ? date(v) : typeof v === "number" ? number(v) : v;
  const fields = options as unknown as Readonly<Record<string, unknown>>;
  // A range is said with its axis's unit ("500 to 630 words"), else after the axis's label
  // ("Words 500 to 630"); a hidden label and no unit leave the values alone.
  const along = (axis: "x" | "y", values: string): string => {
    const unit = fields[`${axis}Unit`];
    if (typeof unit === "string" && unit.trim()) return `${values} ${unit.trim()}`;
    const given = fields[`${axis}Label`];
    const name = given === undefined ? fields[axis] : given;
    return typeof name === "string" && name.trim() ? `${name.trim()} ${values}` : values;
  };
  const said = notes.map((a) => {
    if (a.type === "note") return a.text;
    const values =
      text(a.from) === text(a.to) ? text(a.from) : strings.range(text(a.from), text(a.to));
    return `${a.label ?? strings.terms.highlighted}: ${along(a.axis, values)}`;
  });
  // With no alt the figure names the chart from its data, so the notes join its visible notes.
  if (options.alt === undefined) {
    const given = typeof options.notes === "string" ? [options.notes] : (options.notes ?? []);
    return { ...options, notes: [...given, ...said] };
  }
  return { ...options, alt: `${options.alt.trim()} ${strings.notesOnChart(said)}` };
}

/** A scale as annotations read it: Plot's own, or the light charts' in the same shape. */
export interface AnnotationScale {
  readonly type?: string;
  readonly range?: readonly number[];
  readonly bandwidth?: number;
  apply(value: unknown): number;
}

/** One element of the drawn annotations. */
export interface Shape {
  readonly tag: "rect" | "text" | "path";
  readonly attrs: Readonly<Record<string, string | number>>;
  readonly text?: string;
}

/** The annotations as shapes: ranges drawn behind the marks, notes and arrows above them. */
export interface AnnotationShapes {
  readonly behind: readonly Shape[];
  readonly above: readonly Shape[];
}

const position = (v: AnnotationValue): string =>
  v instanceof Date ? v.toISOString().slice(0, 10) : String(v);

/** The pixel position of a value on a scale: a band's center, or its start or end for a range. */
function place(
  kind: string,
  scale: AnnotationScale | undefined,
  value: AnnotationValue,
  edge?: "start" | "end",
): number {
  if (!scale) throw new Error(`${kind}: an annotation names an axis the chart does not have`);
  const time = scale.type === "utc" || scale.type === "time";
  const v = time && !(value instanceof Date) ? new Date(value) : value;
  const at = scale.apply(scale.type === "band" || scale.type === "point" ? String(v) : v);
  if (!Number.isFinite(at)) {
    throw new Error(`${kind}: annotation position ${position(value)} is not on the chart's axis`);
  }
  const band = scale.bandwidth ?? 0;
  return edge === "start" ? at : edge === "end" ? at + band : at + band / 2;
}

const span = (scale: AnnotationScale | undefined): [number, number] => {
  const [a = 0, b = 0] = scale?.range ?? [];
  return [Math.min(a, b), Math.max(a, b)];
};

/** A text element with a halo in the background color, so it reads over marks and gridlines. */
function label(
  x: number,
  y: number,
  value: string,
  anchor: "start" | "middle" | "end",
  muted = false,
): Shape {
  return {
    tag: "text",
    attrs: {
      x,
      y,
      dy: "0.32em",
      "text-anchor": anchor,
      fill: muted ? "var(--enarratio-text-muted)" : "var(--enarratio-text)",
      stroke: "var(--enarratio-background)",
      "stroke-width": 3,
      "paint-order": "stroke",
    },
    text: value,
  };
}

/**
 * Lays out the annotations on the chart's scales. `swap` is for horizontal bars, whose x field
 * runs down the y axis.
 */
export function annotationShapes(
  kind: string,
  annotations: readonly Annotation[],
  scaleOf: (axis: "x" | "y") => AnnotationScale | undefined,
  swap = false,
): AnnotationShapes {
  const scale = (axis: "x" | "y"): AnnotationScale | undefined =>
    scaleOf(swap ? (axis === "x" ? "y" : "x") : axis);
  const horizontal = (axis: "x" | "y"): boolean => (axis === "x") !== swap;
  const behind: Shape[] = [];
  const above: Shape[] = [];
  for (const a of annotations) {
    if (a.type === "range") {
      const s = scale(a.axis);
      const p1 = place(kind, s, a.from, "start");
      const p2 = place(kind, s, a.to, "end");
      const [lo, hi] = [Math.min(p1, p2), Math.max(p1, p2)];
      const across = span(scale(a.axis === "x" ? "y" : "x"));
      const rect = horizontal(a.axis)
        ? { x: lo, width: hi - lo, y: across[0], height: across[1] - across[0] }
        : { y: lo, height: hi - lo, x: across[0], width: across[1] - across[0] };
      // A range from a value to itself has no width to fill, so it is drawn as a line there.
      behind.push(
        hi - lo < 1
          ? {
              tag: "path",
              attrs: {
                d: horizontal(a.axis)
                  ? `M${lo},${across[0]}L${lo},${across[1]}`
                  : `M${across[0]},${lo}L${across[1]},${lo}`,
                stroke: "var(--enarratio-text-muted)",
                "stroke-width": 1.5,
                "stroke-dasharray": "4,3",
                fill: "none",
              },
            }
          : {
              tag: "rect",
              attrs: { ...rect, fill: "var(--enarratio-text)", "fill-opacity": 0.08 },
            },
      );
      if (a.label) behind.push(label(rect.x + 4, rect.y + 8, a.label, "start", true));
      continue;
    }
    const [px, py] = swap
      ? [place(kind, scale("y"), a.y), place(kind, scale("x"), a.x)]
      : [place(kind, scale("x"), a.x), place(kind, scale("y"), a.y)];
    const dx = a.dx ?? 0;
    const dy = a.dy ?? 0;
    const tx = px + dx;
    const ty = py + dy;
    const length = Math.hypot(dx, dy);
    if (length > 12) {
      // From just short of the text to just short of the point, with a head at the point.
      const ux = -dx / length;
      const uy = -dy / length;
      const end = { x: px - ux * 3, y: py - uy * 3 };
      const start = { x: tx + ux * 8, y: ty + uy * 8 };
      const head = (side: number): string =>
        `${end.x - ux * 7 + side * uy * 3.5},${end.y - uy * 7 - side * ux * 3.5}`;
      above.push(
        {
          tag: "path",
          attrs: {
            d: `M${start.x},${start.y}L${end.x},${end.y}`,
            stroke: "var(--enarratio-text)",
            "stroke-width": 1.25,
            fill: "none",
          },
        },
        {
          tag: "path",
          attrs: { d: `M${end.x},${end.y}L${head(1)}L${head(-1)}Z`, fill: "var(--enarratio-text)" },
        },
      );
    }
    above.push(label(tx, ty, a.text, dx > 0 ? "start" : dx < 0 ? "end" : "middle"));
  }
  return { behind, above };
}

/** The attributes of the two groups the shapes are drawn in. */
export const ANNOTATION_GROUPS = {
  behind: { "data-enarratio-mark": "range annotation", "aria-hidden": "true" },
  above: { "data-enarratio-mark": "note annotation", "aria-hidden": "true" },
} as const;
