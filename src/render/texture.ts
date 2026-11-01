/**
 * Pattern fills, so filled series are told apart by texture as well as hue (B5, B49): slot 1 stays
 * solid and slots 2 to 8 each lay a texture, in the color for text on that series, over its color.
 * In forced-colors mode every series is the same system color and the textures alone tell them
 * apart. Both renderers pass their finished SVG through {@link texture}, so they agree.
 */

/** One 8-unit tile's strokes per slot: /, dots, -, |, \, +, x. */
const TEXTURES = [
  "M-2 2l4-4M0 8l8-8M6 10l4-4",
  "M2 2h.5M6 6h.5",
  "M0 4h8",
  "M4 0v8",
  "M-2 6l4 4M0 0l8 8M6-2l4 4",
  "M0 4h8M4 0v8",
  "M-2 2l4-4M0 8l8-8M6 10l4-4M-2 6l4 4M0 0l8 8M6-2l4 4",
];

/** A short, stable hash (FNV-1a). */
export function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

/**
 * Fills series 2 to 8 with their patterns and defines the patterns the drawing uses. Ids come from
 * the drawing's text and its color overrides (`colors`), which both renderers write alike, so two
 * charts on a page never share a pattern that one recolors.
 */
export function texture(svg: string, colors = ""): string {
  const slots = new Set<number>();
  const filled = svg.replace(/fill="var\(--enarratio-series-([2-8])\)"/g, (_, slot: string) => {
    slots.add(Number(slot));
    return `fill="url(#enarratio-pattern-${slot})"`;
  });
  if (slots.size === 0) return svg;
  const id = `enarratio-${hash(svg.replace(/<[^>]*>/g, " ") + colors)}-`;
  const defs = [...slots]
    .sort((a, b) => a - b)
    .map(
      (n) =>
        `<pattern id="${id}${n}" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="var(--enarratio-series-${n})"/><path class="enarratio-texture" d="${TEXTURES[n - 2]}" fill="none" stroke="var(--enarratio-series-text-${n})" stroke-width="1.5" stroke-linecap="round"/></pattern>`,
    )
    .join("");
  return filled
    .replaceAll("url(#enarratio-pattern-", `url(#${id}`)
    .replace(/^<svg[^>]*>/, (open) => `${open}<defs>${defs}</defs>`);
}
