// Ranges from low to high, with the median marked.
import { rangePlot } from "enarratio/plot";

const analytes = [
  { analyte: "Hemoglobin (g/dL)", low: 11.8, high: 16.4, median: 14.1 },
  { analyte: "White cells (10³/µL)", low: 4.1, high: 10.9, median: 6.8 },
  { analyte: "Platelets (10⁴/µL)", low: 15.2, high: 39.6, median: 25.3 },
  { analyte: "Glucose (mmol/L)", low: 3.9, high: 7.2, median: 5.1 },
  { analyte: "Creatinine (mg/dL)", low: 0.6, high: 1.3, median: 0.9 },
];

export default rangePlot({
  data: analytes,
  y: "analyte",
  low: "low",
  high: "high",
  value: "median",
  valueLabel: "median",
  xLabel: "Value in the analyte's unit",
  title: "Central 95% of values in the cohort",
  alt: "Range of the central 95% of values for five blood analytes, with medians: hemoglobin 11.8 to 16.4 g/dL, white cells 4.1 to 10.9, platelets 15.2 to 39.6, glucose 3.9 to 7.2 mmol/L and creatinine 0.6 to 1.3 mg/dL.",
  caption: "Illustrative data. The tick marks the median.",
});
