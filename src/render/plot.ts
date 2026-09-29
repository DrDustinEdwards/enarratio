/**
 * Runs Observable Plot on the server and turns its SVG into Abscissa markup: no inline styles,
 * no per-chart `<style>`, marks named by `data-abscissa-mark`, every drawn datum keyed so the
 * enhancement layer can find it, and coordinates rounded so output is stable across engines.
 */

import * as Plot from "@observablehq/plot";
import { parseHTML } from "linkedom";
import { escapeHtml } from "../html.js";

/** A document for Plot to draw into. linkedom, because it runs in Node, Workers, Deno and Bun. */
function createDocument(): Document {
  const { document } = parseHTML("<!doctype html><html><body></body></html>");
  // linkedom implements the subset of the DOM that Plot and Abscissa use; its types differ.
  return document as unknown as Document;
}

/** What the enhancement layer needs to know about one drawn datum. */
export interface MarkDatum {
  /** Unique within the chart and stable across re-renders of the same data (for transitions). */
  readonly key: string;
  /** The value a click filters on, and the name of the field it belongs to. */
  readonly filter?: { readonly field: string; readonly value: string };
  /** The x value as text, for brush and hover. */
  readonly x?: string;
  /** The series name, when the chart has series. */
  readonly series?: string;
  /**
   * The mark's place for keyboard reading order: its category (column) and its position within
   * the category (row). Taken from the data, not the drawing, so order is right in facets and in
   * charts enhanced while hidden (F9).
   */
  readonly column?: number;
  readonly row?: number;
}

/**
 * A Plot render transform that calls `apply` on each element a mark draws with the datum it
 * draws. Plot draws one element per index entry, in index order, for bar, dot, cell, rect and text.
 */
export function decorate<T>(
  items: readonly T[],
  apply: (el: Element, item: T) => void,
): Plot.RenderFunction {
  return (index, scales, values, dimensions, context, next) => {
    if (!next) throw new Error("decorate() must be used as a render transform");
    const group = next(index, scales, values, dimensions, context);
    if (!group) return group;
    const children = [...group.children];
    if (children.length !== index.length) {
      throw new Error(`a decorated mark drew ${children.length} elements for ${index.length} data`);
    }
    children.forEach((child, i) => {
      const item = items[index[i] as number];
      if (item === undefined) throw new Error(`decorated mark index ${index[i]} has no datum`);
      apply(child, item);
    });
    return group;
  };
}

/**
 * A render transform that tags each element with its datum's keys for the enhancement layer, and
 * optionally decorates it further.
 */
export function keyed<T>(
  items: readonly T[],
  describe: (item: T) => MarkDatum,
  also?: (el: Element, item: T) => void,
): Plot.RenderFunction {
  return decorate(items, (el, item) => {
    tag(el, describe(item));
    also?.(el, item);
  });
}

/** Writes a datum's keys onto an element. */
export function tag(el: Element, datum: MarkDatum): void {
  el.setAttribute("data-abscissa-key", datum.key);
  if (datum.filter) {
    el.setAttribute("data-abscissa-field", datum.filter.field);
    el.setAttribute("data-abscissa-value", datum.filter.value);
  }
  if (datum.x !== undefined) el.setAttribute("data-abscissa-x", datum.x);
  if (datum.series !== undefined) el.setAttribute("data-abscissa-series", datum.series);
  if (datum.column !== undefined) el.setAttribute("data-abscissa-col", String(datum.column));
  if (datum.row !== undefined) el.setAttribute("data-abscissa-row", String(datum.row));
}

/** A scale as the enhancement layer needs it to turn a pointer position back into data. */
export interface ScaleDescription {
  readonly type: string;
  readonly domain: readonly (number | string)[];
  readonly range: readonly number[];
}

const NUMBER = /-?\d+\.\d{3,}(?:e-?\d+)?/g;
const ROUNDED_ATTRIBUTES = new Set([
  "x",
  "y",
  "x1",
  "x2",
  "y1",
  "y2",
  "cx",
  "cy",
  "r",
  "width",
  "height",
  "d",
  "points",
  "transform",
  "viewBox",
]);

