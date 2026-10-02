/**
 * The gallery's second theme, and a worked example of writing one. It is deliberately not
 * anyone's brand: warm paper, a serif body, gridlines both ways and a violet ramp, so that the
 * gallery shows how far a theme can move from `defaultTheme` while every chart's markup stays the
 * same. Copy it, change what you need, and run `checkTheme` on the result.
 *
 * How to read a theme (the full contract is in docs/api.md):
 *
 * - A theme is data: fonts, which gridlines to show, and a `light` and a `dark` color scheme.
 *   `stylesheet(theme)` turns it into CSS custom properties (`--enarratio-series-1`, ...) and
 *   charts refer only to those, so one server render serves both schemes.
 * - Every color is hex, because Enarratio measures them. `checkTheme` holds text and muted text to
 *   4.5:1 on the background, every series, status and focus color to 3:1, and reports series
 *   colors that look alike to a reader with typical vision, protanopia, deuteranopia or
 *   tritanopia (CIEDE2000 under 10). The last is a warning, not an error: with eight colors some
 *   pair is always close for someone, which is why charts never rely on hue alone.
 * - A series keeps its hue from light to dark (series 1 is blue in both) and is lighter in dark,
 *   so a reader who has learned the colors keeps them when the scheme changes. A few pairs
 *   (green and crimson with deuteranopia, say) are still closer than 10 units; the gallery's theme
 *   check lists them, and charts answer with labels, symbols and tables, not hue alone.
 * - The sequential ramp runs from least to most. In light, "most" is the darkest step; in dark it
 *   is the lightest, because it must stand out from the background.
 * - Sizes, weights, radii and animation timings are not part of a theme: set the
 *   `--enarratio-*` custom properties for those (docs/api.md, "Custom properties").
 */
import type { Theme } from "enarratio";

export const exampleTheme: Theme = {
  name: "example",
  fonts: {
    // The body font is used for titles, labels, legends and tables. `numeric` could name a
    // different font for tick labels and values; left out, they use the body font.
    body: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
  },
  gridlines: "both",
  light: {
    background: "#fbfaf7",
    text: "#211f1c",
    mutedText: "#57534c",
    grid: "#ddd9cf",
    focus: "#5a3fb0",
    series: [
      "#1d5fa6",
      "#b0520b",
      "#1c7a52",
      "#a1264a",
      "#4d91b3",
      "#0f0f8a",
      "#0d7385",
      "#5b5853",
    ],
    sequential: ["#ece7f6", "#cdc1e8", "#a590d2", "#7a5ab8", "#4d2f8a"],
    status: { good: "#1c7a3d", warning: "#8f5c00", bad: "#b3261e", unknown: "#7d7a73" },
  },
  dark: {
    background: "#1b1a18",
    text: "#ece8e1",
    mutedText: "#b0aaa0",
    grid: "#38352f",
    focus: "#b8a4f0",
    series: [
      "#6fa8e8",
      "#e8975a",
      "#62c595",
      "#e87c9b",
      "#b4d1df",
      "#7575f0",
      "#52bfd2",
      "#b8b4ac",
    ],
    sequential: ["#2a2438", "#41355f", "#5f4c93", "#9380d0", "#d4c9f3"],
    status: { good: "#4cc26b", warning: "#e0a526", bad: "#f2685f", unknown: "#7d7a73" },
  },
};
