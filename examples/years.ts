// Selecting a year: bars filter by category, link to a filtered page without script, and thin their labels.
import { barChart } from "abscissa";

const types = ["Publications", "Grants", "Talks"] as const;
const entries = Array.from({ length: 22 }, (_, i) => 2005 + i).flatMap((year, i) =>
  types.flatMap((type, t) =>
    Array.from({ length: (i * (t + 2) + t * 3) % 5 }, () => ({ year, type })),
  ),
);

export default barChart({
  id: "entries-by-year-select",
  data: entries,
  x: "year",
  series: "type",
  seriesDomain: [...types],
  xDomain: Array.from({ length: 22 }, (_, i) => 2005 + i),
  filterBy: "x",
  href: (year) => `?year=${year}`,
  maxXTicks: 8,
  xLabel: "Year",
  yLabel: "Entries",
  title: "Entries per year, 2005 to 2026",
  alt: "Stacked bars of CV entries per year from 2005 to 2026, by type. Every year has between 3 and 12 entries, peaking at 12 every fifth year: 2007, 2012, 2017 and 2022.",
  caption:
    "Illustrative data. Clicking a bar selects its year; with scripts off, each bar links to that year.",
});
