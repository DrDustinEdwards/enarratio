/**
 * The image files a reader downloads: the drawing as SVG (C3), as PNG, and as a tactile SVG for
 * an embosser or swell paper (B55, record 0030). Loaded only when one of the buttons is pressed,
 * so the enhancement layer's first load stays within its budget. No dependency.
 */

import { LINE_DASHES } from "../theme/dashes.js";

const SVG_NS = "http://www.w3.org/2000/svg";

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
 * The drawing as a standalone SVG element: computed styles as attributes (attributes, not
 * `style`, so a page under a strict Content-Security-Policy reports nothing), the background
 * painted in, and the enhancement layer's pointer targets and brush left out. `each` sees every
 * original element beside its copy.
 */
function copy(
  svg: SVGSVGElement,
  each?: (from: Element, to: Element) => void,
): { clone: SVGSVGElement; w: number; h: number } {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const from = [svg, ...svg.querySelectorAll("*")];
  const to = [clone, ...clone.querySelectorAll("*")];
  from.forEach((el, i) => {
    const target = to[i] as Element;
    const computed = getComputedStyle(el);
    for (const name of PROPERTIES) {
      // A pattern fill computes to url("page#id"); the copy keeps its own patterns.
      const value = computed
        .getPropertyValue(name)
        .replace(/url\("?[^#"]*(#[^")]+)"?\)/g, "url($1)");
      if (value) target.setAttribute(name, value);
    }
    each?.(el, target);
  });
  for (const extra of clone.querySelectorAll(".enarratio-hit, .enarratio-brush")) extra.remove();
  const [, , w = svg.clientWidth, h = svg.clientHeight] = (svg.getAttribute("viewBox") ?? "")
    .split(/[\s,]+/)
    .map(Number);
  const probe = document.createElement("span");
  probe.style.backgroundColor = "var(--enarratio-background)";
  svg.after(probe);
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
  return { clone, w, h };
}

const serialize = (node: Node): string => new XMLSerializer().serializeToString(node);

/** The drawing as shown, as an SVG file. */
export function svgFile(svg: SVGSVGElement): Blob {
  return new Blob([serialize(copy(svg).clone)], { type: "image/svg+xml" });
}

/** The drawing as shown, as a PNG at twice its size. */
export async function pngFile(svg: SVGSVGElement): Promise<Blob> {
  const { clone, w, h } = copy(svg);
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialize(clone))}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * PNG_SCALE);
  canvas.height = Math.round(h * PNG_SCALE);
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise((done, fail) =>
    canvas.toBlob((blob) => (blob ? done(blob) : fail(new Error("no PNG"))), "image/png"),
  );
}

/**
 * The colors a tactile drawing is printed in: black raises, white stays flat. Every series is
 * black, told apart by textures, dashes and labels, as in forced colors; the sequential ramp is
 * five grays from white to black, and printed values carry what a gray cannot.
 */
function tactileColors(): [string, string][] {
  const pairs: [string, string][] = [
    ["background", "#fff"],
    ["text", "#000"],
    ["text-muted", "#000"],
    ["grid", "#000"],
    ["focus", "#000"],
    ["status-good", "#000"],
    ["status-warning", "#000"],
    ["status-bad", "#000"],
    ["status-unknown", "#000"],
  ];
  for (let i = 1; i <= 8; i += 1) {
    pairs.push(
      [`series-${i}`, "#000"],
      [`series-text-${i}`, "#fff"],
      [`series-label-${i}`, "#000"],
    );
  }
  ["#fff", "#bbb", "#888", "#444", "#000"].forEach((gray, i) => {
    pairs.push(
      [`sequential-${i + 1}`, gray],
      [`sequential-text-${i + 1}`, i < 3 ? "#000" : "#fff"],
      [`sequential-edge-${i + 1}`, "#000"],
    );
  });
  return pairs;
}

/** The tactile page: 11 by 11.5 inches (the braille page), at 96 units an inch. */
const PAGE_W = 11 * 96;
const PAGE_H = 11.5 * 96;
const MARGIN = 48;
/** The thinnest raised line, in page units: about 0.7 mm, which a fingertip finds. */
const MIN_LINE = 2.7;

/**
 * The drawing as a tactile SVG, for a braille embosser or swell paper (B55), following the
 * Braille Authority of North America's tactile graphics guidelines (2022) where a drawing can:
 * black on white, scaled to fill an 11 by 11.5 inch page, the title as a heading above it,
 * gridlines left out (they are less than the data, 3.4.3.8), every raised line at least 0.7 mm,
 * series told apart by texture and dash rather than color, textures at full strength, every
 * label horizontal (5.10.1; a turned axis title moves under the heading) and kept as text, so
 * braille translation software or the embosser's own can write it in braille.
 */
