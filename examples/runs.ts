// Runs per day on a time axis: no pre-formatted labels, and quiet days stay in the picture.
import { barChart } from "enarratio/plot";

const sites = ["Austin", "Boston", "Chicago"] as const;
// A run is one row with a time. Enarratio puts each in its day and counts them; days with no
// runs (13 and 14 June) still get a slot.
const runs = Array.from({ length: 20 * 6 }, (_, i) => {
  const day = Math.floor(i / 6);
  const weekend = day % 7 === 4 || day % 7 === 5;
  return { day, hour: 6 + (i % 6) * 3, site: sites[(i + day) % 3] as string, weekend };
})
  .filter((r) => !r.weekend || r.hour === 6)
  .filter((r) => !(r.day === 4 || r.day === 5))
  .map((r) => ({
    at: new Date(Date.UTC(2026, 5, 9 + r.day, r.hour)).toISOString(),
    site: r.site,
  }));

export default barChart({
  id: "runs-per-day",
  data: runs,
  x: "at",
  xType: "time",
  interval: "day",
  series: "site",
  xLabel: "Day",
  yLabel: "Runs",
  title: "Analysis runs per day, by site",
  alt: "Analysis runs per day at three sites, 9 to 28 June 2026. Most days have six runs, two from each site. There are none on 13 and 14 June, and one run on each of 20, 21, 27 and 28 June.",
  caption: "Illustrative data. Every day between the first and last run has a bar slot.",
});
