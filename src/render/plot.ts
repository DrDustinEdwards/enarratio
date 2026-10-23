/**
 * Runs Observable Plot on the server and turns its SVG into Enarratio markup: no inline styles,
 * no per-chart `<style>`, marks named by `data-enarratio-mark`, every drawn datum keyed so the
 * enhancement layer can find it, and coordinates rounded so output is stable across engines.
 */

import * as Plot from "@observablehq/plot";
import { createDocument } from "#document";
import { escapeHtml } from "../html.js";
import { datumAttributes, type MarkDatum } from "./datum.js";
import type { ScaleDescription } from "./figure.js";

export type { MarkDatum } from "./datum.js";

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
function tag(el: Element, datum: MarkDatum): void {
  for (const [name, value] of datumAttributes(datum)) el.setAttribute(name, value);
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
      "Enarratio charts must draw a single SVG; remove Plot options that add a legend or caption",
    );
  }

  for (const style of svg.querySelectorAll("style")) style.remove();
  for (const name of ["class", "font-family", "font-size", "style"]) svg.removeAttribute(name);
  // Plot names groups with aria-label, which is invalid on a <g> without a role and hidden anyway
  // inside role="img". The name moves to a data attribute for CSS and the enhancement layer.
  for (const group of svg.querySelectorAll("[aria-label]")) {
    group.setAttribute("data-enarratio-mark", group.getAttribute("aria-label") ?? "");
    group.removeAttribute("aria-label");
    // Axes repeat what the text alternative and the data table say; once enhanced, loose tick
    // text would be read before the marks (A12).
    if (/axis/.test(group.getAttribute("data-enarratio-mark") ?? "")) {
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
