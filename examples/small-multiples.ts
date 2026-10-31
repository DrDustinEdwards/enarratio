// One line chart per region on shared scales, so panels compare by position.
import { smallMultiples } from "enarratio/plot";

const regions: Record<string, number[]> = {
  Northeast: [4, 6, 9, 15, 22, 18, 12, 8],
  Southeast: [7, 11, 16, 21, 19, 14, 10, 7],
  Midwest: [3, 4, 6, 10, 16, 23, 19, 13],
  Southwest: [5, 7, 8, 9, 11, 10, 9, 8],
  West: [2, 3, 5, 8, 12, 17, 21, 18],
  Northwest: [1, 2, 3, 5, 8, 12, 15, 16],
};
const weekly = Object.entries(regions).flatMap(([region, values]) =>
  values.map((rate, i) => ({ region, week: i + 1, rate })),
);

export default smallMultiples({
  chart: "line",
  data: weekly,
  facet: "region",
  x: "week",
  y: "rate",
  xLabel: "Week of season",
  yLabel: "Positivity (%)",
  title: "Influenza positivity by region",
  alt: "Six panels of weekly influenza positivity on shared scales: the Southeast peaks first, at 21% in week 4, the Northeast at 22% in week 5, the Midwest at 23% in week 6, and the West and Northwest last, near weeks 7 and 8; the Southwest stays flat near 10%.",
  caption: "Illustrative data.",
});
