// Smoothed distributions of one measurement, compared on shared axes.
import { densityPlot } from "enarratio/plot";

let seed = 11;
const random = (): number => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const normal = (mean: number, sd: number): number =>
  mean + sd * Math.sqrt(-2 * Math.log(random())) * Math.cos(2 * Math.PI * random());
const groups = { "Wild type": [24, 3], ΔNS1: [31, 4], "PA-X null": [27, 6] } as const;
const ct = Object.entries(groups).flatMap(([virus, [mean, sd]]) =>
  Array.from({ length: 80 }, () => ({ virus, ct: Math.round(normal(mean, sd) * 10) / 10 })),
);

export default densityPlot({
  data: ct,
  x: "ct",
  series: "virus",
  xLabel: "Cycle threshold (Ct)",
  title: "Ct values by virus",
  alt: "Density of Ct values for three viruses, 80 samples each: wild type peaks near Ct 24, PA-X null near 27 and spreads widest, and ΔNS1 peaks latest, near 32.",
  caption: "Illustrative data.",
});
