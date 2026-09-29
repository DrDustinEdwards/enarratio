// Hemagglutination inhibition titers by timepoint on a two-fold dilution axis.
import { titerPlot } from "abscissa";

const titers: Record<string, number[]> = {
  "Day 0": [5, 5, 10, 10, 10, 20, 20, 40, 10, 10, 20, 10],
  "Day 14": [40, 80, 80, 160, 160, 160, 320, 80, 40, 160, 320, 640],
  "Day 28": [80, 160, 160, 320, 320, 320, 640, 160, 80, 320, 640, 1280],
  "Day 180": [20, 40, 40, 80, 80, 80, 160, 40, 20, 80, 160, 320],
};
const sera = Object.entries(titers).flatMap(([timepoint, values]) =>
  values.map((hai) => ({ timepoint, hai })),
);

export default titerPlot({
  data: sera,
  group: "timepoint",
  titer: "hai",
  dilution: { start: 10, factor: 2 },
  groupLabel: "Timepoint",
  titerLabel: "HAI titer",
  title: "HAI titers after vaccination",
  alt: "HAI titers for 12 participants at four timepoints. The geometric mean titer rises from about 12 at day 0 to about 270 at day 28, then wanes to about 67 by day 180. Two day 0 samples were below the 1:10 limit of detection.",
  caption:
    "Illustrative data. Bars are geometric mean titers with 95% confidence intervals; hollow points are below the limit of detection, plotted at half the limit.",
});
