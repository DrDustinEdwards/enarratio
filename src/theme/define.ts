import { isHexColor } from "./color.js";
import type { ColorScheme, Theme } from "./types.js";

const GRIDLINES = new Set(["none", "x", "y", "both"]);

/**
 * Characters that could end a CSS comment, declaration, rule or the surrounding <style> element.
 * A theme's name and fonts are written into CSS, and themes may come from data (F10, A10).
 */
const UNSAFE_CSS_TEXT = /[<>{};\\]|\/\*|\*\//;

/** Throws unless `text` can be written into CSS as it is. */
export function assertCssText(where: string, text: string): void {
  if (UNSAFE_CSS_TEXT.test(text)) {
    throw new Error(
      `${where}: "${text}" contains a character not allowed in CSS text (<, >, {, }, ;, \\, /* or */)`,
    );
  }
}

function assertScheme(themeName: string, which: "light" | "dark", scheme: ColorScheme): void {
  const where = `theme "${themeName}" ${which}`;
  const colors: [string, string][] = [
    ["background", scheme.background],
    ["text", scheme.text],
    ["mutedText", scheme.mutedText],
    ["grid", scheme.grid],
    ["focus", scheme.focus],
    ...scheme.series.map((c, i): [string, string] => [`series[${i}]`, c]),
    ...scheme.sequential.map((c, i): [string, string] => [`sequential[${i}]`, c]),
    ["status.good", scheme.status.good],
    ["status.warning", scheme.status.warning],
    ["status.bad", scheme.status.bad],
    ["status.unknown", scheme.status.unknown],
  ];
  if (scheme.series.length !== 8) {
    throw new Error(`${where}: series must have exactly 8 colors, has ${scheme.series.length}`);
  }
  if (scheme.sequential.length !== 5) {
    throw new Error(
      `${where}: sequential must have exactly 5 colors, has ${scheme.sequential.length}`,
    );
  }
  for (const [name, value] of colors) {
    if (!isHexColor(value)) throw new Error(`${where}.${name}: "${value}" is not a hex color`);
  }
}

/**
 * Validates a theme's shape and returns it unchanged. TypeScript already checks the shape at
 * compile time; this is for themes built from data at run time (JSON, a CMS), where a typo would
 * otherwise become an invisible chart instead of an error.
 *
 * It does not judge the colors: {@link checkTheme} does that, and reports rather than throws.
 */
export function defineTheme(theme: Theme): Theme {
  if (theme.name.trim() === "") throw new Error("a theme needs a non-empty name");
  assertCssText("theme name", theme.name);
  if (theme.fonts.body.trim() === "") throw new Error(`theme "${theme.name}": fonts.body is empty`);
  assertCssText(`theme "${theme.name}" fonts.body`, theme.fonts.body);
  if (theme.fonts.numeric !== undefined) {
    assertCssText(`theme "${theme.name}" fonts.numeric`, theme.fonts.numeric);
  }
  if (!GRIDLINES.has(theme.gridlines)) {
    throw new Error(`theme "${theme.name}": gridlines must be none, x, y or both`);
  }
  assertScheme(theme.name, "light", theme.light);
  assertScheme(theme.name, "dark", theme.dark);
  return theme;
}
