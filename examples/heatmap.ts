// A grid of values on the theme's sequential ramp.
import { heatmap } from "enarratio/plot";

const cohorts = ["Jan", "Feb", "Mar", "Apr", "May"];
const retention = cohorts.flatMap((cohort, c) =>
  Array.from({ length: 5 - c }, (_, m) => ({
    cohort,
    month: `M${m}`,
    retained: m === 0 ? 100 : Math.round(100 * 0.82 ** m - c * 2),
  })),
);

export default heatmap({
  data: retention,
  x: "month",
  y: "cohort",
  value: "retained",
  valueLabel: "% retained",
  xDomain: ["M0", "M1", "M2", "M3", "M4"],
  thresholds: [50, 60, 70, 85],
  xLabel: "Months since joining",
  yLabel: "Cohort",
  title: "Retention by cohort",
  alt: "Retention heatmap for five monthly cohorts: every cohort starts at 100% and falls about 18 points a month, reaching 45% at month four for the January cohort.",
  caption: "Illustrative data.",
});
