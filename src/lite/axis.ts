/** Axes and grids drawn as Plot draws them: the same groups, positions and offsets. */

import { type Attrs, el, type FacetContent, markGroup, textElement, translate } from "./svg.js";

/** The drawing area: the SVG's size and the margins around the plotted frame. */
export interface Frame {
  readonly width: number;
  readonly height: number;
  readonly marginTop: number;
  readonly marginRight: number;
  readonly marginBottom: number;
  readonly marginLeft: number;
}

/** A tick: where it is, and its label (empty for none). */
export interface Tick {
  readonly at: number;
  readonly label: string;
}

/** Where a mark is drawn: once, or once per facet with its offset. */
export type Placement = undefined | readonly { readonly dx: number; readonly dy: number }[];

const HIDDEN = { "aria-hidden": "true" } as const;

function place(placement: Placement, children: string): string | FacetContent[] {
  return placement ? placement.map((p) => ({ ...p, children })) : children;
}

/** Light lines across the frame at each tick: horizontal for y, vertical for x. */
export function grid(
  k: "x" | "y",
  at: readonly number[],
  frame: Frame,
  placement?: Placement,
): string {
  if (at.length === 0) return "";
  const { width, height, marginTop, marginRight, marginBottom, marginLeft } = frame;
  const lines = at
    .map((p) =>
      k === "y"
        ? el("line", { x1: marginLeft, x2: width - marginRight, y1: p, y2: p })
        : el("line", { x1: p, x2: p, y1: marginTop, y2: height - marginBottom }),
    )
    .join("");
  return markGroup(
    { ...HIDDEN, "data-enarratio-mark": `${k}-grid` },
    { stroke: "currentColor", "stroke-opacity": "0.1" },
    place(placement, lines),
  );
}

/**
 * Tick marks on the left (y) or bottom (x) of the frame. `offset` moves them to the middle of a
 * band, for categories.
 */
export function axisTicks(
  k: "x" | "y",
  at: readonly number[],
  frame: Frame,
  offset = 0,
  placement?: Placement,
): string {
  if (at.length === 0) return "";
  const paths = at
    .map((p) =>
      k === "y"
        ? el("path", { transform: translate(frame.marginLeft, p), d: "M0,0L-6,0" })
        : el("path", { transform: translate(p, frame.height - frame.marginBottom), d: "M0,0L0,6" }),
    )
    .join("");
  return markGroup(
    {
      ...HIDDEN,
      "data-enarratio-mark": `${k}-axis tick`,
      transform: offset ? (k === "y" ? translate(0, offset) : translate(offset, 0)) : undefined,
    },
    { fill: "none", stroke: "currentColor" },
    place(placement, paths),
  );
}

/**
 * Tick labels beside the ticks. `padding` is the gap from the frame: 9 beside a tick mark, as
 * on value and category axes. Figures are proportional: tabular
 * figures widen the comma in some faces ("1 , 600"), and end-anchored labels need no columns.
 */
export function axisTickLabels(
  k: "x" | "y" | "fx" | "fy",
  ticks: readonly Tick[],
  frame: Frame,
  options: { offset?: number; placement?: Placement } = {},
): string {
  const vertical = k === "y" || k === "fy";
  const label = (t: Tick): string =>
    vertical
      ? textElement({ transform: translate(frame.marginLeft, t.at) }, t.label, "middle")
      : textElement(
          { transform: translate(t.at, frame.height - frame.marginBottom) },
          t.label,
          "top",
        );
  const offset = options.offset ?? 0;
  const outer: Attrs = {
    ...HIDDEN,
    "data-enarratio-mark": `${k}-axis tick label`,
    transform: vertical ? translate(-9, offset) : translate(offset, 9),
  };
  const styles: Attrs = {
    "text-anchor": vertical ? "end" : undefined,
  };
  // A tick without a label (between powers of ten on a log axis) still gets an empty text.
  const children = ticks.map(label).join("");
  if (children === "") return "";
  return markGroup(outer, styles, place(options.placement, children));
}

/**
 * The labels of a facet axis: each facet's name, centered on its frame, in the facets that are
 * drawn. `facets` gives each facet's offset and the label it carries, if any.
 */
export function facetTickLabels(
  k: "fx" | "fy",
  facets: readonly { readonly dx: number; readonly dy: number; readonly label?: string }[],
  frame: Frame,
): string {
  const { width, height, marginTop, marginRight, marginBottom, marginLeft } = frame;
  const content: FacetContent[] = [];
  for (const f of facets) {
    if (f.label === undefined) continue;
    const children =
      k === "fx"
        ? textElement(
            { transform: translate((marginLeft + width - marginRight) / 2, height - marginBottom) },
            f.label,
            "top",
          )
        : textElement(
            { transform: translate(marginLeft, (marginTop + height - marginBottom) / 2) },
            f.label,
            "middle",
          );
    content.push({ dx: f.dx, dy: f.dy, children });
  }
  if (content.length === 0) return "";
  return markGroup(
    {
      ...HIDDEN,
      "data-enarratio-mark": `${k}-axis tick label`,
      transform: k === "fx" ? translate(0, 9) : translate(-9, 0),
    },
    { "text-anchor": k === "fy" ? "end" : undefined },
    content,
  );
}

/**
 * An axis label: centered below the frame for x, or rotated and centered beside it for y. The
 * position comes from `frame`; the offset from `inset`, the margins as given.
 */
export function axisLabel(
  k: "x" | "y" | "fx" | "fy",
  label: string | null,
  frame: Frame,
  inset: Frame = frame,
): string {
  // An empty label is still drawn, as Plot draws it; only null hides it.
  if (label === null) return "";
  const { width, height, marginTop, marginRight, marginBottom, marginLeft } = frame;
  const horizontal = k === "x" || k === "fx";
  const node = horizontal
    ? textElement(
        { transform: translate((marginLeft + width - marginRight) / 2, height - marginBottom) },
        label,
        "bottom",
      )
    : textElement(
        {
          transform: `${translate(marginLeft, (marginTop + height - marginBottom) / 2)} rotate(-90)`,
        },
        label,
        "top",
      );
  return el(
    "g",
    {
      ...HIDDEN,
      "data-enarratio-mark": `${k}-axis label`,
      transform: horizontal
        ? translate(0, inset.marginBottom - 3)
        : translate(-(inset.marginLeft - 3), 0),
    },
    node,
  );
}
