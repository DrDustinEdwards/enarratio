// One bar chart per clinic on a shared scale, stacked by visit type.
import { smallMultiples } from "enarratio/plot";

const rows: [string, string, number, number][] = [
  ["North", "Q1", 120, 40],
  ["North", "Q2", 135, 52],
  ["North", "Q3", 128, 61],
  ["North", "Q4", 150, 70],
  ["Central", "Q1", 210, 35],
  ["Central", "Q2", 198, 41],
  ["Central", "Q3", 205, 44],
  ["Central", "Q4", 220, 48],
  ["South", "Q1", 80, 72],
  ["South", "Q2", 92, 88],
  ["South", "Q3", 101, 97],
  ["South", "Q4", 110, 115],
];
const visits = rows.flatMap(([clinic, quarter, inPerson, video]) => [
  { clinic, quarter, type: "In person", visits: inPerson },
  { clinic, quarter, type: "Video", visits: video },
]);

export default smallMultiples({
  chart: "bar",
  data: visits,
  facet: "clinic",
  x: "quarter",
  y: "visits",
  series: "type",
  xLabel: null,
  yLabel: "Visits",
  title: "Clinic visits by quarter",
  alt: "Three panels of quarterly visits on a shared scale: Central is busiest, about 250 a quarter, nearly all in person; North grows from 160 to 220 with video rising; South grows from 152 to 225, with video overtaking in-person visits in the fourth quarter.",
  caption: "Illustrative data.",
});
