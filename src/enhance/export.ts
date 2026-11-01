/**
 * Saving the drawing (C3, and tactile, B55) and copying a snippet that points at the chart (C4).
 * Buttons beside the "Download CSV" link, or in the control bar when the figure has none. The
 * files are made by ./image.js, which loads on the first press.
 */

import { button } from "./controls.js";
import type { EnhanceStrings } from "./types.js";

function save(blob: Blob, file: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = file;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 0);
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
  options: { readonly download: boolean; readonly tactile: boolean; readonly embed: boolean },
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
    const download = (
      label: string,
      file: string,
      make: (image: typeof import("./image.js")) => Blob | Promise<Blob>,
    ) =>
      button(label, () =>
        import("./image.js").then(make).then(
          (blob) => save(blob, file),
          () => announce(strings.exportFailed),
        ),
      );
    buttons.push(
      download(strings.downloadSvg, `${base}.svg`, (i) => i.svgFile(svg)),
      download(strings.downloadPng, `${base}.png`, (i) => i.pngFile(svg)),
    );
    if (options.tactile) {
      buttons.push(
        download(strings.downloadTactile, `${base}-tactile.svg`, (i) =>
          i.tactileFile(svg, title || strings.chart),
        ),
      );
    }
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
