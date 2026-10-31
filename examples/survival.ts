// Kaplan-Meier survival curves with censor marks and the number at risk.
import { survivalPlot } from "enarratio/science";

// Remission times in weeks for 6-MP and placebo (Freireich et al. 1963, Gehan 1965); a + marks censoring.
const arms: Record<string, string> = {
  "6-MP": "6 6 6 6+ 7 9+ 10 10+ 11+ 13 16 17+ 19+ 20+ 22 23 25+ 32+ 32+ 34+ 35+",
  Placebo: "1 1 2 2 3 4 4 5 5 8 8 8 8 11 11 12 12 15 17 22 23",
};
const patients = Object.entries(arms).flatMap(([arm, times]) =>
  times.split(" ").map((t) => ({ arm, weeks: Number.parseInt(t, 10), relapsed: !t.endsWith("+") })),
);

export default survivalPlot({
  data: patients,
  time: "weeks",
  event: "relapsed",
  group: "arm",
  timeLabel: "Weeks",
  survivalLabel: "Remaining in remission",
  title: "Remission in childhood leukemia",
  alt: "Kaplan-Meier curves of remission for 21 patients on 6-MP and 21 on placebo: every placebo patient relapsed by week 23, with half by week 8, while on 6-MP 12 were censored and the estimate stays at 0.45 from week 23.",
  caption: "Freireich et al. (1963) as tabulated by Gehan (1965).",
});