function roundCoordinates(root: Element): void {
  for (const el of [root, ...root.querySelectorAll("*")]) {
    for (const name of el.getAttributeNames()) {
      if (!ROUNDED_ATTRIBUTES.has(name)) continue;
      const value = el.getAttribute(name);
      if (value === null) continue;
      el.setAttribute(
        name,
        value.replace(NUMBER, (n) => String(Math.round(Number(n) * 100) / 100)),
      );
    }
  }
}

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

/**
 * Serializes an SVG tree with every attribute and text node escaped, so the markup is valid in
 * HTML and XML alike whatever the data contains. Childless elements self-close, as SVG allows.
 */
function serialize(node: Node): string {
  if (node.nodeType === TEXT_NODE) return escapeHtml(node.textContent ?? "");
  if (node.nodeType !== ELEMENT_NODE) return "";
  const el = node as Element;
  const attrs = el
    .getAttributeNames()
    .map((name) => ` ${name}="${escapeHtml(el.getAttribute(name) ?? "")}"`)
    .join("");
  const children = [...el.childNodes].map(serialize).join("");
  return children === ""
    ? `<${el.localName}${attrs}/>`
    : `<${el.localName}${attrs}>${children}</${el.localName}>`;
}

/** The result of {@link renderPlot}. */
export interface RenderedPlot {
  readonly svg: string;
  readonly x?: ScaleDescription;
}

/**
 * Draws a Plot specification into SVG markup named by `alt`: one image, or a group when its
 * marks are links. Throws if Plot warns, because a warning means the chart shown would not be the
 * chart intended.
 */
export function renderPlot(
  options: Plot.PlotOptions,
  alt: string,
  role: "img" | "group" = "img",
  after?: (svg: SVGSVGElement) => void,
): RenderedPlot {
  const document = createDocument();
  const svg = Plot.plot({ ...options, document }) as unknown as SVGSVGElement & Plot.Plot;

  // Plot's warning is its own node: a top-level <text> whose <title> counts the warnings. Found by
  // that structure, not by the glyph, which data may contain (F13).
  const warning = [...svg.children].find(
    (el) =>
      el.localName === "text" &&
      /^\d+ warnings?\. Please check the console\.$/.test(
        el.querySelector("title")?.textContent ?? "",
      ),
  );
  if (warning) {
    throw new Error(
      `Observable Plot warned while drawing "${alt}": ${warning.querySelector("title")?.textContent ?? ""}`,
    );
  }
  if (svg.localName !== "svg") {
    throw new Error(
      "Abscissa charts must draw a single SVG; remove Plot options that add a legend or caption",
    );
  }

  for (const style of svg.querySelectorAll("style")) style.remove();
  for (const name of ["class", "font-family", "font-size", "style"]) svg.removeAttribute(name);
  // Plot names groups with aria-label, which is invalid on a <g> without a role and hidden anyway
  // inside role="img". The name moves to a data attribute for CSS and the enhancement layer.
  for (const group of svg.querySelectorAll("[aria-label]")) {
    group.setAttribute("data-abscissa-mark", group.getAttribute("aria-label") ?? "");
    group.removeAttribute("aria-label");
    // Axes repeat what the text alternative and the data table say; once enhanced, loose tick
    // text would be read before the marks (A12).
    if (/axis/.test(group.getAttribute("data-abscissa-mark") ?? "")) {
      group.setAttribute("aria-hidden", "true");
    }
  }
  after?.(svg);
  roundCoordinates(svg);
  // A chart whose marks are links cannot be one image: role="img" would hide the links.
  svg.setAttribute("role", role);
  if (role === "group") svg.setAttribute("aria-roledescription", "chart");
  svg.setAttribute("aria-label", alt);

  let x: ScaleDescription | undefined;
  const scale = svg.scale("x");
  if (scale?.domain && scale.range && scale.type) {
    x = {
      type: scale.type,
      domain: [...scale.domain].map((d) =>
        d instanceof Date ? d.getTime() : (d as number | string),
      ),
      range: [...scale.range] as number[],
    };
  }
  const markup = serialize(svg);
  return x ? { svg: markup, x } : { svg: markup };
}
