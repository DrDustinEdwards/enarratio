/** SVG markup as strings, written the way the Plot renderer serializes its drawing. */

import { escapeHtml } from "../html.js";

/** Attribute values; `undefined` omits the attribute. */
export type Attrs = Readonly<Record<string, string | number | undefined>>;

/** A coordinate rounded to two decimals, as the Plot renderer rounds its output. */
export const num = (value: number): string => String(Math.round(value * 100) / 100);

/** `translate(x,y)`, rounded. */
export const translate = (x: number, y: number): string => `translate(${num(x)},${num(y)})`;

function attributes(attrs: Attrs): string {
  let out = "";
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined) continue;
    out += ` ${name}="${escapeHtml(typeof value === "number" ? num(value) : value)}"`;
  }
  return out;
}

/** One element. `children` is markup; an element without children closes itself. */
export function el(tag: string, attrs: Attrs, children = ""): string {
  return children === ""
    ? `<${tag}${attributes(attrs)}/>`
    : `<${tag}${attributes(attrs)}>${children}</${tag}>`;
}

/** Escaped text content. */
export const text = (value: string): string => escapeHtml(value);

/** A facet's offset and what is drawn in it. */
export interface FacetContent {
  readonly dx: number;
  readonly dy: number;
  readonly children: string;
}

/**
 * A mark's group. Unfaceted, one group holds everything; faceted, the outer group carries the
 * mark's name and offset and each facet is a group of its own carrying the mark's styles, as Plot
 * draws them.
 */
export function markGroup(
  outer: Attrs,
  styles: Attrs,
  content: string | readonly FacetContent[],
): string {
  if (typeof content === "string") return el("g", { ...outer, ...styles }, content);
  return el(
    "g",
    outer,
    content
      .map((f) => el("g", { transform: translate(f.dx, f.dy), ...styles }, f.children))
      .join(""),
  );
}

/**
 * A text element with Plot's line placement: `anchor` is where the lines sit relative to the
 * point (top, middle or bottom), and a label with several lines is split into tspans.
 */
export function textElement(
  attrs: Attrs,
  value: string,
  anchor: "top" | "middle" | "bottom",
): string {
  const lines = value.split(/\r\n?|\n/);
  const n = lines.length;
  const y = anchor === "top" ? 0.71 : anchor === "bottom" ? 1 - n : (164 - n * 100) / 200;
  if (n === 1) return el("text", { ...attrs, y: y ? `${y}em` : undefined }, text(value));
  let spans = "";
  let m = 0;
  lines.forEach((line, i) => {
    ++m;
    if (!line) return;
    spans += el(
      "tspan",
      i === m - 1 ? { x: 0, y: `${y + i}em` } : { x: 0, dy: `${m}em` },
      text(line),
    );
    m = 0;
  });
  return el("text", attrs, spans);
}

/** The chart's root element, named by its text alternative. */
export function svgRoot(
  width: number,
  height: number,
  alt: string,
  role: "img" | "group",
  children: string,
): string {
  return el(
    "svg",
    {
      fill: "currentColor",
      "text-anchor": "middle",
      width,
      height,
      viewBox: `0 0 ${num(width)} ${num(height)}`,
      role,
      // A chart whose marks are links cannot be one image: role="img" would hide the links.
      "aria-roledescription": role === "group" ? "chart" : undefined,
      "aria-label": alt,
    },
    children,
  );
}
