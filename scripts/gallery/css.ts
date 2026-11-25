import { cpSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { inlineCss } from "capsomer/build";
import { type Example, reserveCss } from "./examples.ts";

export const packageFile = createRequire(import.meta.url).resolve;
const capsomerDir = dirname(dirname(packageFile("capsomer/tokens.css")));

/** The Capsomer components the page uses, in the order their CSS loads, then the NASA manual theme and the family footer. */
const COMPONENTS = [
  "link",
  "button",
  "popover",
  "dialog",
  "theme-switch",
  "site-header",
  "page-head",
  "panel",
  "disclosure",
  "chart-frame",
  "manual",
  "family-footer",
];

/** The gallery's color family: every page's root is `data-family="rose"`. */
export const FAMILY = "rose";

/**
 * The gallery's own layout, from Capsomer's tokens, in the NASA manual theme. The charts' column
 * stays 52rem, so each chart is drawn at the width its stored images were taken at.
 */
const GALLERY_CSS = `
.gallery { padding-block-start: var(--space-6); }
.gallery-head h1 { margin: 0 0 var(--space-3); font-size: clamp(2rem, 1.5rem + 2vw, 3rem); line-height: 1.05; letter-spacing: -0.02em; text-wrap: balance; }
.gallery-head .cap-form-boxes { margin-block: var(--space-5) 0; }
.gallery-intro { max-width: var(--measure); margin: 0 0 var(--space-4); color: var(--muted); }
.gallery-body { display: grid; gap: var(--space-7); margin-block-start: var(--space-7); }
.gallery-main { min-width: 0; max-width: 52rem; }
@media (min-width: 64rem) { .gallery-contents .cap-leader-index { columns: 2; column-gap: var(--space-8); } .gallery-contents li { break-inside: avoid; } }
.gallery-contents h2 { margin: 0 0 var(--space-3); font: var(--weight-heading) 0.75rem / 1.5 var(--mono); letter-spacing: 0.08em; text-transform: uppercase; }
.gallery .report { border-radius: 0; border-color: var(--text); }
.gallery .cap-panel { margin-block-start: var(--space-6); border-color: var(--text); border-radius: 0; box-shadow: none; }
.gallery .cap-panel-head { display: grid; gap: var(--space-1); background: transparent; border-block-end: 1px solid var(--line); }
.gallery .cap-panel-head h2 { margin: 0; font-size: 1.25rem; text-wrap: balance; }
.gallery .cap-panel-head h2 .cap-part-no { margin-inline-end: var(--space-3); font-weight: 400; color: var(--muted); font-variant-numeric: tabular-nums; }
/* A whole-pixel line (13px at 1.5 is 19.5px), so each chart starts on the pixel grid its stored image was taken on. */
.gallery .cap-panel-head p { margin: 0; color: var(--muted); font-size: var(--fs-detail); line-height: 20px; }
.example-chart { grid-template-columns: minmax(0, 1fr); gap: var(--space-3); background: var(--enarratio-background); color: var(--enarratio-text); }
.example-source { border-block-start: 1px solid var(--line); padding: var(--space-2) calc(var(--pad-card) - var(--pad-x)); }
.example-source pre { overflow-x: auto; margin: 0; padding: var(--space-4); border-radius: var(--radius-m); background: var(--sunken); font: 400 var(--fs-detail) / 1.6 var(--mono); }
.events { min-height: 1.5em; margin: 0; font: 400 var(--fs-detail) / var(--leading) var(--mono); overflow-wrap: anywhere; }
.primitives { display: flex; flex-wrap: wrap; gap: var(--space-6); align-items: center; }
.primitive-tables p { margin: var(--space-3) 0; }
.primitive-tables figure { margin: 0 0 var(--space-6); }
.primitive-tables figure:last-child { margin-bottom: 0; }
.primitive-tables .enarratio-head p { margin: 0; }
.guide > :not(.gallery-head) { max-width: 52rem; }
.guide h2 { margin: var(--space-7) 0 var(--space-3); }
.guide p, .guide ul { max-width: var(--measure); }
.guide pre { overflow-x: auto; margin: var(--space-3) 0; padding: var(--space-4); border-radius: var(--radius-m); background: var(--sunken); font: 400 var(--fs-detail) / 1.6 var(--mono); }
`;

export function capsomerCss(fontDir: string, examples: readonly Example[]): string {
  cpSync(join(capsomerDir, "fonts"), fontDir, { recursive: true });
  return [
    "/* Built by scripts/gallery.ts from Capsomer: its faces, tokens, base and the components the gallery uses. */",
    inlineCss(join(capsomerDir, "css", "fonts.css")).replaceAll("../fonts/", "fonts/"),
    inlineCss(join(capsomerDir, "css", "tokens.css")),
    inlineCss(packageFile("capsomer/base.css")),
    `@layer cap.tokens {\n${inlineCss(join(capsomerDir, "tokens", `family-${FAMILY}.css`))}\n}`,
    ...COMPONENTS.map((name) => inlineCss(join(capsomerDir, "components", name, `${name}.css`))),
    GALLERY_CSS,
    reserveCss(examples),
  ].join("\n\n");
}
