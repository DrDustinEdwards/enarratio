// Several measures, each a bar against its target over qualitative bands (Few's bullet graph).
import { bulletChart } from "enarratio/plot";

const lab = [
  { measure: "Samples processed", done: 1840, goal: 2000, scale: 2400 },
  { measure: "Same-day results (%)", done: 91, goal: 95, scale: 100 },
  { measure: "Results within 24 h (%)", done: 78, goal: 90, scale: 100 },
];

export default bulletChart({
  data: lab,
  label: "measure",
  value: "done",
  target: "goal",
  max: "scale",
  bands: (row) => [
    { to: row.scale * 0.6, label: "poor" },
    { to: row.scale * 0.85, label: "fair" },
    { to: row.scale, label: "good" },
  ],
  title: "Laboratory performance this month",
  alt: "Bullet chart of three lab measures: 1,840 samples processed against a goal of 2,000, 91% same-day results against 95%, and 78% of results within 24 hours against 90%. Each misses its target; same-day results are in the good band, the other two in the fair band.",
  caption: "Illustrative data. Bands are fixed shares of each scale.",
});
