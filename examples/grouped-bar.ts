// Two measurements per category, side by side.
import { barChart } from "enarratio/plot";

const results = [
  { assay: "Plaque", method: "Manual", hours: 72 },
  { assay: "Plaque", method: "Automated", hours: 48 },
  { assay: "TCID50", method: "Manual", hours: 120 },
  { assay: "TCID50", method: "Automated", hours: 96 },
  { assay: "qPCR", method: "Manual", hours: 6 },
  { assay: "qPCR", method: "Automated", hours: 4 },
];

export default barChart({
  data: results,
  x: "assay",
  y: "hours",
  series: "method",
  layout: "grouped",
  xLabel: "Assay",
  yLabel: "Hours to result",
  title: "Time to result by assay",
  alt: "Grouped bars of hours to result for three assays. Automation saves a day on plaque assays (72 to 48 hours) and TCID50 (120 to 96), and two hours on qPCR (6 to 4).",
  caption: "Illustrative data.",
});
