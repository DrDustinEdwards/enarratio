import { BRUSH_SCALES, ENHANCE_STRINGS, ICONS } from "../controls.js";
import { element, escapeHtml } from "../html.js";
import { safeHref } from "./data.js";
import type { FigureOptions, FigureParts } from "./figure.js";
import type { Strings } from "./text.js";

/** Markup the enhancement layer replaces when it runs: inert until then, hidden with scripts off. */
function pending(tag: string, attrs: Record<string, string | undefined>, content: string): string {
  return element(tag, { ...attrs, "data-enarratio-pending": true, inert: true }, content);
}

/** A toolbar icon: an inline SVG stroked in the button's color, hidden from assistive technology. */
function iconMarkup(name: keyof typeof ICONS): string {
  return element(
    "svg",
    { class: "enarratio-icon", viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false" },
    element("path", { d: ICONS[name] }),
  );
}

/** A toolbar control's face: its icon and its word, which is also its name. */
function face(name: keyof typeof ICONS, text: string): string {
  return iconMarkup(name) + element("span", { class: "enarratio-label" }, escapeHtml(text));
}

/**
 * The toolbar above the drawing, as `enhance()` builds it with its default options: Sound with two
 * or more marks, Range on a continuous x scale, then the Download menu. What only the layer can do
 * is written inert and hidden with scripts off; "Download CSV" is a link in a native disclosure.
 * Returns "" when there is nothing to put in it.
 */
export function toolbarMarkup(
  options: FigureOptions,
  parts: FigureParts,
  svg: string,
  csv: string,
): string {
  const s = ENHANCE_STRINGS;
  const layer = !parts.fixed && !parts.tableMarkup && options.controls !== false;
  const bar: string[] = [];
  if (layer && (svg.match(/\sdata-enarratio-key=/g) ?? []).length > 1) {
    bar.push(
      pending("button", { type: "button", "aria-pressed": "false" }, face("sound", s.sound)),
    );
  }
  if (layer && parts.x && BRUSH_SCALES.includes(parts.x.type)) {
    bar.push(
      pending(
        "details",
        { class: "enarratio-range" },
        element("summary", {}, face("range", s.range)),
      ),
    );
  }
  // A primitive (parts.fixed) has no Sound or Range, but its drawing saves as any chart's does.
  const files = !parts.tableMarkup && options.controls !== false;
  const exports = files
    ? [s.downloadSvg, s.downloadPng, s.downloadTactile, ...(options.id ? [s.copyEmbed] : [])]
    : [];
  if (csv || exports.length > 0) {
    const items =
      csv + exports.map((text) => pending("button", { type: "button" }, escapeHtml(text))).join("");
    const menu = `${element("summary", {}, face("download", s.download) + iconMarkup("chevron"))}${element("div", { class: "enarratio-panel enarratio-menu" }, items)}`;
    // With no CSV link, nothing in the menu works without script, so the whole menu waits for it.
    bar.push(
      csv
        ? element("details", { class: "enarratio-download" }, menu)
        : pending("details", { class: "enarratio-download" }, menu),
    );
  }
  return bar.length > 0
    ? element(
        "div",
        { class: "enarratio-controls", role: "toolbar", "aria-label": s.controls },
        bar.join(""),
      )
    : "";
}

/** The source line: source (linked) and byline, or "" when there is none. */
export function sourceLine(kind: string, options: FigureOptions, strings: Strings): string {
  const parts: string[] = [];
  const source = typeof options.source === "string" ? { name: options.source } : options.source;
  if (source?.name.trim()) {
    const name = escapeHtml(source.name.trim());
    const linked = source.href ? element("a", { href: safeHref(kind, source.href) }, name) : name;
    parts.push(`${escapeHtml(strings.source)}: ${linked}`);
  }
  if (options.byline?.trim()) parts.push(escapeHtml(strings.by(options.byline.trim())));
  return parts.length > 0 ? element("p", { class: "enarratio-source" }, parts.join(" · ")) : "";
}
