// A table with an inline bar, heat cells and a sparkline in every row.
import { tableChart } from "enarratio";

const sites = [
  { site: "Asheville", tests: 1840, positivity: 8.2, change: 1.4, weeks: [5, 6, 6, 7, 8, 8.2] },
  { site: "Charlotte", tests: 5120, positivity: 11.6, change: 2.9, weeks: [7, 8, 9, 10, 11, 11.6] },
  {
    site: "Durham",
    tests: 3310,
    positivity: 9.1,
    change: -0.8,
    weeks: [10, 10.4, 9.9, 9.6, 9.3, 9.1],
  },
  {
    site: "Greensboro",
    tests: 2470,
    positivity: 6.4,
    change: -1.6,
    weeks: [8.2, 8, 7.4, 7, 6.8, 6.4],
  },
  {
    site: "Wilmington",
    tests: 1290,
    positivity: 4.9,
    change: 0.3,
    weeks: [4.5, 4.6, 4.4, 4.8, 4.7, 4.9],
  },
];

export default tableChart({
  data: sites,
  columns: [
    { field: "site", label: "Site" },
    { field: "tests", label: "Tests", kind: "bar" },
    { field: "positivity", label: "Positivity (%)", kind: "heat" },
    { field: "change", label: "Change (points)", kind: "bar" },
    { field: "weeks", label: "Last six weeks", kind: "sparkline" },
  ],
  title: "Testing by site this week",
  alt: "Testing at five sites this week: Charlotte runs the most tests, 5,120, and has the highest positivity, 11.6%, up 2.9 points; Wilmington has the lowest, 4.9%; positivity fell at Durham and Greensboro.",
  caption: "Illustrative data. Every cell prints its value; bars and colors repeat it.",
});
