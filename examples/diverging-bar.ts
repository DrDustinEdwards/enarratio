// Signed changes about zero, sorted, each labeled with its sign.
import { divergingBarChart } from "enarratio/plot";

const change = [
  { county: "Ashe", points: 4.2 },
  { county: "Buncombe", points: 2.8 },
  { county: "Catawba", points: 1.1 },
  { county: "Durham", points: -0.6 },
  { county: "Forsyth", points: -1.9 },
  { county: "Guilford", points: 0.4 },
  { county: "Haywood", points: -3.4 },
  { county: "Iredell", points: 2.1 },
];

export default divergingBarChart({
  data: change,
  x: "county",
  y: "points",
  sort: "descending",
  positiveLabel: "Rose",
  negativeLabel: "Fell",
  xLabel: null,
  yLabel: "Change in vaccination rate (percentage points)",
  title: "Vaccination rate change, 2024 to 2025",
  alt: "Change in vaccination rate by county from 2024 to 2025: five counties rose, led by Ashe at +4.2 points, and three fell, the most Haywood at −3.4 points.",
  caption: "Illustrative data.",
});
