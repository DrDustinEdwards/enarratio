import type { Theme } from "../theme/types.js";

/**
 * Enarratio's own theme: neutral surfaces, system fonts, horizontal gridlines, and a series
 * palette chosen to pass {@link checkTheme} in light and dark. Series 1 to 6 differ from each
 * other by at least 10 CIEDE2000 units with typical vision and under simulated protanopia,
 * deuteranopia and tritanopia, in both schemes, and each slot keeps its hue from light to dark
 * (A1).
 */
export const defaultTheme: Theme = {
  name: "default",
  fonts: {
    body: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  gridlines: "y",
  light: {
    background: "#ffffff",
    text: "#1b1e23",
    mutedText: "#57606a",
    grid: "#e3e6ea",
    focus: "#0b57d0",
    series: [
      "#084fba",
      "#a06f30",
      "#018d87",
      "#811736",
      "#653161",
      "#6f73b4",
      "#4f5500",
      "#595959",
    ],
    sequential: ["#dbe9f6", "#a6c8ea", "#6aa3d8", "#2f78c0", "#0b4a8c"],
    status: { good: "#1a7f37", warning: "#9a6700", bad: "#cf222e", unknown: "#8c959f" },
  },
  dark: {
    background: "#16181d",
    text: "#e6e8eb",
    mutedText: "#a3aab3",
    grid: "#2f343c",
    focus: "#8ab4f8",
    series: [
      "#4b8efe",
      "#e7b375",
      "#a1e7e2",
      "#d96a7e",
      "#b57baf",
      "#b1b7fd",
      "#96984b",
      "#a8a8a8",
    ],
    sequential: ["#1d2d42", "#1f4c7a", "#2f74b5", "#6aa6e0", "#b8d8f5"],
    status: { good: "#3fb950", warning: "#d29922", bad: "#f85149", unknown: "#6e7681" },
  },
};
