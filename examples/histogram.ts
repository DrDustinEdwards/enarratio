// A histogram of one measurement, with a density curve over it.
import { histogram } from "enarratio/plot";

// A fixed sample, so the gallery draws the same chart every time.
let seed = 7;
const random = (): number => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const normal = (mean: number, sd: number): number =>
  mean + sd * Math.sqrt(-2 * Math.log(random())) * Math.cos(2 * Math.PI * random());
const cells = Array.from({ length: 240 }, () => ({
  diameter: Math.round(normal(12.4, 1.8) * 10) / 10,
}));

export default histogram({
  data: cells,
  x: "diameter",
  thresholds: 14,
  density: true,
  xLabel: "Cell diameter (µm)",
  title: "Cell diameters",
  alt: "Histogram of 240 cell diameters: one peak near 12.5 µm, roughly symmetric, with nearly all cells between 8 and 17 µm.",
  caption: "Illustrative data.",
});
