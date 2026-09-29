// Two measurements per sample, grouped, with a regression line on a log axis.
import { scatterPlot } from "abscissa";

const isolates = [
  { id: "A1", clade: "2.3.4.4b", ct: 18.2, titer: 5.2e6 },
  { id: "A2", clade: "2.3.4.4b", ct: 21.5, titer: 6.1e5 },
  { id: "A3", clade: "2.3.4.4b", ct: 24.9, titer: 4.8e4 },
  { id: "A4", clade: "2.3.4.4b", ct: 27.3, titer: 9.5e3 },
  { id: "A5", clade: "2.3.4.4b", ct: 30.8, titer: 7.2e2 },
  { id: "B1", clade: "2.3.2.1c", ct: 19.4, titer: 2.1e6 },
  { id: "B2", clade: "2.3.2.1c", ct: 22.8, titer: 1.9e5 },
  { id: "B3", clade: "2.3.2.1c", ct: 26.1, titer: 2.4e4 },
  { id: "B4", clade: "2.3.2.1c", ct: 29.6, titer: 1.6e3 },
];

export default scatterPlot({
  data: isolates,
  x: "ct",
  y: "titer",
  series: "clade",
  label: "id",
  yType: "log",
  regression: true,
  xLabel: "Cycle threshold (Ct)",
  yLabel: "Infectious titer (PFU/mL)",
  title: "Ct value against infectious titer",
  alt: "Scatter plot of nine isolates from two clades: infectious titer falls about tenfold for every 3.3 Ct cycles in both clades, from about 5 million PFU/mL at Ct 18 to about 700 at Ct 31.",
  caption: "Illustrative data. Each series has its own symbol as well as its own color.",
});
