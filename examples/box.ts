// Box plots by group, every value drawn beside its box.
import { boxPlot } from "enarratio/plot";

const weights: Record<string, number[]> = {
  Chow: [24.1, 25.3, 23.8, 26.0, 24.7, 25.1, 23.2, 24.9, 25.8, 24.4],
  "High fat": [29.4, 31.2, 28.7, 33.5, 30.1, 32.0, 29.9, 30.6, 38.2, 31.4],
  "High fat + drug": [26.2, 27.8, 25.9, 28.4, 27.1, 26.6, 29.0, 27.4, 26.8, 22.1],
};
const mice = Object.entries(weights).flatMap(([diet, values]) =>
  values.map((weight) => ({ diet, weight })),
);

export default boxPlot({
  data: mice,
  x: "diet",
  y: "weight",
  points: true,
  xLabel: "Diet",
  yLabel: "Body weight at 12 weeks (g)",
  title: "Body weight by diet",
  alt: "Box plots of body weight for three diets, ten mice each: chow has a median of 24.8 g, high fat 30.9 g with one heavy mouse at 38.2 g, and high fat with the drug 27.0 g with one light mouse at 22.1 g.",
  caption:
    "Illustrative data. Boxes span the quartiles; whiskers reach the furthest value within 1.5 IQR.",
});
