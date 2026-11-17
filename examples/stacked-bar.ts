// Entries per year by type, counted from one row per entry: the CV's overview chart.
import { barChart } from "enarratio/plot";

const entries = [
  ...Array.from({ length: 3 }, () => ({ year: 2019, type: "Publications" })),
  { year: 2019, type: "Talks" },
  ...Array.from({ length: 4 }, () => ({ year: 2020, type: "Publications" })),
  { year: 2020, type: "Grants" },
  ...Array.from({ length: 2 }, () => ({ year: 2021, type: "Talks" })),
  ...Array.from({ length: 5 }, () => ({ year: 2021, type: "Publications" })),
  ...Array.from({ length: 6 }, () => ({ year: 2022, type: "Publications" })),
  ...Array.from({ length: 2 }, () => ({ year: 2022, type: "Grants" })),
  ...Array.from({ length: 3 }, () => ({ year: 2022, type: "Talks" })),
  ...Array.from({ length: 4 }, () => ({ year: 2023, type: "Publications" })),
  ...Array.from({ length: 4 }, () => ({ year: 2023, type: "Talks" })),
  ...Array.from({ length: 7 }, () => ({ year: 2024, type: "Publications" })),
  { year: 2024, type: "Grants" },
  ...Array.from({ length: 2 }, () => ({ year: 2024, type: "Talks" })),
];

// The busiest year, counted from the rows so the finding cannot drift from the data.
const perYear = new Map<number, number>();
for (const e of entries) perYear.set(e.year, (perYear.get(e.year) ?? 0) + 1);
const [busiest, busiestCount] = [...perYear].reduce((a, b) => (b[1] > a[1] ? b : a));

export default barChart({
  id: "entries-by-year",
  data: entries,
  x: "year",
  series: "type",
  seriesDomain: ["Publications", "Grants", "Talks"],
  directLabels: true,
  xLabel: "Year",
  yLabel: "Entries",
  title: "Entries per year",
  alt: `Stacked bars of CV entries per year from 2019 to 2024. Publications lead every year except 2023, when talks matched them; ${busiest} is the busiest year with ${busiestCount} entries.`,
  caption: "Illustrative data.",
  source: "Sample CV",
  byline: "Sample Lab",
});
