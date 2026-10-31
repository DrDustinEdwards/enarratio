import type { Theme } from "../theme/types.js";

/**
 * A high-contrast theme: black and white surfaces, text at 15:1 or more, gridlines at 3:1, and
 * series colors that each reach 4.5:1 on the background and stay at least 10 CIEDE2000 apart with
 * typical vision and under simulated protanopia, deuteranopia and tritanopia, in light and dark.
 * Use it as a site's theme, or under `prefers-contrast: more` with
 * `stylesheet(theme, { highContrast: highContrastTheme })`.
 */
export const highContrastTheme: Theme = {
  name: "high-contrast",
  fonts: {
    body: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  gridlines: "y",
  light: {
    background: "#ffffff",
    text: "#000000",
    mutedText: "#333333",
    grid: "#767676",
    focus: "#0000ee",
    series: [
      "#0044bb",
      "#bb5500",
      "#554444",
      "#772200",
      "#777766",
      "#996688",
      "#4466ff",
      "#444466",
    ],
    sequential: ["#cfe1f2", "#7fb0db", "#3a7fc1", "#1b4f8a", "#08254a"],
    status: { good: "#006b2e", warning: "#7a4d00", bad: "#b3001b", unknown: "#595959" },
  },
  dark: {
    background: "#000000",
    text: "#ffffff",
    mutedText: "#e6e6e6",
    grid: "#8c8c8c",
    focus: "#9ec5ff",
    series: [
      "#0077cc",
      "#eeaa00",
      "#887777",
      "#cc5533",
      "#bbbbaa",
      "#bb99bb",
      "#9999ff",
      "#777799",
    ],
    sequential: ["#0d2240", "#174a80", "#2f78c0", "#79b1e8", "#d3e7fb"],
    status: { good: "#5ee07a", warning: "#ffc940", bad: "#ff6b6b", unknown: "#a0a0a0" },
  },
};
