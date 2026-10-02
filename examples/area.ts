// Stacked areas: parts of a whole over time.
import { areaChart } from "enarratio/plot";

const activities = ["Research", "Teaching", "Service"] as const;
const hours = {
  Research: [22, 20, 18, 24, 26, 25],
  Teaching: [12, 14, 16, 10, 9, 12],
  Service: [6, 6, 7, 6, 5, 6],
};
const monthly = activities.flatMap((activity) =>
  hours[activity].map((h, i) => ({
    month: new Date(Date.UTC(2025, 8 + i, 1)),
    activity,
    hours: h,
  })),
);

export default areaChart({
  data: monthly,
  x: "month",
  y: "hours",
  series: "activity",
  xLabel: "Month",
  yLabel: "Hours per week",
  title: "Where the week goes",
  alt: "Stacked areas of weekly hours by activity from September 2025 to February 2026. Research is the largest share throughout, rising to 26 hours in January; teaching peaks at 16 hours in November; service stays near 6.",
  caption: "Illustrative data.",
});
