/**
 * Saving the drawing (C3) and copying a snippet that points at the chart (C4). Buttons beside the
 * "Download CSV" link, or in the control bar when the figure has none. No dependency: the SVG is
 * the drawing as shown, with its computed colors and fonts written onto each element, and the PNG
 * is that SVG drawn on a canvas.
 */

import { button } from "./controls.js";
import { SVG_NS } from "./marks.js";
import type { EnhanceStrings } from "./types.js";

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
function standalone(
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

function save(blob: Blob, file: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = file;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 0);
}

async function png(markup: string, w: number, h: number): Promise<Blob> {
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

const escapeHtml = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/**
 * The export and embed buttons for one figure, placed beside its CSV link or appended to `bar`.
 * Returns the undo.
 */
export function exportControls(
  figure: HTMLElement,
  svg: SVGSVGElement,
  options: { readonly download: boolean; readonly embed: boolean },
  strings: EnhanceStrings,
  bar: HTMLElement,
  announce: (message: string) => void,
): () => void {
  const csv = figure.querySelector<HTMLAnchorElement>(".enarratio-csv");
  const base = (
    csv?.getAttribute("download") ??
    figure.getAttribute("data-enarratio") ??
    "chart"
  ).replace(/\.csv$/, "");
  const title = figure.querySelector(".enarratio-title")?.textContent?.trim();
  const buttons: HTMLButtonElement[] = [];
  if (options.download) {
    buttons.push(
      button(strings.downloadSvg, () => {
        const { markup } = standalone(svg, figure);
        save(new Blob([markup], { type: "image/svg+xml" }), `${base}.svg`);
      }),
      button(strings.downloadPng, () => {
        const { markup, w, h } = standalone(svg, figure);
        png(markup, w, h).then(
          (blob) => save(blob, `${base}.png`),
          () => announce(strings.exportFailed),
        );
      }),
    );
  }
  // A snippet needs an address for the chart, which only a figure with an id has.
  if (options.embed && figure.id && navigator.clipboard) {
    buttons.push(
      button(strings.copyEmbed, () => {
        const href = `${location.href.split("#")[0]}#${encodeURIComponent(figure.id)}`;
        const snippet = `<a href="${escapeHtml(href)}">${escapeHtml(title || strings.chart)}</a>`;
        navigator.clipboard.writeText(snippet).then(
          () => announce(strings.embedCopied),
          () => announce(strings.exportFailed),
        );
      }),
    );
  }
  // Beside the CSV link, as links read, or in the control bar when the figure has none.
  const added = csv ? buttons.flatMap((b) => [document.createTextNode(" · "), b]) : buttons;
  for (const b of buttons) if (csv) b.className = "enarratio-export";
  if (csv) csv.after(...added);
  else bar.append(...added);
  return () => {
    for (const node of added) node.parentNode?.removeChild(node);
  };
}
