// Grouped bars with 95% confidence intervals as error bars.
import { barChart } from "enarratio/plot";

const assays = [
  { strain: "PR8", treatment: "Control", titer: 6.1, lo: 5.6, hi: 6.6 },
  { strain: "PR8", treatment: "Antiviral", titer: 3.9, lo: 3.2, hi: 4.6 },
  { strain: "WSN", treatment: "Control", titer: 6.8, lo: 6.4, hi: 7.2 },
  { strain: "WSN", treatment: "Antiviral", titer: 4.4, lo: 3.9, hi: 4.9 },
  { strain: "Cal09", treatment: "Control", titer: 5.7, lo: 5.1, hi: 6.3 },
  { strain: "Cal09", treatment: "Antiviral", titer: 5.0, lo: 4.3, hi: 5.7 },
];

export default barChart({
  data: assays,
  x: "strain",
  y: "titer",
  series: "treatment",
  layout: "grouped",
  errorBars: { lower: "lo", upper: "hi", label: "95% CI" },
  xLabel: "Strain",
  yLabel: "Titer (log10 PFU/mL)",
  title: "Viral titer with and without antiviral",
  alt: "Mean viral titer for three strains, control against antiviral, with 95% confidence intervals: the antiviral lowers titer by about 2.3 log10 for PR8 and WSN, with intervals far apart, and by 0.7 for Cal09, where the intervals overlap.",
  caption: "Illustrative data. Error bars are 95% confidence intervals of the mean, n = 6.",
});
