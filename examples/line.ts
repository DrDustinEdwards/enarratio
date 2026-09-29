// Weekly counts over time, with a gap, a threshold and an event marker.
import { lineChart } from "enarratio";

const counties = ["Travis", "Hays", "Williamson"] as const;
const base = { Travis: 42, Hays: 18, Williamson: 27 };
const weekly = counties.flatMap((county) =>
  Array.from({ length: 16 }, (_, week) => {
    const wave = Math.round(base[county] * (1 + 0.9 * Math.exp(-(((week - 9) / 3) ** 2))));
    // Hays did not report in week 6: a gap, not a zero.
    const cases = county === "Hays" && week === 6 ? null : wave;
    return { week: new Date(Date.UTC(2025, 9, 6 + week * 7)), county, cases };
  }),
);

export default lineChart({
  id: "weekly-cases",
  data: weekly,
  x: "week",
  y: "cases",
  series: "county",
  xLabel: "Week starting",
  yLabel: "Positive tests",
  references: [{ y: 60, label: "Alert threshold" }],
  markers: [{ x: "2025-11-24", label: "Holiday" }],
  directLabels: true,
  title: "Weekly positive tests by county",
  alt: "Lines of weekly positive tests in three counties from October 2025 to January 2026. All three peak in the week of 8 December; Travis peaks near 80, above the alert threshold of 60, while Hays and Williamson stay below it. Hays did not report in the week of 17 November.",
  caption:
    "Illustrative data. Drag across the chart, or hold Shift with the arrow keys, to pick a range.",
});
