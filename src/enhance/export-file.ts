/**
 * The drawing as a file (C3), loaded only when a reader asks for one: the standalone SVG with its
 * computed colors and fonts, and the PNG drawn from it on a canvas. Kept apart from export.ts so the
 * enhancement layer does not carry it on first load.
 */

import { SVG_NS } from "./marks.js";

/** The properties that carry the theme into a standalone SVG, written as presentation attributes. */
const PROPERTIES = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-dasharray",
  "stroke-linecap",
  "stroke-linejoin",
  "paint-order",
  "opacity",
  "display",
  "font-family",
  "font-size",
  "font-weight",
  "text-anchor",
];

/** How many image pixels a PNG has per CSS pixel of the drawing. */
const PNG_SCALE = 2;

/**
 * The drawing as a standalone SVG document: computed styles as attributes (attributes, not
 * `style`, so a page under a strict Content-Security-Policy reports nothing), the background
 * painted in, and the enhancement layer's pointer targets and brush left out.
 */
export function standalone(
  svg: SVGSVGElement,
  figure: HTMLElement,
): { markup: string; w: number; h: number } {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const from = [svg, ...svg.querySelectorAll("*")];
  const to = [clone, ...clone.querySelectorAll("*")];
  from.forEach((el, i) => {
    const computed = getComputedStyle(el);
    for (const name of PROPERTIES) {
      // A pattern fill computes to url("page#id"); the copy keeps its own patterns.
      const value = computed
        .getPropertyValue(name)
        .replace(/url\("?[^#"]*(#[^")]+)"?\)/g, "url($1)");
      if (value) to[i]?.setAttribute(name, value);
    }
  });
  for (const extra of clone.querySelectorAll(".enarratio-hit, .enarratio-brush")) extra.remove();
  const [, , w = svg.clientWidth, h = svg.clientHeight] = (svg.getAttribute("viewBox") ?? "")
    .split(/[\s,]+/)
    .map(Number);
  const probe = document.createElement("span");
  probe.style.backgroundColor = "var(--enarratio-background)";
  figure.append(probe);
  const background = getComputedStyle(probe).backgroundColor;
  probe.remove();
  const paint = document.createElementNS(SVG_NS, "rect");
  paint.setAttribute("width", "100%");
  paint.setAttribute("height", "100%");
  paint.setAttribute("fill", background);
  clone.prepend(paint);
  clone.setAttribute("xmlns", SVG_NS);
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  return { markup: new XMLSerializer().serializeToString(clone), w, h };
}

export function save(blob: Blob, file: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = file;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 0);
}

export async function png(markup: string, w: number, h: number): Promise<Blob> {
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * PNG_SCALE);
  canvas.height = Math.round(h * PNG_SCALE);
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise((done, fail) =>
    canvas.toBlob((blob) => (blob ? done(blob) : fail(new Error("no PNG"))), "image/png"),
  );
}
