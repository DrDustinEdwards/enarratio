// Every value as a point, spread in a beeswarm so none hides another.
import { stripPlot } from "enarratio/plot";

let seed = 3;
const random = (): number => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const normal = (mean: number, sd: number): number =>
  mean + sd * Math.sqrt(-2 * Math.log(random())) * Math.cos(2 * Math.PI * random());
const cohorts = { "18 to 49": [62, 10], "50 to 64": [70, 9], "65 and over": [78, 7] } as const;
const scores = Object.entries(cohorts).flatMap(([age, [mean, sd]]) =>
  Array.from({ length: 40 }, () => ({ age, score: Math.min(100, Math.round(normal(mean, sd))) })),
);

export default stripPlot({
  data: scores,
  x: "age",
  y: "score",
  colorByGroup: true,
  xLabel: "Age group",
  yLabel: "Knowledge score",
  title: "Vaccine knowledge scores by age",
  alt: "Beeswarm of knowledge scores for 40 people in each of three age groups: scores rise with age, centered near 62 for 18 to 49, 70 for 50 to 64 and 78 for 65 and over, with the youngest group the most spread.",
  caption: "Illustrative data.",
});
