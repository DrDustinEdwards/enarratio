// A forest plot: study estimates with intervals, and the pooled estimate as a diamond.
import { forestPlot } from "enarratio/science";

const trials = [
  { trial: "Alvarez 2019", or: 0.72, lo: 0.51, hi: 1.02 },
  { trial: "Becker 2020", or: 0.85, lo: 0.66, hi: 1.09 },
  { trial: "Chen 2021", or: 0.61, lo: 0.4, hi: 0.93 },
  { trial: "Diallo 2022", or: 1.04, lo: 0.7, hi: 1.55 },
  { trial: "Evans 2023", or: 0.78, lo: 0.63, hi: 0.97 },
  { trial: "Fischer 2024", or: 0.69, lo: 0.46, hi: 1.04 },
];

export default forestPlot({
  data: trials,
  label: "trial",
  estimate: "or",
  lower: "lo",
  upper: "hi",
  log: true,
  pooled: "random",
  estimateLabel: "Odds ratio of hospitalization (95% CI)",
  favors: ["Favors vaccine", "Favors placebo"],
  title: "Vaccination and hospitalization, six trials",
  alt: "Forest plot of six trials: five odds ratios fall below 1, two of their intervals clear of it, and one, Diallo 2022, sits just above 1; the pooled random-effects odds ratio is about 0.79, with an interval below 1.",
  caption: "Illustrative data.",
});
