/**
 * Saving the drawing (C3) and copying a snippet that points at the chart (C4). Buttons beside the
 * "Download CSV" link, or in the control bar when the figure has none. No dependency: the SVG is
 * the drawing as shown, with its computed colors and fonts written onto each element, and the PNG
 * is that SVG drawn on a canvas.
 */

import { button } from "./controls.js";
import type { EnhanceStrings } from "./types.js";

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
        import("./export-file.js").then(
          ({ standalone, save }) => {
            const { markup } = standalone(svg, figure);
            save(new Blob([markup], { type: "image/svg+xml" }), `${base}.svg`);
          },
          () => announce(strings.exportFailed),
        );
      }),
      button(strings.downloadPng, () => {
        import("./export-file.js")
          .then(({ standalone, png, save }) => {
            const { markup, w, h } = standalone(svg, figure);
            return png(markup, w, h).then((blob) => save(blob, `${base}.png`));
          })
          .catch(() => announce(strings.exportFailed));
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