export function tactileFile(svg: SVGSVGElement, title: string): Blob {
  const colors = tactileColors();
  for (const [name, value] of colors) svg.style.setProperty(`--enarratio-${name}`, value);
  // Axes drawn in currentColor follow the page's text, light on a dark page.
  svg.style.setProperty("color", "#000");
  const { clone, w, h } = (() => {
    try {
      return copy(svg, (from, to) => {
        // Lines 2 to 8 take their dash, as forced colors draws them.
        const n = /^var\(--enarratio-series-(\d)\)$/.exec(from.getAttribute("stroke") ?? "")?.[1];
        if (n && n !== "1" && from.closest('[data-enarratio-mark="line"]')) {
          to.setAttribute("stroke-dasharray", LINE_DASHES[Number(n) - 2] ?? "");
        }
      });
    } finally {
      for (const [name] of colors) svg.style.removeProperty(`--enarratio-${name}`);
      svg.style.removeProperty("color");
    }
  })();
  // A turned label (a y axis title) is moved under the heading, read horizontally (5.10.1).
  const turned: string[] = [];
  // A map's street names keep their angle along their streets.
  for (const text of clone.querySelectorAll("text")) {
    if (!/rotate\(/.test(text.getAttribute("transform") ?? "")) continue;
    if (text.closest('[data-enarratio-mark="basemap label"]')) continue;
    if (text.textContent?.trim()) turned.push(text.textContent.trim());
    text.remove();
  }
  const top = MARGIN + 48 + turned.length * 32;
  const scale = Math.min((PAGE_W - 2 * MARGIN) / w, (PAGE_H - MARGIN - top) / h);
  // The painted background is the page's; paper is white.
  clone.firstElementChild?.setAttribute("fill", "#fff");
  for (const grid of clone.querySelectorAll('[data-enarratio-mark$="grid"]')) grid.remove();
  for (const el of clone.querySelectorAll("*")) {
    const stroke = el.getAttribute("stroke");
    if (stroke && stroke !== "none") {
      const width = Number.parseFloat(el.getAttribute("stroke-width") ?? "1") || 1;
      el.setAttribute("stroke-width", String(Math.max(width, MIN_LINE / scale)));
      el.setAttribute("stroke-opacity", "1");
    }
    if (el.getAttribute("fill-opacity")) el.setAttribute("fill-opacity", "1");
    if (/^(text|tspan)$/i.test(el.tagName)) {
      // Labels in black on a white patch that leaves blank space round them on a raised area
      // (3.4.3.13).
      el.setAttribute("fill", "#000");
      el.setAttribute("stroke", "#fff");
      el.setAttribute("stroke-width", String(6 / scale));
      el.setAttribute("stroke-linejoin", "round");
      el.setAttribute("paint-order", "stroke");
    }
  }
  const page = document.createElementNS(SVG_NS, "svg");
  page.setAttribute("xmlns", SVG_NS);
  page.setAttribute("width", "11in");
  page.setAttribute("height", "11.5in");
  page.setAttribute("viewBox", `0 0 ${PAGE_W} ${PAGE_H}`);
  page.setAttribute("role", "img");
  const name = document.createElementNS(SVG_NS, "title");
  name.textContent = svg.getAttribute("aria-label") || title;
  const heading = document.createElementNS(SVG_NS, "text");
  heading.setAttribute("x", String(MARGIN));
  heading.setAttribute("y", String(MARGIN + 24));
  heading.setAttribute("font-size", "28");
  heading.setAttribute("font-family", "sans-serif");
  heading.textContent = title;
  const notes = turned.map((line, i) => {
    const note = document.createElementNS(SVG_NS, "text");
    note.setAttribute("x", String(MARGIN));
    note.setAttribute("y", String(MARGIN + 64 + i * 32));
    note.setAttribute("font-size", "22");
    note.setAttribute("font-family", "sans-serif");
    note.textContent = line;
    return note;
  });
  clone.setAttribute("x", String(MARGIN));
  clone.setAttribute("y", String(top));
  clone.setAttribute("width", String(w * scale));
  clone.setAttribute("height", String(h * scale));
  clone.removeAttribute("role");
  clone.removeAttribute("aria-label");
  page.append(name, heading, ...notes, clone);
  const background = document.createElementNS(SVG_NS, "rect");
  background.setAttribute("width", "100%");
  background.setAttribute("height", "100%");
  background.setAttribute("fill", "#fff");
  name.after(background);
  return new Blob([serialize(page)], { type: "image/svg+xml" });
}
