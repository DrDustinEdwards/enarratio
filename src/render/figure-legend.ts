import { element, escapeHtml } from "../html.js";
import type { FigureParts } from "./figure.js";

/**
 * Kinds whose series are lines, and kinds told apart by symbol: their legend swatches are drawn as
 * a line (dashed in forced colors) or as the symbol, so the legend matches the marks without color.
 */
const LINE_KINDS = new Set([
  "line",
  "density",
  "survival",
  "dose-response",
  "slope",
  "radar",
  "parallel",
]);
const SYMBOL_KINDS = new Set(["scatter", "dot", "tree", "network"]);
/** Charts whose first series is drawn hollow (a candlestick's rising candles). */
const HOLLOW_KINDS = new Set(["candlestick"]);

export function legendMarkup(parts: FigureParts): string {
  const swatch = element("span", { class: "enarratio-swatch", "aria-hidden": "true" });
  if (parts.ramp && parts.ramp.length > 0) {
    return element(
      "ul",
      { class: "enarratio-legend enarratio-ramp" },
      parts.ramp
        .map((item) =>
          element("li", { "data-step": item.step }, `${swatch}${escapeHtml(item.label)}`),
        )
        .join(""),
    );
  }
  if (!parts.legend || parts.legend.length === 0) return "";
  const mark = LINE_KINDS.has(parts.kind)
    ? "line"
    : SYMBOL_KINDS.has(parts.kind)
      ? "symbol"
      : HOLLOW_KINDS.has(parts.kind)
        ? "hollow"
        : undefined;
  return element(
    "ul",
    { class: "enarratio-legend", "data-enarratio-legend": mark },
    parts.legend
      .map((item) =>
        element(
          "li",
          { "data-enarratio-series": item.label, "data-slot": item.slot },
          `${swatch}${escapeHtml(item.label)}`,
        ),
      )
      .join(""),
  );
}
