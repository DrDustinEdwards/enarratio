// A line chart with a highlighted range, a note and an arrow.
import { lineChart } from "enarratio/plot";

const weekly = [12, 14, 13, 18, 26, 41, 63, 88, 104, 97, 81, 60, 44, 33, 25, 21].map(
  (visits, i) => ({ week: new Date(Date.UTC(2025, 9, 6 + 7 * i)), visits }),
);

export default lineChart({
  data: weekly,
  x: "week",
  y: "visits",
  xLabel: null,
  yLabel: "ILI visits",
  annotations: [
    { type: "range", axis: "x", from: "2025-12-22", to: "2026-01-12", label: "Winter break" },
    { type: "note", x: "2025-12-01", y: 104, text: "Peak, 104 visits", dx: 64, dy: 28 },
  ],
  title: "Influenza-like illness visits, fall 2025",
  alt: "Weekly influenza-like illness visits from October 2025 to January 2026 rise from 12 to a peak of 104 in the week of 1 December, then fall to 21.",
  caption: "Illustrative data.",
});
